// Canvas LMS entity types and operation interfaces.
// Ported from canvas-cli-for-codex Python CLI (api.py, cli.py).

// ==================== Canvas Entities ====================

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position?: number;
  published?: boolean;
  unlock_at?: string | null;
  require_sequential_progress?: boolean;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  content_id?: number;
  page_url?: string;
}

export interface CanvasPage {
  page_id: number;
  title: string;
  url: string;
  published: boolean;
  body?: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string | null;
  points_possible?: number;
  submission_types?: string[];
  published?: boolean;
  rubric_settings?: { id: number };
  discussion_topic?: { id: number };
}

export interface CanvasRubric {
  id: number;
  title: string;
  points_possible?: number;
  data?: CanvasRubricCriterion[];
}

export interface CanvasRubricCriterion {
  id: string;
  title?: string;
  description?: string;
  long_description?: string;
  points: number;
  ratings: CanvasRubricRating[];
}

export interface CanvasRubricRating {
  id: string;
  description: string;
  long_description?: string;
  points: number;
}

export interface CanvasSubmission {
  user_id: number;
  submitted_at?: string | null;
  grade?: string | null;
  score?: number | null;
  workflow_state: string;
  late: boolean;
  attempt?: number;
  body?: string;
  submission_type?: string;
  url?: string;
  user?: { id: number; name: string; display_name?: string };
  submission_comments?: CanvasSubmissionComment[];
  attachments?: CanvasAttachment[];
}

export interface CanvasSubmissionComment {
  author_name: string;
  created_at: string;
  comment: string;
}

export interface CanvasAttachment {
  id: number;
  filename: string;
  url: string;
  content_type?: string;
  size?: number;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message?: string;
  published?: boolean;
  assignment_id?: number;
}

export interface CanvasDiscussionView {
  participants: { id: number; display_name: string }[];
  view: CanvasDiscussionEntry[];
}

export interface CanvasDiscussionEntry {
  id: number;
  user_id: number;
  message: string;
  created_at: string;
  replies?: CanvasDiscussionEntry[];
}

export interface CanvasQuiz {
  id: number;
  title: string;
  description?: string;
  published?: boolean;
  points_possible?: number;
}

// ==================== Configuration ====================

export interface CanvasConfig {
  canvas_url: string;
  api_token: string;
  default_folder: string;
  course_folders?: Record<string, string>;
  content_root?: string;
}

// ==================== Operation Types ====================

export interface PullOptions {
  courseId: string;
  moduleName?: string;
  pageName?: string;
  assignmentName?: string;
  discussionName?: string;
  includeRubrics?: boolean;
  submissions?: "all" | "ungraded" | "none";
  includeDiscussions?: boolean;
  contentRoot?: string;
}

export interface PushOptions {
  filePath?: string;
  moduleName?: string;
  dryRun?: boolean;
  contentRoot?: string;
}

export interface PullResult {
  success: boolean;
  itemsPulled: number;
  courseDir: string;
  errors: string[];
  items: { type: string; name: string; path: string }[];
}

export interface PushResult {
  success: boolean;
  itemsPushed: number;
  errors: string[];
  dryRun: boolean;
  items: { type: string; name: string; action: string }[];
}

export interface StatusReport {
  courses: CourseStatus[];
}

export interface CourseStatus {
  name: string;
  path: string;
  canvasId: number;
  pages: number;
  assignments: number;
  rubrics: number;
  submissions: number;
  level?: number;
}

// ==================== Local File Metadata ====================

export interface CourseMeta {
  canvas_id: number;
  name: string;
  code?: string;
  level?: number; // FHEQ level: 4=1st yr UG, 5=2nd yr, 6=3rd yr, 7=Masters
}

export interface ModuleMeta {
  canvas_id: number;
  name: string;
  position?: number;
  unlock_at?: string | null;
  require_sequential_progress?: boolean;
  published?: boolean;
}

// Local rubric format (YAML file) - differs from Canvas API format
export interface LocalRubric {
  canvas_id: number | null;
  title: string;
  points_possible?: number;
  criteria: LocalRubricCriterion[];
}

export interface LocalRubricCriterion {
  id?: string;
  title: string;
  description?: string;
  points: number;
  ratings: LocalRubricRating[];
}

export interface LocalRubricRating {
  id?: string;
  description: string;
  long_description?: string;
  points: number;
}
