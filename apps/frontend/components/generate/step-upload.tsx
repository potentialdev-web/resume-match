"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadResume } from "@/lib/api/client";
import { ResumeData } from "@/lib/types";

interface StepUploadProps {
  onComplete: (resumeId: string, parsedData: ResumeData) => void;
}

export function StepUpload({ onComplete }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ resumeId: string; data: ResumeData } | null>(null);
  const [dragging, setDragging] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Upload Your Base Resume</h2>
        <p className="text-sm text-gray-400">
          Upload your existing resume in PDF, DOCX, or TXT format. Our AI will parse it
          into structured data while preserving all your experience.
        </p>
      </div>

      {/* Dropzone */}
      {!preview && (
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

      <div className="flex gap-3">
        {file && !preview && (
          <Button onClick={handleUpload} loading={uploading} size="lg">
            <FileText className="w-4 h-4" />
            Parse Resume
          </Button>
        )}
        {!file && !preview && (
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
              onClick={() => { setPreview(null); setFile(null); }}
            >
              Change File
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
