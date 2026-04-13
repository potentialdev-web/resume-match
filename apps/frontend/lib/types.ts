// Core resume data types matching backend schemas

export interface PersonalInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website?: string | null;
  linkedin?: string | null;
  github?: string | null;
}

export interface Experience {
  id: number;
  title: string;
  company: string;
  location?: string | null;
  years: string;
  description: string[];
}

export interface Education {
  id: number;
  institution: string;
  degree: string;
  years: string;
  description?: string | null;
}

export interface Project {
  id: number;
  name: string;
  role: string;
  years: string;
  github?: string | null;
  website?: string | null;
  description: string[];
}

export interface AdditionalInfo {
  technicalSkills: string[];
  languages: string[];
  certificationsTraining: string[];
  awards: string[];
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  summary: string;
  workExperience: Experience[];
  education: Education[];
  personalProjects: Project[];
  additional: AdditionalInfo;
  sectionMeta?: SectionMeta[];
  customSections?: Record<string, CustomSection>;
}

export interface SectionMeta {
  id: string;
  key: string;
  displayName: string;
  sectionType: "personalInfo" | "text" | "itemList" | "stringList";
  isDefault: boolean;
  isVisible: boolean;
  order: number;
}

export interface CustomSection {
  sectionType: "text" | "itemList" | "stringList";
  items?: CustomSectionItem[];
  strings?: string[];
  text?: string;
}

export interface CustomSectionItem {
  id: number;
  title: string;
  subtitle?: string | null;
  location?: string | null;
  years: string;
  description: string[];
}

// ATS Score types

export interface ATSScoreFactor {
  name: string;
  score: number;       // 0-100 percentage for this factor
  max_score: number;   // weight
  earned: number;      // actual points
  description: string;
  tip?: string | null;
}

export interface ATSScore {
  overall: number;
  grade: string;
  factors: ATSScoreFactor[];
  matched_keywords: string[];
  missing_keywords: string[];
  total_keywords: number;
  keyword_match_pct: number;
}

// API response types

export interface ResumeListItem {
  id: string;
  filename: string;
  is_master: boolean;
  parent_id: string | null;
  processing_status: string;
  ats_score: ATSScore | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratePreviewResponse {
  generation_id: string;
  tailored_resume: ResumeData;
  ats_score: ATSScore;
  diffs: DiffChange[];
  base_ats_score: ATSScore | null;
}

export interface GenerateConfirmResponse {
  tailored_resume_id: string;
  tailored_resume: ResumeData;
  ats_score: ATSScore;
}

export interface DiffChange {
  path: string;
  action: "replace" | "append" | "reorder";
  original: string | null;
  value: string | string[];
  reason: string;
}

export interface JobKeywords {
  required_skills: string[];
  preferred_skills: string[];
  experience_requirements: string[];
  education_requirements: string[];
  key_responsibilities: string[];
  keywords: string[];
  experience_years?: number;
  seniority_level?: string;
}

export interface JobUploadResponse {
  job_id: string;
  keywords: JobKeywords;
  created_at: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
  api_key_set: boolean;
  api_base?: string | null;
}
