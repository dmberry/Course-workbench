// Rubric management: YAML read/write, format conversion, attach to assignments.
// Ported from canvas-cli-for-codex cli.py rubric functions.

import { promises as fs } from "node:fs";
import YAML from "yaml";

import {
  createRubric,
  updateRubric,
  listRubrics,
  listAssignments,
  attachRubricToAssignment,
} from "./client";
import { findCourseMeta } from "./push";
import { matchesName } from "./utils";
import type { LocalRubric, PushResult } from "./types";

/**
 * Convert local rubric YAML format to Canvas API format.
 *
 * Canvas expects criteria as indexed dict, not array:
 * {"0": {...}, "1": {...}} instead of [{...}, {...}]
 *
 * Ported from Python cli.py convert_rubric_to_canvas_format().
 */
export function convertRubricToCanvasFormat(
  rubricData: LocalRubric
): Record<string, unknown> {
  const criteria: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < (rubricData.criteria || []).length; i++) {
    const criterion = rubricData.criteria[i];
    const ratings: Record<string, Record<string, unknown>> = {};

    for (let j = 0; j < (criterion.ratings || []).length; j++) {
      const rating = criterion.ratings[j];
      const ratingData: Record<string, unknown> = {
        description: rating.description || "",
        long_description: rating.long_description || "",
        points: rating.points || 0,
      };
      if (rating.id) ratingData.id = rating.id;
      ratings[String(j)] = ratingData;
    }

    const critData: Record<string, unknown> = {
      description: criterion.title || "",
      long_description: criterion.description || "",
      points: criterion.points || 0,
      ratings,
    };
    if (criterion.id) critData.id = criterion.id;
    criteria[String(i)] = critData;
  }

  return {
    title: rubricData.title,
    points_possible: rubricData.points_possible,
    criteria,
  };
}

/**
 * Convert Canvas API rubric format to local YAML format.
 */
export function convertCanvasRubricToLocal(rubric: {
  id: number;
  title: string;
  points_possible?: number;
  data?: Array<{
    id: string;
    title?: string;
    description?: string;
    long_description?: string;
    points: number;
    ratings: Array<{
      id: string;
      description: string;
      long_description?: string;
      points: number;
    }>;
  }>;
}): LocalRubric {
  return {
    canvas_id: rubric.id,
    title: rubric.title,
    points_possible: rubric.points_possible,
    criteria: (rubric.data || []).map((criterion) => ({
      id: criterion.id,
      title: criterion.title || criterion.description || "",
      description: criterion.long_description,
      points: criterion.points,
      ratings: (criterion.ratings || []).map((rating) => ({
        id: rating.id,
        description: rating.description,
        long_description: rating.long_description,
        points: rating.points,
      })),
    })),
  };
}

/**
 * Push a rubric YAML file to Canvas. Creates or updates based on canvas_id.
 *
 * If canvas_id is null, creates a new rubric and updates the local file
 * with the returned canvas_id.
 *
 * Ported from Python cli.py push_rubric_file().
 */
export async function pushRubricFile(
  filePath: string,
  dryRun: boolean = false
): Promise<PushResult> {
  const result: PushResult = {
    success: true,
    itemsPushed: 0,
    errors: [],
    dryRun,
    items: [],
  };

  try {
    const text = await fs.readFile(filePath, "utf8");
    const rubricData = YAML.parse(text) as LocalRubric;
    const rubricId = rubricData.canvas_id;
    const isNew = rubricId === null || rubricId === undefined;

    const courseMeta = await findCourseMeta(filePath);
    const courseId = String(courseMeta.canvas_id);
    const canvasFormat = convertRubricToCanvasFormat(rubricData);
    const action = isNew ? "create" : "update";

    result.items.push({
      type: "rubric",
      name: rubricData.title || filePath,
      action: dryRun ? `would ${action}` : `${action}d`,
    });

    if (!dryRun) {
      if (isNew) {
        const created = (await createRubric(courseId, canvasFormat)) as unknown as Record<
          string,
          unknown
        >;
        const newId =
          (created.rubric as Record<string, unknown>)?.id || created.id;
        if (newId) {
          rubricData.canvas_id = newId as number;
          await fs.writeFile(filePath, YAML.stringify(rubricData), "utf8");
        }
      } else {
        await updateRubric(courseId, rubricId, canvasFormat);
      }
      result.itemsPushed++;
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : String(error)
    );
  }

  return result;
}

/**
 * Attach a rubric to one or more assignments by name.
 *
 * Ported from Python cli.py attach_rubric command.
 */
export async function attachRubric(
  courseId: string,
  rubricName: string,
  assignmentNames: string[],
  useForGrading: boolean = true,
  dryRun: boolean = false
): Promise<PushResult> {
  const result: PushResult = {
    success: true,
    itemsPushed: 0,
    errors: [],
    dryRun,
    items: [],
  };

  try {
    // Resolve rubric
    let rubricId: number | null = null;
    const rubricIdNum = Number(rubricName);
    if (!isNaN(rubricIdNum)) {
      rubricId = rubricIdNum;
    } else {
      const rubrics = await listRubrics(courseId);
      for (const rubric of rubrics) {
        if (rubricName.toLowerCase().includes((rubric.title || "").toLowerCase()) ||
            (rubric.title || "").toLowerCase().includes(rubricName.toLowerCase())) {
          rubricId = rubric.id;
          break;
        }
      }
    }

    if (rubricId === null) {
      result.errors.push(`Rubric not found: ${rubricName}`);
      result.success = false;
      return result;
    }

    // Get all assignments for matching
    const assignments = await listAssignments(courseId);

    for (const searchName of assignmentNames) {
      const matched = assignments.find((a) =>
        matchesName(searchName, a.name || "")
      );

      if (!matched) {
        result.errors.push(`Assignment not found: ${searchName}`);
        continue;
      }

      result.items.push({
        type: "rubric-attachment",
        name: matched.name,
        action: dryRun ? "would attach" : "attached",
      });

      if (!dryRun) {
        try {
          await attachRubricToAssignment(
            courseId,
            rubricId,
            matched.id,
            useForGrading
          );
          result.itemsPushed++;
        } catch (error) {
          result.errors.push(
            `Error attaching to ${matched.name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : String(error)
    );
  }

  return result;
}
