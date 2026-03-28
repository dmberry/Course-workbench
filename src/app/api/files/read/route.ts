// File read API: reads and parses a single file.
// GET /api/files/read?path=...

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import nodePath from "node:path";
import matter from "gray-matter";
import { markdownToHtml } from "@/lib/canvas/converters";
import type { FileContent } from "@/types/workbench";

export const runtime = "nodejs";

function detectFileType(
  filePath: string,
  frontmatter: Record<string, unknown>
): FileContent["fileType"] {
  const name = nodePath.basename(filePath);
  const dir = nodePath.dirname(filePath);

  if (name === "_course.yaml") return "course-meta";
  if (name === "_module.yaml") return "module-meta";
  if (name.endsWith(".yaml") && dir.includes("rubrics")) return "rubric";
  if (dir.includes("submissions")) return "submission";

  // Detect from frontmatter
  if ("canvas_url" in frontmatter) return "page";
  const submissionTypes = frontmatter.submission_types as string[] | undefined;
  if (submissionTypes && submissionTypes.includes("discussion_topic"))
    return "discussion";
  if ("submission_types" in frontmatter || "points_possible" in frontmatter)
    return "assignment";

  return "page";
}

export async function GET(req: NextRequest) {
  try {
    const filePath = req.nextUrl.searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { ok: false, error: "path parameter is required" },
        { status: 400 }
      );
    }

    const resolved = nodePath.resolve(filePath);
    if (!nodePath.isAbsolute(resolved)) {
      return NextResponse.json(
        { ok: false, error: "Path must be absolute" },
        { status: 400 }
      );
    }

    const raw = await fs.readFile(filePath, "utf8");
    const name = nodePath.basename(filePath);

    // YAML files: return as structured data, no markdown body
    if (filePath.endsWith(".yaml")) {
      const { default: YAML } = await import("yaml");
      const parsed = YAML.parse(raw) || {};
      const file: FileContent = {
        path: filePath,
        name,
        raw,
        frontmatter: parsed,
        body: "",
        html: "",
        fileType: detectFileType(filePath, parsed),
      };
      return NextResponse.json({ ok: true, file });
    }

    // Markdown files: parse frontmatter + render HTML
    const parsed = matter(raw);
    const frontmatter =
      parsed.data && typeof parsed.data === "object"
        ? (parsed.data as Record<string, unknown>)
        : {};
    const body = parsed.content.trim();
    const html = markdownToHtml(body);

    const file: FileContent = {
      path: filePath,
      name,
      raw,
      frontmatter,
      body,
      html,
      fileType: detectFileType(filePath, frontmatter),
    };

    return NextResponse.json({ ok: true, file });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      },
      { status: 500 }
    );
  }
}
