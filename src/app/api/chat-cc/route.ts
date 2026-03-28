import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { spawn } from "node:child_process";
import { NextRequest } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { buildSystemPrompt, type ChatContext } from "@/lib/ai/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

function getContentRoot(): string {
  const configPath = join(process.cwd(), ".canvas-config.yaml");
  const mdConfigPath = join(process.cwd(), "canvas-config.local.md");

  if (existsSync(configPath)) {
    try {
      const config = YAML.parse(readFileSync(configPath, "utf8"));
      if (config?.content_root && existsSync(config.content_root)) return config.content_root;
    } catch {
      /* fall through */
    }
  }

  if (existsSync(mdConfigPath)) {
    try {
      const text = readFileSync(mdConfigPath, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/CONTENT_ROOT\s*:\s*(.+)/);
        if (m) {
          const root = m[1].trim().replace(/^[`"']|[`"']$/g, "");
          if (existsSync(root)) return root;
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Fall back to process.cwd() (not a subdirectory that might not exist)
  return process.cwd();
}

/** Resolve the claude CLI binary path */
function findClaudeBinary(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  // Common installation locations
  const candidates = [
    join(home, ".local", "bin", "claude"),
    join(home, ".npm-global", "bin", "claude"),
    "/usr/local/bin/claude",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fall back to bare name (relies on PATH)
  return "claude";
}

/**
 * Build a condensed conversation context from prior messages.
 * This gives the CLI context about earlier turns when --resume is not used.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function buildConversationContext(messages: any[]): string {
  if (!messages || messages.length <= 1) return "";

  // Everything except the last user message (that's the current prompt)
  const prior = messages.slice(0, -1);
  if (prior.length === 0) return "";

  const turns: string[] = [];
  for (const msg of prior) {
    const role = msg.role === "user" ? "User" : "Assistant";
    let text = "";
    if (msg.parts) {
      text = msg.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("");
    } else if (typeof msg.content === "string") {
      text = msg.content;
    }
    if (text.trim()) {
      // Truncate long responses to keep context manageable
      const truncated = text.length > 2000
        ? text.slice(0, 2000) + "\n[...truncated...]"
        : text;
      turns.push(`**${role}:** ${truncated}`);
    }
  }

  if (turns.length === 0) return "";

  return [
    "## Conversation History",
    "Here is our conversation so far. Continue from where we left off.\n",
    ...turns,
    "\n---\nNow respond to the user's latest message below.",
  ].join("\n\n");
}

export async function POST(request: NextRequest) {
  console.log("[chat-cc] Route hit, provider header:", request.headers.get("x-ai-provider"));

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    console.error("[chat-cc] Failed to parse request body:", e);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, context, ccPreferences } = body as {
    messages: any;
    context?: ChatContext;
    ccPreferences?: {
      responseStyle?: "prose" | "bullets";
      verbosity?: "short" | "medium" | "detailed";
      allowedTools?: string[];
    };
  };
  const model =
    request.headers.get("x-ai-model") || "claude-sonnet-4-20250514";
  const sessionId = request.headers.get("x-cc-session-id") || undefined;

  // Resolve content root with multi-step fallback
  let contentRoot: string;
  if (context?.contentRoot && existsSync(context.contentRoot)) {
    contentRoot = context.contentRoot;
  } else if (context?.activeCourse?.path && existsSync(context.activeCourse.path)) {
    // Active course path is a reliable secondary source
    contentRoot = context.activeCourse.path;
    console.warn("[chat-cc] contentRoot fallback to activeCourse.path:", contentRoot,
      "(original contentRoot was:", JSON.stringify(context?.contentRoot), ")");
  } else {
    contentRoot = getContentRoot();
    console.warn("[chat-cc] contentRoot fallback to getContentRoot():", contentRoot,
      "(context.contentRoot:", JSON.stringify(context?.contentRoot),
      ", activeCourse.path:", JSON.stringify(context?.activeCourse?.path), ")");
  }

  const systemPrompt = buildSystemPrompt({
    ...context,
    contentRoot,
    responseStyle: ccPreferences?.responseStyle,
    verbosity: ccPreferences?.verbosity,
  });

  console.log("[chat-cc] POST received", {
    model, sessionId, contentRoot, messageCount: messages?.length,
    contextContentRoot: context?.contentRoot || "(empty)",
    contextCourse: context?.activeCourse?.name || "(none)",
    contextCoursePath: context?.activeCourse?.path || "(none)",
  });

  // Extract latest user message text
  const lastUserMsg = [...messages]
    .reverse()
    .find((m: any) => m.role === "user");
  let prompt = "";
  if (lastUserMsg?.parts) {
    prompt = lastUserMsg.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  } else if (typeof lastUserMsg?.content === "string") {
    prompt = lastUserMsg.content;
  }

  console.log("[chat-cc] Extracted prompt:", prompt.slice(0, 100));

  if (!prompt.trim()) {
    return new Response(
      JSON.stringify({ error: "No user message found" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build conversation context for multi-turn continuity
  const conversationContext = buildConversationContext(messages);

  // When using --resume, the CLI already has conversation history.
  // When fresh (no session or retry after session failure), prepend context.
  const promptWithContext = conversationContext
    ? `${conversationContext}\n\n**User:** ${prompt}`
    : prompt;

  const claudeBin = findClaudeBinary();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      return new Promise<void>((resolve) => {
        // ─── Streaming state ───
        let started = false;
        let stepInProgress = false;
        let finished = false;
        let currentTextId: string | null = null;
        let currentToolCallId: string | null = null;
        const streamedBlockIndices = new Set<number>();
        let textPartCounter = 0;

        function emitStart(ccSessionId?: string) {
          if (started) return;
          writer.write({
            type: "start",
            ...(ccSessionId
              ? {
                  messageMetadata: {
                    claudeCodeSessionId: ccSessionId,
                  },
                }
              : {}),
          });
          started = true;
        }

        function startStep() {
          if (stepInProgress) {
            writer.write({ type: "finish-step" });
          }
          writer.write({ type: "start-step" });
          stepInProgress = true;
          streamedBlockIndices.clear();
          currentTextId = null;
          currentToolCallId = null;
        }

        function finishStream(reason: "stop" | "error") {
          if (finished) return;
          emitStart();
          if (stepInProgress) {
            writer.write({ type: "finish-step" });
            stepInProgress = false;
          }
          writer.write({ type: "finish", finishReason: reason });
          finished = true;
        }

        function processLine(line: string) {
          if (!line.trim()) return;
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch {
            console.log("[chat-cc] Non-JSON line:", line.slice(0, 100));
            return;
          }
          console.log("[chat-cc] Event:", ev.type, ev.subtype || "", ev.event?.type || "");

          switch (ev.type) {
            // ── Session init ──
            case "system": {
              if (ev.subtype === "init" && ev.session_id) {
                emitStart(ev.session_id);
              }
              break;
            }

            // ── Token-level streaming events ──
            case "stream_event": {
              const e = ev.event;
              if (!e) break;

              switch (e.type) {
                case "message_start": {
                  emitStart();
                  startStep();
                  break;
                }

                case "content_block_start": {
                  const block = e.content_block;
                  if (!block) break;
                  if (block.type === "text") {
                    currentTextId = `cc-text-${textPartCounter++}`;
                    streamedBlockIndices.add(e.index);
                    writer.write({
                      type: "text-start",
                      id: currentTextId,
                    });
                  } else if (block.type === "tool_use") {
                    currentToolCallId = block.id;
                    streamedBlockIndices.add(e.index);
                    writer.write({
                      type: "tool-input-start",
                      toolCallId: block.id,
                      toolName: block.name,
                      dynamic: true,
                    });
                  }
                  break;
                }

                case "content_block_delta": {
                  const delta = e.delta;
                  if (!delta) break;
                  if (delta.type === "text_delta" && currentTextId) {
                    writer.write({
                      type: "text-delta",
                      delta: delta.text,
                      id: currentTextId,
                    });
                  } else if (
                    delta.type === "input_json_delta" &&
                    currentToolCallId
                  ) {
                    writer.write({
                      type: "tool-input-delta",
                      toolCallId: currentToolCallId,
                      inputTextDelta: delta.partial_json,
                    });
                  }
                  break;
                }

                case "content_block_stop": {
                  if (currentTextId) {
                    writer.write({
                      type: "text-end",
                      id: currentTextId,
                    });
                    currentTextId = null;
                  }
                  currentToolCallId = null;
                  break;
                }
              }
              break;
            }

            // ── Complete assistant turn ──
            case "assistant": {
              const msg = ev.message;
              if (!msg?.content) break;

              emitStart();
              if (!stepInProgress) startStep();

              for (let i = 0; i < msg.content.length; i++) {
                const block = msg.content[i];

                if (
                  block.type === "text" &&
                  block.text &&
                  !streamedBlockIndices.has(i)
                ) {
                  const id = `cc-text-${textPartCounter++}`;
                  writer.write({ type: "text-start", id });
                  writer.write({
                    type: "text-delta",
                    delta: block.text,
                    id,
                  });
                  writer.write({ type: "text-end", id });
                }

                if (block.type === "tool_use") {
                  if (!streamedBlockIndices.has(i)) {
                    writer.write({
                      type: "tool-input-start",
                      toolCallId: block.id,
                      toolName: block.name,
                      dynamic: true,
                    });
                  }
                  writer.write({
                    type: "tool-input-available",
                    toolCallId: block.id,
                    toolName: block.name,
                    input: block.input,
                    dynamic: true,
                  });
                }
              }

              if (msg.stop_reason === "end_turn") {
                writer.write({ type: "finish-step" });
                stepInProgress = false;
              }
              break;
            }

            // ── Tool results ──
            case "user": {
              const msg = ev.message;
              if (!msg?.content) break;

              for (const block of msg.content) {
                if (block.type === "tool_result") {
                  const output =
                    typeof block.content === "string"
                      ? block.content
                      : Array.isArray(block.content)
                        ? block.content
                            .filter((b: any) => b.type === "text")
                            .map((b: any) => b.text)
                            .join("")
                        : JSON.stringify(block.content);
                  writer.write({
                    type: "tool-output-available",
                    toolCallId: block.tool_use_id,
                    output,
                    dynamic: true,
                  });
                }
              }

              if (stepInProgress) {
                writer.write({ type: "finish-step" });
                stepInProgress = false;
              }
              break;
            }

            // ── Final result ──
            case "result": {
              const errors: string[] = ev.errors || [];
              const errorText = errors.join("; ") || ev.error || "";

              emitStart();
              if (ev.subtype !== "success" && !stepInProgress) {
                writer.write({ type: "start-step" });
                stepInProgress = true;
                const errMsg = errorText
                  ? `Claude Code error: ${errorText.slice(0, 400)}`
                  : "Claude Code encountered an unknown error.";
                writer.write({ type: "error", errorText: errMsg });
              }
              if (stepInProgress) {
                writer.write({ type: "finish-step" });
                stepInProgress = false;
              }
              writer.write({
                type: "finish",
                finishReason:
                  ev.subtype === "success" ? "stop" : "error",
              });
              finished = true;
              break;
            }
          }
        }

        function spawnCLI(cliArgs: string[]) {
          let buffer = "";
          let stderrOutput = "";

          console.log("[chat-cc] Spawning:", claudeBin, cliArgs.join(" ").slice(0, 200));
          const child = spawn(claudeBin, cliArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: contentRoot,
            env: { ...process.env },
          });
          child.stdin.end();

          // Kill child process on client disconnect
          const abortHandler = () => {
            console.log("[chat-cc] Client aborted, killing child");
            child.kill("SIGTERM");
          };
          request.signal.addEventListener("abort", abortHandler);

          // Safety timeout for CLI (90s)
          const cliTimer = setTimeout(() => {
            console.log("[chat-cc] CLI timeout after 90s, killing child");
            child.kill("SIGTERM");
          }, 90000);

          child.stdout.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              processLine(line);
            }
          });

          child.stderr.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stderrOutput += text;
            console.log("[chat-cc] stderr:", text.slice(0, 200));
          });

          child.on("close", (code) => {
            clearTimeout(cliTimer);
            request.signal.removeEventListener("abort", abortHandler);
            console.log("[chat-cc] Child closed with code:", code, "started:", started, "finished:", finished);

            // Process any remaining data in the buffer
            if (buffer.trim()) processLine(buffer);

            if (code !== 0 && code !== null && !finished) {
              emitStart();
              if (!stepInProgress) {
                writer.write({ type: "start-step" });
                stepInProgress = true;
              }
              const errMsg = stderrOutput.includes("not authenticated")
                ? "Authentication expired. Run `claude login` in your terminal."
                : `Claude Code exited with code ${code}. ${stderrOutput.slice(0, 300)}`;
              writer.write({ type: "error", errorText: errMsg });
              writer.write({ type: "finish-step" });
              writer.write({ type: "finish", finishReason: "error" });
              finished = true;
            }

            // Safety: ensure the stream always closes properly
            if (!finished) {
              emitStart();
              if (!stepInProgress) {
                writer.write({ type: "start-step" });
                stepInProgress = true;
              }
              if (stepInProgress) {
                writer.write({ type: "finish-step" });
              }
              writer.write({ type: "finish", finishReason: "stop" });
            }

            resolve();
          });

          child.on("error", (err: NodeJS.ErrnoException) => {
            clearTimeout(cliTimer);
            request.signal.removeEventListener("abort", abortHandler);
            emitStart();
            if (!stepInProgress) {
              writer.write({ type: "start-step" });
            }
            const errMsg =
              err.code === "ENOENT"
                ? "Claude Code CLI not found. Install with: npm i -g @anthropic-ai/claude-code"
                : `Failed to start Claude Code: ${err.message}`;
            writer.write({ type: "error", errorText: errMsg });
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "error" });
            finished = true;
            resolve();
          });
        }

        // Build CLI arguments — always fresh (no --resume; conversation
        // context is built manually via buildConversationContext instead)
        const initialArgs = [
          "-p",
          promptWithContext,
          "--output-format",
          "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--model",
          model,
          "--allowedTools",
          [
            ...(ccPreferences?.allowedTools?.length
              ? ccPreferences.allowedTools
              : ["Read", "Glob", "Grep"]),
            "Write",  // For _ai-notes.md working memory
            "Edit",   // For collaborative editing of course files
          ].join(","),
          "--disallowedTools",
          "Bash,NotebookEdit",
          "--system-prompt",
          systemPrompt,
        ];

        spawnCLI(initialArgs);
      });
    },
  });

  console.log("[chat-cc] Returning SSE response");
  return createUIMessageStreamResponse({ stream });
}
