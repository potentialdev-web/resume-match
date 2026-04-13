"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ATSScorePanel } from "@/components/ats/ats-score-panel";
import { confirmGeneration } from "@/lib/api/client";
import { ATSScore, DiffChange, ResumeData } from "@/lib/types";
import { ChevronDown, ChevronUp, Download, Edit3, CheckCircle } from "lucide-react";

interface StepReviewProps {
  generationId: string;
  tailoredResume: ResumeData;
  atsScore: ATSScore;
  baseAtsScore: ATSScore | null;
  diffs: DiffChange[];
  onBack: () => void;
}

export function StepReview({
  generationId,
  tailoredResume,
  atsScore,
  baseAtsScore,
  diffs,
  onBack,
}: StepReviewProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffsOpen, setDiffsOpen] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmGeneration(generationId);
      setConfirmed({ id: result.tailored_resume_id });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirming(false);
    }
  };

  if (confirmed) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">Resume Saved!</h2>
          <p className="text-gray-400 text-sm">
            Your tailored resume is ready. Edit it further in the builder or download as PDF.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => router.push(`/builder/${confirmed.id}`)}
          >
            <Edit3 className="w-4 h-4" />
            Open in Builder
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              window.open(`/api/v1/resumes/${confirmed.id}/pdf`, "_blank");
            }}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Review Your Tailored Resume</h2>
        <p className="text-sm text-gray-400">
          Your resume has been tailored. Review the ATS score breakdown and changes before saving.
        </p>
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: resume summary + diffs */}
        <div className="space-y-4">
          {/* Resume summary card */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">
              {tailoredResume.personalInfo.name || "Tailored Resume"}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div>
                <span className="text-gray-600">Title: </span>
                {tailoredResume.personalInfo.title || "—"}
              </div>
              <div>
                <span className="text-gray-600">Experience: </span>
                {tailoredResume.workExperience.length} positions
              </div>
              <div>
                <span className="text-gray-600">Skills: </span>
                {tailoredResume.additional.technicalSkills.length} listed
              </div>
              <div>
                <span className="text-gray-600">Projects: </span>
                {tailoredResume.personalProjects.length}
              </div>
            </div>
          </div>

          {/* Changes made */}
          {diffs.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5">
              <button
                onClick={() => setDiffsOpen(!diffsOpen)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-300 hover:text-white"
              >
                <span>{diffs.length} changes made by AI</span>
                {diffsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {diffsOpen && (
                <div className="border-t border-white/10 px-5 pb-4 space-y-3 max-h-80 overflow-y-auto">
                  {diffs.map((diff, i) => (
                    <div
                      key={i}
                      className="text-xs border border-white/10 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-indigo-400 text-[11px]">{diff.path}</code>
                        <span className="text-gray-600 capitalize">{diff.action}</span>
                      </div>
                      {diff.original && (
                        <div className="bg-red-500/10 rounded p-2 text-red-300 line-through">
                          {typeof diff.original === "string" ? diff.original : JSON.stringify(diff.original)}
                        </div>
                      )}
                      <div className="bg-green-500/10 rounded p-2 text-green-300">
                        {typeof diff.value === "string" ? diff.value : Array.isArray(diff.value) ? diff.value.join(", ") : JSON.stringify(diff.value)}
                      </div>
                      {diff.reason && (
                        <p className="text-gray-500 italic">{diff.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: ATS score panel */}
        <ATSScorePanel score={atsScore} baseScore={baseAtsScore} />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>
          Start Over
        </Button>
        <Button size="lg" onClick={handleConfirm} loading={confirming}>
          <CheckCircle className="w-4 h-4" />
          Save & Open Builder
        </Button>
      </div>
    </div>
  );
}
