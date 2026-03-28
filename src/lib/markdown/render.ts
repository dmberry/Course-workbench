// Client-safe markdown renderer for live preview.
// Uses marked directly (no turndown/DOM dependencies).

import { marked, Renderer } from "marked";

// Custom renderer: sanitise links to prevent unwanted popups
const renderer = new Renderer();
renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${href}"${titleAttr} rel="noopener noreferrer">${text}</a>`;
};

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, renderer }) as string;
}
