import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Generator — AI-powered ATS-ready resumes",
  description:
    "Upload your base resume + job description. Get a tailored, ATS-optimized resume in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
