"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { StepUpload } from "./step-upload";
import { StepJD } from "./step-jd";
import { StepReview } from "./step-review";
import { generatePreview } from "@/lib/api/client";
import { ATSScore, DiffChange, JobKeywords, ResumeData } from "@/lib/types";
import { Loader2 } from "lucide-react";

type Step = "upload" | "jd" | "generating" | "review";

const STEPS: { id: Step | string; label: string }[] = [
  { id: "upload", label: "Upload Resume" },
  { id: "jd", label: "Job Description" },
  { id: "review", label: "Review & Save" },
];

function StepIndicator({ current }: { current: Step }) {
  const displaySteps = STEPS.filter((s) => s.id !== "generating");
  const currentIdx =
    current === "generating" || current === "review"
      ? 2
      : displaySteps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-3 mb-8">
      {displaySteps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px flex-1 w-12 ${done ? "bg-indigo-500" : "bg-white/10"}`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? "bg-indigo-600 text-white"
                    : active
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-400/50"
                    : "bg-white/10 text-gray-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  active ? "text-white" : done ? "text-indigo-300" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GenerateWizard() {
  const searchParams = useSearchParams();
  const fromResumeId = searchParams.get("from");
  const [step, setStep] = useState<Step>("upload");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [tailoredResume, setTailoredResume] = useState<ResumeData | null>(null);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [baseAtsScore, setBaseAtsScore] = useState<ATSScore | null>(null);
  const [diffs, setDiffs] = useState<DiffChange[]>([]);
  const [jobLabel, setJobLabel] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleUploadComplete = (rid: string, _parsedData: ResumeData) => {
    setResumeId(rid);
    setStep("jd");
  };

  const handleJDComplete = async (jid: string, _keywords: JobKeywords) => {
    if (!resumeId) return;
    setJobId(jid);
    setStep("generating");
    setGenError(null);

    try {
      const preview = await generatePreview(resumeId, jid);
      setGenerationId(preview.generation_id);
      setTailoredResume(preview.tailored_resume);
      setAtsScore(preview.ats_score);
      setBaseAtsScore(preview.base_ats_score ?? null);
      setDiffs(preview.diffs);
      setJobLabel(preview.job_label?.trim() || null);
      setStep("review");
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
      setStep("jd");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <StepIndicator current={step} />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        {step === "upload" && (
          <StepUpload
            onComplete={handleUploadComplete}
            initialResumeId={fromResumeId}
          />
        )}

        {(step === "jd" || step === "generating") && (
          <div className="space-y-4">
            {genError && (
              <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">
                {genError}
              </div>
            )}
            <StepJD
              onComplete={handleJDComplete}
              onBack={() => setStep("upload")}
            />
            {step === "generating" && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="rounded-2xl border border-white/20 bg-[#1a1d27] p-8 text-center max-w-sm mx-4">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">Generating your resume…</h3>
                  <p className="text-sm text-gray-400">
                    AI is tailoring your resume, running up to 2 ATS optimization passes, and
                    injecting missing keywords. This takes 30–60 seconds.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "review" &&
          generationId &&
          tailoredResume &&
          atsScore && (
            <StepReview
              generationId={generationId}
              tailoredResume={tailoredResume}
              atsScore={atsScore}
              baseAtsScore={baseAtsScore}
              diffs={diffs}
              jobLabel={jobLabel}
              onBack={() => setStep("upload")}
            />
          )}
      </div>
    </div>
  );
}
