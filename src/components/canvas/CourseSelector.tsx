"use client";

import { useState, useEffect } from "react";
import { FolderPlus, FolderOpen, Loader2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { CourseSummary } from "@/types/workbench";

interface StatusCourse {
  name: string;
  path: string;
  canvasId: number;
  pages: number;
  rubrics: number;
  submissions: number;
  level?: number;
}

export function CourseSelector() {
  const { contentRoot, setContentRoot, setActiveCourse, refreshTree } =
    useWorkspace();

  const [mode, setMode] = useState<"choose" | "new" | "open">("choose");
  const [courses, setCourses] = useState<StatusCourse[]>([]);

  // New project fields
  const [projectName, setProjectName] = useState("");
  const [parentFolder, setParentFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Open existing fields
  const [openPath, setOpenPath] = useState(contentRoot);

  useEffect(() => {
    if (contentRoot) setOpenPath(contentRoot);
  }, [contentRoot]);

  const fetchCourses = async (root: string) => {
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", contentRoot: root }),
      });
      const data = await res.json();
      if (data.ok && data.courses) {
        setCourses(data.courses);
      }
    } catch {
      setCourses([]);
    }
  };

  const handleCreateProject = async () => {
    const name = projectName.trim();
    if (!name) return;

    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parent: parentFolder.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setContentRoot(data.path);
        setMode("choose");
      } else {
        setError(data.error || "Failed to create workspace");
      }
    } catch {
      setError("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenExisting = () => {
    const path = openPath.trim();
    if (!path) return;
    setContentRoot(path);
    fetchCourses(path);
    setMode("choose");
  };

  const handleSelectCourse = (course: StatusCourse) => {
    const summary: CourseSummary = {
      name: course.name,
      path: course.path,
      canvasId: course.canvasId,
      moduleCount: 0,
      pageCount: course.pages,
      level: course.level,
    };
    setActiveCourse(summary);
    setContentRoot(course.path);
    refreshTree();
  };

  // Initial choice screen (no workspace set yet)
  if (!contentRoot && mode === "choose") {
    return (
      <div className="space-y-2">
        <p className="text-caption font-sans text-muted-foreground">
          Choose a workspace folder where your Canvas content will live.
        </p>
        <button
          onClick={() => setMode("new")}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-caption font-sans
            bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60 hover:border-burgundy/30 transition-colors"
        >
          <FolderPlus className="w-4 h-4 text-burgundy" />
          <div className="text-left">
            <span className="font-medium text-foreground block">
              New Workspace
            </span>
            <span className="text-muted-foreground text-[10px]">
              Create a folder in Documents
            </span>
          </div>
        </button>
        <button
          onClick={() => setMode("open")}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-caption font-sans
            bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60 hover:border-burgundy/30 transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-gold" />
          <div className="text-left">
            <span className="font-medium text-foreground block">
              Open Existing
            </span>
            <span className="text-muted-foreground text-[10px]">
              Point to an existing folder
            </span>
          </div>
        </button>
      </div>
    );
  }

  // New project form
  if (mode === "new") {
    return (
      <div className="space-y-3">
        <p className="text-caption font-sans font-medium text-foreground">
          New Workspace
        </p>
        <div>
          <label className="text-caption font-sans text-muted-foreground block mb-1">
            Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            placeholder="e.g. Canvas Work"
            className="input-editorial !py-1.5 !text-caption"
            autoFocus
          />
        </div>
        <div>
          <label className="text-caption font-sans text-muted-foreground block mb-1">
            Location
          </label>
          <input
            type="text"
            value={parentFolder}
            onChange={(e) => setParentFolder(e.target.value)}
            placeholder="~/Documents (default)"
            className="input-editorial !py-1.5 !text-caption"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Leave blank to create in your Documents folder
          </p>
        </div>

        {error && <p className="text-caption text-error-500">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("choose");
              setError("");
            }}
            className="btn-editorial-ghost !px-3 !py-1.5 text-caption flex-1"
          >
            Back
          </button>
          <button
            onClick={handleCreateProject}
            disabled={!projectName.trim() || creating}
            className="btn-editorial-primary !px-3 !py-1.5 text-caption flex-1 gap-1.5"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderPlus className="w-3.5 h-3.5" />
            )}
            Create
          </button>
        </div>
      </div>
    );
  }

  // Open existing form
  if (mode === "open") {
    return (
      <div className="space-y-3">
        <p className="text-caption font-sans font-medium text-foreground">
          Open Existing Workspace
        </p>
        <div>
          <label className="text-caption font-sans text-muted-foreground block mb-1">
            Folder path
          </label>
          <input
            type="text"
            value={openPath}
            onChange={(e) => setOpenPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleOpenExisting()}
            placeholder="/Users/you/canvas-work"
            className="input-editorial !py-1.5 !text-caption"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("choose")}
            className="btn-editorial-ghost !px-3 !py-1.5 text-caption flex-1"
          >
            Back
          </button>
          <button
            onClick={handleOpenExisting}
            disabled={!openPath.trim()}
            className="btn-editorial-primary !px-3 !py-1.5 text-caption flex-1 gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open
          </button>
        </div>
      </div>
    );
  }

  // Workspace is set — show current folder name + available courses
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-3.5 h-3.5 text-gold flex-shrink-0" />
        <span className="text-caption font-sans text-foreground truncate flex-1">
          {contentRoot.split("/").pop() || contentRoot}
        </span>
        <button
          onClick={() => {
            setContentRoot("");
            setCourses([]);
            setMode("choose");
          }}
          className="text-[10px] font-sans text-burgundy hover:underline flex-shrink-0"
        >
          Change
        </button>
      </div>

      {courses.length > 0 && (
        <div>
          <label className="text-caption font-sans font-medium text-muted-foreground block mb-1">
            Courses
          </label>
          <div className="space-y-1">
            {courses.map((course) => (
              <button
                key={course.path}
                onClick={() => handleSelectCourse(course)}
                className="w-full text-left px-3 py-2 rounded-sm text-caption font-sans
                  bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60 transition-colors"
              >
                <span className="font-medium text-foreground block truncate">
                  {course.name}
                </span>
                <span className="text-muted-foreground">
                  {course.pages} pages, {course.rubrics} rubrics
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
