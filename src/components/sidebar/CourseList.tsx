"use client";

import { useState, useCallback } from "react";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { CourseSummary } from "@/types/workbench";

const LEVEL_LABELS: Record<number, string> = {
  4: "L4",
  5: "L5",
  6: "L6",
  7: "L7",
};

export function CourseList() {
  const {
    courses,
    isCourseListLoading,
    setActiveCourse,
    setContentRoot,
    refreshTree,
    fetchCourses,
  } = useWorkspace();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSelectCourse = (course: CourseSummary) => {
    if (confirmDelete) return;
    setActiveCourse(course);
    setContentRoot(course.path);
    refreshTree();
  };

  const handleDelete = useCallback(async (course: CourseSummary, e: React.MouseEvent) => {
    e.stopPropagation();

    if (confirmDelete !== course.path) {
      setConfirmDelete(course.path);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/files/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", path: course.path }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmDelete(null);
        fetchCourses();
      }
    } catch {
      // Silently fail
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, fetchCourses]);

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
  }, []);

  if (isCourseListLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-caption text-muted-foreground font-sans">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Scanning courses...
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="px-3 py-4 text-caption text-muted-foreground font-sans">
        No courses found. Pull a course from Canvas to get started.
      </div>
    );
  }

  return (
    <div className="py-2 px-2 space-y-1">
      {courses.map((course) => {
        const isConfirming = confirmDelete === course.path;

        return (
          <div key={course.path} className="relative group">
            <button
              onClick={() => handleSelectCourse(course)}
              className="w-full text-left px-3 py-2.5 rounded-sm text-caption font-sans
                bg-card border border-border hover:bg-cream/60 dark:hover:bg-muted/60
                hover:border-burgundy/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span className="font-medium text-foreground block truncate flex-1">
                  {course.name}
                </span>
                {course.level && (
                  <span className="text-[10px] text-muted-foreground bg-cream dark:bg-muted
                    px-1.5 py-0.5 rounded-sm flex-shrink-0">
                    {LEVEL_LABELS[course.level] || `L${course.level}`}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-[10px] block ml-[22px]">
                {course.pageCount} pages
              </span>
            </button>

            {/* Delete — appears on hover */}
            {!isConfirming && (
              <button
                onClick={(e) => handleDelete(course, e)}
                className="absolute top-2 right-2 p-1 rounded-sm opacity-0 group-hover:opacity-100
                  text-muted-foreground hover:text-error hover:bg-error/10 transition-all"
                title="Delete course"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            )}

            {/* Confirm overlay */}
            {isConfirming && (
              <div className="absolute inset-0 rounded-sm bg-error/10 border border-error/30
                flex items-center justify-center gap-2 backdrop-blur-sm">
                <span className="text-[10px] font-sans text-error font-medium">Delete?</span>
                <button
                  onClick={(e) => handleDelete(course, e)}
                  disabled={deleting}
                  className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-sm
                    bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? "..." : "Yes"}
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-sm
                    bg-card border border-border text-foreground hover:bg-cream dark:hover:bg-muted transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
