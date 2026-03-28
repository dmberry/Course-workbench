"use client";

import { useEffect, useRef } from "react";
import {
  FileText,
  ClipboardCheck,
  MessageCircle,
  Table,
  BookOpen,
  Settings,
  UserCheck,
  File,
} from "lucide-react";
import type { FileTreeNode } from "@/types/workbench";

const FILE_TYPE_ICONS: Record<
  NonNullable<FileTreeNode["fileType"]>,
  typeof FileText
> = {
  page: FileText,
  assignment: ClipboardCheck,
  discussion: MessageCircle,
  rubric: Table,
  "course-meta": BookOpen,
  "module-meta": Settings,
  submission: UserCheck,
  unknown: File,
};

export interface FlatFile {
  name: string;
  path: string;
  fileType: NonNullable<FileTreeNode["fileType"]>;
}

export function flattenTree(nodes: FileTreeNode[]): FlatFile[] {
  const result: FlatFile[] = [];
  function walk(items: FileTreeNode[]) {
    for (const item of items) {
      if (item.type === "file") {
        result.push({
          name: item.name,
          path: item.path,
          fileType: item.fileType || "unknown",
        });
      }
      if (item.children) walk(item.children);
    }
  }
  walk(nodes);
  return result;
}

interface FileMentionPopupProps {
  query: string;
  files: FlatFile[];
  selectedIndex: number;
  onSelect: (file: FlatFile) => void;
  onClose: () => void;
}

export function FileMentionPopup({
  query,
  files,
  selectedIndex,
  onSelect,
  onClose,
}: FileMentionPopupProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  const shown = filtered.slice(0, 8);

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-editorial-md overflow-y-auto max-h-56 z-50"
    >
      {shown.map((file, i) => {
        const Icon = FILE_TYPE_ICONS[file.fileType] || File;
        return (
          <button
            key={file.path}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // keep textarea focus
              onSelect(file);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-body-sm font-sans transition-colors ${
              i === selectedIndex
                ? "bg-burgundy/10 text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">{file.name}</span>
          </button>
        );
      })}
      {filtered.length > 8 && (
        <div className="px-3 py-1 text-[10px] text-slate-muted font-sans">
          +{filtered.length - 8} more
        </div>
      )}
    </div>
  );
}
