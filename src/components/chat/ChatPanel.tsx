"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  PanelRight,
  PanelRightClose,
  Search,
  X,
  Loader2,
  SlidersHorizontal,
  Minus,
  Plus,
  ArrowUp,
  FileSearch,
  MessageSquarePlus,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAISettings } from "@/context/AISettingsContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { MessageBubble } from "./MessageBubble";
import { ClaudeCodePrefsModal } from "./ClaudeCodePrefsModal";
import { FileMentionPopup, flattenTree } from "./FileMentionPopup";
import type { FlatFile } from "./FileMentionPopup";
import { EditDiffBlock } from "./EditDiffBlock";

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 20;

interface ChatPanelProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function ChatPanel({ collapsed, setCollapsed }: ChatPanelProps) {
  const {
    settings,
    isAiReady,
    connectionStatus,
    getRequestHeaders,
    setConnectionStatus,
    setClaudeCodeSessionId,
    clearClaudeCodeSession,
  } = useAISettings();

  const { activeCourse, activeFile, contentRoot, fileTree, reloadActiveFile, proofreadRequest, requestProofread } = useWorkspace();

  const isClaudeCode = settings.provider === "claude-code";

  // Use refs so the body callback always reads the latest values,
  // even if useChat internally caches the transport instance.
  const workspaceRef = useRef({ activeCourse, activeFile, contentRoot });
  useEffect(() => {
    workspaceRef.current = { activeCourse, activeFile, contentRoot };
  }, [activeCourse, activeFile, contentRoot]);

  const ccPrefsRef = useRef(settings.ccPreferences);
  useEffect(() => {
    ccPrefsRef.current = settings.ccPreferences;
  }, [settings.ccPreferences]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: isClaudeCode ? "/api/chat-cc" : "/api/chat",
        headers: () => getRequestHeaders(),
        body: () => {
          const { activeCourse: ac, activeFile: af, contentRoot: cr } = workspaceRef.current;
          return {
            context: {
              activeCourse: ac
                ? { name: ac.name, path: ac.path, level: ac.level }
                : null,
              activeFile: af
                ? { path: af.path, name: af.name, fileType: af.fileType }
                : null,
              contentRoot: cr,
            },
            ccPreferences: ccPrefsRef.current,
          };
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClaudeCode, settings.provider, settings.model, settings.apiKey, settings.baseUrl, settings.customModelId]
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
  } = useChat({
    transport,
    onError: (err) => {
      console.error("[ChatPanel] useChat error:", err);
    },
  });

  // Debug logging for status transitions only (not every streaming update)
  const prevDebugStatusRef = useRef(status);
  useEffect(() => {
    if (status !== prevDebugStatusRef.current) {
      console.log("[ChatPanel] status:", prevDebugStatusRef.current, "→", status, "messages:", messages.length, "provider:", settings.provider);
      if (error) console.log("[ChatPanel] error:", error.message);
      prevDebugStatusRef.current = status;
    }
  }, [status, messages.length, error, settings.provider]);

