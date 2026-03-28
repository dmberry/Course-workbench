import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { NextRequest } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import YAML from "yaml";
import { extractAIConfig, createModelInstance, validateAIConfig } from "@/lib/ai/client";
import { buildSystemPrompt, type ChatContext } from "@/lib/ai/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

function getContentRoot(): string {
  const configPath = join(process.cwd(), ".canvas-config.yaml");
  const mdConfigPath = join(process.cwd(), "canvas-config.local.md");

  if (existsSync(configPath)) {
    try {
      const config = YAML.parse(readFileSync(configPath, "utf8"));
      if (config?.content_root) return config.content_root;
    } catch { /* fall through */ }
  }

  if (existsSync(mdConfigPath)) {
    try {
      const text = readFileSync(mdConfigPath, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/CONTENT_ROOT\s*:\s*(.+)/);
        if (m) return m[1].trim().replace(/^[`"']|[`"']$/g, "");
      }
    } catch { /* fall through */ }
  }

  return join(process.cwd(), "content");
}

async function listFilesRecursive(
  dir: string,
  base: string,
  maxDepth: number = 4,
  depth: number = 0
): Promise<string[]> {
  if (depth >= maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      const relPath = relative(base, fullPath);
      if (entry.isDirectory()) {
        results.push(relPath + "/");
        const children = await listFilesRecursive(fullPath, base, maxDepth, depth + 1);
        results.push(...children);
      } else {
        results.push(relPath);
      }
    }
  } catch { /* directory might not exist */ }
  return results;
}

async function searchFiles(dir: string, query: string, maxResults: number = 20): Promise<Array<{ file: string; matches: string[] }>> {
  const results: Array<{ file: string; matches: string[] }> = [];
  const lowerQuery = query.toLowerCase();

  async function walk(current: string, depth: number) {
    if (depth > 4 || results.length >= maxResults) return;
    try {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || results.length >= maxResults) continue;
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".yaml") || entry.name.endsWith(".yml") || entry.name.endsWith(".txt")) {
          try {
            const content = await readFile(fullPath, "utf8");
            if (content.toLowerCase().includes(lowerQuery)) {
              const lines = content.split("\n");
              const matchLines = lines
                .filter((l) => l.toLowerCase().includes(lowerQuery))
                .slice(0, 3)
                .map((l) => l.trim().slice(0, 200));
              results.push({ file: relative(dir, fullPath), matches: matchLines });
            }
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* skip unreadable directories */ }
  }

  await walk(dir, 0);
  return results;
}

export async function POST(request: NextRequest) {
  const aiConfig = extractAIConfig(request.headers);

  // Claude Code CLI requests are handled by /api/chat-cc
  if (aiConfig.provider === "claude-code") {
    console.log("[chat] Forwarding claude-code request to chat-cc");
    const { POST: handleClaudeCode } = await import("../chat-cc/route");
    return handleClaudeCode(request);
  }

  const validation = validateAIConfig(aiConfig);

  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages, context } = body as { messages: any; context?: ChatContext };

  // Convert UI messages (parts-based) to model messages for streamText
  const modelMessages = await convertToModelMessages(messages);

  // Use context content root from the frontend, falling back to config
  const contentRoot = (context?.contentRoot && existsSync(context.contentRoot))
    ? context.contentRoot
    : getContentRoot();

  const systemPrompt = buildSystemPrompt({
    ...context,
    contentRoot,
  });

  const model = createModelInstance(aiConfig);

  // Ollama models generally don't support tool use via the OpenAI compat layer
  const supportsTools = aiConfig.provider !== "ollama";

  const workspaceTools = {
      readFile: tool({
        description:
          "Read the contents of a file from the course workspace. Returns the full text content of the file.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file within the course workspace"),
        }),
        execute: async (params) => {
          const fullPath = join(contentRoot, params.filePath);
          if (!fullPath.startsWith(contentRoot)) {
            return "Access denied: path is outside the workspace";
          }
          try {
            const info = await stat(fullPath);
            if (info.size > 500000) {
              return "File too large to read (>500KB)";
            }
            const content = await readFile(fullPath, "utf8");
            return `File: ${params.filePath} (${info.size} bytes)\n\n${content}`;
          } catch {
            return `File not found: ${params.filePath}`;
          }
        },
      }),

      listFiles: tool({
        description:
          "List files and folders in the course workspace. Returns a directory listing.",
        inputSchema: z.object({
          directory: z
            .string()
            .optional()
            .describe("Subdirectory to list (relative path). Leave empty for root."),
        }),
        execute: async (params) => {
          const targetDir = params.directory
            ? join(contentRoot, params.directory)
            : contentRoot;
          if (!targetDir.startsWith(contentRoot)) {
            return "Access denied: path is outside the workspace";
          }
          const files = await listFilesRecursive(targetDir, targetDir, 3);
          return `Directory: ${params.directory || "/"}\n${files.length} items:\n${files.join("\n")}`;
        },
      }),

      searchContent: tool({
        description:
          "Search for text across all course files (markdown, yaml, txt). Returns matching files with relevant lines.",
        inputSchema: z.object({
          query: z.string().describe("Text to search for (case-insensitive)"),
        }),
        execute: async (params) => {
          const results = await searchFiles(contentRoot, params.query);
          if (results.length === 0) return `No results found for "${params.query}"`;
          return results
            .map((r) => `${r.file}:\n${r.matches.map((m) => `  ${m}`).join("\n")}`)
            .join("\n\n");
        },
      }),

      editFile: tool({
        description:
          "Edit a file by replacing an exact string match with new text. Use this to fix spelling, grammar, or make other text changes the user has approved.",
        inputSchema: z.object({
          filePath: z.string().describe("Relative path to the file within the course workspace"),
          oldString: z.string().describe("The exact text to find and replace (must match precisely)"),
          newString: z.string().describe("The replacement text"),
        }),
        execute: async (params) => {
          const fullPath = join(contentRoot, params.filePath);
          if (!fullPath.startsWith(contentRoot)) {
            return "Access denied: path is outside the workspace";
          }
          try {
            const content = await readFile(fullPath, "utf8");
            if (!content.includes(params.oldString)) {
              return `Could not find the exact text to replace in ${params.filePath}. Make sure old_string matches precisely.`;
            }
            const occurrences = content.split(params.oldString).length - 1;
            if (occurrences > 1) {
              return `Found ${occurrences} occurrences of the text in ${params.filePath}. Please provide more surrounding context to make the match unique.`;
            }
            const updated = content.replace(params.oldString, params.newString);
            await writeFile(fullPath, updated, "utf8");
            return `Successfully edited ${params.filePath}`;
          } catch {
            return `Failed to edit file: ${params.filePath}`;
          }
        },
      }),
  };

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    ...(supportsTools ? { tools: workspaceTools } : {}),
  });

  return result.toUIMessageStreamResponse();
}
