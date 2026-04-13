import { GenerateWizard } from "@/components/generate/generate-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate Resume — ResumeGen",
};

export default function GeneratePage() {
  return <GenerateWizard />;
}
