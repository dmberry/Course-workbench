"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

export function FrontmatterPanel() {
  const { activeFile } = useWorkspace();
  const [expanded, setExpanded] = useState(false);

  if (!activeFile || Object.keys(activeFile.frontmatter).length === 0) {
    return null;
  }

  const fm = activeFile.frontmatter;

  return (
    <div className="border-b border-border bg-ivory/50 dark:bg-muted/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-4 py-1.5 text-caption font-sans text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="font-medium">Frontmatter</span>
        <span className="text-muted-foreground">
          ({Object.keys(fm).length} fields)
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {Object.entries(fm).map(([key, value]) => (
            <div key={key} className="contents">
              <span className="text-caption font-sans font-medium text-muted-foreground">
                {key}
              </span>
              <span className="text-caption font-sans text-foreground">
                {key === "published" ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                      value
                        ? "bg-success-50 text-success-500"
                        : "bg-error-50 text-error-500"
                    }`}
                  >
                    {value ? "Published" : "Unpublished"}
                  </span>
                ) : typeof value === "object" ? (
                  JSON.stringify(value)
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
