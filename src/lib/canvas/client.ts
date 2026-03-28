// Canvas LMS REST API client.
// Ported from canvas-cli-for-codex api.py — all endpoints.

import { getCanvasRuntimeConfig } from "./config";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasDiscussionTopic,
  CanvasDiscussionView,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasQuiz,
  CanvasRubric,
  CanvasSubmission,
} from "./types";

const API_VERSION = "api/v1";

function getConfig() {
  return getCanvasRuntimeConfig();
}

const FETCH_TIMEOUT_MS = 30_000;

function buildUrl(basePath: string, baseUrl: string): string {
  return `${baseUrl}/${API_VERSION}${basePath.startsWith("/") ? basePath : `/${basePath}`}`;
}

async function canvasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = getConfig();
  const url = buildUrl(path, baseUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res: Response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function canvasFetchAll<T>(path: string): Promise<T[]> {
  const { baseUrl, token } = getConfig();
  const firstUrl = buildUrl(path, baseUrl);

  const out: T[] = [];
  let nextUrl: string | null = firstUrl;
  let page = 0;
  const MAX_PAGES = 50;

  while (nextUrl && page < MAX_PAGES) {
    page++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(nextUrl, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Canvas API timeout after ${FETCH_TIMEOUT_MS}ms on page ${page}: ${nextUrl}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API ${res.status}: ${text}`);
    }

    const chunk = (await res.json()) as T[];
    out.push(...chunk);

    const link: string = res.headers.get("link") || "";
    const match: string | undefined = link
      .split(",")
      .map((part: string) => part.trim())
      .find((part: string) => /rel="next"/.test(part));

    if (!match) {
      nextUrl = null;
    } else {
      const m: RegExpMatchArray | null = match.match(/<([^>]+)>/);
      nextUrl = m?.[1] || null;
    }
  }

  return out;
}

/**
 * Authenticated fetch for downloading files (e.g. submission attachments).
 * Returns the raw Response for streaming/buffer access.
 */
export async function canvasFetchRaw(url: string): Promise<Response> {
  const { token } = getConfig();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Canvas download ${res.status}: ${url}`);
  }
  return res;
}

// ==================== Courses ====================

export async function listCourses(): Promise<CanvasCourse[]> {
  return canvasFetchAll<CanvasCourse>(
    "/courses?per_page=100&enrollment_state=active&include[]=term&state[]=available&state[]=unpublished"
  );
}

export async function getCourse(courseId: string): Promise<CanvasCourse> {
  return canvasFetch<CanvasCourse>(`/courses/${courseId}`);
}

// ==================== Modules ====================

export async function listModules(courseId: string): Promise<CanvasModule[]> {
  return canvasFetchAll<CanvasModule>(
    `/courses/${courseId}/modules?per_page=100`
  );
}

export async function getModule(
  courseId: string,
  moduleId: number
): Promise<CanvasModule> {
  return canvasFetch<CanvasModule>(
    `/courses/${courseId}/modules/${moduleId}`
  );
}

export async function listModuleItems(
  courseId: string,
  moduleId: number
): Promise<CanvasModuleItem[]> {
  return canvasFetchAll<CanvasModuleItem>(
    `/courses/${courseId}/modules/${moduleId}/items?per_page=100`
  );
}

export async function updateModule(
  courseId: string,
  moduleId: number,
  data: Partial<CanvasModule>
): Promise<CanvasModule> {
  return canvasFetch<CanvasModule>(
    `/courses/${courseId}/modules/${moduleId}`,
    { method: "PUT", body: JSON.stringify({ module: data }) }
  );
}

// ==================== Pages ====================

export async function listPages(courseId: string): Promise<CanvasPage[]> {
  return canvasFetchAll<CanvasPage>(
    `/courses/${courseId}/pages?per_page=100`
  );
}

export async function getPage(
  courseId: string,
  pageUrlOrId: string
): Promise<CanvasPage> {
  return canvasFetch<CanvasPage>(
    `/courses/${courseId}/pages/${encodeURIComponent(pageUrlOrId)}`
  );
}

export async function updatePage(
  courseId: string,
  pageUrlOrId: string,
  data: { title?: string; body?: string; published?: boolean }
): Promise<CanvasPage> {
  return canvasFetch<CanvasPage>(
    `/courses/${courseId}/pages/${encodeURIComponent(pageUrlOrId)}`,
    { method: "PUT", body: JSON.stringify({ wiki_page: data }) }
  );
}

export async function createPage(
  courseId: string,
  data: { title: string; body: string; published?: boolean }
): Promise<CanvasPage> {
  return canvasFetch<CanvasPage>(`/courses/${courseId}/pages`, {
    method: "POST",
    body: JSON.stringify({ wiki_page: data }),
  });
}

// ==================== Assignments ====================

export async function listAssignments(
  courseId: string
): Promise<CanvasAssignment[]> {
  return canvasFetchAll<CanvasAssignment>(
    `/courses/${courseId}/assignments?per_page=100`
  );
}

export async function getAssignment(
  courseId: string,
  assignmentId: number
): Promise<CanvasAssignment> {
  return canvasFetch<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`
  );
}

export async function updateAssignment(
  courseId: string,
  assignmentId: number,
  data: Record<string, unknown>
): Promise<CanvasAssignment> {
  return canvasFetch<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`,
    { method: "PUT", body: JSON.stringify({ assignment: data }) }
  );
}

