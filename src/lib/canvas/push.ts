// Push local content back to Canvas LMS.
// Ported from canvas-cli-for-codex cli.py push command.

import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import matter from "gray-matter";

import {
  updatePage,
  updateAssignment,
  updateDiscussionTopic,
  listDiscussionTopics,
} from "./client";
import { markdownToHtml } from "./converters";
import { pushRubricFile } from "./rubrics";
import type { CourseMeta, PushResult } from "./types";

// ==================== File Parsing ====================

/**
 * Parse a markdown file with YAML frontmatter.
 * Returns the frontmatter as a record and the body as a string.
 */
export function parseMarkdownFile(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const parsed = matter(content);
  const frontmatter =
    parsed.data && typeof parsed.data === "object"
      ? (parsed.data as Record<string, unknown>)
      : {};
  return { frontmatter, body: parsed.content.trim() };
}

/**
 * Find _course.yaml by walking up from a file path.
 * Ported from Python cli.py find_course_meta().
 */
export async function findCourseMeta(filePath: string): Promise<CourseMeta> {
  const dir = path.dirname(filePath);

  // Try parent.parent first (for files in subdirectories like pages/, assignments/)
  const candidates = [
    path.join(dir, "..", "_course.yaml"),
    path.join(dir, "_course.yaml"),
  ];

  // Also walk up further
  let current = path.dirname(dir);
  for (let i = 0; i < 5; i++) {
    candidates.push(path.join(current, "_course.yaml"));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const candidate of candidates) {
    try {
      const text = await fs.readFile(candidate, "utf8");
      return YAML.parse(text) as CourseMeta;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Cannot find _course.yaml for ${filePath}. Pull the course first to create local metadata.`
  );
}

/**
 * Detect content type from frontmatter fields.
 * Ported from Python cli.py push_file() detection logic.
 */
export function detectContentType(
  frontmatter: Record<string, unknown>
): "page" | "assignment" | "discussion" | "unknown" {
  if ("canvas_url" in frontmatter) {
    return "page";
  }

  const submissionTypes = frontmatter.submission_types as string[] | undefined;
  if (submissionTypes && submissionTypes.includes("discussion_topic")) {
    return "discussion";
  }

  if ("submission_types" in frontmatter || "points_possible" in frontmatter) {
    return "assignment";
  }

  return "unknown";
}

// ==================== Push Functions ====================

/**
 * Push a single markdown file to Canvas.
 */
export async function pushFile(
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
    const content = await fs.readFile(filePath, "utf8");
    const { frontmatter, body } = parseMarkdownFile(content);

    if (!("canvas_id" in frontmatter)) {
      result.errors.push(`Skipping ${path.basename(filePath)}: no canvas_id in frontmatter`);
      return result;
    }

    const courseMeta = await findCourseMeta(filePath);
    const courseId = String(courseMeta.canvas_id);
    const bodyHtml = markdownToHtml(body);
    const contentType = detectContentType(frontmatter);
    const title = (frontmatter.title as string) || path.basename(filePath);

    if (contentType === "page") {
      result.items.push({
        type: "page",
        name: title,
        action: dryRun ? "would update" : "updated",
      });
      if (!dryRun) {
        await updatePage(courseId, frontmatter.canvas_url as string, {
          body: bodyHtml,
        });
      }
      result.itemsPushed++;
    } else if (contentType === "discussion") {
      // Find discussion topic ID from assignment ID
      const assignmentId = frontmatter.canvas_id as number;
      let topicId: number | null =
        (frontmatter.discussion_topic_id as number) || null;

      if (!topicId) {
        const topics = await listDiscussionTopics(courseId);
        for (const topic of topics) {
          if (topic.assignment_id === assignmentId) {
            topicId = topic.id;
            break;
          }
        }
      }

      if (!topicId) {
        result.errors.push(
          `Could not find discussion topic for assignment ${assignmentId}`
        );
        result.success = false;
        return result;
      }

      const updateData: Record<string, unknown> = { message: bodyHtml };
      if (frontmatter.title) {
        updateData.title = frontmatter.title;
      }

      result.items.push({
        type: "discussion",
        name: title,
        action: dryRun ? "would update" : "updated",
      });
      if (!dryRun) {
        await updateDiscussionTopic(courseId, topicId, updateData);
      }
      result.itemsPushed++;
    } else if (contentType === "assignment") {
      const updateData: Record<string, unknown> = { description: bodyHtml };
      if (frontmatter.due_at) updateData.due_at = frontmatter.due_at;
      if (frontmatter.points_possible)
        updateData.points_possible = frontmatter.points_possible;

      result.items.push({
        type: "assignment",
        name: title,
        action: dryRun ? "would update" : "updated",
      });
      if (!dryRun) {
        await updateAssignment(
          courseId,
          frontmatter.canvas_id as number,
          updateData
        );
      }
      result.itemsPushed++;
    } else {
      result.errors.push(
        `Unknown content type for ${path.basename(filePath)} - skipping`
      );
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
 * Push all markdown files in a module directory to Canvas.
 */
export async function pushModule(
  moduleName: string,
  contentRoot: string,
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
    // Search for matching module directory
    const entries = await fs.readdir(contentRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const coursePath = path.join(contentRoot, entry.name);

      const courseEntries = await fs.readdir(coursePath, {
        withFileTypes: true,
      });
      for (const subEntry of courseEntries) {
        if (
          !subEntry.isDirectory() ||
          !subEntry.name.toLowerCase().includes(moduleName.toLowerCase())
        ) {
          continue;
        }

        const moduleDir = path.join(coursePath, subEntry.name);
        const files = await fs.readdir(moduleDir);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;
          const filePath = path.join(moduleDir, file);

          // Detect rubric files
          if (
            file.endsWith(".yaml") &&
            filePath.includes("rubrics")
          ) {
            const rubricResult = await pushRubricFile(filePath, dryRun);
            result.items.push(...rubricResult.items);
            result.errors.push(...rubricResult.errors);
            result.itemsPushed += rubricResult.itemsPushed;
          } else {
            const fileResult = await pushFile(filePath, dryRun);
            result.items.push(...fileResult.items);
            result.errors.push(...fileResult.errors);
            result.itemsPushed += fileResult.itemsPushed;
            if (!fileResult.success) result.success = false;
          }
        }
        return result;
      }
    }

    result.errors.push(`Module directory not found: ${moduleName}`);
    result.success = false;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : String(error)
    );
  }

  return result;
}
