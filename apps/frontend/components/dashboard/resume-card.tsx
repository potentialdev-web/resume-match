"use client";

import Link from "next/link";
import { ResumeListItem } from "@/lib/types";
import { scoreColor, formatDate } from "@/lib/utils";
import { ScoreRingCompact } from "@/components/ats/score-ring";
import { FileText, Trash2, Download, Edit3, Crown, Sparkles } from "lucide-react";
import { deleteResume } from "@/lib/api/client";

interface ResumeCardProps {
  resume: ResumeListItem;
  onDeleted: (id: string) => void;
}

export function ResumeCard({ resume, onDeleted }: ResumeCardProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this resume?")) return;
    try {
      await deleteResume(resume.id);
      onDeleted(resume.id);
    } catch {
      alert("Failed to delete resume");
    }
  };

  const statusColor =
    resume.processing_status === "completed"
      ? "text-green-400"
      : resume.processing_status === "failed"
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-all group">
      {resume.is_master && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 rounded-full px-2 py-0.5">
          <Crown className="w-3 h-3" />
          Master
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* ATS Score ring or file icon */}
        <div className="flex-shrink-0 mt-1">
          {resume.ats_score ? (
            <ScoreRingCompact score={resume.ats_score} size={72} />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {resume.filename.replace(/\.[^.]+$/, "") || "Untitled"}
          </h3>
          {resume.parent_id && (
            <p className="text-xs text-indigo-400 mt-0.5">Tailored resume</p>
          )}
          <p className={`text-xs mt-1 capitalize ${statusColor}`}>
            {resume.processing_status}
          </p>
          <p className="text-xs text-gray-600 mt-1">{formatDate(resume.created_at)}</p>

          {resume.ats_score && (
            <p className="text-xs mt-2" style={{ color: scoreColor(resume.ats_score.overall) }}>
              ATS: {Math.round(resume.ats_score.overall)}/100 · Grade {resume.ats_score.grade}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
        <Link
          href={`/generate?from=${encodeURIComponent(resume.id)}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-indigo-300 hover:text-white hover:bg-indigo-500/20 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          New job
        </Link>
        <Link
          href={`/builder/${resume.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </Link>
        <a
          href={`/api/v1/resumes/${resume.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          PDF
        </a>
        <button
          onClick={handleDelete}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
