import { generateText } from "ai";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { extractAIConfig, createModelInstance, validateAIConfig } from "@/lib/ai/client";

export const runtime = "nodejs";

function findClaudeBinary(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    join(home, ".local", "bin", "claude"),
    join(home, ".npm-global", "bin", "claude"),
    "/usr/local/bin/claude",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "claude";
}

function runClaude(args: string[], timeoutMs = 30000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const claudeBin = findClaudeBinary();
    const child = spawn(claudeBin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: null, stdout, stderr: stderr || "Timed out" });
    }, timeoutMs);
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: err.code === "ENOENT" ? "ENOENT" : err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export async function POST(request: NextRequest) {
  const aiConfig = extractAIConfig(request.headers);
  const validation = validateAIConfig(aiConfig);

  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error });
  }

  try {
    // Claude Code CLI — verify CLI is installed
    if (aiConfig.provider === "claude-code") {
      const ver = await runClaude(["--version"], 5000);
      if (ver.stderr === "ENOENT") {
        return NextResponse.json({
          success: false,
          error:
            "Claude Code CLI not found. Install with: npm i -g @anthropic-ai/claude-code",
        });
      }
      if (ver.code !== 0 && ver.code !== null) {
        return NextResponse.json({
          success: false,
          error: `Claude Code CLI error: ${(ver.stderr || ver.stdout).slice(0, 300)}`,
        });
      }
      // CLI exists and runs — auth issues will surface on first chat message
      return NextResponse.json({ success: true });
    }

    if (aiConfig.provider === "ollama") {
      const baseUrl = aiConfig.baseUrl || "http://localhost:11434";
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: "Ollama is not responding. Start it with `ollama serve`.",
        });
      }
      return NextResponse.json({ success: true });
    }

    const model = createModelInstance(aiConfig);
    await generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 5,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    });
  }
}
