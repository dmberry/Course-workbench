export interface InstitutionProfile {
  id: string;
  name: string;
  version: number;
  canonicalMapping: {
    programme: string[];
    module: string[];
    assessment: string[];
  };
  structure: {
    academicYearRoot: string;
    moduleRoot: string;
    programmeRoot: string;
    moduleContextFolder: string;
    teachingFolder: string;
    assessmentFolder: string;
  };
  pageTypes: {
    moduleContextPages: string[];
    teachingPagePattern: string;
    assessmentPagePattern: string;
  };
  canvasMapping: {
    canvasCourseEntity: string;
    uiLabelProgramme: string;
    uiLabelModule: string;
  };
  validation: {
    requireModuleInformationPage: boolean;
    requireAssessmentFolder: boolean;
    requireTeachingPages: boolean;
    minTeachingPages: number;
  };
}

export interface InstitutionProfileSummary {
  id: string;
  name: string;
  version: number;
}
