// File tree API: returns the directory structure for the sidebar.
// GET /api/files?root=...

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadCanvasConfig, getContentRoot } from "@/lib/canvas/config";
import type { FileTreeNode } from "@/types/workbench";

export const runtime = "nodejs";

const MAX_DEPTH = 5;

function detectFileType(
  name: string,
  parentDir: string
): FileTreeNode["fileType"] {
  if (name === "_course.yaml") return "course-meta";
  if (name === "_module.yaml") return "module-meta";
  if (name.endsWith(".yaml") && parentDir.includes("rubrics")) return "rubric";
  if (parentDir.includes("submissions")) return "submission";
  // Default .md files as pages; further classification happens at read time
  if (name.endsWith(".md")) return "page";
  return "unknown";
}

async function walkDirectory(
  dir: string,
  depth: number
): Promise<FileTreeNode[]> {
  if (depth > MAX_DEPTH) return [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileTreeNode[] = [];
  const files: FileTreeNode[] = [];

  for (const entry of entries) {
    // Skip hidden files/dirs and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const children = await walkDirectory(fullPath, depth + 1);
      dirs.push({
        name: entry.name,
        path: fullPath,
        type: "directory",
        children,
      });
    } else {
      files.push({
        name: entry.name,
        path: fullPath,
        type: "file",
        fileType: detectFileType(entry.name, dir),
      });
    }
  }

  // Sort: directories first (alphabetically), then files (alphabetically)
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export async function GET(req: NextRequest) {
  try {
    const config = loadCanvasConfig();
    const defaultRoot = getContentRoot(config);
    const root = req.nextUrl.searchParams.get("root") || defaultRoot;
    const resolved = path.resolve(root);

    // Basic safety: must be absolute
    if (!path.isAbsolute(resolved)) {
      return NextResponse.json(
        { ok: false, error: "Path must be absolute" },
        { status: 400 }
      );
    }

    const tree = await walkDirectory(resolved, 0);
    return NextResponse.json({ ok: true, root: resolved, tree });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read directory",
      },
      { status: 500 }
    );
  }
}
