"use client";

import { cn } from "@/lib/utils";
import { Copy, Check, Heart } from "lucide-react";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  message: UIMessage;
  fontSize?: number;
  isCopied?: boolean;
  isFavourite?: boolean;
  onCopy?: (messageId: string, content: string) => void;
  onToggleFavourite?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  fontSize = 14,
  isCopied = false,
  isFavourite = false,
  onCopy,
  onToggleFavourite,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const content = message.parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join("\n\n");

  if (!content) return null;

  return (
    <div
      className={cn(
        "group/message",
        isUser ? "flex flex-col items-end" : "flex flex-col items-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-sm px-4 py-3",
          isUser
            ? "bg-burgundy/10 text-ink dark:text-foreground dark:bg-burgundy/20"
            : "bg-card border border-parchment dark:border-muted text-foreground"
        )}
      >
        {isUser ? (
          <p
            className="font-body whitespace-pre-wrap leading-relaxed"
            style={{ fontSize: `${fontSize}px` }}
          >
            {content}
          </p>
        ) : (
          <div
            className="font-body leading-relaxed prose prose-sm prose-slate dark:prose-invert max-w-none
              prose-p:my-2 prose-p:leading-relaxed prose-p:text-[1em]
              prose-headings:font-display prose-headings:text-ink dark:prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2
              prose-h1:text-[1.2em] prose-h2:text-[1.1em] prose-h3:text-[1em]
              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-[1em]
              prose-code:font-mono prose-code:bg-parchment dark:prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:!text-[0.85em] prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-parchment dark:prose-pre:bg-muted prose-pre:border prose-pre:border-parchment-dark prose-pre:rounded-sm prose-pre:my-2 prose-pre:!text-[0.85em] prose-pre:font-mono prose-pre:overflow-x-auto
              prose-blockquote:border-l-burgundy prose-blockquote:text-slate-muted prose-blockquote:my-2
              prose-strong:text-ink dark:prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-burgundy prose-a:no-underline hover:prose-a:underline"
            style={{ fontSize: `${fontSize}px` }}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
      {/* Timestamp and actions */}
      <div
        className={cn(
          "mt-0.5 px-1 flex items-center gap-2",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <span className="font-sans text-[9px] text-slate-muted">
          {message.parts.length > 0 ? "" : ""}
        </span>
        {onCopy && onToggleFavourite && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onCopy(message.id, content)}
              className="p-0.5 text-slate-muted hover:text-ink dark:hover:text-foreground rounded-sm transition-colors opacity-0 group-hover/message:opacity-100"
              title="Copy"
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-green-600" strokeWidth={1.5} />
              ) : (
                <Copy className="h-3 w-3" strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={() => onToggleFavourite(message.id)}
              className={cn(
                "p-0.5 rounded-sm transition-colors",
                isFavourite
                  ? "text-burgundy"
                  : "text-slate-muted hover:text-ink dark:hover:text-foreground opacity-0 group-hover/message:opacity-100"
              )}
              title={isFavourite ? "Marked" : "Mark"}
            >
              <Heart
                className="h-3 w-3"
                strokeWidth={1.5}
                fill={isFavourite ? "currentColor" : "none"}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
