"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ATSScore, JobKeywords, ResumeData, ResumeFamilyVariant } from "@/lib/types";
import { ATSScorePanel } from "@/components/ats/ats-score-panel";
import { ResumeRenderer } from "@/components/resume/resume-renderer";
import { Button } from "@/components/ui/button";
import { calculateAtsScore, optimizeResume, updateResume } from "@/lib/api/client";
import {
  Download,
  Save,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutPanelLeft,
  Sparkles,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface ResumeBuilderProps {
  resumeId: string;
  initialResume: ResumeData;
  initialAtsScore: ATSScore | null;
  jobKeywords?: JobKeywords;
  /** Base + tailored variants to switch in the left sidebar */
  family?: ResumeFamilyVariant[];
}

export function ResumeBuilder({
  resumeId,
  initialResume,
  initialAtsScore,
  jobKeywords,
  family = [],
}: ResumeBuilderProps) {
  const [resume, setResume] = useState<ResumeData>(initialResume);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(initialAtsScore);
  const [scorePanelOpen, setScorePanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{ delta: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce ATS score recalculation on resume edits — always pass job keywords
  const recalculateScore = useCallback(
    (updatedResume: ResumeData) => {
      if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
      scoreDebounceRef.current = setTimeout(async () => {
        try {
          const result = await calculateAtsScore(updatedResume, jobKeywords);
          setAtsScore(result.ats_score);
        } catch {
          // Score recalculation is non-critical
        }
      }, 1200);
    },
    [jobKeywords]
  );

  useEffect(() => {
    return () => {
      if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    };
  }, []);

  const updateField = <K extends keyof ResumeData>(
    key: K,
    value: ResumeData[K]
  ) => {
    const updated = { ...resume, [key]: value };
    setResume(updated);
    setSaved(false);
    recalculateScore(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateResume(resumeId, resume);
      setSaved(true);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const result = await optimizeResume(resume, jobKeywords);
      const delta = Math.round(result.ats_score.overall - result.previous_score);
      setResume(result.resume as ResumeData);
      setAtsScore(result.ats_score);
      setOptimizeResult({ delta });
      setSaved(false);
      // Clear feedback after 4 seconds
      setTimeout(() => setOptimizeResult(null), 4000);
    } catch (e) {
      alert("Optimization failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-4 h-12 flex-shrink-0">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-white flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>

        <div className="h-4 w-px bg-white/10 mx-1" />

        <span className="text-sm text-gray-300 truncate max-w-[200px]">
          {resume.personalInfo.name || "Resume"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                activeTab === "preview"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                activeTab === "edit"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LayoutPanelLeft className="w-3.5 h-3.5" /> Edit
            </button>
          </div>

          <button
            onClick={() => setScorePanelOpen(!scorePanelOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg transition-colors"
          >
            {scorePanelOpen ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
            ATS Score
          </button>

          {optimizeResult && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
              optimizeResult.delta > 0
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-500/20 text-gray-400"
            }`}>
              {optimizeResult.delta > 0 ? `+${optimizeResult.delta} pts` : "No change"}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOptimize}
            loading={optimizing}
            title="Fix dates, quantify achievements, and inject missing keywords using AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {optimizing ? "Optimizing…" : "AI Optimize"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.open(`/api/v1/resumes/${resumeId}/pdf`, "_blank");
            }}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            variant={saved ? "secondary" : "primary"}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {family.length > 0 && (
          <aside className="w-52 flex-shrink-0 border-r border-white/10 bg-[#0c0e14] flex flex-col overflow-hidden">
            <div className="px-3 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5" />
                Generated resumes
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {family.map((v) => {
                const active = v.id === resumeId;
                const title = v.is_base
                  ? "Base resume"
                  : v.filename.replace(/\.[^.]+$/, "").replace(/^tailored_/i, "Tailored ") ||
                    "Tailored";
                return (
                  <Link
                    key={v.id}
                    href={`/builder/${v.id}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-indigo-500/20 text-white border border-indigo-500/40"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"
                    }`}
                  >
                    <span className="block truncate font-medium">{title}</span>
                    {!v.is_base && v.ats_overall != null && (
                      <span className="text-xs text-gray-500">ATS {v.ats_overall}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Center: preview or edit */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-gray-950">
          {activeTab === "preview" ? (
            <div className="flex justify-center py-8 px-4">
              <div className="shadow-2xl">
                <ResumeRenderer resume={resume} />
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
              <EditForm resume={resume} onChange={updateField} />
            </div>
          )}
        </div>

        {/* Right: ATS score panel */}
        {scorePanelOpen && (
          <div className="w-80 flex-shrink-0 border-l border-white/10 overflow-y-auto p-4 bg-[#0f1117]">
            {atsScore ? (
              <ATSScorePanel score={atsScore} />
            ) : (
              <div className="text-center py-12 text-sm text-gray-500">
                ATS score will appear here
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline edit form for resume sections
function EditForm({
  resume,
  onChange,
}: {
  resume: ResumeData;
  onChange: <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Personal Info */}
      <Section title="Personal Info">
        <div className="grid grid-cols-2 gap-3">
          {(["name", "title", "email", "phone", "location", "linkedin", "github", "website"] as const).map(
            (field) => (
              <div key={field}>
                <label className="text-xs text-gray-500 capitalize block mb-1">{field}</label>
                <input
                  type="text"
                  value={resume.personalInfo[field] ?? ""}
                  onChange={(e) =>
                    onChange("personalInfo", {
                      ...resume.personalInfo,
                      [field]: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )
          )}
        </div>
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <textarea
          value={resume.summary}
          onChange={(e) => onChange("summary", e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
        />
      </Section>

      {/* Experience */}
      <Section title="Experience">
        {(resume.workExperience?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-500 mb-3">
            No roles yet. Add a company and job title below.
          </p>
        )}
        {(resume.workExperience ?? []).map((exp, i) => (
          <div
            key={exp.id || i}
            className="border border-white/10 rounded-lg p-4 space-y-3 mb-3"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const list = [...(resume.workExperience ?? [])];
                  list.splice(i, 1);
                  onChange("workExperience", list);
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Title"
                value={exp.title}
                onChange={(v) => {
                  const updated = [...(resume.workExperience ?? [])];
                  updated[i] = { ...exp, title: v };
                  onChange("workExperience", updated);
                }}
              />
              <Field
                label="Company"
                value={exp.company}
                onChange={(v) => {
                  const updated = [...(resume.workExperience ?? [])];
                  updated[i] = { ...exp, company: v };
                  onChange("workExperience", updated);
                }}
              />
              <DateField
                label="Years"
                value={exp.years}
                onChange={(v) => {
                  const updated = [...(resume.workExperience ?? [])];
                  updated[i] = { ...exp, years: v };
                  onChange("workExperience", updated);
                }}
              />
              <Field
                label="Location"
                value={exp.location ?? ""}
                onChange={(v) => {
                  const updated = [...(resume.workExperience ?? [])];
                  updated[i] = { ...exp, location: v };
                  onChange("workExperience", updated);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bullets (one per line)</label>
              <textarea
                value={(exp.description ?? []).join("\n")}
                onChange={(e) => {
                  const updated = [...(resume.workExperience ?? [])];
                  updated[i] = {
                    ...exp,
                    description: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  };
                  onChange("workExperience", updated);
                }}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const list = [...(resume.workExperience ?? [])];
            const nextId =
              list.reduce((m, e) => Math.max(m, e.id ?? 0), 0) + 1;
            list.push({
              id: nextId,
              title: "",
              company: "",
              years: "",
              location: "",
              description: [],
            });
            onChange("workExperience", list);
          }}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          + Add company
        </button>
      </Section>

      {/* Education */}
      <Section title="Education">
        {(resume.education?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-500 mb-3">
            No education entries yet. Add your university or school below.
          </p>
        )}
        {(resume.education ?? []).map((edu, i) => (
          <div
            key={edu.id || i}
            className="border border-white/10 rounded-lg p-4 space-y-3 mb-3"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const list = [...(resume.education ?? [])];
                  list.splice(i, 1);
                  onChange("education", list);
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Institution"
                value={edu.institution}
                onChange={(v) => {
                  const updated = [...(resume.education ?? [])];
                  updated[i] = { ...edu, institution: v };
                  onChange("education", updated);
                }}
              />
              <Field
                label="Degree"
                value={edu.degree}
                onChange={(v) => {
                  const updated = [...(resume.education ?? [])];
                  updated[i] = { ...edu, degree: v };
                  onChange("education", updated);
                }}
              />
              <DateField
                label="Years"
                value={edu.years}
                onChange={(v) => {
                  const updated = [...(resume.education ?? [])];
                  updated[i] = { ...edu, years: v };
                  onChange("education", updated);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Details (optional — honors, GPA, coursework)
              </label>
              <textarea
                value={edu.description ?? ""}
                onChange={(e) => {
                  const updated = [...(resume.education ?? [])];
                  updated[i] = {
                    ...edu,
                    description: e.target.value || null,
                  };
                  onChange("education", updated);
                }}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const list = [...(resume.education ?? [])];
            const nextId =
              list.reduce((m, e) => Math.max(m, e.id ?? 0), 0) + 1;
            list.push({
              id: nextId,
              institution: "",
              degree: "",
              years: "",
              description: null,
            });
            onChange("education", list);
          }}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          + Add school
        </button>
      </Section>

      {/* Skills */}
      <Section title="Technical Skills">
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            One skill per line
          </label>
          <textarea
            value={resume.additional.technicalSkills.join("\n")}
            onChange={(e) =>
              onChange("additional", {
                ...resume.additional,
                technicalSkills: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

/** Normalizes MM/YYYY date ranges to "Mon YYYY" format client-side */
function normalizeDate(raw: string): string {
  return raw
    .replace(
      /\b(0?[1-9]|1[0-2])[/\-](20\d{2}|19\d{2})\b/g,
      (_, m, y) => {
        const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${names[parseInt(m, 10) - 1]} ${y}`;
      }
    )
    .replace(/\b(present|current|now|ongoing)\b/gi, "Present")
    .replace(/\s*[-–—]\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const _MONTH_NAME_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i;

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hasNumericDate = /\b(0?[1-9]|1[0-2])[/\-](20\d{2}|19\d{2})\b/.test(value);
  const hasTwoRanges = (value.match(/ - /g) || []).length > 1;

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        {hasNumericDate && (
          <button
            type="button"
            onClick={() => onChange(normalizeDate(value))}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline"
          >
            Fix format
          </button>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Jan 2020 - Present"
        className={`w-full rounded-lg border px-3 py-1.5 text-sm text-white bg-white/5 focus:outline-none focus:border-indigo-500 ${
          hasNumericDate || hasTwoRanges
            ? "border-yellow-500/50"
            : "border-white/10"
        }`}
      />
      {hasTwoRanges && (
        <p className="text-xs text-yellow-400 mt-1">
          Multiple date ranges detected. Keep only the current job&apos;s dates (e.g. &quot;Jan 2025 - Present&quot;).
        </p>
      )}
      {hasNumericDate && !hasTwoRanges && (
        <p className="text-xs text-yellow-400 mt-1">
          Click &quot;Fix format&quot; to convert to ATS-friendly month names.
        </p>
      )}
      {!hasNumericDate && !hasTwoRanges && value && !_MONTH_NAME_RE.test(value) && (
        <p className="text-xs text-gray-500 mt-1">Use format: &quot;Jan 2020 - Present&quot;</p>
      )}
    </div>
  );
}
