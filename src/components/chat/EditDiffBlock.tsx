"use client";

import { useState } from "react";
import { Pencil, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface EditDiffBlockProps {
  fileName: string;
  oldString: string;
  newString: string;
  isComplete: boolean;
}

export function EditDiffBlock({
  fileName,
  oldString,
  newString,
  isComplete,
}: EditDiffBlockProps) {
  const [expanded, setExpanded] = useState(true);

  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");

  const removedCount = oldLines.length;
  const addedCount = newLines.length;

  // Summary like "Removed 2 lines, Added 4 lines"
  const parts: string[] = [];
  if (removedCount > 0)
    parts.push(`${removedCount} line${removedCount !== 1 ? "s" : ""} removed`);
  if (addedCount > 0)
    parts.push(`${addedCount} line${addedCount !== 1 ? "s" : ""} added`);
  const summary = parts.join(", ");

  if (!isComplete) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-muted font-sans pl-1">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
        <span>Editing {fileName}...</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden text-[11px] font-mono max-w-[85%]">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-slate-muted flex-shrink-0" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="h-3 w-3 text-slate-muted flex-shrink-0" strokeWidth={1.5} />
        )}
        <Pencil className="h-3 w-3 text-slate-muted flex-shrink-0" strokeWidth={1.5} />
        <span className="font-sans text-caption font-medium text-foreground">
          Edit {fileName}
        </span>
        {summary && (
          <span className="font-sans text-[10px] text-slate-muted ml-auto">
            {summary}
          </span>
        )}
      </button>

      {/* Diff body */}
      {expanded && (
        <div className="overflow-x-auto">
          {/* Removed lines */}
          {oldLines.map((line, i) => (
            <div
              key={`old-${i}`}
              className="flex bg-error/10 border-l-2 border-error/40"
            >
              <span className="select-none text-error/50 px-2 py-px text-right min-w-[20px]">
                −
              </span>
              <pre className="text-error/80 dark:text-error/70 py-px pr-3 whitespace-pre-wrap break-all">
                {line}
              </pre>
            </div>
          ))}
          {/* Added lines */}
          {newLines.map((line, i) => (
            <div
              key={`new-${i}`}
              className="flex bg-success-50 dark:bg-success-500/10 border-l-2 border-success-500/40"
            >
              <span className="select-none text-success-500/50 px-2 py-px text-right min-w-[20px]">
                +
              </span>
              <pre className="text-success-500/80 dark:text-success-500/70 py-px pr-3 whitespace-pre-wrap break-all">
                {line}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
