import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  InstitutionProfile,
  InstitutionProfileSummary,
} from "@/types/institution-profile";

const PROFILE_DIR = join(process.cwd(), "config", "institutions");

const DEFAULT_PROFILE: InstitutionProfile = {
  id: "default",
  name: "Generic Institution",
  version: 1,
  canonicalMapping: {
    programme: ["programme", "course", "pathway"],
    module: ["module", "course", "unit"],
    assessment: ["assessment", "assignment", "task"],
  },
  structure: {
    academicYearRoot: "{year}",
    moduleRoot: "{year}/modules/{module_code}-{module_name}",
    programmeRoot: "{year}/programmes/{programme_code}-{programme_name}",
    moduleContextFolder: "01-module-context",
    teachingFolder: "02-teaching",
    assessmentFolder: "03-assessment",
  },
  pageTypes: {
    moduleContextPages: [
      "module-information",
      "module-contacts",
      "digital-and-employability-skills",
    ],
    teachingPagePattern: "Week-{n}-{title}",
    assessmentPagePattern: "{assessment_id}-{title}",
  },
  canvasMapping: {
    canvasCourseEntity: "module",
    uiLabelProgramme: "Programme",
    uiLabelModule: "Module",
  },
  validation: {
    requireModuleInformationPage: true,
    requireAssessmentFolder: true,
    requireTeachingPages: true,
    minTeachingPages: 8,
  },
};

function list(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function int(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isNaN(n) ? fallback : n;
}

export function parseInstitutionProfileMarkdown(content: string): InstitutionProfile {
  const keyValues: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colon = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
    if (colon) {
      keyValues[colon[1]] = colon[2].trim();
      continue;
    }

    const equals = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (equals) {
      keyValues[equals[1]] = equals[2].trim();
    }
  }

  return {
    id: keyValues.id || DEFAULT_PROFILE.id,
    name: keyValues.name || DEFAULT_PROFILE.name,
    version: int(keyValues.version || String(DEFAULT_PROFILE.version), DEFAULT_PROFILE.version),
    canonicalMapping: {
      programme: keyValues.programme ? list(keyValues.programme) : DEFAULT_PROFILE.canonicalMapping.programme,
      module: keyValues.module ? list(keyValues.module) : DEFAULT_PROFILE.canonicalMapping.module,
      assessment: keyValues.assessment ? list(keyValues.assessment) : DEFAULT_PROFILE.canonicalMapping.assessment,
    },
    structure: {
      academicYearRoot: keyValues.academic_year_root || DEFAULT_PROFILE.structure.academicYearRoot,
      moduleRoot: keyValues.module_root || DEFAULT_PROFILE.structure.moduleRoot,
      programmeRoot: keyValues.programme_root || DEFAULT_PROFILE.structure.programmeRoot,
      moduleContextFolder:
        keyValues.module_context_folder || DEFAULT_PROFILE.structure.moduleContextFolder,
      teachingFolder: keyValues.teaching_folder || DEFAULT_PROFILE.structure.teachingFolder,
      assessmentFolder: keyValues.assessment_folder || DEFAULT_PROFILE.structure.assessmentFolder,
    },
    pageTypes: {
      moduleContextPages: keyValues.module_context_pages
        ? list(keyValues.module_context_pages)
        : DEFAULT_PROFILE.pageTypes.moduleContextPages,
      teachingPagePattern:
        keyValues.teaching_page_pattern || DEFAULT_PROFILE.pageTypes.teachingPagePattern,
      assessmentPagePattern:
        keyValues.assessment_page_pattern || DEFAULT_PROFILE.pageTypes.assessmentPagePattern,
    },
    canvasMapping: {
      canvasCourseEntity:
        keyValues.canvas_course_entity || DEFAULT_PROFILE.canvasMapping.canvasCourseEntity,
      uiLabelProgramme:
        keyValues.ui_label_programme || DEFAULT_PROFILE.canvasMapping.uiLabelProgramme,
      uiLabelModule: keyValues.ui_label_module || DEFAULT_PROFILE.canvasMapping.uiLabelModule,
    },
    validation: {
      requireModuleInformationPage: bool(
        keyValues.require_module_information_page ||
          String(DEFAULT_PROFILE.validation.requireModuleInformationPage),
        DEFAULT_PROFILE.validation.requireModuleInformationPage
      ),
      requireAssessmentFolder: bool(
        keyValues.require_assessment_folder ||
          String(DEFAULT_PROFILE.validation.requireAssessmentFolder),
        DEFAULT_PROFILE.validation.requireAssessmentFolder
      ),
      requireTeachingPages: bool(
        keyValues.require_teaching_pages || String(DEFAULT_PROFILE.validation.requireTeachingPages),
        DEFAULT_PROFILE.validation.requireTeachingPages
      ),
      minTeachingPages: int(
        keyValues.min_teaching_pages || String(DEFAULT_PROFILE.validation.minTeachingPages),
        DEFAULT_PROFILE.validation.minTeachingPages
      ),
    },
  };
}

function readProfileByPath(path: string): InstitutionProfile {
  const text = readFileSync(path, "utf8");
  return parseInstitutionProfileMarkdown(text);
}

export function listInstitutionProfiles(): InstitutionProfileSummary[] {
  if (!existsSync(PROFILE_DIR)) {
    return [{ id: DEFAULT_PROFILE.id, name: DEFAULT_PROFILE.name, version: DEFAULT_PROFILE.version }];
  }

  const files = readdirSync(PROFILE_DIR).filter((name) => name.endsWith(".md"));
  const summaries: InstitutionProfileSummary[] = [];

  for (const file of files) {
    try {
      const profile = readProfileByPath(join(PROFILE_DIR, file));
      summaries.push({ id: profile.id, name: profile.name, version: profile.version });
    } catch {
      // Skip invalid profile files
    }
  }

  if (!summaries.some((p) => p.id === DEFAULT_PROFILE.id)) {
    summaries.unshift({
      id: DEFAULT_PROFILE.id,
      name: DEFAULT_PROFILE.name,
      version: DEFAULT_PROFILE.version,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export function getInstitutionProfile(profileId: string): InstitutionProfile {
  if (existsSync(PROFILE_DIR)) {
    const files = readdirSync(PROFILE_DIR).filter((name) => name.endsWith(".md"));
    for (const file of files) {
      const fullPath = join(PROFILE_DIR, file);
      try {
        const parsed = readProfileByPath(fullPath);
        if (parsed.id === profileId) return parsed;
      } catch {
        // Ignore malformed profile
      }
    }
  }

  return DEFAULT_PROFILE;
}
