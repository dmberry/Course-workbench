// File management API: delete, rename, mkdir.
// POST /api/files/manage { action, path, ... }

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import nodePath from "node:path";

export const runtime = "nodejs";

interface ManageRequest {
  action: "delete" | "rename" | "mkdir";
  path?: string;
  oldPath?: string;
  newPath?: string;
}

function validateAbsolute(p: string): string | null {
  const resolved = nodePath.resolve(p);
  if (!nodePath.isAbsolute(resolved)) return null;
  return resolved;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ManageRequest;

    if (!body?.action) {
      return NextResponse.json(
        { ok: false, error: "Missing action field" },
        { status: 400 }
      );
    }

    // ==================== Delete ====================
    if (body.action === "delete") {
      if (!body.path) {
        return NextResponse.json(
          { ok: false, error: "path is required for delete" },
          { status: 400 }
        );
      }
      const resolved = validateAbsolute(body.path);
      if (!resolved) {
        return NextResponse.json(
          { ok: false, error: "Path must be absolute" },
          { status: 400 }
        );
      }

      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        await fs.rm(resolved, { recursive: true, force: true });
      } else {
        await fs.unlink(resolved);
      }
      return NextResponse.json({ ok: true });
    }

    // ==================== Rename ====================
    if (body.action === "rename") {
      if (!body.oldPath || !body.newPath) {
        return NextResponse.json(
          { ok: false, error: "oldPath and newPath are required for rename" },
          { status: 400 }
        );
      }
      const resolvedOld = validateAbsolute(body.oldPath);
      const resolvedNew = validateAbsolute(body.newPath);
      if (!resolvedOld || !resolvedNew) {
        return NextResponse.json(
          { ok: false, error: "Paths must be absolute" },
          { status: 400 }
        );
      }

      // Check target doesn't already exist
      try {
        await fs.access(resolvedNew);
        return NextResponse.json(
          { ok: false, error: "A file or folder with that name already exists" },
          { status: 409 }
        );
      } catch {
        // Target doesn't exist — good
      }

      await fs.rename(resolvedOld, resolvedNew);
      return NextResponse.json({ ok: true, newPath: resolvedNew });
    }

    // ==================== Mkdir ====================
    if (body.action === "mkdir") {
      if (!body.path) {
        return NextResponse.json(
          { ok: false, error: "path is required for mkdir" },
          { status: 400 }
        );
      }
      const resolved = validateAbsolute(body.path);
      if (!resolved) {
        return NextResponse.json(
          { ok: false, error: "Path must be absolute" },
          { status: 400 }
        );
      }

      await fs.mkdir(resolved, { recursive: true });
      return NextResponse.json({ ok: true, path: resolved });
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
          error instanceof Error ? error.message : "File operation failed",
      },
      { status: 500 }
    );
  }
}
