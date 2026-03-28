// Pull content from Canvas LMS to local files.
// Ported from canvas-cli-for-codex cli.py pull command.

import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

import {
  getCourse,
  getAssignment,
  getDiscussionTopic,
  getDiscussionEntries,
  getPage,
  listAssignments,
  listDiscussionTopics,
  listModuleItems,
  listModules,
  listPages,
  listRubrics,
  listSubmissions,
  canvasFetchRaw,
} from "./client";
import { loadCanvasConfig, getCourseFolder, getContentRoot } from "./config";
import { htmlToMarkdown } from "./converters";
import { slugify, matchesName } from "./utils";
import type {
  CanvasAssignment,
  CanvasDiscussionView,
  CanvasPage,
  CanvasRubric,
  CanvasSubmission,
  PullOptions,
  PullResult,
} from "./types";

// ==================== Save Functions ====================

async function writeFrontmatterFile(
  filePath: string,
  frontmatter: Record<string, unknown>,
  body: string
): Promise<void> {
  // Remove null/undefined values from frontmatter
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v !== undefined && v !== null) {
      clean[k] = v;
    }
  }

  const yamlStr = YAML.stringify(clean).trim();
  const content = `---\n${yamlStr}\n---\n\n${body}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function writeYamlFile(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, YAML.stringify(data), "utf8");
}

export async function savePage(
  courseDir: string,
  page: CanvasPage,
  subdir: string = "pages"
): Promise<string> {
  const pagesDir = path.join(courseDir, subdir);
  const filename = slugify(page.title || page.url) + ".md";
  const filePath = path.join(pagesDir, filename);

  const bodyMd = htmlToMarkdown(page.body || "");
  const frontmatter: Record<string, unknown> = {
    canvas_id: page.page_id,
    canvas_url: page.url,
    title: page.title,
    published: page.published ?? false,
  };

  await writeFrontmatterFile(filePath, frontmatter, bodyMd);
  return filePath;
}

export async function saveAssignment(
  courseDir: string,
  assignment: CanvasAssignment,
  subdir: string = "assignments"
): Promise<string> {
  const assignDir = path.join(courseDir, subdir);
  const filename = slugify(assignment.name || String(assignment.id)) + ".md";
  const filePath = path.join(assignDir, filename);

  const descMd = htmlToMarkdown(assignment.description || "");
  const frontmatter: Record<string, unknown> = {
    canvas_id: assignment.id,
    title: assignment.name,
    due_at: assignment.due_at,
    points_possible: assignment.points_possible,
    submission_types: assignment.submission_types,
    published: assignment.published ?? false,
    rubric_id: assignment.rubric_settings?.id,
  };

  await writeFrontmatterFile(filePath, frontmatter, descMd);
  return filePath;
}

export async function saveRubric(
  courseDir: string,
  rubric: CanvasRubric
): Promise<string> {
  const rubricsDir = path.join(courseDir, "rubrics");
  const filename = slugify(rubric.title || String(rubric.id)) + ".yaml";
  const filePath = path.join(rubricsDir, filename);

  const rubricData: Record<string, unknown> = {
    canvas_id: rubric.id,
    title: rubric.title,
    points_possible: rubric.points_possible,
    criteria: (rubric.data || []).map((criterion) => ({
      id: criterion.id,
      title: criterion.title || criterion.description,
      description: criterion.long_description,
      points: criterion.points,
      ratings: (criterion.ratings || []).map((rating) => ({
        id: rating.id,
        description: rating.description,
        long_description: rating.long_description,
        points: rating.points,
      })),
    })),
  };

  await writeYamlFile(filePath, rubricData);
  return filePath;
}

export async function saveDiscussionEntries(
  courseDir: string,
  topicName: string,
  topicId: number,
  courseId: string
): Promise<string> {
  const discussionsDir = path.join(courseDir, "discussions");
  const filename = slugify(topicName) + "-entries.md";
  const filePath = path.join(discussionsDir, filename);

  const data: CanvasDiscussionView = await getDiscussionEntries(
    courseId,
    topicId
  );

  // Build participant lookup
  const participants: Record<number, string> = {};
  for (const p of data.participants || []) {
    participants[p.id] = p.display_name || `User ${p.id}`;
  }

  const output: string[] = [];
  output.push(`# ${topicName} - Student Posts\n`);
  output.push(
    `*Pulled: ${new Date().toISOString().slice(0, 16).replace("T", " ")}*\n`
  );

  function formatEntry(
    entry: CanvasDiscussionView["view"][0],
    indent: number = 0
  ): string[] {
    const lines: string[] = [];
    const prefix = "  ".repeat(indent);
    const heading = indent === 0 ? "##" : "###";

    const userName = participants[entry.user_id] || "Unknown";
    const posted = entry.created_at
      ? entry.created_at.slice(0, 10)
      : "Unknown date";

    lines.push(`${prefix}${heading} ${userName}`);
    lines.push(`${prefix}*Posted: ${posted}*\n`);

    let message = entry.message || "(No content)";
    // Clean up HTML
    message = message.replace(/<p>/g, "");
    message = message.replace(/<\/p>/g, "\n");
    message = message.replace(/<br\s*\/?>/g, "\n");
    message = message.replace(/<[^>]+>/g, "");
    message = message.trim();

    if (indent > 0) {
      message = message
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
    }
    lines.push(`${message}\n`);

    const replies = entry.replies || [];
    if (replies.length > 0) {
      lines.push(`${prefix}**Replies:**\n`);
      for (const reply of replies) {
        lines.push(...formatEntry(reply, indent + 1));
      }
    }

    return lines;
  }

  for (const entry of data.view || []) {
    output.push(...formatEntry(entry));
    output.push("---\n");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, output.join("\n"), "utf8");
  return filePath;
}

