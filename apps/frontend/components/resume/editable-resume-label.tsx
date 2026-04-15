"use client";

import { useEffect, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateResumeLabel } from "@/lib/api/client";
import { filenameStem, resumeDisplayTitle } from "@/lib/utils";

interface EditableResumeLabelProps {
  resumeId: string;
  /** Full stored filename e.g. `Senior Engineer.json` */
  filename: string;
  /** Called after successful save with new full filename */
  onSaved?: (newFilename: string) => void;
  /** card = title row; bar = compact toolbar */
  variant?: "card" | "bar";
  className?: string;
}

export function EditableResumeLabel({
  resumeId,
  filename,
  onSaved,
  variant = "card",
  className = "",
}: EditableResumeLabelProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => filenameStem(filename));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(filenameStem(filename));
  }, [filename, resumeId]);

  const cancel = () => {
    setValue(filenameStem(filename));
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const stem = value.trim();
    if (!stem) {
      setError("Enter a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updateResumeLabel(resumeId, stem);
      onSaved?.(res.filename);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
            className="flex-1 min-w-0 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="Resume name"
            autoFocus
            disabled={saving}
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="p-1 rounded text-green-400 hover:bg-white/10 disabled:opacity-50"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="p-1 rounded text-gray-400 hover:bg-white/10"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const display = resumeDisplayTitle(filename);

  if (variant === "bar") {
    return (
      <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
        <span className="text-sm text-gray-500 flex-shrink-0">Label</span>
        <span className="text-sm text-gray-300 truncate max-w-[180px]" title={filename}>
          {display}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-1 rounded text-gray-500 hover:text-indigo-400 hover:bg-white/10 flex-shrink-0"
          title="Edit label"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 min-w-0 ${className}`}>
      <h3 className="text-sm font-semibold text-white truncate flex-1 min-w-0" title={filename}>
        {display}
      </h3>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 rounded text-gray-500 hover:text-indigo-400 hover:bg-white/10 flex-shrink-0 mt-0.5"
        title="Edit label"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
