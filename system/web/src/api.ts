import type {
  ApprovalView,
  Assessment,
  Assumptions,
  AssumptionsUpdate,
  BriefReaderResult,
  DeclineView,
  Draft,
  Extension,
  ExtensionCreated,
  ExtensionRequest,
  MondayCheckResult,
  OkMessage,
  OutboxMail,
  Overview,
  PrePublishResult,
  Proposal,
  PublicSummary,
  PulseResult,
  Run,
  Session,
  StudentDigest,
  StudentLink,
  WeekDetail,
} from "./types";

export const MOCK = import.meta.env.VITE_MOCK === "1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PUT";

/** Listeners told when an operator call returns 401, so the app can show the locked state. */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (MOCK) {
    const { mockRequest } = await import("./mock");
    try {
      return (await mockRequest(method, path, body)) as T;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) unauthorizedListeners.forEach((f) => f());
      throw e;
    }
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Could not reach the CrunchRadar server. Check that it is running.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    if (res.status === 401) unauthorizedListeners.forEach((f) => f());
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : null;
    const msg = typeof detail === "string" ? detail : `Request failed (${res.status}).`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};
const enc = encodeURIComponent;

export const api = {
  session: () => request<Session>("GET", "/api/session"),
  publicSummary: () => request<PublicSummary>("GET", "/api/public-summary"),

  overview: () => request<Overview>("GET", "/api/overview"),
  assessments: () => request<Assessment[]>("GET", "/api/assessments"),
  week: (n: number) => request<WeekDetail>("GET", `/api/week/${n}`),
  assumptions: () => request<Assumptions>("GET", "/api/assumptions"),
  putAssumptions: (body: AssumptionsUpdate) => request<Assumptions>("PUT", "/api/assumptions", body),
  resetAssumptions: () => request<Assumptions>("POST", "/api/assumptions/reset"),

  proposals: () => request<Proposal[]>("GET", "/api/proposals"),
  runs: (limit = 50) => request<Run[]>("GET", `/api/runs${q({ limit })}`),
  outbox: (limit = 50) => request<OutboxMail[]>("GET", `/api/outbox${q({ limit })}`),

  mondayCheck: () => request<MondayCheckResult>("POST", "/api/workflows/monday-check"),
  followUp: () => request<{ run_id: number; checked: string[] }>("POST", "/api/workflows/follow-up"),
  prePublish: (draft: Draft) => request<PrePublishResult>("POST", "/api/pre-publish", draft),
  briefReader: (text: string) => request<BriefReaderResult>("POST", "/api/brief-reader", { text }),

  approval: (token: string) => request<ApprovalView>("GET", `/api/approve/${enc(token)}`),
  decide: (token: string, decision: "approve" | "reject") => request<OkMessage>("POST", `/api/approve/${enc(token)}`, { decision }),
  lecturer: (token: string) => request<DeclineView>("GET", `/api/lecturer/${enc(token)}`),
  decline: (token: string) => request<OkMessage>("POST", `/api/lecturer/${enc(token)}/decline`),

  student: (email: string, token: string, week?: number) => request<StudentDigest>("GET", `/api/student${q({ email, token, week })}`),
  pulse: (email: string, token: string, week: number) => request<PulseResult>("POST", "/api/pulse", { email, token, week }),
  studentLink: (email: string) => request<StudentLink>("GET", `/api/student-link${q({ email })}`),

  requestExtension: (body: ExtensionRequest) => request<ExtensionCreated>("POST", "/api/extensions", body),
  extensions: () => request<Extension[]>("GET", "/api/extensions"),
  decideExtension: (id: number, decision: "approve" | "override") => request<OkMessage>("POST", `/api/extensions/${id}/decide`, { decision }),
};