export async function saveSubmission(
  courseDir: string,
  assignmentName: string,
  submission: CanvasSubmission
): Promise<string | null> {
  const submissionsDir = path.join(
    courseDir,
    "submissions",
    slugify(assignmentName)
  );

  const userName =
    submission.user?.name ||
    submission.user?.display_name ||
    `user-${submission.user_id}`;
  const userSlug = slugify(userName);
  const filename = userSlug + ".md";
  const filePath = path.join(submissionsDir, filename);

  // Get submission body
  let body = submission.body || "";
  if (submission.submission_type === "online_url") {
    body = `URL: ${submission.url || "N/A"}\n\n${body}`;
  }
  const bodyMd = body ? htmlToMarkdown(body) : "(No submission content)";

  // Download attachments
  const attachments = submission.attachments || [];
  const attachmentFiles: string[] = [];
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const ext = path.extname(att.filename) || "";
    const attFilename =
      attachments.length === 1
        ? `${userSlug}${ext}`
        : `${userSlug}-${i + 1}${ext}`;
    const attPath = path.join(submissionsDir, attFilename);

    if (att.url) {
      try {
        const res = await canvasFetchRaw(att.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        await fs.mkdir(submissionsDir, { recursive: true });
        await fs.writeFile(attPath, buffer);
        attachmentFiles.push(attFilename);
      } catch {
        // Skip failed downloads
      }
    }
  }

  // Build comments section
  let commentsMd = "";
  for (const comment of submission.submission_comments || []) {
    const author = comment.author_name || "Unknown";
    const date = comment.created_at ? comment.created_at.slice(0, 10) : "";
    commentsMd += `\n### ${author} (${date})\n${comment.comment}\n`;
  }

  // Build attachments section
  let attachmentsMd = "";
  if (attachmentFiles.length > 0) {
    attachmentsMd = "\n## Attachments\n";
    for (const f of attachmentFiles) {
      attachmentsMd += `- [${f}](${f})\n`;
    }
  }

  const frontmatter: Record<string, unknown> = {
    student_id: submission.user_id,
    student_name: userName,
    submitted_at: submission.submitted_at,
    grade: submission.grade,
    score: submission.score,
    workflow_state: submission.workflow_state,
    late: submission.late,
    attempt: submission.attempt,
  };
  if (attachmentFiles.length > 0) {
    frontmatter.attachments = attachmentFiles;
  }

  const fullBody = `# Submission\n\n${bodyMd}\n${attachmentsMd}\n## Comments\n${commentsMd || "(No comments)"}\n`;

  await writeFrontmatterFile(filePath, frontmatter, fullBody);
  return filePath;
}

