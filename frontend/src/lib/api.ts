export type Analysis = {
  id: number;
  candidate_name: string;
  skills: string[];
  years_experience: number;
  fit_score: number;
  summary: string;
  created_at: string;
};

export type Health = {
  status: string;
  app: string;
  environment: string;
  llm_provider: string;
  database: string;
};

export type ExtractedDocument = {
  filename: string;
  characters: number;
  text: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return error.map((item) => item?.msg ?? JSON.stringify(item)).join(" | ");
  }
  if (error && typeof error === "object" && "detail" in error) {
    return normalizeError((error as { detail: unknown }).detail);
  }
  return "Erro inesperado na comunicação com a API.";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  const isFormData = options?.body instanceof FormData;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: isFormData
        ? options?.headers
        : {
            "Content-Type": "application/json",
            ...(options?.headers ?? {}),
          },
    });
  } catch {
    throw new Error(
      `Não foi possível conectar na API em ${API_URL}. Confirme se o backend está rodando na porta 8000.`
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Erro inesperado." }));
    throw new Error(normalizeError(payload));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getHealth() {
  return request<Health>("/health");
}

export function createAnalysis(resumeText: string, jobText: string) {
  return request<Analysis>("/analyses", {
    method: "POST",
    body: JSON.stringify({ resume_text: resumeText, job_text: jobText }),
  });
}

export function extractDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<ExtractedDocument>("/documents/extract", {
    method: "POST",
    body: formData,
  });
}

export function listAnalyses() {
  return request<Analysis[]>("/analyses");
}

export async function deleteAnalysis(id: number) {
  await request<void>(`/analyses/${id}`, {
    method: "DELETE",
  });
}
