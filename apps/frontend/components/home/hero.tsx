import Link from "next/link";
import { ArrowRight, CheckCircle, Zap, Target, FileText } from "lucide-react";

const FEATURES = [
  {
    icon: <Zap className="w-5 h-5 text-indigo-400" />,
    title: "AI-Powered Tailoring",
    desc: "Automatically adapts your resume to each job description using advanced language models.",
  },
  {
    icon: <Target className="w-5 h-5 text-green-400" />,
    title: "Full ATS Score Panel",
    desc: "Get a 0–100 ATS score with 6-factor breakdown: keywords, formatting, verbs, and more.",
  },
  {
    icon: <FileText className="w-5 h-5 text-yellow-400" />,
    title: "Preserves Your Truth",
    desc: "Never invents experience. Only rephrases what's already there to match the job better.",
  },
];

const STEPS = [
  { n: "1", label: "Upload your base resume (PDF or DOCX)" },
  { n: "2", label: "Paste the job description" },
  { n: "3", label: "Get a tailored, ATS-scored resume instantly" },
];

export function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-powered, ATS-ready resumes in seconds
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight mb-6">
          Your resume,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            perfectly matched
          </span>
          <br />
          to every job
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Upload your base resume, paste a job description, and let AI tailor your resume
          to maximize ATS score and keyword alignment — without fabricating a single line.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all hover:scale-105 shadow-lg shadow-indigo-900/40"
          >
            Generate My Resume
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium text-sm border border-white/10 transition-all"
          >
            View Dashboard
          </Link>
        </div>

        {/* How it works */}
        <div className="mt-20 text-left">
          <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-8">
            How It Works
          </h2>
          <div className="flex flex-col sm:flex-row items-start justify-center gap-6">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="flex items-start gap-3 flex-1 max-w-xs"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </div>
                <p className="text-sm text-gray-300">{step.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-5 text-left hover:border-white/20 transition-colors"
            >
              <div className="mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600">
          {[
            "Never fabricates experience",
            "Supports OpenAI, Anthropic, Gemini",
            "Local Ollama support",
            "PDF export",
          ].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
