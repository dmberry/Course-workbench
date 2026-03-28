"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  FileText,
  ClipboardCheck,
  MessageCircle,
  Table,
  Folder,
  FolderOpen,
  BookOpen,
  Settings,
  UserCheck,
  File,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { FileTreeNode as FileTreeNodeType } from "@/types/workbench";

const FILE_TYPE_ICONS: Record<
  NonNullable<FileTreeNodeType["fileType"]>,
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

const MENU_ITEM_CLASS =
  "flex items-center gap-2 px-2 py-1.5 text-caption font-sans text-foreground rounded-sm cursor-pointer outline-none hover:bg-cream/60 dark:hover:bg-muted/60 data-[highlighted]:bg-cream/60 dark:data-[highlighted]:bg-muted/60";
const MENU_ITEM_DANGER_CLASS =
  "flex items-center gap-2 px-2 py-1.5 text-caption font-sans text-error-500 rounded-sm cursor-pointer outline-none hover:bg-red-50 dark:hover:bg-red-950/30 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-950/30";
const ACTION_BTN_CLASS =
  "p-0.5 rounded hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-foreground";

interface Props {
  node: FileTreeNodeType;
  depth: number;
}

export function FileTreeNode({ node, depth }: Props) {
  const { activeFile, openFile, deleteItem, renameItem, createFolder } =
    useWorkspace();
  const [expanded, setExpanded] = useState(depth < 2);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);

  const isActive = activeFile?.path === node.path;
  const indent = depth * 16;

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      if (node.type === "file") {
        const dotIndex = node.name.lastIndexOf(".");
        renameRef.current.setSelectionRange(
          0,
          dotIndex > 0 ? dotIndex : node.name.length
        );
      } else {
        renameRef.current.select();
      }
    }
  }, [renaming, node.type, node.name]);

  const handleStartRename = useCallback(() => {
    setRenameValue(node.name);
    setRenaming(true);
  }, [node.name]);

  const handleConfirmRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.name) {
      setRenaming(false);
      return;
    }
    await renameItem(node.path, trimmed);
    setRenaming(false);
  }, [renameValue, node.name, node.path, renameItem]);

  const handleCancelRename = useCallback(() => {
    setRenaming(false);
    setRenameValue(node.name);
  }, [node.name]);

  const handleDelete = useCallback(async () => {
    const kind = node.type === "directory" ? "folder" : "file";
    if (!confirm(`Delete ${kind} "${node.name}"? This cannot be undone.`)) {
      return;
    }
    await deleteItem(node.path);
  }, [node, deleteItem]);

  const handleNewFolder = useCallback(async () => {
    const name = prompt("New folder name:");
    if (!name?.trim()) return;
    const parent =
      node.type === "directory"
        ? node.path
        : node.path.substring(0, node.path.lastIndexOf("/"));
    await createFolder(parent, name.trim());
    if (node.type === "directory") setExpanded(true);
  }, [node, createFolder]);

  // Inline rename input
  const renameInput = (
    <input
      ref={renameRef}
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleConfirmRename();
        if (e.key === "Escape") handleCancelRename();
      }}
      onBlur={handleConfirmRename}
      className="flex-1 min-w-0 bg-white dark:bg-card border border-burgundy rounded px-1 py-0 text-caption font-sans text-foreground outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );

  // Hover action icons — uses <span role="button"> to avoid nested <button>
  const hoverActions = (
    <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      {node.type === "directory" && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); handleNewFolder(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleNewFolder(); } }}
          className={ACTION_BTN_CLASS}
          title="New Folder"
        >
          <FolderPlus className="w-3 h-3" />
        </span>
      )}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); handleStartRename(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleStartRename(); } }}
        className={ACTION_BTN_CLASS}
        title="Rename"
      >
        <Pencil className="w-3 h-3" />
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDelete(); } }}
        className="p-0.5 rounded hover:bg-cream dark:hover:bg-muted text-muted-foreground hover:text-error-500"
        title="Delete"
      >
        <Trash2 className="w-3 h-3" />
      </span>
    </span>
  );

  // Context menu content
  const menuContent = (
    <ContextMenu.Content className="min-w-[160px] bg-card border border-border rounded-sm shadow-editorial-lg p-1 z-[60]">
      {node.type === "directory" && (
        <ContextMenu.Item onSelect={handleNewFolder} className={MENU_ITEM_CLASS}>
          <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
          New Folder
        </ContextMenu.Item>
      )}
      <ContextMenu.Item onSelect={handleStartRename} className={MENU_ITEM_CLASS}>
        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        Rename
      </ContextMenu.Item>
      <ContextMenu.Separator className="h-px my-1 bg-border" />
      <ContextMenu.Item onSelect={handleDelete} className={MENU_ITEM_DANGER_CLASS}>
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </ContextMenu.Item>
    </ContextMenu.Content>
  );

  // ==================== Directory node ====================
  if (node.type === "directory") {
    const DirIcon = expanded ? FolderOpen : Folder;
    const Chevron = expanded ? ChevronDown : ChevronRight;

    return (
      <div>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpanded(!expanded)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}
              className={`group w-full flex items-center gap-1 py-0.5 pr-2 text-caption font-sans
                hover:bg-cream/60 dark:hover:bg-muted/60 transition-colors rounded-sm cursor-pointer select-none
                ${isActive ? "bg-cream dark:bg-muted text-burgundy" : "text-foreground"}`}
              style={{ paddingLeft: `${indent + 4}px` }}
            >
              <Chevron className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <DirIcon className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              {renaming ? renameInput : (
                <>
                  <span className="truncate">{node.name}</span>
                  {hoverActions}
                </>
              )}
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>{menuContent}</ContextMenu.Portal>
        </ContextMenu.Root>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== File node ====================
  const Icon = FILE_TYPE_ICONS[node.fileType || "unknown"];

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={() => openFile(node.path)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFile(node.path); }}
          className={`group w-full flex items-center gap-1 py-0.5 pr-2 text-caption font-sans
            hover:bg-cream/60 dark:hover:bg-muted/60 transition-colors rounded-sm cursor-pointer select-none
            ${isActive ? "bg-cream dark:bg-muted text-burgundy font-medium" : "text-foreground"}`}
          style={{ paddingLeft: `${indent + 20}px` }}
        >
          <Icon
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              isActive ? "text-burgundy" : "text-muted-foreground"
            }`}
          />
          {renaming ? renameInput : (
            <>
              <span className="truncate">{node.name}</span>
              {hoverActions}
            </>
          )}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>{menuContent}</ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
