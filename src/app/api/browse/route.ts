import { NextRequest, NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const home = homedir();
  let rawPath = request.nextUrl.searchParams.get("path") || home;

  // Expand ~ to home directory
  if (rawPath === "~") rawPath = home;
  else if (rawPath.startsWith("~/")) rawPath = join(home, rawPath.slice(2));

  const path = resolve(rawPath);

  // Security: only allow absolute paths under home or /Users or /home
  if (!path.startsWith(home) && !path.startsWith("/Users") && !path.startsWith("/home")) {
    return NextResponse.json(
      { ok: false, error: "Access denied" },
      { status: 403 }
    );
  }

  if (!existsSync(path)) {
    return NextResponse.json(
      { ok: false, error: "Path does not exist" },
      { status: 404 }
    );
  }

  try {
    const entries = await readdir(path, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.name,
        path: join(path, e.name),
      }));

    // Allow navigating up until we hit /Users (macOS) or /home (Linux)
    const stopAt = path.startsWith("/Users") ? "/Users" : "/home";
    const parent = path !== stopAt && path !== home
      ? resolve(path, "..")
      : null;

    return NextResponse.json({
      ok: true,
      current: path,
      parent,
      entries: dirs,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cannot read directory" },
      { status: 500 }
    );
  }
}