  // Capture Claude Code session ID from message metadata.
  // Only check when status changes (not on every streaming message update)
  // to avoid cascading re-renders during rapid tool streaming.
  const lastCapturedSessionId = useRef<string | undefined>(undefined);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    if (!isClaudeCode) return;
    for (const msg of messagesRef.current) {
      const meta = msg.metadata as
        | { claudeCodeSessionId?: string }
        | undefined;
      if (meta?.claudeCodeSessionId && meta.claudeCodeSessionId !== lastCapturedSessionId.current) {
        lastCapturedSessionId.current = meta.claudeCodeSessionId;
        setClaudeCodeSessionId(meta.claudeCodeSessionId);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isClaudeCode, setClaudeCodeSessionId]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    if (isClaudeCode) clearClaudeCodeSession();
  }, [setMessages, isClaudeCode, clearClaudeCodeSession]);

  const isLoading = status === "submitted" || status === "streaming";

  // Reload the active file after any AI response finishes
  // (it may have edited the file on disk)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasLoading = prevStatusRef.current === "submitted" || prevStatusRef.current === "streaming";
    const nowIdle = status === "ready" || status === "error";
    if (wasLoading && nowIdle) {
      reloadActiveFile();
    }
    prevStatusRef.current = status;
  }, [status, reloadActiveFile]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [input, setInput] = useState("");
  const [ccPrefsOpen, setCcPrefsOpen] = useState(false);
  const [chatFontSize, setChatFontSize] = useState(14);
  const [showFontSizePopover, setShowFontSizePopover] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [favouriteMessages, setFavouriteMessages] = useState<Set<string>>(
    new Set()
  );

  // @ mention autocomplete
  const flatFiles = useMemo(() => flattenTree(fileTree), [fileTree]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Position in `input` where the triggering "@" sits
  const mentionStartRef = useRef<number>(-1);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filtered mention results (needed for keyboard nav bounds)
  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    return flatFiles
      .filter((f) => f.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 8);
  }, [mentionQuery, flatFiles]);

  // Detect @ trigger and extract query from textarea value + cursor position
  const detectMention = useCallback(
    (value: string, cursorPos: number) => {
      // Scan backwards from cursor to find "@"
      const before = value.slice(0, cursorPos);
      const atIdx = before.lastIndexOf("@");
      if (atIdx === -1) {
        setMentionQuery(null);
        return;
      }
      // "@" must be at start or preceded by whitespace
      if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) {
        setMentionQuery(null);
        return;
      }
      // No spaces allowed in the query (file names don't have spaces typically)
      const query = before.slice(atIdx + 1);
      if (/\s/.test(query)) {
        setMentionQuery(null);
        return;
      }
      mentionStartRef.current = atIdx;
      setMentionQuery(query);
      setMentionIndex(0);
    },
    []
  );

  // Insert selected file mention into input
  const handleMentionSelect = useCallback(
    (file: FlatFile) => {
      const start = mentionStartRef.current;
      if (start === -1) return;
      const cursorPos = inputRef.current?.selectionStart ?? input.length;
      const before = input.slice(0, start);
      const after = input.slice(cursorPos);
      const inserted = `@${file.name} `;
      const newValue = before + inserted + after;
      setInput(newValue);
      setMentionQuery(null);
      setMentionIndex(0);
      mentionStartRef.current = -1;
      // Restore cursor after the inserted mention
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        inputRef.current?.setSelectionRange(pos, pos);
        inputRef.current?.focus();
      });
    },
    [input]
  );

  // Handle proofread request from editor (spelling, grammar & voice check)
  useEffect(() => {
    if (!proofreadRequest) return;
    setCollapsed(false);
    sendMessage({
      text: `Please check the following passage for spelling, grammar, and voice. List any issues you find with specific suggestions for improvement. If you recommend changes, ask me whether I would like you to apply them to the file.\n\n> ${proofreadRequest}`,
    });
    requestProofread(null);
  }, [proofreadRequest, requestProofread, setCollapsed, sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
      detectMention(e.target.value, el.selectionStart);
    },
    [detectMention]
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    sendMessage({ text });
  }, [input, isLoading, sendMessage]);

  const handleReviewModule = useCallback(() => {
    if (isLoading || !activeCourse) return;
    sendMessage({
      text: `Please review the module "${activeCourse.name}". Start by reading the _course.yaml and listing the module's directories, then provide a structured analysis covering: overview and structure, coherence across pages and assessments, gaps or absences, level appropriateness, areas where students may need extra guidance, and suggestions for improvement.`,
    });
  }, [isLoading, activeCourse, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // When mention popup is open, intercept navigation keys
      if (mentionQuery !== null && mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionResults.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleMentionSelect(mentionResults[mentionIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionQuery(null);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, mentionQuery, mentionResults, mentionIndex, handleMentionSelect]
  );

  const handleCopyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  const handleToggleFavourite = useCallback((id: string) => {
    setFavouriteMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing");
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getRequestHeaders(),
        },
      });
      const data = await response.json();
      if (data.success) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error", data.error || "Connection test failed");
      }
    } catch (err) {
      setConnectionStatus(
        "error",
        err instanceof Error ? err.message : "Connection test failed"
      );
    }
  }, [setConnectionStatus, getRequestHeaders]);

  // Auto-test connection when panel opens and AI is enabled but untested
  useEffect(() => {
    if (!collapsed && settings.aiEnabled && connectionStatus === "unknown") {
      handleTestConnection();
    }
  }, [collapsed, settings.aiEnabled, connectionStatus, handleTestConnection]);

  // Extract text content from message parts
  const getMessageText = useCallback((message: (typeof messages)[0]): string => {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("");
  }, []);

  // Filter messages for search
  const filteredMessages = chatSearchQuery
    ? messages.filter((m) =>
        getMessageText(m).toLowerCase().includes(chatSearchQuery.toLowerCase())
      )
    : messages;

  if (collapsed) {
    return (
      <div className="hidden md:flex flex-col w-10 flex-shrink-0">
        <div className="flex-1 flex flex-col items-center pt-2 bg-cream/30 dark:bg-muted/30 border-l border-border">
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 text-slate-muted hover:text-ink dark:hover:text-foreground hover:bg-cream dark:hover:bg-muted rounded-sm transition-colors"
            title="Expand chat panel"
          >
            <PanelRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <span
            className="mt-2 text-[10px] text-slate-muted"
            style={{ writingMode: "vertical-rl" }}
          >
            Chat
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:flex flex-col flex-1 min-w-0 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-cream/30 dark:bg-muted/30">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-slate-muted hover:text-ink dark:hover:text-foreground hover:bg-cream dark:hover:bg-muted rounded-sm transition-colors"
            title="Collapse chat panel"
          >
            <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="p-1 text-slate-muted hover:text-ink dark:hover:text-foreground hover:bg-cream dark:hover:bg-muted rounded-sm transition-colors"
              title="New Chat"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {isClaudeCode ? (
          <>
            <button
              onClick={() => setCcPrefsOpen(true)}
              className="font-sans text-[10px] text-slate-muted hover:text-burgundy transition-colors cursor-pointer"
              title="Claude Code preferences"
            >
              Claude Code
              {connectionStatus === "success" && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-success align-middle" />
              )}
            </button>
            <ClaudeCodePrefsModal open={ccPrefsOpen} onOpenChange={setCcPrefsOpen} />
          </>
        ) : (
          <span className="font-sans text-[10px] text-slate-muted">
            {settings.provider === "anthropic" ? "Claude" : settings.provider}
            {connectionStatus === "success" && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-success align-middle" />
            )}
          </span>
        )}
      </div>

      {/* Search bar */}
      {showChatSearch && (
        <div className="border-b border-border bg-cream/50 dark:bg-muted/50 px-3 py-2 flex items-center gap-2">
          <Search
            className="h-3.5 w-3.5 text-slate-muted flex-shrink-0"
            strokeWidth={1.5}
          />
          <input
            ref={chatSearchInputRef}
            type="text"
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-slate-muted focus:outline-none font-body"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowChatSearch(false);
                setChatSearchQuery("");
              }
            }}
          />
          {chatSearchQuery && (
            <span className="text-[10px] text-slate-muted">
              {filteredMessages.length} found
            </span>
          )}
          <button
            onClick={() => {
              setShowChatSearch(false);
              setChatSearchQuery("");
            }}
            className="p-0.5 text-slate-muted hover:text-ink dark:hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.map((message) => {
          // Show tool invocation indicators (v6: dynamic-tool parts)
          const toolParts =
            message.role === "assistant"
              ? message.parts.filter((p) => p.type === "dynamic-tool" || p.type.startsWith("tool-"))
              : [];

          return (
            <React.Fragment key={message.id}>
              {toolParts.map((p, i) => {
                const toolName = "toolName" in p ? (p as { toolName: string }).toolName : p.type.replace("tool-", "");
                const state = "state" in p ? (p as { state: string }).state : "";
                const isDone = state === "output-available";
                const input = "input" in p ? (p as { input?: Record<string, unknown> }).input : undefined;

                // Friendly descriptions instead of raw tool names
                let label: string;
                switch (toolName) {
                  case "Read": {
                    const fp = input?.file_path as string | undefined;
                    const name = fp ? fp.split("/").pop() : "file";
                    label = isDone ? `Read ${name}` : `Reading ${name}...`;
                    break;
                  }
                  case "Glob": {
                    const pat = input?.pattern as string | undefined;
                    label = isDone
                      ? `Found files${pat ? ` matching ${pat}` : ""}`
                      : "Searching for files...";
                    break;
                  }
                  case "Grep": {
                    const pat = input?.pattern as string | undefined;
                    label = isDone
                      ? `Searched for "${pat || "content"}"`
                      : `Searching for "${pat || "content"}"...`;
                    break;
                  }
                  case "Write": {
                    const fp = input?.file_path as string | undefined;
                    const name = fp ? fp.split("/").pop() : "notes";
                    label = isDone ? `Updated ${name}` : `Updating ${name}...`;
                    break;
                  }
                  case "Edit": {
                    const fp = input?.file_path as string | undefined;
                    const name = fp ? fp.split("/").pop() : "file";
                    label = isDone ? `Edited ${name}` : `Editing ${name}...`;
                    break;
                  }
                  default:
                    label = isDone ? `Used ${toolName}` : `Using ${toolName}...`;
                }

                // Render Edit tool calls as a visual diff block
                if (toolName === "Edit") {
                  const fp = input?.file_path as string | undefined;
                  const name = fp ? fp.split("/").pop() || "file" : "file";
                  return (
                    <EditDiffBlock
                      key={`${message.id}-tool-${i}`}
                      fileName={name}
                      oldString={(input?.old_string as string) ?? ""}
                      newString={(input?.new_string as string) ?? ""}
                      isComplete={isDone}
                    />
                  );
                }

                return (
                  <div
                    key={`${message.id}-tool-${i}`}
                    className="flex items-center gap-1.5 text-[10px] text-slate-muted font-sans pl-1"
                  >
                    <FileSearch className="h-3 w-3" strokeWidth={1.5} />
                    <span>{label}</span>
                  </div>
                );
              })}
              <MessageBubble
                message={message}
                fontSize={chatFontSize}
                isCopied={copiedMessageId === message.id}
                isFavourite={favouriteMessages.has(message.id)}
                onCopy={handleCopyMessage}
                onToggleFavourite={handleToggleFavourite}
              />
            </React.Fragment>
          );
        })}

        {isLoading && (
          <div className="flex justify-start pl-2 py-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-burgundy/70 animate-pulse" />
              <div
                className="w-1.5 h-1.5 rounded-full bg-burgundy/70 animate-pulse"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-burgundy/70 animate-pulse"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 p-3 rounded-sm bg-error/10 border border-error/30 text-error text-xs font-sans">
            {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 flex justify-center">
        <div className="w-full md:w-[80%]">
          <div className="relative bg-card rounded-2xl border border-border shadow-sm">
            {/* @ mention popup */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <FileMentionPopup
                query={mentionQuery}
                files={flatFiles}
                selectedIndex={mentionIndex}
                onSelect={handleMentionSelect}
                onClose={() => setMentionQuery(null)}
              />
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isAiReady
                  ? "Ask about your course content..."
                  : "Configure AI in settings to start chatting"
              }
              className="w-full resize-none rounded-t-2xl px-4 py-3 font-body bg-transparent text-foreground placeholder:text-slate-muted focus:outline-none overflow-hidden"
              style={{
                fontSize: `${chatFontSize}px`,
                minHeight: "44px",
              }}
              rows={1}
              disabled={!settings.aiEnabled}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3 pb-2">
              {/* Left side */}
              <div className="flex items-center gap-0.5">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatSearch(!showChatSearch);
                      if (!showChatSearch) {
                        setTimeout(
                          () => chatSearchInputRef.current?.focus(),
                          50
                        );
                      } else {
                        setChatSearchQuery("");
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      showChatSearch
                        ? "text-burgundy"
                        : "text-slate-muted hover:text-ink dark:hover:text-foreground"
                    )}
                    title="Search messages"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
                {activeCourse && (
                  <button
                    type="button"
                    onClick={handleReviewModule}
                    disabled={isLoading}
                    className="p-1.5 rounded-md transition-colors text-slate-muted hover:text-burgundy disabled:opacity-30"
                    title={`Review module: ${activeCourse.name}`}
                  >
                    <ClipboardCheck className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-1">
                {/* Font size popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setShowFontSizePopover(!showFontSizePopover)
                    }
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      showFontSizePopover
                        ? "text-burgundy"
                        : "text-slate-muted hover:text-ink dark:hover:text-foreground"
                    )}
                    title="Font size"
                  >
                    <SlidersHorizontal
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />
                  </button>
                  {showFontSizePopover && (
                    <div className="absolute bottom-full right-0 mb-2 bg-popover rounded-lg border border-border shadow-lg p-2 z-50">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setChatFontSize((s) => Math.max(FONT_SIZE_MIN, s - 1))
                          }
                          disabled={chatFontSize <= FONT_SIZE_MIN}
                          className="p-1.5 text-slate-muted hover:text-ink dark:hover:text-foreground hover:bg-cream dark:hover:bg-muted rounded-md transition-colors disabled:opacity-30"
                          title="Decrease"
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                        <span className="text-xs text-foreground font-mono w-6 text-center">
                          {chatFontSize}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setChatFontSize((s) => Math.min(FONT_SIZE_MAX, s + 1))
                          }
                          disabled={chatFontSize >= FONT_SIZE_MAX}
                          className="p-1.5 text-slate-muted hover:text-ink dark:hover:text-foreground hover:bg-cream dark:hover:bg-muted rounded-md transition-colors disabled:opacity-30"
                          title="Increase"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Send button */}
                <button
                  type="button"
                  onClick={() => {
                    if (connectionStatus !== "success" && !input.trim()) {
                      handleTestConnection();
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={isLoading || connectionStatus === "testing" || !settings.aiEnabled}
                  className={cn(
                    "p-2 rounded-lg flex items-center justify-center transition-colors",
                    isLoading || connectionStatus === "testing"
                      ? "bg-parchment dark:bg-muted text-slate-muted cursor-not-allowed"
                      : connectionStatus === "success"
                        ? input.trim() && isAiReady
                          ? "bg-burgundy text-ivory hover:bg-burgundy/90"
                          : "bg-burgundy/30 text-burgundy cursor-not-allowed"
                        : settings.aiEnabled
                          ? "bg-amber-500 text-ivory hover:bg-amber-600 cursor-pointer"
                          : "bg-parchment dark:bg-muted text-slate-muted cursor-not-allowed"
                  )}
                  title={
                    connectionStatus === "testing"
                      ? "Testing connection..."
                      : connectionStatus === "success"
                        ? input.trim()
                          ? "Send message"
                          : "Type a message"
                        : settings.aiEnabled
                          ? "Click to test connection"
                          : "Enable AI in settings"
                  }
                >
                  {isLoading || connectionStatus === "testing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
