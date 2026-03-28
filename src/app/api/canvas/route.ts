// Canvas API route: handles pull, push, status, and attach-rubric operations.
// Rewritten to use the native TypeScript Canvas library (no external Python CLI).

import { NextRequest, NextResponse } from "next/server";
import { pullCourse } from "@/lib/canvas/pull";
import { pushFile, pushModule } from "@/lib/canvas/push";
import { pushRubricFile, attachRubric } from "@/lib/canvas/rubrics";
import { getStatus } from "@/lib/canvas/status";
import { loadCanvasConfig, getContentRoot, getCourseFolder, parseCourseInfo } from "@/lib/canvas/config";
import { listCourses, listModules } from "@/lib/canvas/client";
import { slugify } from "@/lib/canvas/utils";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PullOptions } from "@/lib/canvas/types";

export const runtime = "nodejs";

interface CanvasRunRequest {
  action: "pull" | "push" | "status" | "attach-rubric" | "list-courses" | "list-modules" | "check-exists";

  // Pull options
  courseId?: string;
  moduleName?: string;
  pageName?: string;
  assignmentName?: string;
  discussionName?: string;
  includeRubrics?: boolean;
  submissions?: "all" | "ungraded" | "none";
  includeDiscussions?: boolean;

  // Push options
  filePath?: string;
  dryRun?: boolean;

  // Attach-rubric options
  rubricName?: string;
  assignmentNames?: string[];
  useForGrading?: boolean;

  // List options
  year?: string;

  // Shared
  contentRoot?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CanvasRunRequest;

    if (!body?.action) {
      return NextResponse.json(
        { ok: false, error: "Missing action field" },
        { status: 400 }
      );
    }

    const config = loadCanvasConfig();
    const contentRoot = body.contentRoot || getContentRoot(config);

    // ==================== Pull ====================
    if (body.action === "pull") {
      if (!body.courseId?.trim()) {
        return NextResponse.json(
          { ok: false, error: "courseId is required for pull" },
          { status: 400 }
        );
      }

      const options: PullOptions = {
        courseId: body.courseId.trim(),
        moduleName: body.moduleName?.trim() || undefined,
        pageName: body.pageName?.trim() || undefined,
        assignmentName: body.assignmentName?.trim() || undefined,
        discussionName: body.discussionName?.trim() || undefined,
        includeRubrics: body.includeRubrics,
        submissions: body.submissions || "none",
        includeDiscussions: body.includeDiscussions,
        contentRoot,
      };

      const result = await pullCourse(options);
      return NextResponse.json({ ok: result.success, ...result });
    }

    // ==================== Push ====================
    if (body.action === "push") {
      const dryRun = Boolean(body.dryRun);

      if (body.filePath?.trim()) {
        const filePath = body.filePath.trim();

        // Detect rubric files (YAML in rubrics directory)
        if (filePath.endsWith(".yaml") && filePath.includes("rubrics")) {
          const result = await pushRubricFile(filePath, dryRun);
          return NextResponse.json({ ok: result.success, ...result });
        }

        const result = await pushFile(filePath, dryRun);
        return NextResponse.json({ ok: result.success, ...result });
      }

      if (body.moduleName?.trim()) {
        const result = await pushModule(
          body.moduleName.trim(),
          contentRoot,
          dryRun
        );
        return NextResponse.json({ ok: result.success, ...result });
      }

      return NextResponse.json(
        { ok: false, error: "For push, provide filePath or moduleName" },
        { status: 400 }
      );
    }

    // ==================== Status ====================
    if (body.action === "status") {
      const report = await getStatus(contentRoot);
      return NextResponse.json({ ok: true, ...report });
    }

    // ==================== Attach Rubric ====================
    if (body.action === "attach-rubric") {
      if (!body.courseId?.trim()) {
        return NextResponse.json(
          { ok: false, error: "courseId is required for attach-rubric" },
          { status: 400 }
        );
      }
      if (!body.rubricName?.trim()) {
        return NextResponse.json(
          { ok: false, error: "rubricName is required for attach-rubric" },
          { status: 400 }
        );
      }
      if (
        !body.assignmentNames ||
        body.assignmentNames.length === 0
      ) {
        return NextResponse.json(
          { ok: false, error: "assignmentNames is required for attach-rubric" },
          { status: 400 }
        );
      }

      const result = await attachRubric(
        body.courseId.trim(),
        body.rubricName.trim(),
        body.assignmentNames,
        body.useForGrading !== false,
        Boolean(body.dryRun)
      );
      return NextResponse.json({ ok: result.success, ...result });
    }

    // ==================== List Courses ====================
    if (body.action === "list-courses") {
      const courses = await listCourses();

      const year = body.year?.trim();

      // Build search variants: "2025" → also match "25/26", "24/25", "25-26", "24-25"
      const yearVariants: string[] = [];
      if (year) {
        yearVariants.push(year);
        const short = year.slice(2);
        const prev = String(Number(short) - 1).padStart(2, "0");
        const next = String(Number(short) + 1).padStart(2, "0");
        yearVariants.push(`${prev}/${short}`, `${short}/${next}`);
        yearVariants.push(`${prev}-${short}`, `${short}-${next}`);
      }

      const filtered = year
        ? courses.filter((c) => {
            const text = `${c.name || ""} ${c.course_code || ""}`;
            return yearVariants.some((v) => text.includes(v));
          })
        : courses;

      filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      return NextResponse.json({
        ok: true,
        courses: filtered.map((c) => ({
          id: c.id,
          name: c.name,
          course_code: c.course_code,
        })),
      });
    }

    // ==================== List Modules ====================
    if (body.action === "list-modules") {
      if (!body.courseId?.trim()) {
        return NextResponse.json(
          { ok: false, error: "courseId is required for list-modules" },
          { status: 400 }
        );
      }
      const modules = await listModules(body.courseId.trim());
      modules.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      return NextResponse.json({
        ok: true,
        modules: modules.map((m) => ({
          id: m.id,
          name: m.name,
          position: m.position,
          published: m.published,
        })),
      });
    }

    // ==================== Check Exists ====================
    if (body.action === "check-exists") {
      if (!body.courseId?.trim()) {
        return NextResponse.json(
          { ok: false, error: "courseId is required for check-exists" },
          { status: 400 }
        );
      }

      // Figure out where this course would be stored
      const courseName = body.moduleName || "";
      const courseCode = "";
      const courseFolder = getCourseFolder(courseCode, courseName, config);
      const courseDir = join(contentRoot, courseFolder);

      // If a module name is provided, check for that specific module dir
      if (body.moduleName?.trim()) {
        const moduleSlug = slugify(body.moduleName.trim());
        const moduleDir = join(courseDir, moduleSlug);
        const exists = existsSync(moduleDir);
        return NextResponse.json({ ok: true, exists, path: moduleDir });
      }

      const exists = existsSync(courseDir);
      return NextResponse.json({ ok: true, exists, path: courseDir });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${body.action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unknown Canvas API error",
      },
      { status: 500 }
    );
  }
}
