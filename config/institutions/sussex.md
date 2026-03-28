# Institution Profile
id: sussex
name: University of Sussex
version: 1

## Canonical Mapping
programme = programme|course|pathway
module = module|course|unit
assessment = assessment|assignment|task

## Structure
academic_year_root = {year}
module_root = {year}/{module_code}-{module_name}
programme_root = {year}/programmes/{programme_code}-{programme_name}
module_context_folder = 01-Key-information-and-resources
teaching_folder = 02-Weekly-prompts-notes-and-resources
assessment_folder = 03-Assessment

## Page Types
module_context_pages = Module-information|Module-contacts|Digital-and-Employability-Skills
teaching_page_pattern = Week-{n}-{title}
assessment_page_pattern = {assessment_id}-{title}

## Canvas Mapping
canvas_course_entity = module
ui_label_programme = Course
ui_label_module = Module

## Validation
require_module_information_page = true
require_assessment_folder = true
require_teaching_pages = true
min_teaching_pages = 8
