import { ResumeRenderer } from "@/components/resume/resume-renderer";
import { getResume } from "@/lib/api/client";
import { notFound } from "next/navigation";

interface PrintPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}

export default async function PrintResumePage({ params, searchParams }: PrintPageProps) {
  const { id } = await params;
  const { template } = await searchParams;

  let resumeData;
  try {
    resumeData = await getResume(id);
  } catch {
    notFound();
  }

  if (!resumeData?.parsed_data) {
    notFound();
  }

  return (
    <html>
      <head>
        <title>{resumeData.parsed_data.contact?.name ? `${resumeData.parsed_data.contact.name} - Resume` : "Resume"}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 0; }
        `}</style>
      </head>
      <body>
        <ResumeRenderer
          resume={resumeData.parsed_data}
          template={(template as "modern" | "swiss") || "modern"}
        />
      </body>
    </html>
  );
}
