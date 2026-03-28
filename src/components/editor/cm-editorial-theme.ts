// CodeMirror editorial theme using CCS-WB design tokens.
// Uses CSS custom properties so it adapts to light/dark mode.

import { EditorView } from "@codemirror/view";

export const editorialTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
    fontFamily: "var(--font-source-serif), Georgia, serif",
  },
  ".cm-content": {
    padding: "16px 24px",
    caretColor: "hsl(var(--burgundy))",
    lineHeight: "1.75",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--burgundy))",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "hsl(var(--cream) / 0.8)",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--ivory) / 0.5)",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--muted-foreground))",
    borderRight: "1px solid hsl(var(--border))",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    fontSize: "11px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--muted))",
  },
  ".cm-foldGutter": {
    width: "16px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});
