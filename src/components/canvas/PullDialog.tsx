"use client";

import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownToLine,
  X,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  BookOpen,
  Calendar,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

// ==================== Types ====================

interface CourseItem {
  id: number;
  name: string;
  course_code?: string;
}

type Step = "courses" | "confirm";

// Build academic year options. The "year" value sent to the API is the
// starting calendar year (e.g. "2025" means 2025/26). The server matches
// both 4-digit and 2-digit variants (25/26, 2025, etc.).
function buildYearOptions(): { value: string; label: string }[] {
  const now = new Date().getFullYear();
  const opts: { value: string; label: string }[] = [];
  for (let y = now + 1; y >= now - 5; y--) {
    const short = String(y).slice(2);
    const nextShort = String(y + 1).slice(2);
    opts.push({ value: String(y), label: `${short}/${nextShort}` });
  }
  return opts;
}

// Default to current academic year: Sep-Dec → this year, Jan-Aug → previous year
function currentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  return month >= 8 ? String(now.getFullYear()) : String(now.getFullYear() - 1);
}

// ==================== Component ====================

export function PullDialog() {
  const { workspaceRoot, contentRoot, runPull, isCanvasBusy } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("courses");

  // Year filter — default to current academic year
  const [year, setYear] = useState(currentAcademicYear);
  const yearOptions = buildYearOptions();

  // Course list
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");

  // Selected course
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);

  // Existence check
  const [existsLocally, setExistsLocally] = useState(false);
  const [existsPath, setExistsPath] = useState("");
  const [checkingExists, setCheckingExists] = useState(false);

  // Pull options
  const [includeRubrics, setIncludeRubrics] = useState(true);
  const [includeDiscussions, setIncludeDiscussions] = useState(false);
  const [submissions, setSubmissions] = useState<"none" | "all" | "ungraded">(
    "none"
  );

  // ---- Fetch courses ----
  const fetchCourses = useCallback(async (yearFilter: string) => {
    setCoursesLoading(true);
    setCoursesError("");
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-courses", year: yearFilter }),
      });
      const data = await res.json();
      if (data.ok) {
        setCourses(data.courses);
      } else {
        setCoursesError(data.error || "Failed to load courses");
      }
    } catch (err) {
      console.error("[PullDialog] list-courses error:", err);
      setCoursesError("Failed to connect to Canvas");
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  // Fetch courses when dialog opens or year changes
  useEffect(() => {
    if (!open) return;
    fetchCourses(year);
  }, [open, year, fetchCourses]);

  // ---- Check if content exists locally ----
  const checkExists = useCallback(
    async (courseId: number) => {
      setCheckingExists(true);
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check-exists",
            courseId: String(courseId),
            contentRoot: workspaceRoot || contentRoot || undefined,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setExistsLocally(data.exists);
          setExistsPath(data.path || "");
        }
      } catch {
        setExistsLocally(false);
      } finally {
        setCheckingExists(false);
      }
    },
    [workspaceRoot, contentRoot]
  );

  // ---- Select a course → go to confirm ----
  const handleSelectCourse = (course: CourseItem) => {
    setSelectedCourse(course);
    setStep("confirm");
    checkExists(course.id);
  };

  // ---- Run pull ----
  const handlePull = async () => {
    if (!selectedCourse) return;
    await runPull({
      courseId: String(selectedCourse.id),
      contentRoot: workspaceRoot || contentRoot || undefined,
      includeRubrics,
      includeDiscussions,
      submissions,
    });
    setOpen(false);
  };

  // ---- Reset on close ----
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep("courses");
      setSelectedCourse(null);
      setCourses([]);
      setExistsLocally(false);
      setExistsPath("");
    }
  };

  // ---- Back navigation ----
  const handleBack = () => {
    setStep("courses");
    setSelectedCourse(null);
    setExistsLocally(false);
    setExistsPath("");
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="btn-editorial-secondary !px-3 !py-1.5 text-caption gap-1.5">
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Pull
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-[540px] max-h-[85vh] overflow-hidden bg-card rounded-sm shadow-editorial-lg border border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border">
            {step === "confirm" && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground -ml-1"
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Dialog.Title className="font-display text-display-md font-bold text-foreground flex-1 truncate">
              {step === "courses" ? "Pull from Canvas" : "Confirm Pull"}
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Browse and pull courses from Canvas LMS
          </Dialog.Description>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* ==================== Step 1: Courses ==================== */}
            {step === "courses" && (
              <div>
                {/* Year dropdown */}
                <div className="px-6 py-3 border-b border-border bg-cream/20 dark:bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <label className="text-caption font-sans text-muted-foreground">
                      Academic year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="ml-auto bg-transparent border border-border rounded px-2 py-1 text-body-sm font-sans text-foreground focus:outline-none focus:ring-1 focus:ring-burgundy"
                    >
                      <option value="">All years</option>
                      {yearOptions.map((y) => (
                        <option key={y.value} value={y.value}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                    {coursesLoading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Course list */}
                <div className="divide-y divide-border/50">
                  {coursesError && (
                    <div className="px-6 py-4 text-caption text-error-500">
                      {coursesError}
                    </div>
                  )}
                  {!coursesLoading && !coursesError && courses.length === 0 && (
                    <div className="px-6 py-8 text-center text-caption text-muted-foreground">
                      {year
                        ? `No courses or modules found for ${year}`
                        : "No courses or modules found"}
                    </div>
                  )}
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => handleSelectCourse(course)}
                      className="w-full text-left px-6 py-3 hover:bg-cream/40 dark:hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-burgundy shrink-0" />
                        <div className="min-w-0">
                          <p className="text-body-sm font-sans text-foreground truncate">
                            {course.name}
                          </p>
                          {course.course_code && (
                            <p className="text-[10px] text-muted-foreground">
                              {course.course_code}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== Step 2: Confirm ==================== */}
            {step === "confirm" && (
              <div className="p-6 space-y-5">
                {/* Summary */}
                <div className="bg-cream/30 dark:bg-muted/30 rounded-sm border border-border p-4">
                  <p className="text-caption font-sans text-muted-foreground mb-1">
                    Course
                  </p>
                  <p className="text-body-sm font-sans font-medium text-foreground">
                    {selectedCourse?.name}
                  </p>
                  {selectedCourse?.course_code && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedCourse.course_code}
                    </p>
                  )}
                </div>

                {/* Overwrite warning */}
                {checkingExists ? (
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking local files...
                  </div>
                ) : existsLocally ? (
                  <div className="bg-gold/10 border border-gold/30 rounded-sm p-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                    <div>
                      <p className="text-body-sm font-sans font-medium text-foreground">
                        Already pulled
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Content exists at {existsPath}. Pulling again will
                        overwrite local changes.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Options */}
                <div className="space-y-3">
                  <p className="text-caption font-sans font-medium text-foreground">
                    Options
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-caption font-sans text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeRubrics}
                        onChange={(e) => setIncludeRubrics(e.target.checked)}
                        className="accent-burgundy"
                      />
                      Include rubrics
                    </label>
                    <label className="flex items-center gap-2 text-caption font-sans text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeDiscussions}
                        onChange={(e) =>
                          setIncludeDiscussions(e.target.checked)
                        }
                        className="accent-burgundy"
                      />
                      Include discussions
                    </label>
                  </div>
                  <div>
                    <label className="text-caption font-sans text-foreground block mb-1">
                      Submissions
                    </label>
                    <select
                      value={submissions}
                      onChange={(e) =>
                        setSubmissions(
                          e.target.value as "none" | "all" | "ungraded"
                        )
                      }
                      className="input-editorial !py-1.5 !text-body-sm"
                    >
                      <option value="none">None</option>
                      <option value="all">All</option>
                      <option value="ungraded">Ungraded only</option>
                    </select>
                  </div>
                </div>

                {/* Pull button */}
                <button
                  onClick={handlePull}
                  disabled={isCanvasBusy}
                  className="btn-editorial-primary w-full !py-2.5 gap-2"
                >
                  {isCanvasBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      {existsLocally ? "Pull & Overwrite" : "Pull"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
