// API client for the backend

function getApiBase(): string {
  if (typeof window === "undefined") {
    // Server-side: call backend directly
    return `${process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000"}/api/v1`;
  }
  // Client-side: go through Next.js rewrite proxy
  return "/api/v1";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const cookieHeader: Record<string, string> = {};
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const token = (await cookies()).get("token")?.value;
      if (token) cookieHeader["Cookie"] = `token=${token}`;
    } catch { /* not in RSC context */ }
  }
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...cookieHeader,
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMsg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      errorMsg = body.detail || body.message || errorMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

// ── Resume endpoints ──────────────────────────────────────────────────────

export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${getApiBase()}/resumes/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function listResumes() {
  return request<{ data: import("@/lib/types").ResumeListItem[] }>("/resumes/list");
}

export async function getResume(resumeId: string) {
  return request<{
    id: string;
    filename: string;
    is_master: boolean;
    parent_id: string | null;
    processing_status: string;
    parsed_data: import("@/lib/types").ResumeData;
    ats_score: import("@/lib/types").ATSScore | null;
    job_id: string | null;
    job_keywords: import("@/lib/types").JobKeywords | null;
    base_id: string;
    family: import("@/lib/types").ResumeFamilyVariant[];
    created_at: string;
    updated_at: string;
  }>(`/resumes/${resumeId}`);
}

export async function updateResume(resumeId: string, data: import("@/lib/types").ResumeData) {
  return request<{ success: boolean }>(`/resumes/${resumeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateResumeLabel(resumeId: string, label: string) {
  return request<{ success: boolean; filename: string }>(`/resumes/${resumeId}/label`, {
    method: "PATCH",
    body: JSON.stringify({ label }),
  });
}

export async function deleteResume(resumeId: string) {
  return request<{ success: boolean }>(`/resumes/${resumeId}`, {
    method: "DELETE",
  });
}

export function getResumePdfUrl(resumeId: string, template = "modern") {
  return `/api/v1/resumes/${resumeId}/pdf?template=${template}`;
}

// ── Job endpoints ─────────────────────────────────────────────────────────

export async function uploadJob(content: string) {
  return request<import("@/lib/types").JobUploadResponse>("/jobs/upload", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getJob(jobId: string) {
  return request<{
    job_id: string;
    content: string;
    keywords: import("@/lib/types").JobKeywords;
    created_at: string;
  }>(`/jobs/${jobId}`);
}

// ── Generate endpoints ────────────────────────────────────────────────────

export async function generatePreview(resumeId: string, jobId: string) {
  return request<import("@/lib/types").GeneratePreviewResponse>("/generate/preview", {
    method: "POST",
    body: JSON.stringify({ resume_id: resumeId, job_id: jobId }),
  });
}

export async function confirmGeneration(
  generationId: string,
  tailoredResume?: import("@/lib/types").ResumeData
) {
  return request<import("@/lib/types").GenerateConfirmResponse>("/generate/confirm", {
    method: "POST",
    body: JSON.stringify({
      generation_id: generationId,
      ...(tailoredResume ? { tailored_resume: tailoredResume } : {}),
    }),
  });
}

// ── Score endpoints ───────────────────────────────────────────────────────

export async function getAtsScore(resumeId: string, jobId?: string) {
  const qs = jobId ? `?job_id=${jobId}` : "";
  return request<{
    resume_id: string;
    job_id: string | null;
    ats_score: import("@/lib/types").ATSScore;
  }>(`/score/${resumeId}${qs}`);
}

export async function calculateAtsScore(
  resumeData: import("@/lib/types").ResumeData,
  jobKeywords?: import("@/lib/types").JobKeywords
) {
  return request<{ ats_score: import("@/lib/types").ATSScore }>("/score/calculate", {
    method: "POST",
    body: JSON.stringify({ resume: resumeData, job_keywords: jobKeywords }),
  });
}

export async function optimizeResume(
  resumeData: import("@/lib/types").ResumeData,
  jobKeywords?: import("@/lib/types").JobKeywords
) {
  return request<{
    resume: import("@/lib/types").ResumeData;
    ats_score: import("@/lib/types").ATSScore;
    previous_score: number;
  }>("/score/optimize", {
    method: "POST",
    body: JSON.stringify({ resume: resumeData, job_keywords: jobKeywords }),
  });
}

// ── Config endpoints ──────────────────────────────────────────────────────

export async function getLlmConfig() {
  return request<import("@/lib/types").LLMConfig>("/config/llm");
}

export async function updateLlmConfig(config: {
  provider: string;
  model: string;
  api_key: string;
  api_base?: string;
}) {
  return request<{ success: boolean }>("/config/llm", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function testLlmConnection() {
  return request<{ healthy: boolean; provider: string; model: string; error_code?: string }>(
    "/config/llm/test",
    { method: "POST", body: "{}" }
  );
}

export async function saveApiKey(provider: string, apiKey: string, model?: string) {
  return request<{ success: boolean }>("/config/api-keys", {
    method: "POST",
    body: JSON.stringify({ provider, api_key: apiKey, model }),
  });
}

// ── Health ────────────────────────────────────────────────────────────────

export async function getHealth() {
  return request<{ status: string; llm: Record<string, unknown> }>("/health");
}
