/**
 * Typed FastAPI client for Daak v2 Desktop Web & Citizen Preview.
 * Uses NEXT_PUBLIC_API_BASE_URL when configured; degrades gracefully offline.
 */

import type {
  ActivityLog,
  CrimeReport,
  CriminalRecord,
  DaakDataset,
  DistressSignal,
  PoliceStation,
  SafeWalk,
  ShiftHandover,
  UserRole,
} from "./opsLogic";

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function isLiveApiConfigured(): boolean {
  return Boolean(getApiBase());
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const base = getApiBase();
  if (!base) {
    throw new Error("API_BASE_UNCONFIGURED");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const resp = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const json = (await resp.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  };
  if (!resp.ok || json.data === undefined) {
    throw new Error(json.error?.message || `API request failed (${resp.status})`);
  }
  return json.data;
}

export async function apiDemoLogin(role: UserRole): Promise<{ access_token: string }> {
  return apiRequest<{ access_token: string }>("/api/v1/auth/demo-login", {
    method: "POST",
    body: { role },
  });
}

function normalizeReport(raw: Record<string, unknown>): CrimeReport {
  return {
    id: String(raw.id),
    reporter_id: raw.reporter_id ? String(raw.reporter_id) : null,
    reporter_display_name: String(raw.reporter_display_name ?? "Daak Citizen"),
    is_anonymous_public: Boolean(raw.is_anonymous_public),
    category: (raw.category as CrimeReport["category"]) ?? "other",
    severity: (raw.severity as CrimeReport["severity"]) ?? "medium",
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    area_name: String(raw.area_name ?? "Dhaka"),
    address_text: raw.address_text ? String(raw.address_text) : undefined,
    lat: Number(raw.lat ?? 23.7465),
    lng: Number(raw.lng ?? 90.376),
    occurred_at: String(raw.occurred_at ?? raw.created_at ?? new Date().toISOString()),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    status: (raw.status as CrimeReport["status"]) ?? "pending",
    corroboration_count: Number(raw.corroboration_count ?? 0),
    suspicion_score: Number(raw.suspicion_score ?? 0),
    flag_status: (raw.flag_status as CrimeReport["flag_status"]) ?? "none",
    suspicion_reasons: Array.isArray(raw.suspicion_reasons)
      ? raw.suspicion_reasons.map(String)
      : [],
    moderation_note: raw.moderation_note ? String(raw.moderation_note) : null,
  };
}

function normalizeSos(raw: Record<string, unknown>): DistressSignal {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id ?? ""),
    citizen_name: String(raw.citizen_name ?? "Daak Citizen"),
    trigger_source: (raw.trigger_source as DistressSignal["trigger_source"]) ?? "panic_button",
    lat: Number(raw.lat ?? 23.7465),
    lng: Number(raw.lng ?? 90.376),
    area_name: String(raw.area_name ?? "Dhaka"),
    battery_level: raw.battery_level === null || raw.battery_level === undefined ? null : Number(raw.battery_level),
    note: String(raw.note ?? ""),
    status: (raw.status as DistressSignal["status"]) ?? "active",
    claimed_by: raw.claimed_by ? String(raw.claimed_by) : null,
    assigned_unit: raw.assigned_unit ? String(raw.assigned_unit) : null,
    triggered_at: String(raw.triggered_at ?? new Date().toISOString()),
    sla_target_seconds: Number(raw.sla_target_seconds ?? 300),
    dispatch_timeline: Array.isArray(raw.dispatch_timeline)
      ? (raw.dispatch_timeline as DistressSignal["dispatch_timeline"])
      : [],
  };
}

function normalizeLog(raw: Record<string, unknown>): ActivityLog {
  const meta = (raw.metadata as Record<string, unknown> | undefined) ?? {};
  const summary =
    typeof raw.summary === "string" && raw.summary
      ? raw.summary
      : Object.keys(meta).length > 0
      ? `${String(raw.action)} (${Object.entries(meta)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(", ")})`
      : `${String(raw.action)} on ${String(raw.target_type)}`;
  return {
    id: String(raw.id),
    actor_role: String(raw.actor_role ?? "system"),
    action: String(raw.action ?? "event"),
    target_type: String(raw.target_type ?? "system"),
    summary,
    created_at: String(raw.created_at ?? new Date().toISOString()),
  };
}

