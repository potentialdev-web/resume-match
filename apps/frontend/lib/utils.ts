import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Great";
  if (score >= 60) return "Fair";
  return "Needs Work";
}

export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-400";
  if (grade.startsWith("B")) return "text-yellow-400";
  if (grade.startsWith("C")) return "text-orange-400";
  return "text-red-400";
}

/** Readable dashboard title from stored filename (strips extension, labels old tailored_* ids). */
export function resumeDisplayTitle(filename: string): string {
  const base = (filename || "").replace(/\.[^.]+$/, "").trim();
  if (!base) return "Untitled";
  if (/^tailored_[a-f0-9]{6,}$/i.test(base)) {
    return "Tailored resume (auto ID)";
  }
  return base;
}
