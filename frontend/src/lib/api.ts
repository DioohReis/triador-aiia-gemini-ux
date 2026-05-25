export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

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
  content_type?: string;
  characters: number;
  text: string;
};

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const NORMALIZED_API_URL = RAW_API_URL.replace(/\/$/, "");
const API_URL = NORMALIZED_API_URL.endsWith("/api")
  ? NORMALIZED_API_URL
  : `${NORMALIZED_API_URL}/api`;

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

async function request<T>(path: string, options?: RequestInit, token?: string | null): Promise<T> {
  let response: Response;
  const isFormData = options?.body instanceof FormData;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Não foi possível conectar na API em ${API_URL}. Confirme se o backend está online.`
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

export function registerUser(name: string, email: string, password: string) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginUser(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string) {
  return request<User>("/auth/me", undefined, token);
}

export function createAnalysis(resumeText: string, jobText: string, token: string) {
  return request<Analysis>(
    "/analyses",
    {
      method: "POST",
      body: JSON.stringify({ resume_text: resumeText, job_text: jobText }),
    },
    token
  );
}

export function extractDocument(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  return request<ExtractedDocument>(
    "/documents/extract",
    {
      method: "POST",
      body: formData,
    },
    token
  );
}

export function listAnalyses(token: string) {
  return request<Analysis[]>("/analyses", undefined, token);
}

export async function deleteAnalysis(id: number, token: string) {
  await request<void>(
    `/analyses/${id}`,
    {
      method: "DELETE",
    },
    token
  );
}