export async function apiFetchDataset(token: string, role: UserRole): Promise<Partial<DaakDataset>> {
  const [sosRaw, reportsRaw, walksRaw, criminalsRaw, stationsRaw] = await Promise.all([
    apiRequest<Record<string, unknown>[]>("/api/v1/sos", { token }),
    apiRequest<Record<string, unknown>[]>("/api/v1/reports", { token }),
    apiRequest<SafeWalk[]>("/api/v1/safe-walks", { token }),
    apiRequest<CriminalRecord[]>("/api/v1/criminals", { token }),
    apiRequest<PoliceStation[]>("/api/v1/thanas/nearest?limit=8", { token }),
  ]);

  const partial: Partial<DaakDataset> = {
    distressSignals: sosRaw.map(normalizeSos),
    reports: reportsRaw.map(normalizeReport),
    safeWalks: walksRaw,
    criminals: criminalsRaw,
    policeStations: stationsRaw,
  };

  if (role === "police" || role === "admin") {
    const [handovers, logsRaw] = await Promise.all([
      apiRequest<ShiftHandover[]>("/api/v1/police/handovers", { token }),
      apiRequest<Record<string, unknown>[]>("/api/v1/admin/logs", { token }),
    ]);
    partial.shiftHandovers = handovers;
    partial.activityLogs = logsRaw.map(normalizeLog);
  }

  return partial;
}

export async function apiTriggerSos(
  token: string,
  payload: { lat: number; lng: number; area_name: string; note: string; battery_level?: number }
): Promise<DistressSignal> {
  const res = await apiRequest<Record<string, unknown>>("/api/v1/sos", {
    method: "POST",
    token,
    body: {
      ...payload,
      idempotency_key: `web-${Date.now()}`,
    },
  });
  return normalizeSos(res);
}

export async function apiDispatchSos(
  token: string,
  sosId: string,
  payload: { status: "claimed" | "responding" | "resolved" | "false_alarm"; assigned_unit?: string }
): Promise<DistressSignal> {
  const res = await apiRequest<Record<string, unknown>>(`/api/v1/sos/${sosId}/dispatch`, {
    method: "PATCH",
    token,
    body: payload,
  });
  return normalizeSos(res);
}

export async function apiCreateReport(
  token: string,
  payload: {
    category: CrimeReport["category"];
    severity: CrimeReport["severity"];
    title: string;
    description: string;
    area_name: string;
    lat: number;
    lng: number;
    is_anonymous_public: boolean;
  }
): Promise<CrimeReport> {
  const res = await apiRequest<Record<string, unknown>>("/api/v1/reports", {
    method: "POST",
    token,
    body: payload,
  });
  return normalizeReport(res);
}

export async function apiCorroborateReport(
  token: string,
  reportId: string,
  userLat: number,
  userLng: number
): Promise<void> {
  await apiRequest<Record<string, unknown>>(`/api/v1/reports/${reportId}/corroborate`, {
    method: "POST",
    token,
    body: { user_lat: userLat, user_lng: userLng },
  });
}

export async function apiEscalateSafeWalk(
  token: string,
  walkId: string
): Promise<{ safe_walk: SafeWalk; distress_signal: DistressSignal }> {
  const res = await apiRequest<{ safe_walk: SafeWalk; distress_signal: Record<string, unknown> }>(
    `/api/v1/safe-walks/${walkId}/escalate`,
    { method: "POST", token }
  );
  return {
    safe_walk: res.safe_walk,
    distress_signal: normalizeSos(res.distress_signal),
  };
}

export async function apiCompleteSafeWalk(token: string, walkId: string): Promise<SafeWalk> {
  return apiRequest<SafeWalk>(`/api/v1/safe-walks/${walkId}/checkin`, {
    method: "PATCH",
    token,
    body: { action: "complete" },
  });
}

export async function apiModerateReport(
  token: string,
  reportId: string,
  payload: {
    status?: CrimeReport["status"];
    flag_status?: CrimeReport["flag_status"];
    moderation_note?: string | null;
  }
): Promise<CrimeReport> {
  const res = await apiRequest<Record<string, unknown>>(`/api/v1/admin/reports/${reportId}/moderate`, {
    method: "PATCH",
    token,
    body: payload,
  });
  return normalizeReport(res);
}

export async function apiCreateHandover(
  token: string,
  payload: { shift_label: string; summary: string; priority_areas: string[] }
): Promise<ShiftHandover> {
  return apiRequest<ShiftHandover>("/api/v1/police/handovers", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiCreateCriminal(
  token: string,
  payload: { full_name: string; last_known_area: string; risk_level: CriminalRecord["risk_level"] }
): Promise<CriminalRecord> {
  return apiRequest<CriminalRecord>("/api/v1/admin/criminals", {
    method: "POST",
    token,
    body: {
      ...payload,
      crime_categories: ["snatching"],
      status: "wanted",
      details: "Added via Admin Watchlist console (synthetic demo).",
    },
  });
}

export async function apiUpdateCriminalStatus(
  token: string,
  criminalId: string,
  status: CriminalRecord["status"]
): Promise<CriminalRecord> {
  return apiRequest<CriminalRecord>(`/api/v1/admin/criminals/${criminalId}`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

export async function apiAskDaakAi(
  token: string,
  prompt: string,
  lat: number,
  lng: number
): Promise<{ reply: string }> {
  return apiRequest<{ reply: string }>("/api/v1/ai/chat", {
    method: "POST",
    token,
    body: { prompt, lat, lng },
  });
}
