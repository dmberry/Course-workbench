"use client";

import { FileText, Save, Check, Loader2, SpellCheck } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { FrontmatterPanel } from "@/components/editor/FrontmatterPanel";

export function ContentPanel() {
  const {
    activeFile,
    isFileLoading,
    viewMode,
    setViewMode,
    isDirty,
    saveFile,
    isSaving,
    editorContent,
    requestProofread,
  } = useWorkspace();

  const handleCheck = () => {
    const selected = window.getSelection()?.toString().trim();
    const text = selected || editorContent;
    if (!text) return;
    requestProofread(text);
  };

  if (isFileLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin opacity-40" />
        <p className="font-body text-body-md">Loading file...</p>
      </div>
    );
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <FileText className="w-12 h-12 opacity-30" />
        <p className="font-body text-body-md">
          Select a file from the sidebar
        </p>
      </div>
    );
  }

  const isYaml = activeFile.path.endsWith(".yaml");

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Sub-toolbar */}
      <div className="px-4 py-1.5 border-b border-border bg-card flex items-center gap-3">
        {/* View mode toggle — only for markdown files */}
        {!isYaml && (
          <div className="flex border border-border rounded-sm overflow-hidden">
            <button
              onClick={() => setViewMode("markdown")}
              className={`px-3 py-1 text-caption font-sans transition-colors ${
                viewMode === "markdown"
                  ? "bg-burgundy text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Markdown
            </button>
            <button
              onClick={() => setViewMode("richtext")}
              className={`px-3 py-1 text-caption font-sans transition-colors ${
                viewMode === "richtext"
                  ? "bg-burgundy text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Rich Text
            </button>
          </div>
        )}

        {/* Save button */}
        {!isYaml && (
          <button
            onClick={saveFile}
            disabled={!isDirty || isSaving}
            className={`btn-editorial-ghost !px-2.5 !py-1 text-caption gap-1.5 ${
              !isDirty ? "opacity-40" : ""
            }`}
            title="Save (Cmd+S)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDirty ? (
              <Save className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5 text-success-500" />
            )}
            Save
          </button>
        )}

        {/* Check spelling, grammar & voice */}
        {!isYaml && (
          <button
            onClick={handleCheck}
            className="btn-editorial-ghost !px-2.5 !py-1 text-caption gap-1.5"
            title="Check for spelling, grammar &amp; voice (selection or whole file)"
          >
            <SpellCheck className="w-3.5 h-3.5" />
            Check
          </button>
        )}
      </div>

      {/* Frontmatter panel */}
      <FrontmatterPanel />

      {/* Content area */}
      {isYaml ? (
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="font-mono text-body-sm text-foreground whitespace-pre-wrap">
            {activeFile.raw}
          </pre>
        </div>
      ) : viewMode === "markdown" ? (
        <MarkdownEditor key={activeFile.path} />
      ) : (
        <RichTextEditor key={activeFile.path} />
      )}
    </div>
  );
}
