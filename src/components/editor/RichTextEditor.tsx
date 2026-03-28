"use client";

import { useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import { Table as TableExtension, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import ImageExtension from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import matter from "gray-matter";
import { useWorkspace } from "@/context/WorkspaceContext";
import { renderMarkdown } from "@/lib/markdown/render";
import { htmlToMarkdown } from "@/lib/canvas/converters";
import { EditorToolbar } from "./EditorToolbar";
import "./tiptap-editorial.css";

function contentToHtml(markdown: string): string {
  try {
    const { content } = matter(markdown);
    return renderMarkdown(content.trim());
  } catch {
    return renderMarkdown(markdown);
  }
}

function extractFrontmatter(markdown: string): string {
  try {
    const { data } = matter(markdown);
    if (Object.keys(data).length === 0) return "";
    return matter.stringify("", data).trim() + "\n";
  } catch {
    return "";
  }
}

export function RichTextEditor() {
  const { editorContent, setEditorContent, saveFile } = useWorkspace();

  // Store frontmatter separately so it survives round-trips
  const frontmatterRef = useRef(extractFrontmatter(editorContent));
  // Track last markdown we pushed so we can detect external changes
  const lastPushedRef = useRef(editorContent);
  // Debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialHtml = useRef(contentToHtml(editorContent));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      TableExtension.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: initialHtml.current,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          saveFile();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = ed.getHTML();
        const md = htmlToMarkdown(html);
        const full = frontmatterRef.current
          ? frontmatterRef.current + "\n" + md
          : md;
        lastPushedRef.current = full;
        setEditorContent(full);
      }, 300);
    },
  });

  // Sync external content changes (e.g. AI edits) into the editor
  const syncExternalContent = useCallback(
    (newContent: string) => {
      if (!editor || editor.isDestroyed) return;
      frontmatterRef.current = extractFrontmatter(newContent);
      const html = contentToHtml(newContent);
      editor.commands.setContent(html);
    },
    [editor],
  );

  useEffect(() => {
    // If editorContent changed and it wasn't us who changed it, sync
    if (editorContent !== lastPushedRef.current) {
      lastPushedRef.current = editorContent;
      syncExternalContent(editorContent);
    }
  }, [editorContent, syncExternalContent]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="tiptap-editorial flex-1 flex flex-col min-h-0">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-card">
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}
