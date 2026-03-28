// Settings API: read and update Canvas configuration.
// GET  /api/settings — returns current settings (token masked)
// POST /api/settings — updates settings

import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

export const runtime = "nodejs";

const CONFIG_PATH = join(process.cwd(), ".canvas-config.yaml");
const MD_CONFIG_PATH = join(process.cwd(), "canvas-config.local.md");

function loadCurrentConfig(): Record<string, unknown> {
  // Try YAML first
  if (existsSync(CONFIG_PATH)) {
    try {
      return YAML.parse(readFileSync(CONFIG_PATH, "utf8")) || {};
    } catch {
      // Fall through
    }
  }

  // Try MD config
  if (existsSync(MD_CONFIG_PATH)) {
    try {
      const text = readFileSync(MD_CONFIG_PATH, "utf8");
      const result: Record<string, string> = {};
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/^[\s>*-]+/, "").trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^([A-Z0-9_]+)\s*:\s*(.+)$/);
        if (!m) continue;
        result[m[1]] = m[2].trim().replace(/^[`"']|[`"']$/g, "");
      }
      return {
        canvas_url: result.CANVAS_BASE_URL || "",
        api_token: result.CANVAS_API_TOKEN || "",
        content_root: result.CONTENT_ROOT || "",
      };
    } catch {
      // Fall through
    }
  }

  return {};
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return token ? "****" : "";
  return token.slice(0, 4) + "..." + token.slice(-4);
}

export async function GET() {
  const config = loadCurrentConfig();
  return NextResponse.json({
    ok: true,
    settings: {
      canvas_url: (config.canvas_url as string) || "",
      api_token_masked: maskToken((config.api_token as string) || ""),
      has_token: Boolean(config.api_token),
      content_root: (config.content_root as string) || "",
      default_folder: (config.default_folder as string) || "",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      canvas_url?: string;
      api_token?: string;
      content_root?: string;
    };

    // Load existing config to preserve fields we're not changing
    const existing = loadCurrentConfig();

    if (body.canvas_url !== undefined) {
      existing.canvas_url = body.canvas_url.replace(/\/$/, "");
    }
    if (body.api_token !== undefined && body.api_token !== "") {
      existing.api_token = body.api_token;
    }
    if (body.content_root !== undefined) {
      existing.content_root = body.content_root;
    }

    // Always write to YAML format
    writeFileSync(CONFIG_PATH, YAML.stringify(existing), "utf8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}
