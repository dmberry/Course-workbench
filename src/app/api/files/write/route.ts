// File write API: saves content back to disk.
// POST /api/files/write { path: string, content: string }

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import nodePath from "node:path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { path?: string; content?: string };

    if (!body.path || typeof body.content !== "string") {
      return NextResponse.json(
        { ok: false, error: "path and content are required" },
        { status: 400 }
      );
    }

    const resolved = nodePath.resolve(body.path);
    if (!nodePath.isAbsolute(resolved)) {
      return NextResponse.json(
        { ok: false, error: "Path must be absolute" },
        { status: 400 }
      );
    }

    await fs.writeFile(resolved, body.content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write file",
      },
      { status: 500 }
    );
  }
}