// ==================== Rubrics ====================

export async function listRubrics(courseId: string): Promise<CanvasRubric[]> {
  return canvasFetchAll<CanvasRubric>(
    `/courses/${courseId}/rubrics?per_page=100`
  );
}

export async function getRubric(
  courseId: string,
  rubricId: number
): Promise<CanvasRubric> {
  return canvasFetch<CanvasRubric>(
    `/courses/${courseId}/rubrics/${rubricId}?include[]=assessments`
  );
}

export async function createRubric(
  courseId: string,
  data: Record<string, unknown>
): Promise<CanvasRubric> {
  return canvasFetch<CanvasRubric>(`/courses/${courseId}/rubrics`, {
    method: "POST",
    body: JSON.stringify({ rubric: data }),
  });
}

export async function updateRubric(
  courseId: string,
  rubricId: number,
  data: Record<string, unknown>
): Promise<CanvasRubric> {
  return canvasFetch<CanvasRubric>(
    `/courses/${courseId}/rubrics/${rubricId}`,
    { method: "PUT", body: JSON.stringify({ rubric: data }) }
  );
}

export async function attachRubricToAssignment(
  courseId: string,
  rubricId: number,
  assignmentId: number,
  useForGrading: boolean = true
): Promise<unknown> {
  return canvasFetch<unknown>(
    `/courses/${courseId}/rubric_associations`,
    {
      method: "POST",
      body: JSON.stringify({
        rubric_association: {
          rubric_id: rubricId,
          association_id: assignmentId,
          association_type: "Assignment",
          use_for_grading: useForGrading,
          purpose: "grading",
        },
      }),
    }
  );
}

// ==================== Submissions ====================

export async function listSubmissions(
  courseId: string,
  assignmentId: number,
  includeComments: boolean = true
): Promise<CanvasSubmission[]> {
  const includes = includeComments
    ? "&include[]=submission_comments&include[]=user&include[]=attachments"
    : "";
  return canvasFetchAll<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100${includes}`
  );
}

export async function getSubmission(
  courseId: string,
  assignmentId: number,
  userId: number
): Promise<CanvasSubmission> {
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}?include[]=submission_comments&include[]=user`
  );
}

export async function updateSubmission(
  courseId: string,
  assignmentId: number,
  userId: number,
  grade?: string,
  comment?: string
): Promise<CanvasSubmission> {
  const data: Record<string, unknown> = { submission: {} };
  if (grade !== undefined) {
    (data.submission as Record<string, unknown>).posted_grade = grade;
  }
  if (comment !== undefined) {
    data.comment = { text_comment: comment };
  }
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

// ==================== Discussions ====================

export async function listDiscussionTopics(
  courseId: string
): Promise<CanvasDiscussionTopic[]> {
  return canvasFetchAll<CanvasDiscussionTopic>(
    `/courses/${courseId}/discussion_topics?per_page=100`
  );
}

export async function getDiscussionTopic(
  courseId: string,
  topicId: number
): Promise<CanvasDiscussionTopic> {
  return canvasFetch<CanvasDiscussionTopic>(
    `/courses/${courseId}/discussion_topics/${topicId}`
  );
}

export async function updateDiscussionTopic(
  courseId: string,
  topicId: number,
  data: Record<string, unknown>
): Promise<CanvasDiscussionTopic> {
  return canvasFetch<CanvasDiscussionTopic>(
    `/courses/${courseId}/discussion_topics/${topicId}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function getDiscussionEntries(
  courseId: string,
  topicId: number
): Promise<CanvasDiscussionView> {
  return canvasFetch<CanvasDiscussionView>(
    `/courses/${courseId}/discussion_topics/${topicId}/view`
  );
}

// ==================== Quizzes ====================

export async function listQuizzes(courseId: string): Promise<CanvasQuiz[]> {
  return canvasFetchAll<CanvasQuiz>(
    `/courses/${courseId}/quizzes?per_page=100`
  );
}

export async function getQuiz(
  courseId: string,
  quizId: number
): Promise<CanvasQuiz> {
  return canvasFetch<CanvasQuiz>(`/courses/${courseId}/quizzes/${quizId}`);
}

export async function getQuizQuestions(
  courseId: string,
  quizId: number
): Promise<unknown[]> {
  return canvasFetchAll<unknown>(
    `/courses/${courseId}/quizzes/${quizId}/questions?per_page=100`
  );
}

export async function updateQuiz(
  courseId: string,
  quizId: number,
  data: Record<string, unknown>
): Promise<CanvasQuiz> {
  return canvasFetch<CanvasQuiz>(
    `/courses/${courseId}/quizzes/${quizId}`,
    { method: "PUT", body: JSON.stringify({ quiz: data }) }
  );
}
