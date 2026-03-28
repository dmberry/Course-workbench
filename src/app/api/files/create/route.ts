// Create a new project folder.
// POST /api/files/create { name: string, parent: string }

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import nodePath from "node:path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; parent?: string };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "name is required" },
        { status: 400 }
      );
    }

    const parent = body.parent?.trim() || nodePath.join(
      process.env.HOME || "/tmp",
      "Documents"
    );
    const projectPath = nodePath.join(parent, body.name.trim());

    // Create the directory (and parents) if it doesn't exist
    await fs.mkdir(projectPath, { recursive: true });

    return NextResponse.json({ ok: true, path: projectPath });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create folder",
      },
      { status: 500 }
    );
  }
}
