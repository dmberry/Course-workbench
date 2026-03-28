"use client";

import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { FileTreeNode } from "./FileTreeNode";

export function FileTree() {
  const { fileTree, isTreeLoading, contentRoot } = useWorkspace();

  if (!contentRoot) {
    return (
      <div className="px-3 py-4 text-caption text-muted-foreground">
        No content root configured. Pull a course to get started.
      </div>
    );
  }

  if (isTreeLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-caption text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading...
      </div>
    );
  }

  if (fileTree.length === 0) {
    return (
      <div className="px-3 py-4 text-caption text-muted-foreground">
        No files found. Pull a course to populate the workspace.
      </div>
    );
  }

  return (
    <div className="py-1">
      {fileTree.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
