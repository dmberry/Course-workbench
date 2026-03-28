"use client";

import { RefreshCcw, ChevronLeft, FolderOpen } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { FileTree } from "@/components/tree/FileTree";
import { CourseList } from "@/components/sidebar/CourseList";

const LEVEL_LABELS: Record<number, string> = {
  4: "Level 4",
  5: "Level 5",
  6: "Level 6",
  7: "Level 7",
};

export function Sidebar() {
  const {
    workspaceRoot,
    setWorkspaceRoot,
    activeCourse,
    isTreeLoading,
    isCourseListLoading,
    refreshTree,
    fetchCourses,
    clearActiveCourse,
  } = useWorkspace();

  const showFileTree = activeCourse !== null;
  const isLoading = showFileTree ? isTreeLoading : isCourseListLoading;
  const handleRefresh = showFileTree ? refreshTree : fetchCourses;

  // No workspace configured — prompt user to open via toolbar
  if (!workspaceRoot) {
    return (
      <aside className="w-[280px] min-w-[280px] border-r border-border bg-card flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-caption font-sans font-medium text-foreground flex-1">
            Explorer
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-caption font-sans text-muted-foreground text-center leading-relaxed">
            Open a project folder using the <FolderOpen className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" /> button in the toolbar.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[280px] min-w-[280px] border-r border-border bg-card flex flex-col">
      {/* Header — adapts based on active panel */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 min-h-[40px]">
        {showFileTree ? (
          <>
            <button
              onClick={clearActiveCourse}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Back to courses"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-caption font-sans font-medium text-foreground block truncate">
                {activeCourse.name}
              </span>
              {activeCourse.level && (
                <span className="text-[10px] font-sans text-muted-foreground">
                  {LEVEL_LABELS[activeCourse.level] || `Level ${activeCourse.level}`}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-caption font-sans font-medium text-foreground flex-1">
              Courses
            </span>
          </>
        )}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sliding container */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div
          className="flex h-full transition-transform duration-[250ms] ease-in-out"
          style={{
            width: "560px",
            transform: showFileTree ? "translateX(-280px)" : "translateX(0)",
          }}
        >
          {/* Panel A: Course List */}
          <div className="w-[280px] min-w-[280px] h-full overflow-y-auto">
            <CourseList />
          </div>

          {/* Panel B: File Tree */}
          <div className="w-[280px] min-w-[280px] h-full overflow-y-auto px-1 py-1">
            <FileTree />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex items-center gap-1">
        <p className="text-[10px] text-muted-foreground truncate font-sans flex-1" title={workspaceRoot}>
          {workspaceRoot.split("/").pop() || workspaceRoot}
        </p>
        <button
          onClick={() => {
            clearActiveCourse();
            setWorkspaceRoot("");
          }}
          className="text-[10px] font-sans text-burgundy hover:underline flex-shrink-0"
        >
          Change
        </button>
      </div>
    </aside>
  );
}
