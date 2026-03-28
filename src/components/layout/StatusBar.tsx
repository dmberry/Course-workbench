"use client";

import { useWorkspace } from "@/context/WorkspaceContext";

export function StatusBar() {
  const { activeFile, isDirty, activeCourse, isCanvasBusy, viewMode } =
    useWorkspace();

  return (
    <footer className="px-4 py-1 border-t border-border bg-card flex items-center gap-4 text-caption text-muted-foreground font-sans">
      <span>Course Workbench v0.3.0</span>

      {isCanvasBusy && (
        <span className="text-burgundy font-medium">Canvas operation running...</span>
      )}

      <div className="flex-1" />

      {activeCourse && (
        <span className="truncate max-w-[200px]">{activeCourse.name}</span>
      )}

      {activeFile && (
        <>
          <span className="text-foreground">{activeFile.fileType}</span>
          <span className="truncate max-w-[250px]">{activeFile.name}</span>
          <span>{viewMode === "markdown" ? "Markdown" : "Preview"}</span>
          {isDirty ? (
            <span className="text-warning-500 font-medium">Modified</span>
          ) : (
            <span className="text-success-500">Saved</span>
          )}
        </>
      )}
    </footer>
  );
}
