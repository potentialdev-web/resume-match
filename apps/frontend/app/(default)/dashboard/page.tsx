"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listResumes } from "@/lib/api/client";
import { ResumeListItem } from "@/lib/types";
import { ResumeCard } from "@/components/dashboard/resume-card";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listResumes();
      setResumes(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const masters = resumes.filter((r) => r.is_master);
  const tailored = resumes.filter((r) => !r.is_master);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Resumes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {resumes.length} resume{resumes.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Link href="/generate">
            <Button size="sm">
              <Plus className="w-3.5 h-3.5" />
              New Resume
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && resumes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-gray-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No resumes yet</h2>
          <p className="text-sm text-gray-400 mb-6">
            Upload your base resume and a job description to get started.
          </p>
          <Link href="/generate">
            <Button size="lg">Generate My First Resume</Button>
          </Link>
        </div>
      )}

      {/* Base resumes */}
      {masters.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Base Resumes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {masters.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                onDeleted={(id) =>
                  setResumes((prev) => prev.filter((x) => x.id !== id))
                }
                onLabelUpdated={(id, filename) =>
                  setResumes((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, filename } : x))
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Tailored resumes */}
      {tailored.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Tailored Resumes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tailored.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                onDeleted={(id) =>
                  setResumes((prev) => prev.filter((x) => x.id !== id))
                }
                onLabelUpdated={(id, filename) =>
                  setResumes((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, filename } : x))
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
