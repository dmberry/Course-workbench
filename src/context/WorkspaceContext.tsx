"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  FileTreeNode,
  FileContent,
  CourseSummary,
  PullFormData,
  PushFormData,
} from "@/types/workbench";

// ==================== Types ====================

interface WorkspaceState {
  // Workspace root (parent directory containing all courses)
  workspaceRoot: string;
  setWorkspaceRoot: (root: string) => void;

  // Content root (active course directory)
  contentRoot: string;
  setContentRoot: (root: string) => void;

  // Courses in workspace
  courses: CourseSummary[];
  isCourseListLoading: boolean;
  fetchCourses: () => Promise<void>;

  // Active course
  activeCourse: CourseSummary | null;
  setActiveCourse: (course: CourseSummary | null) => void;
  clearActiveCourse: () => void;

  // File tree
  fileTree: FileTreeNode[];
  isTreeLoading: boolean;
  refreshTree: () => Promise<void>;

  // Active file
  activeFile: FileContent | null;
  isFileLoading: boolean;
  openFile: (path: string) => Promise<void>;
  reloadActiveFile: () => Promise<void>;
  closeFile: () => void;

  // Editor state
  editorContent: string;
  setEditorContent: (content: string) => void;
  isDirty: boolean;
  saveFile: () => Promise<void>;
  isSaving: boolean;

  // View mode
  viewMode: "markdown" | "richtext";
  setViewMode: (mode: "markdown" | "richtext") => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // File management
  deleteItem: (path: string) => Promise<boolean>;
  renameItem: (oldPath: string, newName: string) => Promise<boolean>;
  createFolder: (parentPath: string, name: string) => Promise<boolean>;

  // Proofread request (cross-component: editor → chat)
  proofreadRequest: string | null;
  requestProofread: (text: string | null) => void;

  // Canvas operations
  isCanvasBusy: boolean;
  canvasLog: string;
  showCanvasLog: boolean;
  setShowCanvasLog: (show: boolean) => void;
  runPull: (data: PullFormData) => Promise<void>;
  runPush: (data: PushFormData) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

// ==================== LocalStorage helpers ====================

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(`cw:${key}`);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`cw:${key}`, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

// ==================== Log formatters ====================

interface PullResult {
  ok: boolean;
  success?: boolean;
  itemsPulled?: number;
  courseDir?: string;
  errors?: string[];
  items?: { type: string; name: string; path: string }[];
  error?: string;
}

function formatPullLog(r: PullResult): string {
  if (!r.ok || !r.success) {
    return `Pull failed: ${r.error || "Unknown error"}`;
  }
  const lines: string[] = [];
  lines.push(`Pulled ${r.itemsPulled ?? 0} items`);
  lines.push(`Location: ${r.courseDir ?? "unknown"}`);
  if (r.errors && r.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    r.errors.forEach((e) => lines.push(`  - ${e}`));
  }
  if (r.items && r.items.length > 0) {
    lines.push("");
    const grouped: Record<string, string[]> = {};
    for (const item of r.items) {
      const key = item.type || "other";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item.name);
    }
    for (const [type, names] of Object.entries(grouped)) {
      lines.push(`${type}s (${names.length}):`);
      names.forEach((n) => lines.push(`  - ${n}`));
    }
  }
  return lines.join("\n");
}

interface PushResult {
  ok: boolean;
  success?: boolean;
  error?: string;
  log?: string;
  pushed?: { type: string; name: string }[];
  dryRun?: boolean;
}

function formatPushLog(r: PushResult): string {
  if (!r.ok || !r.success) {
    return `Push failed: ${r.error || "Unknown error"}`;
  }
  const lines: string[] = [];
  if (r.dryRun) lines.push("[DRY RUN] No changes were made.\n");
  if (r.log) {
    lines.push(r.log);
  } else if (r.pushed && r.pushed.length > 0) {
    lines.push(`Pushed ${r.pushed.length} items:`);
    r.pushed.forEach((p) => lines.push(`  - [${p.type}] ${p.name}`));
  } else {
    lines.push("Push completed.");
  }
  return lines.join("\n");
}

