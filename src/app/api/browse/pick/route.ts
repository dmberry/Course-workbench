import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
      resolve(stdout.trim());
    });
    child.on("error", reject);
  });
}

/**
 * POST /api/browse/pick
 * Opens the native macOS folder picker dialog.
 * Body: { mode: "open" | "new", name?: string }
 *   - "open": shows the standard folder picker
 *   - "new": creates a new folder with the given name inside the picked location
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode || "open";

    const prompt = mode === "new"
      ? "Choose where to create the workspace folder"
      : "Choose your workspace folder";

    // Open native macOS folder picker
    let picked: string;
    try {
      picked = await runOsascript(
        `POSIX path of (choose folder with prompt "${prompt}")`
      );
    } catch {
      // User cancelled the dialog
      return NextResponse.json({ ok: false, cancelled: true });
    }

    // Remove trailing slash
    picked = picked.replace(/\/$/, "");

    if (mode === "new") {
      const name = (body.name || "").trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, error: "Name is required for new workspace" },
          { status: 400 }
        );
      }
      const newPath = join(picked, name);
      if (!existsSync(newPath)) {
        mkdirSync(newPath, { recursive: true });
      }
      return NextResponse.json({ ok: true, path: newPath });
    }

    return NextResponse.json({ ok: true, path: picked });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to open folder picker" },
      { status: 500 }
    );
  }
}
