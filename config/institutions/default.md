# Institution Profile
id: default
name: Generic Institution
version: 1

## Canonical Mapping
programme = programme|course|pathway
module = module|course|unit
assessment = assessment|assignment|task

## Structure
academic_year_root = {year}
module_root = {year}/modules/{module_code}-{module_name}
programme_root = {year}/programmes/{programme_code}-{programme_name}
module_context_folder = 01-module-context
teaching_folder = 02-teaching
assessment_folder = 03-assessment

## Page Types
module_context_pages = module-information|module-contacts|digital-and-employability-skills
teaching_page_pattern = Week-{n}-{title}
assessment_page_pattern = {assessment_id}-{title}

## Canvas Mapping
canvas_course_entity = module
ui_label_programme = Programme
ui_label_module = Module

## Validation
require_module_information_page = true
require_assessment_folder = true
require_teaching_pages = true
min_teaching_pages = 8
