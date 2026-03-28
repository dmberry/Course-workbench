// Canvas configuration loading and course folder routing.
// Supports both .canvas-config.yaml and canvas-config.local.md formats.
// Ported from canvas-cli-for-codex config.py.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";
import type { CanvasConfig } from "./types";
import { slugify } from "./utils";

// ==================== Runtime Config (baseUrl + token) ====================

export interface CanvasRuntimeConfig {
  baseUrl: string;
  token: string;
}

const DEFAULT_MD_CONFIG = "canvas-config.local.md";
const DEFAULT_YAML_CONFIG = ".canvas-config.yaml";

function parseMarkdownConfig(
  content: string
): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/^[\s>*-]+/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2]
      .trim()
      .replace(/^`|`$/g, "")
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "");
    result[key] = value;
  }
  return result;
}

function loadMarkdownConfigFile(): Partial<Record<string, string>> {
  const configFile =
    process.env.CANVAS_CONFIG_MD_PATH ||
    join(process.cwd(), DEFAULT_MD_CONFIG);
  if (!existsSync(configFile)) return {};
  try {
    const text = readFileSync(configFile, "utf8");
    return parseMarkdownConfig(text);
  } catch {
    return {};
  }
}

/**
 * Load the full Canvas config, trying YAML first, then falling back to MD.
 * Returns the full CanvasConfig with all fields (including course_folders, default_folder).
 */
export function loadCanvasConfig(): CanvasConfig {
  // Try YAML config first
  const yamlPath =
    process.env.CANVAS_CONFIG_PATH ||
    join(process.cwd(), DEFAULT_YAML_CONFIG);

  if (existsSync(yamlPath)) {
    try {
      const text = readFileSync(yamlPath, "utf8");
      const data = YAML.parse(text) as Record<string, unknown>;
      const config: CanvasConfig = {
        canvas_url: ((data.canvas_url as string) || "").replace(/\/$/, ""),
        api_token: (data.api_token as string) || "",
        default_folder:
          (data.default_folder as string) ||
          (data.courses_dir as string) ||
          "courses",
        course_folders:
          (data.course_folders as Record<string, string>) || undefined,
        content_root: (data.content_root as string) || undefined,
      };
      if (config.canvas_url && config.api_token) {
        return config;
      }
    } catch {
      // Fall through to MD config
    }
  }

  // Fall back to markdown config
  const md = loadMarkdownConfigFile();
  return {
    canvas_url: (md.CANVAS_BASE_URL || process.env.CANVAS_BASE_URL || "").replace(/\/$/, ""),
    api_token: md.CANVAS_API_TOKEN || process.env.CANVAS_API_TOKEN || "",
    default_folder: md.DEFAULT_FOLDER || "courses",
    content_root: md.CONTENT_ROOT || undefined,
  };
}

/**
 * Get the runtime config (baseUrl + token) for API calls.
 * This is the minimal config needed by the API client.
 */
export function getCanvasRuntimeConfig(): CanvasRuntimeConfig {
  const config = loadCanvasConfig();

  if (!config.canvas_url) {
    throw new Error(
      "Missing Canvas base URL. Set canvas_url in .canvas-config.yaml or CANVAS_BASE_URL in canvas-config.local.md."
    );
  }
  if (!config.api_token) {
    throw new Error(
      "Missing Canvas API token. Set api_token in .canvas-config.yaml or CANVAS_API_TOKEN in canvas-config.local.md."
    );
  }

  return { baseUrl: config.canvas_url, token: config.api_token };
}

// ==================== Course Name Parsing ====================

/**
 * Parse course name to extract semester and course code.
 *
 * Example: "2026SP-PHIL-123-001H-16W: AI and Ethics"
 * Returns: { semester: "SP26", courseCode: "PHIL-123" }
 *
 * Ported from Python config.py parse_course_info().
 */
export function parseCourseInfo(courseName: string): {
  semester: string;
  courseCode: string;
} {
  const match = courseName.match(/^(\d{4})([A-Za-z]{2})-([A-Za-z]+)-(\d+)/);
  if (match) {
    const [, year, sem, dept, num] = match;
    const semester = `${sem.toUpperCase()}${year.slice(2)}`;
    const courseCode = `${dept.toUpperCase()}-${num}`;
    return { semester, courseCode };
  }
  return { semester: "", courseCode: "" };
}

// ==================== Course Folder Routing ====================

/**
 * Get the folder for a specific course based on its code.
 * Uses course_folders mapping from config to route courses to subject folders.
 *
 * Ported from Python config.py get_course_folder().
 */
export function getCourseFolder(
  courseCode: string,
  courseName: string,
  config: CanvasConfig
): string {
  const courseFolders = config.course_folders || {};
  const defaultFolder = config.default_folder || "courses";

  const searchText = `${courseCode} ${courseName}`.toUpperCase();

  // Try to match course code prefix with word boundary awareness.
  // Prefer the longest prefix first so specific mappings win over broad ones.
  let targetFolder = defaultFolder;
  const prefixes = Object.entries(courseFolders).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [prefix, folder] of prefixes) {
    const escaped = prefix.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
    if (pattern.test(searchText)) {
      targetFolder = folder;
      break;
    }
  }

  // Parse course name for subfolder naming
  const info = parseCourseInfo(courseName);
  let subfolder: string;
  if (info.semester && info.courseCode) {
    subfolder = `${info.semester}-${info.courseCode}`;
  } else if (courseName) {
    subfolder = slugify(courseName);
  } else if (courseCode) {
    subfolder = slugify(courseCode);
  } else {
    subfolder = "course";
  }

  return join(targetFolder, subfolder);
}

/**
 * Get the content root directory for storing pulled courses.
 * Configurable via config.content_root or falls back to process.cwd() + default_folder.
 */
export function getContentRoot(config: CanvasConfig): string {
  if (config.content_root) {
    return resolve(config.content_root);
  }
  return resolve(process.cwd(), config.default_folder);
}
