import { ResumeBuilder } from "@/components/builder/resume-builder";
import { getResume } from "@/lib/api/client";
import { notFound } from "next/navigation";

interface BuilderPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { id } = await params;

  let resumeData;
  try {
    resumeData = await getResume(id);
  } catch {
    notFound();
  }

  if (!resumeData || !resumeData.parsed_data) {
    notFound();
  }

  return (
    <ResumeBuilder
      resumeId={id}
      initialResume={resumeData.parsed_data}
      initialAtsScore={resumeData.ats_score}
      jobKeywords={resumeData.job_keywords ?? undefined}
      family={resumeData.family ?? []}
    />
  );
}
