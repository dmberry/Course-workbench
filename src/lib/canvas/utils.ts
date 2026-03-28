// Shared utility functions for Canvas operations.
// Ported from canvas-cli-for-codex cli.py (slugify, matches_name).

/**
 * Convert text to a safe filename.
 * Removes problematic characters, replaces spaces with hyphens, limits length.
 */
export function slugify(text: string): string {
  let result = text.replace(/[<>:"/\\|?*]/g, "");
  result = result.trim().replace(/\s+/g, "-");
  result = result.replace(/-+/g, "-");
  return result.slice(0, 100);
}

/**
 * Check if search term matches target with word boundary awareness.
 *
 * '1.5' matches '1.5 Assignment' but not '11.5 Assignment'
 * 'Module 1' matches 'Module 1 - Intro' but not 'Module 10'
 *
 * Ported from Python cli.py matches_name().
 */
export function matchesName(search: string, target: string): boolean {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase();

  // Escape special regex characters in search term
  const escaped = searchLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match at word boundaries (start/end of string, spaces, or before/after non-alphanumeric)
  const pattern = new RegExp(
    `(?:^|(?<=\\s)|(?<=[^\\w.]))${escaped}(?:$|(?=\\s)|(?=[^\\w.]))`
  );
  if (pattern.test(targetLower)) {
    return true;
  }

  // Also try simpler word boundary match
  const patternSimple = new RegExp(`\\b${escaped}\\b`);
  if (patternSimple.test(targetLower)) {
    return true;
  }

  return false;
}
