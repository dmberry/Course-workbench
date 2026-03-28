// Bidirectional HTML <-> Markdown conversion with HTML table preservation.
// Replaces the regex-based Python converters.py with library-based approach.
// Uses turndown (HTML->MD) and marked (MD->HTML).
// HTML tables are preserved as-is to maintain accessibility features
// (captions, scope attributes, thead/tbody structure).

import TurndownService from "turndown";
import { marked } from "marked";

/**
 * Convert Canvas HTML to Markdown.
 *
 * HTML tables are extracted before conversion and restored after,
 * preserving their accessibility attributes intact.
 */
export function htmlToMarkdown(htmlContent: string): string {
  if (!htmlContent) return "";

  let text = htmlContent;

  // Step 1: Extract and preserve HTML tables
  const tables: string[] = [];
  text = text.replace(
    /<table[^>]*>[\s\S]*?<\/table>/gi,
    (match) => {
      tables.push(match);
      return `<div data-table-placeholder="${tables.length - 1}"></div>`;
    }
  );

  // Step 2: Convert remaining HTML to Markdown using turndown
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Keep iframes (Canvas embeds) as-is
  turndown.keep(["iframe"]);

  let markdown = turndown.turndown(text);

  // Step 3: Restore HTML tables
  for (let i = 0; i < tables.length; i++) {
    markdown = markdown.replace(
      new RegExp(
        `<div data-table-placeholder="${i}"></div>|` +
        `\\[\\]\\(\\)|` +
        `data-table-placeholder="${i}"`,
        "g"
      ),
      `\n\n${tables[i]}\n\n`
    );
    // Also handle case where turndown may have converted the placeholder div
    markdown = markdown.replace(
      `data-table-placeholder="${i}"`,
      `\n\n${tables[i]}\n\n`
    );
  }

  // Clean up excessive newlines
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return markdown;
}

/**
 * Convert Markdown to HTML for Canvas.
 *
 * HTML tables embedded in the markdown are extracted before conversion
 * and restored after, preserving them exactly as-is.
 */
export function markdownToHtml(markdownContent: string): string {
  if (!markdownContent) return "";

  let text = markdownContent;

  // Step 1: Extract and preserve HTML tables
  const tables: string[] = [];
  text = text.replace(
    /<table[^>]*>[\s\S]*?<\/table>/gi,
    (match) => {
      tables.push(match);
      return `<p>__HTML_TABLE_${tables.length - 1}__</p>`;
    }
  );

  // Step 2: Convert Markdown to HTML using marked
  let html = marked.parse(text, { async: false }) as string;

  // Step 3: Restore HTML tables
  for (let i = 0; i < tables.length; i++) {
    // Handle both wrapped-in-p and bare placeholder
    html = html.replace(
      `<p>__HTML_TABLE_${i}__</p>`,
      tables[i]
    );
    html = html.replace(`__HTML_TABLE_${i}__`, tables[i]);
  }

  return html;
}
