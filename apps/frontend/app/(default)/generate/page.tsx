import { GenerateWizard } from "@/components/generate/generate-wizard";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Generate Resume — ResumeGen",
};

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-10 text-gray-500 text-sm">Loading…</div>}>
      <GenerateWizard />
    </Suspense>
  );
}
