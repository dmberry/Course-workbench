"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import { useWorkspace } from "@/context/WorkspaceContext";
import { editorialTheme } from "./cm-editorial-theme";

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { editorContent, setEditorContent, saveFile } = useWorkspace();

  // Track what we last pushed to setEditorContent so we can detect external changes
  const lastContentRef = useRef(editorContent);

  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          saveFile();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        lastContentRef.current = content;
        setEditorContent(content);
      }
    });

    const state = EditorState.create({
      doc: editorContent,
      extensions: [
        lineNumbers(),
        history(),
        markdown(),
        editorialTheme,
        saveKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor only when the raw content source changes (new file opened).
    // editorContent changes from typing are handled internally by CM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes (e.g. reloadActiveFile after AI edit) into CM
  useEffect(() => {
    const view = viewRef.current;
    if (!view || editorContent === lastContentRef.current) return;
    lastContentRef.current = editorContent;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: editorContent,
      },
    });
  }, [editorContent]);

  return <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />;
}
