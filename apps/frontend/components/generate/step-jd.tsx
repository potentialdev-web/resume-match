"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadJob } from "@/lib/api/client";
import { JobKeywords, JobUploadResponse } from "@/lib/types";
import { CheckCircle, Hash } from "lucide-react";

interface StepJDProps {
  onComplete: (jobId: string, keywords: JobKeywords) => void;
  onBack: () => void;
}

const PLACEHOLDER = `Paste the job description here...

Example:
We are looking for a Senior Software Engineer to join our platform team...
Requirements:
- 5+ years of Python experience
- Experience with AWS, Docker, Kubernetes
- Strong understanding of distributed systems
...`;

export function StepJD({ onComplete, onBack }: StepJDProps) {
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobUploadResponse | null>(null);

  const handleExtract = async () => {
    if (!jd.trim()) {
      setError("Please enter a job description.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await uploadJob(jd);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const allKeywords = result
    ? [
        ...(result.keywords.required_skills || []),
        ...(result.keywords.preferred_skills || []),
        ...(result.keywords.keywords || []),
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Paste the Job Description</h2>
        <p className="text-sm text-gray-400">
          Copy and paste the full job posting. Our AI will extract keywords, required skills,
          and responsibilities to tailor your resume.
        </p>
      </div>

      {!result && (
        <textarea
          value={jd}
          onChange={(e) => { setJd(e.target.value); setError(null); }}
          placeholder={PLACEHOLDER}
          rows={12}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Keyword preview */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-semibold text-green-300">
                Extracted {allKeywords.length} keywords from JD
              </h3>
            </div>

            {result.keywords.required_skills?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Required Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.required_skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.keywords.preferred_skills?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Preferred Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.preferred_skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.keywords.seniority_level && (
              <p className="text-xs text-gray-400 mt-2">
                Seniority: <span className="text-white">{result.keywords.seniority_level}</span>
                {result.keywords.experience_years
                  ? ` · ${result.keywords.experience_years}+ years required`
                  : ""}
              </p>
            )}
          </div>

          <div className="text-sm text-gray-500">
            <button onClick={() => setResult(null)} className="hover:text-white underline transition-colors">
              Edit job description
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        {!result ? (
          <Button onClick={handleExtract} loading={loading} size="lg">
            Extract Keywords & Continue
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => onComplete(result.job_id, result.keywords)}
          >
            Generate Tailored Resume
          </Button>
        )}
      </div>
    </div>
  );
}
