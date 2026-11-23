/**
 * Deterministic Citizen mobile state machine, 1 km corroboration guard,
 * Safe Walk deadline evaluator, Bangla/Banglish Thana lookup, and DESIGN.md tokens.
 */

export interface MobileThemePalette {
  canvas: string;
  surface: string;
  railMuted: string;
  railCommitted: string;
  primaryTeal: string;
  onPrimary: string;
  inkPrimary: string;
  inkSecondary: string;
  hairline: string;
  emergencyCrimson: string;
  emergencyFill: string;
  onEmergency: string;
  emergencySoft: string;
  warningAmber: string;
  safeEmerald: string;
}

export const MOBILE_PALETTE: Record<"light" | "dark", MobileThemePalette> = {
  light: {
    canvas: "#F6F7F4",
    surface: "#FFFFFF",
    railMuted: "#ECEFEB",
    railCommitted: "#0F514A",
    primaryTeal: "#0F514A",
    onPrimary: "#FFFFFF",
    inkPrimary: "#131C1E",
    inkSecondary: "#4B5B5E",
    hairline: "#D5DDD9",
    emergencyCrimson: "#C81E2B",
    emergencyFill: "#C81E2B",
    onEmergency: "#FFFFFF",
    emergencySoft: "#FDECEC",
    warningAmber: "#B45309",
    safeEmerald: "#15803D",
  },
  dark: {
    canvas: "#11171A",
    surface: "#182126",
    railMuted: "#1E292F",
    railCommitted: "#0C1114",
    primaryTeal: "#2DD4BF",
    onPrimary: "#091314",
    inkPrimary: "#EEF2F1",
    inkSecondary: "#9EB0B3",
    hairline: "#26343A",
    emergencyCrimson: "#F87171",
    emergencyFill: "#991B1B",
    onEmergency: "#FEF2F2",
    emergencySoft: "#451218",
    warningAmber: "#FBBF24",
    safeEmerald: "#4ADE80",
  },
};

export interface SosCountdownState {
  status: "idle" | "countdown" | "transmitting" | "cancelled";
  secondsRemaining: number;
}

export function createSosCountdown(seconds: number = 5): SosCountdownState {
  return { status: "countdown", secondsRemaining: Math.max(1, seconds) };
}

export function tickSosCountdown(state: SosCountdownState): SosCountdownState {
  if (state.status !== "countdown") return state;
  const next = state.secondsRemaining - 1;
  if (next <= 0) {
    return { status: "transmitting", secondsRemaining: 0 };
  }
  return { status: "countdown", secondsRemaining: next };
}

export function cancelSosCountdown(state: SosCountdownState): SosCountdownState {
  if (state.status === "transmitting") return state;
  return { status: "cancelled", secondsRemaining: 0 };
}

export function evaluateSafeWalkDeadline(
  expectedArrivalIso: string,
  nowMs: number = Date.now()
): { remainingSeconds: number; shouldAutoEscalate: boolean } {
  const targetMs = new Date(expectedArrivalIso).getTime();
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  if (diffSec <= 0) {
    return { remainingSeconds: 0, shouldAutoEscalate: true };
  }
  return { remainingSeconds: diffSec, shouldAutoEscalate: false };
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.min(1, Math.max(0, Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function canCorroborateIncident(
  reportLat: number,
  reportLng: number,
  userLat: number,
  userLng: number,
  isOwnReport: boolean
): { allowed: boolean; distanceMeters: number; reason?: string } {
  const distanceMeters = haversineMeters(reportLat, reportLng, userLat, userLng);
  if (isOwnReport) {
    return { allowed: false, distanceMeters, reason: "SELF_CORROBORATION_FORBIDDEN" };
  }
  if (distanceMeters > 1000) {
    return { allowed: false, distanceMeters, reason: "CORROBORATION_OUT_OF_RANGE" };
  }
  return { allowed: true, distanceMeters };
}

export interface ThanaContact {
  name_en: string;
  name_bn: string;
  phone: string;
  keywords: string[];
}

export const DHAKA_THANAS: ThanaContact[] = [
  {
    name_en: "Dhanmondi Model Police Station",
    name_bn: "ধানমন্ডি মডেল থানা",
    phone: "+8801320039660",
    keywords: ["dhanmondi", "kalabagan", "science lab", "jigatola", "ধানমন্ডি"],
  },
  {
    name_en: "Shahbagh Police Station",
    name_bn: "শাহবাগ থানা",
    phone: "+8801320039520",
    keywords: ["shahbagh", "tsc", "dhaka university", "ramna", "শাহবাগ"],
  },
  {
    name_en: "Mirpur Model Police Station",
    name_bn: "মিরপুর মডেল থানা",
    phone: "+8801320041200",
    keywords: ["mirpur", "mirpur 10", "mirpur-10", "kazipara", "মিরপুর"],
  },
  {
    name_en: "Mohammadpur Police Station",
    name_bn: "মোহাম্মদপুর থানা",
    phone: "+8801320040800",
    keywords: ["mohammadpur", "adabor", "lalmatia", "মোহাম্মদপুর"],
  },
  {
    name_en: "Uttara East Police Station",
    name_bn: "উত্তরা পূর্ব থানা",
    phone: "+8801320041900",
    keywords: ["uttara", "azampur", "উত্তরা"],
  },
  {
    name_en: "Gulshan Police Station",
    name_bn: "গুলশান থানা",
    phone: "+8801320041000",
    keywords: ["gulshan", "banani", "baridhara", "গুলশান"],
  },
];

export function resolveBanglaOrBanglishThana(query: string): ThanaContact {
  const lowered = query.toLowerCase();
  const matched = DHAKA_THANAS.find((t) => t.keywords.some((kw) => lowered.includes(kw)));
  return matched ?? DHAKA_THANAS[0];
}

export const MOBILE_AREA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  dhanmondi: { lat: 23.7465, lng: 90.376 },
  "mirpur-10": { lat: 23.8069, lng: 90.3688 },
  mirpur: { lat: 23.8069, lng: 90.3688 },
  shahbagh: { lat: 23.7385, lng: 90.3954 },
  mohammadpur: { lat: 23.7654, lng: 90.3587 },
  uttara: { lat: 23.8759, lng: 90.4005 },
  gulshan: { lat: 23.7925, lng: 90.4152 },
  motijheel: { lat: 23.733, lng: 90.4173 },
};

export function resolveMobileAreaCoords(area: string): { lat: number; lng: number } {
  const key = area.trim().toLowerCase();
  if (MOBILE_AREA_COORDINATES[key]) return MOBILE_AREA_COORDINATES[key];
  const matched = Object.entries(MOBILE_AREA_COORDINATES).find(([k]) => key.includes(k));
  return matched ? matched[1] : MOBILE_AREA_COORDINATES.dhanmondi;
}

export async function mobileDemoLogin(baseUrl: string): Promise<string | null> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const resp = await fetch(`${base}/api/v1/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "citizen" }),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data?: { access_token?: string } };
    return json.data?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function syncMobileApiAction<T = unknown>(
  baseUrl: string,
  token: string | null,
  path: string,
  method: string,
  body?: unknown
): Promise<T | null> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}
