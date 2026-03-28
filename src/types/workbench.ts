// Workbench types for the Course Workbench UI.

/** File tree node for the sidebar. */
export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  fileType?:
    | "page"
    | "assignment"
    | "discussion"
    | "rubric"
    | "module-meta"
    | "course-meta"
    | "submission"
    | "unknown";
  children?: FileTreeNode[];
}

/** Parsed file content returned by the read API. */
export interface FileContent {
  path: string;
  name: string;
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
  html: string;
  fileType: FileTreeNode["fileType"];
}

/** Course summary for the course selector. */
export interface CourseSummary {
  name: string;
  path: string;
  canvasId: number;
  moduleCount: number;
  pageCount: number;
  level?: number; // FHEQ level: 4=1st yr UG, 5=2nd yr, 6=3rd yr, 7=Masters
}

/** Pull form data. */
export interface PullFormData {
  courseId: string;
  moduleName?: string;
  contentRoot?: string;
  includeRubrics?: boolean;
  submissions?: "all" | "ungraded" | "none";
  includeDiscussions?: boolean;
}

/** Push form data. */
export interface PushFormData {
  filePath?: string;
  moduleName?: string;
  dryRun: boolean;
  contentRoot?: string;
}
