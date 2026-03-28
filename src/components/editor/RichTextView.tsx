"use client";

import { useMemo, useRef, useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { renderMarkdown } from "@/lib/markdown/render";
import matter from "gray-matter";

export function RichTextView() {
  const { editorContent } = useWorkspace();
  const articleRef = useRef<HTMLElement>(null);

  const html = useMemo(() => {
    // Parse frontmatter out so we only render the body
    try {
      const parsed = matter(editorContent);
      return renderMarkdown(parsed.content.trim());
    } catch {
      return renderMarkdown(editorContent);
    }
  }, [editorContent]);

  // Sanitise links in rendered HTML: strip target="_blank" and
  // block external popups (Panopto, Canvas embeds, etc.)
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    // Remove target="_blank" from all links inside rendered content
    const links = el.querySelectorAll("a[target]");
    links.forEach((a) => {
      a.removeAttribute("target");
      a.setAttribute("rel", "noopener noreferrer");
    });

    // Sandbox any iframes to prevent popup/redirect behaviour
    const iframes = el.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      if (!iframe.hasAttribute("sandbox")) {
        iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
      }
    });
  }, [html]);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-card">
      <article
        ref={articleRef}
        className="prose prose-lg max-w-none
          prose-headings:font-display prose-headings:text-foreground
          prose-p:font-body prose-p:text-foreground prose-p:leading-relaxed
          prose-a:text-burgundy prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground
          prose-code:text-burgundy-700 prose-code:bg-cream dark:prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm
          prose-blockquote:border-l-gold prose-blockquote:text-slate
          prose-table:border-parchment dark:prose-table:border-muted"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
