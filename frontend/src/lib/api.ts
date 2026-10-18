import type {
  ChatRequest,
  ChatResponse,
  ChatStatus,
  EligibilityRequest,
  EligibilityResponse,
  FieldMeta,
  KindInfo,
  Me,
  OtpSent,
  Profile,
  Scheme,
  SchemesResponse,
  Topic,
} from "./types";

// On the server we call FastAPI directly; in the browser we go through the
// /api rewrite in next.config.ts. BACKEND_URL is never sent to the browser.
const BASE = typeof window === "undefined" ? (process.env.BACKEND_URL ?? "http://127.0.0.1:8000") : "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {}
    throw new ApiError(`${init?.method ?? "GET"} ${path} failed with ${res.status}`, res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const SLUG = /^[a-z0-9_]+$/;

export function getSchemes(topic?: string): Promise<SchemesResponse> {
  return request(topic ? `/api/schemes?topic=${encodeURIComponent(topic)}` : "/api/schemes");
}

export function getTopics(): Promise<Topic[]> {
  return request("/api/topics");
}

/** Resolves to null when the topic does not exist. */
export async function getTopic(id: string): Promise<Topic | null> {
  if (!SLUG.test(id)) return null;
  try {
    return await request<Topic>(`/api/topics/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function getKinds(): Promise<KindInfo[]> {
  return request("/api/kinds");
}

/** Resolves to null when the scheme does not exist. */
export async function getScheme(id: string): Promise<Scheme | null> {
  if (!SLUG.test(id)) return null;
  try {
    return await request<Scheme>(`/api/schemes/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function getFields(): Promise<FieldMeta[]> {
  return request("/api/fields");
}

export function checkEligibility(body: EligibilityRequest, signal?: AbortSignal): Promise<EligibilityResponse> {
  return request("/api/eligibility", { method: "POST", body: JSON.stringify(body), signal });
}

// --------------------------------------------------------------------------- chat

export function sendChat(body: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return request("/api/chat", { method: "POST", body: JSON.stringify(body), signal });
}

export function getChatStatus(): Promise<ChatStatus> {
  return request("/api/chat/status");
}

// --------------------------------------------------------------------------- accounts (browser only: session cookie)

export function requestOtp(phone: string, lang: string): Promise<OtpSent> {
  return request("/api/auth/otp/request", { method: "POST", body: JSON.stringify({ phone, lang }) });
}

export function verifyOtp(phone: string, code: string, lang: string): Promise<Me> {
  return request("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code, lang }) });
}

/** Resolves to null when not logged in. */
export async function getMe(): Promise<Me | null> {
  try {
    return await request<Me>("/api/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function updateMe(body: { whatsapp_opt_in?: boolean; lang?: string }): Promise<Me> {
  return request("/api/me", { method: "PATCH", body: JSON.stringify(body) });
}

export function saveAnswers(profile: Profile, skipped: string[]): Promise<Me> {
  return request("/api/me/answers", { method: "PUT", body: JSON.stringify({ profile, skipped }) });
}

export function logout(): Promise<void> {
  return request("/api/auth/logout", { method: "POST" });
}

export function deleteAccount(): Promise<void> {
  return request("/api/me", { method: "DELETE" });
}