// ==================== Provider ====================

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Workspace root (parent of all courses)
  const [workspaceRoot, setWorkspaceRootState] = useState("");
  const setWorkspaceRoot = useCallback((root: string) => {
    setWorkspaceRootState(root);
    saveLocal("workspaceRoot", root);
  }, []);

  // Content root (active course directory)
  const [contentRoot, setContentRootState] = useState("");
  const setContentRoot = useCallback((root: string) => {
    setContentRootState(root);
    saveLocal("contentRoot", root);
  }, []);

  // Active course
  const [activeCourse, setActiveCourseState] = useState<CourseSummary | null>(
    null
  );
  const setActiveCourse = useCallback((course: CourseSummary | null) => {
    setActiveCourseState(course);
    saveLocal("activeCourse", course);
  }, []);

  // Courses in workspace
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isCourseListLoading, setIsCourseListLoading] = useState(false);

  // File tree
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState(false);

  // Active file
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);

  // Editor
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = editorContent !== savedContent;

  // View mode
  const [viewMode, setViewModeState] = useState<"markdown" | "richtext">(
    "markdown"
  );
  const setViewMode = useCallback((mode: "markdown" | "richtext") => {
    setViewModeState(mode);
    saveLocal("viewMode", mode);
  }, []);

  // Sidebar
  const [sidebarOpen, setSidebarOpenState] = useState(true);
  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    saveLocal("sidebarOpen", open);
  }, []);

  // Canvas
  const [isCanvasBusy, setIsCanvasBusy] = useState(false);
  const [canvasLog, setCanvasLog] = useState("");
  const [showCanvasLog, setShowCanvasLog] = useState(false);
  const [proofreadRequest, requestProofread] = useState<string | null>(null);

  // ---- Hydrate from localStorage ----
  useEffect(() => {
    const savedWorkspaceRoot = loadLocal("workspaceRoot", "");
    const savedActiveCourse = loadLocal<CourseSummary | null>("activeCourse", null);
    const savedContentRoot = loadLocal("contentRoot", "");

    // Migration: derive workspaceRoot from existing state if not set
    if (!savedWorkspaceRoot) {
      let derived = "";
      if (savedActiveCourse?.path) {
        // Active course exists — workspace root is the parent directory
        const lastSlash = savedActiveCourse.path.lastIndexOf("/");
        if (lastSlash > 0) derived = savedActiveCourse.path.substring(0, lastSlash);
      } else if (savedContentRoot) {
        // Only contentRoot exists (old setup) — it was the workspace folder
        derived = savedContentRoot;
      }
      if (derived) {
        setWorkspaceRootState(derived);
        saveLocal("workspaceRoot", derived);
      }
    } else {
      setWorkspaceRootState(savedWorkspaceRoot);
    }

    setContentRootState(savedContentRoot);
    setActiveCourseState(savedActiveCourse);
    setViewModeState(loadLocal("viewMode", "markdown"));
    setSidebarOpenState(loadLocal("sidebarOpen", true));
  }, []);

  // ---- Fetch courses from workspace ----
  const fetchCourses = useCallback(async () => {
    if (!workspaceRoot) return;
    setIsCourseListLoading(true);
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", contentRoot: workspaceRoot }),
      });
      const data = await res.json();
      if (data.ok && data.courses) {
        setCourses(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.courses.map((c: any) => ({
            name: c.name,
            path: c.path,
            canvasId: c.canvasId || 0,
            moduleCount: 0,
            pageCount: c.pages || 0,
            level: c.level,
          }))
        );
      }
    } catch {
      setCourses([]);
    } finally {
      setIsCourseListLoading(false);
    }
  }, [workspaceRoot]);

  // Auto-fetch courses when workspaceRoot changes
  useEffect(() => {
    if (workspaceRoot) {
      fetchCourses();
    }
  }, [workspaceRoot, fetchCourses]);

  // ---- Navigate back to course list ----
  const closeFile = useCallback(() => {
    setActiveFile(null);
    setEditorContent("");
    setSavedContent("");
  }, []);

  const clearActiveCourse = useCallback(() => {
    setActiveCourseState(null);
    saveLocal("activeCourse", null);
    setContentRootState("");
    saveLocal("contentRoot", "");
    setFileTree([]);
    closeFile();
  }, [closeFile]);

  // ---- Fetch tree ----
  const refreshTree = useCallback(async () => {
    const root = contentRoot;
    if (!root) return;
    setIsTreeLoading(true);
    try {
      const res = await fetch(
        `/api/files?root=${encodeURIComponent(root)}`
      );
      const data = await res.json();
      if (data.ok) {
        setFileTree(data.tree);
      }
    } catch {
      // Silently fail — tree stays empty
    } finally {
      setIsTreeLoading(false);
    }
  }, [contentRoot]);

  // Auto-refresh when content root changes
  useEffect(() => {
    if (contentRoot) {
      refreshTree();
    }
  }, [contentRoot, refreshTree]);

  // ---- Open file ----
  const openFile = useCallback(async (filePath: string) => {
    setIsFileLoading(true);
    try {
      const res = await fetch(
        `/api/files/read?path=${encodeURIComponent(filePath)}`
      );
      const data = await res.json();
      if (data.ok && data.file) {
        setActiveFile(data.file);
        setEditorContent(data.file.raw);
        setSavedContent(data.file.raw);
      }
    } catch {
      // Silently fail
    } finally {
      setIsFileLoading(false);
    }
  }, []);

  // ---- Reload active file from disk (e.g. after Claude Code edits it) ----
  const reloadActiveFile = useCallback(async () => {
    if (!activeFile) return;
    try {
      const res = await fetch(
        `/api/files/read?path=${encodeURIComponent(activeFile.path)}`
      );
      const data = await res.json();
      if (data.ok && data.file) {
        setActiveFile(data.file);
        setEditorContent(data.file.raw);
        setSavedContent(data.file.raw);
      }
    } catch {
      // Silently fail
    }
  }, [activeFile]);

  // ---- Save file ----
  const saveFile = useCallback(async () => {
    if (!activeFile || !isDirty) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFile.path, content: editorContent }),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedContent(editorContent);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, editorContent, isDirty]);

  // ---- Canvas pull ----
  const runPull = useCallback(
    async (data: PullFormData) => {
      setIsCanvasBusy(true);
      setCanvasLog("");
      setShowCanvasLog(true);
      try {
        // Use workspaceRoot as the pull target (where course folders live)
        const pullRoot = data.contentRoot || workspaceRoot || contentRoot || undefined;
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pull",
            courseId: data.courseId,
            moduleName: data.moduleName || undefined,
            contentRoot: pullRoot,
            includeRubrics: data.includeRubrics,
            submissions: data.submissions || "none",
            includeDiscussions: data.includeDiscussions,
          }),
        });
        const result = await res.json();
        setCanvasLog(formatPullLog(result));
        if (result.ok) {
          // Refresh course list so the new course appears in the sidebar
          await fetchCourses();
          // Also refresh the file tree if a course is currently selected
          if (contentRoot) await refreshTree();
        }
      } catch (err) {
        setCanvasLog(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setIsCanvasBusy(false);
      }
    },
    [workspaceRoot, contentRoot, refreshTree, fetchCourses]
  );

  // ---- Canvas push ----
  const runPush = useCallback(
    async (data: PushFormData) => {
      setIsCanvasBusy(true);
      setCanvasLog("");
      setShowCanvasLog(true);
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "push",
            filePath: data.filePath || undefined,
            moduleName: data.moduleName || undefined,
            dryRun: data.dryRun,
            contentRoot: data.contentRoot || contentRoot || undefined,
          }),
        });
        const result = await res.json();
        setCanvasLog(formatPushLog(result));
      } catch (err) {
        setCanvasLog(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setIsCanvasBusy(false);
      }
    },
    [contentRoot]
  );

  // ---- File management ----
  const deleteItem = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", path }),
        });
        const data = await res.json();
        if (!data.ok) return false;
        // If deleted item was active, close it
        if (activeFile?.path.startsWith(path)) {
          closeFile();
        }
        await refreshTree();
        return true;
      } catch {
        return false;
      }
    },
    [activeFile, closeFile, refreshTree]
  );

  const renameItem = useCallback(
    async (oldPath: string, newName: string): Promise<boolean> => {
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${parentDir}/${newName}`;
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", oldPath, newPath }),
        });
        const data = await res.json();
        if (!data.ok) return false;
        // If renamed item was active, reopen at new path
        if (activeFile?.path === oldPath) {
          await refreshTree();
          await openFile(newPath);
        } else if (activeFile?.path.startsWith(oldPath + "/")) {
          // Active file was inside a renamed directory
          const relativePart = activeFile.path.substring(oldPath.length);
          await refreshTree();
          await openFile(newPath + relativePart);
        } else {
          await refreshTree();
        }
        return true;
      } catch {
        return false;
      }
    },
    [activeFile, refreshTree, openFile]
  );

  const createFolder = useCallback(
    async (parentPath: string, name: string): Promise<boolean> => {
      const fullPath = `${parentPath}/${name}`;
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mkdir", path: fullPath }),
        });
        const data = await res.json();
        if (!data.ok) return false;
        await refreshTree();
        return true;
      } catch {
        return false;
      }
    },
    [refreshTree]
  );

  const value: WorkspaceState = {
    workspaceRoot,
    setWorkspaceRoot,
    contentRoot,
    setContentRoot,
    courses,
    isCourseListLoading,
    fetchCourses,
    activeCourse,
    setActiveCourse,
    clearActiveCourse,
    fileTree,
    isTreeLoading,
    refreshTree,
    activeFile,
    isFileLoading,
    openFile,
    reloadActiveFile,
    closeFile,
    editorContent,
    setEditorContent,
    isDirty,
    saveFile,
    isSaving,
    viewMode,
    setViewMode,
    sidebarOpen,
    setSidebarOpen,
    isCanvasBusy,
    canvasLog,
    showCanvasLog,
    setShowCanvasLog,
    proofreadRequest,
    requestProofread,
    deleteItem,
    renameItem,
    createFolder,
    runPull,
    runPush,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
