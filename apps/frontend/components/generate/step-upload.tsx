"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, CheckCircle, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getResume, listResumes, uploadResume } from "@/lib/api/client";
import { ResumeData, ResumeListItem } from "@/lib/types";

interface StepUploadProps {
  onComplete: (resumeId: string, parsedData: ResumeData) => void;
  /** When set, load this resume on mount (e.g. from ?from= on /generate) */
  initialResumeId?: string | null;
}

export function StepUpload({ onComplete, initialResumeId }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<"upload" | "saved">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ resumeId: string; data: ResumeData } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [savedList, setSavedList] = useState<ResumeListItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingPick, setLoadingPick] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (source !== "saved") return;
    let cancelled = false;
    (async () => {
      setLoadingSaved(true);
      try {
        const res = await listResumes();
        if (!cancelled) setSavedList(res.data);
      } catch {
        if (!cancelled) setError("Could not load saved resumes");
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (!initialResumeId || initialLoadDone.current) return;
    initialLoadDone.current = true;
    (async () => {
      setLoadingPick(true);
      setError(null);
      try {
        const full = await getResume(initialResumeId);
        if (full.parsed_data) {
          setPreview({ resumeId: full.id, data: full.parsed_data });
          setSource("saved");
        }
      } catch {
        setError("Could not open the resume from the link.");
      } finally {
        setLoadingPick(false);
      }
    })();
  }, [initialResumeId]);

  const handleFile = (f: File) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!allowed.includes(f.type)) {
      setError("Please upload a PDF, DOCX, or TXT file.");
      return;
    }
    setFile(f);
    setError(null);
    setPreview(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadResume(file);
      setPreview({ resumeId: result.resume_id, data: result.parsed_data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const pickSaved = async (item: ResumeListItem) => {
    setLoadingPick(true);
    setError(null);
    try {
      const full = await getResume(item.id);
      if (!full.parsed_data) {
        setError("This resume has no parsed content yet.");
        return;
      }
      setPreview({ resumeId: full.id, data: full.parsed_data });
    } catch {
      setError("Could not load this resume.");
    } finally {
      setLoadingPick(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Choose starting resume</h2>
        <p className="text-sm text-gray-400">
          Upload a file, or reuse any saved base or tailored resume for a new job.
        </p>
      </div>

      {/* Source toggle */}
      {!preview && (
        <div className="flex rounded-lg border border-white/10 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setSource("upload");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 px-3 transition-colors ${
              source === "upload"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => {
              setSource("saved");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 px-3 transition-colors flex items-center justify-center gap-2 ${
              source === "saved"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Saved resumes
          </button>
        </div>
      )}

      {loadingPick && (
        <p className="text-sm text-gray-400">Loading resume…</p>
      )}

      {/* Saved list */}
      {source === "saved" && !preview && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 max-h-72 overflow-y-auto">
          {loadingSaved ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : savedList.length === 0 ? (
            <p className="text-sm text-gray-500">No saved resumes yet. Upload a file first.</p>
          ) : (
            <ul className="space-y-2">
              {savedList.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pickSaved(r)}
                    disabled={loadingPick}
                    className="w-full text-left rounded-lg border border-white/10 px-3 py-2.5 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm text-white font-medium block truncate">
                      {r.filename.replace(/\.[^.]+$/, "") || "Untitled"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {r.is_master ? "Base resume" : "Tailored resume"}
                      {r.ats_score
                        ? ` · ATS ${Math.round(r.ats_score.overall)}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dropzone */}
      {source === "upload" && !preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all ${
            dragging
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Upload className="w-8 h-8 text-gray-500 mb-3" />
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-white">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-300 font-medium">
                Drop your resume here or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">PDF, DOCX, or TXT</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-3">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Parsed preview */}
      {preview && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-green-300">Resume parsed successfully!</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-300">
            <div>
              <span className="text-gray-500">Name: </span>
              {preview.data.personalInfo.name || "—"}
            </div>
            <div>
              <span className="text-gray-500">Title: </span>
              {preview.data.personalInfo.title || "—"}
            </div>
            <div>
              <span className="text-gray-500">Experience entries: </span>
              {preview.data.workExperience.length}
            </div>
            <div>
              <span className="text-gray-500">Skills: </span>
              {preview.data.additional.technicalSkills.length}
            </div>
          </div>

          {/* Skill preview */}
          {preview.data.additional.technicalSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {preview.data.additional.technicalSkills.slice(0, 8).map((s) => (
                <span key={s} className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300">
                  {s}
                </span>
              ))}
              {preview.data.additional.technicalSkills.length > 8 && (
                <span className="px-2 py-0.5 rounded text-xs text-gray-500">
                  +{preview.data.additional.technicalSkills.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {source === "upload" && file && !preview && (
          <Button onClick={handleUpload} loading={uploading} size="lg">
            <FileText className="w-4 h-4" />
            Parse Resume
          </Button>
        )}
        {source === "upload" && !file && !preview && (
          <Button onClick={() => inputRef.current?.click()} variant="secondary" size="lg">
            Choose File
          </Button>
        )}
        {preview && (
          <>
            <Button
              size="lg"
              onClick={() => onComplete(preview.resumeId, preview.data)}
            >
              Continue to Job Description
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setPreview(null);
                setFile(null);
                setError(null);
              }}
            >
              {file ? "Change file" : "Choose different resume"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