// ==================== Main Pull Orchestrator ====================

export async function pullCourse(options: PullOptions): Promise<PullResult> {
  const config = loadCanvasConfig();
  const result: PullResult = {
    success: true,
    itemsPulled: 0,
    courseDir: "",
    errors: [],
    items: [],
  };

  try {
    // Resolve course
    const courseId = options.courseId;
    const courseData = await getCourse(courseId);
    const courseName = courseData.name || `course-${courseId}`;
    const courseCode = courseData.course_code || "";

    // Determine course directory
    const contentRoot = options.contentRoot || getContentRoot(config);
    const courseFolder = getCourseFolder(courseCode, courseName, config);
    const courseDir = path.join(contentRoot, courseFolder);
    result.courseDir = courseDir;

    await fs.mkdir(courseDir, { recursive: true });

    // Save course metadata
    const courseMeta = {
      canvas_id: Number(courseId),
      name: courseName,
      code: courseData.course_code,
    };
    await writeYamlFile(path.join(courseDir, "_course.yaml"), courseMeta);

    // Pull specific page
    if (options.pageName) {
      const pages = await listPages(courseId);
      for (const page of pages) {
        if (matchesName(options.pageName, page.title || "")) {
          const fullPage = await getPage(courseId, page.url);
          const fp = await savePage(courseDir, fullPage);
          result.items.push({
            type: "page",
            name: fullPage.title,
            path: fp,
          });
          result.itemsPulled++;
        }
      }
      if (result.itemsPulled === 0) {
        result.errors.push(`No pages found matching: ${options.pageName}`);
      }
      return result;
    }

    // Pull specific discussion
    if (options.discussionName) {
      const topics = await listDiscussionTopics(courseId);
      for (const topic of topics) {
        if (matchesName(options.discussionName, topic.title || "")) {
          // Save discussion topic as a page
          const discData: CanvasPage = {
            page_id: topic.id,
            url: `discussion-${topic.id}`,
            title: topic.title || "Discussion",
            body: topic.message || "",
            published: topic.published ?? false,
          };
          const fp = await savePage(courseDir, discData, "discussions");
          result.items.push({
            type: "discussion",
            name: topic.title,
            path: fp,
          });

          // Pull entries
          const entriesPath = await saveDiscussionEntries(
            courseDir,
            topic.title,
            topic.id,
            courseId
          );
          result.items.push({
            type: "discussion-entries",
            name: `${topic.title} entries`,
            path: entriesPath,
          });
          result.itemsPulled++;
        }
      }
      if (result.itemsPulled === 0) {
        result.errors.push(
          `No discussions found matching: ${options.discussionName}`
        );
      }
      return result;
    }

    // Pull specific assignment
    if (options.assignmentName) {
      const assignments = await listAssignments(courseId);
      for (const assignment of assignments) {
        if (matchesName(options.assignmentName, assignment.name || "")) {
          const fp = await saveAssignment(courseDir, assignment);
          result.items.push({
            type: "assignment",
            name: assignment.name,
            path: fp,
          });
          result.itemsPulled++;

          // Pull discussion entries if requested and it's a discussion assignment
          const isDiscussion = (assignment.submission_types || []).includes(
            "discussion_topic"
          );
          if (options.includeDiscussions && isDiscussion) {
            const topics = await listDiscussionTopics(courseId);
            for (const topic of topics) {
              if (topic.assignment_id === assignment.id) {
                const entriesPath = await saveDiscussionEntries(
                  courseDir,
                  assignment.name,
                  topic.id,
                  courseId
                );
                result.items.push({
                  type: "discussion-entries",
                  name: `${assignment.name} entries`,
                  path: entriesPath,
                });
                break;
              }
            }
          }

          // Pull submissions if requested
          if (options.submissions && options.submissions !== "none") {
            const submissions = await listSubmissions(
              courseId,
              assignment.id
            );
            for (const sub of submissions) {
              if (
                options.submissions === "ungraded" &&
                sub.grade !== null &&
                sub.grade !== undefined
              ) {
                continue;
              }
              if (sub.workflow_state === "unsubmitted") continue;

              const subPath = await saveSubmission(
                courseDir,
                assignment.name,
                sub
              );
              if (subPath) {
                result.items.push({
                  type: "submission",
                  name: sub.user?.name || `user-${sub.user_id}`,
                  path: subPath,
                });
              }
            }
          }
        }
      }
      if (result.itemsPulled === 0) {
        result.errors.push(
          `No assignments found matching: ${options.assignmentName}`
        );
      }
      return result;
    }

    // Pull specific module
    if (options.moduleName) {
      const modules = await listModules(courseId);
      const moduleData = modules.find((m) =>
        (m.name || "").toLowerCase().includes(options.moduleName!.toLowerCase())
      );

      if (!moduleData) {
        result.errors.push(`Module not found: ${options.moduleName}`);
        result.success = false;
        return result;
      }

      const moduleDir = path.join(courseDir, slugify(moduleData.name));
      await fs.mkdir(moduleDir, { recursive: true });

      // Save module metadata
      await writeYamlFile(path.join(moduleDir, "_module.yaml"), {
        canvas_id: moduleData.id,
        name: moduleData.name,
        position: moduleData.position,
        unlock_at: moduleData.unlock_at,
        require_sequential_progress:
          moduleData.require_sequential_progress,
        published: moduleData.published,
      });

      const items = await listModuleItems(courseId, moduleData.id);
      for (const item of items) {
        if (item.type === "Page" && item.page_url) {
          const page = await getPage(courseId, item.page_url);
          const fp = await savePage(
            courseDir,
            page,
            path.basename(moduleDir)
          );
          result.items.push({ type: "page", name: page.title, path: fp });
          result.itemsPulled++;
        } else if (item.type === "Assignment" && item.content_id) {
          const assignment = await getAssignment(courseId, item.content_id);
          const fp = await saveAssignment(
            courseDir,
            assignment,
            path.basename(moduleDir)
          );
          result.items.push({
            type: "assignment",
            name: assignment.name,
            path: fp,
          });
          result.itemsPulled++;
        } else if (item.type === "Discussion" && item.content_id) {
          const topic = await getDiscussionTopic(courseId, item.content_id);
          const discData: CanvasPage = {
            page_id: topic.id,
            url: `discussion-${topic.id}`,
            title: topic.title || "Discussion",
            body: topic.message || "",
            published: topic.published ?? false,
          };
          const fp = await savePage(
            courseDir,
            discData,
            path.basename(moduleDir)
          );
          result.items.push({
            type: "discussion",
            name: topic.title,
            path: fp,
          });
          result.itemsPulled++;
        }
      }
      return result;
    }

    // Pull entire course (all pages + all assignments + optionally rubrics)
    const pages = await listPages(courseId);
    for (const page of pages) {
      const fullPage = await getPage(courseId, page.url);
      const fp = await savePage(courseDir, fullPage);
      result.items.push({ type: "page", name: fullPage.title, path: fp });
      result.itemsPulled++;
    }

    const assignments = await listAssignments(courseId);
    for (const assignment of assignments) {
      const fp = await saveAssignment(courseDir, assignment);
      result.items.push({
        type: "assignment",
        name: assignment.name,
        path: fp,
      });
      result.itemsPulled++;
    }

    if (options.includeRubrics) {
      const rubrics = await listRubrics(courseId);
      for (const rubric of rubrics) {
        const fp = await saveRubric(courseDir, rubric);
        result.items.push({
          type: "rubric",
          name: rubric.title,
          path: fp,
        });
        result.itemsPulled++;
      }
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : String(error)
    );
    return result;
  }
}
