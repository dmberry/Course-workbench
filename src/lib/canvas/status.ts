// Status reporting: scan local files and report sync state.
// Ported from canvas-cli-for-codex cli.py status command.

import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

import type { StatusReport, CourseStatus } from "./types";

/**
 * Recursively glob for files matching a pattern within a directory.
 */
async function globFiles(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Recursively find all directories containing _course.yaml up to a given depth.
 */
async function findCourseDirs(dir: string, maxDepth: number): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      const metaPath = path.join(full, "_course.yaml");
      try {
        await fs.access(metaPath);
        results.push(full);
      } catch {
        // No _course.yaml here — keep searching deeper
        await walk(full, depth + 1);
      }
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Scan the content root and report sync status for each course.
 * Searches up to 3 levels deep for _course.yaml files, handling
 * intermediate directories like courses/ or subject folders.
 *
 * Ported from Python cli.py status command.
 */
export async function getStatus(contentRoot: string): Promise<StatusReport> {
  const report: StatusReport = { courses: [] };

  const courseDirs = await findCourseDirs(contentRoot, 3);

  for (const coursePath of courseDirs) {
    const courseMetaPath = path.join(coursePath, "_course.yaml");

    let meta: { canvas_id?: number; name?: string; level?: number } = {};
    try {
      const text = await fs.readFile(courseMetaPath, "utf8");
      meta = YAML.parse(text) || {};
    } catch {
      continue;
    }

    const allMd = await globFiles(coursePath, ".md");
    const rubrics = await globFiles(
      path.join(coursePath, "rubrics"),
      ".yaml"
    );
    const submissions = await globFiles(
      path.join(coursePath, "submissions"),
      ".md"
    );

    // Pages/assignments = all .md files minus submissions
    const submissionSet = new Set(submissions);
    const pagesAndAssignments = allMd.filter((f) => !submissionSet.has(f));

    const dirName = path.basename(coursePath);
    const courseStatus: CourseStatus = {
      name: meta.name || dirName,
      path: coursePath,
      canvasId: meta.canvas_id || 0,
      pages: pagesAndAssignments.length,
      assignments: 0,
      rubrics: rubrics.length,
      submissions: submissions.length,
      level: meta.level,
    };

    report.courses.push(courseStatus);
  }

  return report;
}
