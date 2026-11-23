/**
 * Shared types, SLA chronometer, anonymity masking, safety scoring,
 * and synthetic Bangladesh demo state for Daak v2 Desktop Web & Citizen Preview.
 */

export type UserRole = "citizen" | "police" | "admin";

export interface DemoProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string;
  credibility_score: number;
  station_name?: string;
}

export interface PoliceStation {
  id: string;
  name_en: string;
  name_bn: string;
  aliases: string[];
  district: string;
  phone: string;
  lat: number;
  lng: number;
}

export interface CrimeReport {
  id: string;
  reporter_id: string | null;
  reporter_display_name: string;
  is_anonymous_public: boolean;
  category:
    | "snatching"
    | "theft"
    | "assault"
    | "harassment"
    | "fraud"
    | "vandalism"
    | "suspicious_activity"
    | "traffic_hazard"
    | "other";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  area_name: string;
  address_text?: string;
  lat: number;
  lng: number;
  occurred_at: string;
  created_at: string;
  status: "pending" | "verified" | "investigating" | "resolved" | "rejected";
  corroboration_count: number;
  suspicion_score: number;
  flag_status: "none" | "flagged" | "cleared" | "confirmed_false";
  suspicion_reasons: string[];
  moderation_note?: string | null;
}

export interface DistressSignal {
  id: string;
  user_id: string;
  citizen_name: string;
  trigger_source: "panic_button" | "safe_walk_timeout";
  lat: number;
  lng: number;
  area_name: string;
  battery_level: number | null;
  note: string;
  status: "active" | "claimed" | "responding" | "resolved" | "cancelled" | "false_alarm";
  claimed_by: string | null;
  assigned_unit: string | null;
  triggered_at: string;
  sla_target_seconds: number;
  dispatch_timeline: Array<{ at: string; status: string; note: string }>;
}

export interface SafeWalk {
  id: string;
  user_id: string;
  destination_name: string;
  lat: number;
  lng: number;
  expected_arrival_at: string;
  status: "active" | "completed" | "escalated" | "cancelled";
  escalated_sos_id: string | null;
}

export interface ShiftHandover {
  id: string;
  officer_name: string;
  shift_label: string;
  summary: string;
  priority_areas: string[];
  created_at: string;
}

export interface CriminalRecord {
  id: string;
  full_name: string;
  aliases: string[];
  crime_categories: string[];
  risk_level: "low" | "medium" | "high" | "critical";
  last_known_area: string;
  status: "wanted" | "in_custody" | "archived";
  details: string;
}

export interface ActivityLog {
  id: string;
  actor_role: string;
  action: string;
  target_type: string;
  summary: string;
  created_at: string;
}

export interface AreaSafetyScore {
  area: string;
  score: number;
  level: "Safe" | "Moderate" | "Caution" | "High Risk";
  reportCount: number;
  resolvedCount: number;
  pendingCount: number;
  nightCount: number;
  dominantCategory: string;
  lat: number;
  lng: number;
  factors: {
    crimeFrequency: number;
    resolutionRate: number;
    timeOfDay: number;
  };
}

export interface ReportTip {
  id: string;
  report_id: string;
  author_display_name: string;
  is_anonymous_public: boolean;
  body: string;
  votes: number;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  notify_on_sos: boolean;
  notify_on_safe_walk: boolean;
}

export interface FalseReportBreakdown {
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  userCredibility: number;
  duplicatePattern: number;
  rapidSubmission: number;
  detailConsistency: number;
  suspiciousContent: number;
}

export interface PredictiveAlert {
  id: string;
  type: "SPIKE" | "HOTSPOT" | "TREND";
  severity: number;
  severityLabel: "Critical" | "High" | "Medium" | "Low";
  area: string;
  crimeType: string;
  timeOfDay: string;
  message: string;
  description: string;
  count: number;
  trend: "increasing" | "stable";
  lat: number;
  lng: number;
}

export interface DaakDataset {
  profiles: Record<UserRole, DemoProfile>;
  policeStations: PoliceStation[];
  reports: CrimeReport[];
  reportTips: ReportTip[];
  emergencyContacts: EmergencyContact[];
  distressSignals: DistressSignal[];
  safeWalks: SafeWalk[];
  shiftHandovers: ShiftHandover[];
  criminals: CriminalRecord[];
  activityLogs: ActivityLog[];
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

export function findNearestStation(
  stations: PoliceStation[],
  lat: number,
  lng: number,
  query?: string
): { station: PoliceStation; distanceMeters: number } | null {
  if (stations.length === 0) return null;
  const q = (query ?? "").trim().toLowerCase();
  const scored = stations.map((station) => {
    const dist = haversineMeters(lat, lng, station.lat, station.lng);
    const hay = [station.name_en, station.name_bn, ...station.aliases].join(" ").toLowerCase();
    const matchBonus = q && hay.includes(q) ? 1 : 0;
    return { station, distanceMeters: dist, matchBonus };
  });
  scored.sort((a, b) => b.matchBonus - a.matchBonus || a.distanceMeters - b.distanceMeters);
  return { station: scored[0].station, distanceMeters: scored[0].distanceMeters };
}

export function formatSlaChronometer(
  triggeredAtIso: string,
  nowMs: number = Date.now(),
  targetSeconds: number = 300
): { formatted: string; elapsedSeconds: number; tier: "normal" | "warning" | "breach" } {
  const startMs = new Date(triggeredAtIso).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const tier =
    elapsedSeconds >= targetSeconds * 2
      ? "breach"
      : elapsedSeconds >= targetSeconds
      ? "warning"
      : "normal";
  return { formatted, elapsedSeconds, tier };
}

export function maskReportForRole(
  report: CrimeReport,
  viewerRole: UserRole,
  viewerId: string
): CrimeReport {
  const isStaff = viewerRole === "police" || viewerRole === "admin";
  const isOwner = report.reporter_id === viewerId;
  const hideName = report.is_anonymous_public && !isStaff && !isOwner;
  return {
    ...report,
    reporter_id: isStaff || isOwner ? report.reporter_id : null,
    reporter_display_name: hideName ? "Anonymous Citizen" : report.reporter_display_name,
  };
}

export function filterAndSortFalseReports(reports: CrimeReport[]): CrimeReport[] {
  return reports
    .filter(
      (r) =>
        r.flag_status !== "cleared" &&
        r.flag_status !== "confirmed_false" &&
        (r.flag_status === "flagged" || r.suspicion_score >= 50)
    )
    .slice()
    .sort((a, b) => b.suspicion_score - a.suspicion_score);
}

export function computeAreaSafetyScores(reports: CrimeReport[]): AreaSafetyScore[] {
  const grouped = new Map<string, CrimeReport[]>();
  for (const report of reports) {
    if (report.status === "rejected" || report.flag_status === "confirmed_false" || report.flag_status === "flagged") {
      continue;
    }
    const list = grouped.get(report.area_name) ?? [];
    list.push(report);
    grouped.set(report.area_name, list);
  }

  const out: AreaSafetyScore[] = [];
  for (const [area, items] of grouped.entries()) {
    const freq = Math.round(Math.max(10, 100 - Math.min(items.length, 15) * 6));
    const resolvedCount = items.filter((i) => i.status === "resolved").length;
    const pendingCount = items.length - resolvedCount;
    const resRate = Math.round((resolvedCount / items.length) * 100);
    const nightHits = items.filter((i) => {
      const hourBdt = (new Date(i.occurred_at).getUTCHours() + 6) % 24;
      return hourBdt >= 20 || hourBdt < 5;
    }).length;
    const tod = Math.round(Math.max(15, 100 - (nightHits / items.length) * 70));
    const score = Math.max(0, Math.min(100, Math.round(freq * 0.4 + resRate * 0.35 + tod * 0.25)));
    const level: AreaSafetyScore["level"] =
      score >= 75 ? "Safe" : score >= 50 ? "Moderate" : score >= 30 ? "Caution" : "High Risk";

    const catCounts = new Map<string, number>();
    let latSum = 0;
    let lngSum = 0;
    for (const item of items) {
      catCounts.set(item.category, (catCounts.get(item.category) ?? 0) + 1);
      latSum += item.lat;
      lngSum += item.lng;
    }
    const dominantCategory =
      Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";

    out.push({
      area,
      score,
      level,
      reportCount: items.length,
      resolvedCount,
      pendingCount,
      nightCount: nightHits,
      dominantCategory,
      lat: latSum / items.length,
      lng: lngSum / items.length,
      factors: {
        crimeFrequency: freq,
        resolutionRate: resRate,
        timeOfDay: tod,
      },
    });
  }
  return out.sort((a, b) => a.score - b.score);
}

export function computeFalseReportBreakdown(report: CrimeReport): FalseReportBreakdown {
  const base = Math.max(0, Math.min(100, report.suspicion_score));
  const reasonText = report.suspicion_reasons.join(" ").toLowerCase();
  const hasPromo = /http|bit\.ly|promo|test|spam/i.test(`${report.title} ${report.description} ${reasonText}`);
  const hasDup = /duplicate|same incident|copy/i.test(`${report.title} ${report.description} ${reasonText}`);
  const hasRapid = /rapid|submission|burst/i.test(reasonText);
  const shortDetail = report.description.trim().length < 55 || /short|generic/i.test(reasonText);

  const clamp = (v: number) => Math.max(5, Math.min(98, Math.round(v)));
  const userCredibility = clamp(hasPromo ? base * 0.85 : base * 0.62);
  const duplicatePattern = clamp(hasDup ? Math.max(base, 82) : base * 0.48);
  const rapidSubmission = clamp(hasRapid ? Math.max(base * 0.9, 74) : base * 0.42);
  const detailConsistency = clamp(shortDetail ? Math.max(base * 0.88, 72) : base * 0.55);
  const suspiciousContent = clamp(hasPromo ? Math.max(base + 6, 88) : base * 0.45);

  const riskLevel: FalseReportBreakdown["riskLevel"] =
    base >= 80 ? "Critical" : base >= 60 ? "High" : base >= 40 ? "Medium" : "Low";

  return {
    riskLevel,
    userCredibility,
    duplicatePattern,
    rapidSubmission,
    detailConsistency,
    suspiciousContent,
  };
}

function getBdtTimeOfDay(iso: string): string {
  const hourBdt = (new Date(iso).getUTCHours() + 6) % 24;
  if (hourBdt >= 6 && hourBdt < 12) return "Morning";
  if (hourBdt >= 12 && hourBdt < 18) return "Afternoon";
  if (hourBdt >= 18 && hourBdt < 21) return "Evening";
  return "Night";
}

export function generatePredictiveAlerts(reports: CrimeReport[]): PredictiveAlert[] {
  const valid = reports.filter(
    (r) => r.status !== "rejected" && r.flag_status !== "confirmed_false" && r.flag_status !== "flagged"
  );
  if (valid.length === 0) return [];

  const alerts: PredictiveAlert[] = [];
  const byAreaTime = new Map<string, CrimeReport[]>();
  const byCategory = new Map<string, CrimeReport[]>();

  for (const r of valid) {
    const tod = getBdtTimeOfDay(r.occurred_at);
    const key = `${r.area_name}|${tod}`;
    const list = byAreaTime.get(key) ?? [];
    list.push(r);
    byAreaTime.set(key, list);

    const catList = byCategory.get(r.category) ?? [];
    catList.push(r);
    byCategory.set(r.category, catList);
  }

  for (const [key, group] of byAreaTime.entries()) {
    const [area, timeOfDay] = key.split("|");
    const highSev = group.filter((r) => r.severity === "high" || r.severity === "critical").length;
    if (group.length >= 2 || highSev >= 1) {
      const top = group[0];
      const sevScore = Math.min(10, Math.max(5, group.length * 2 + highSev * 2));
      alerts.push({
        id: `spike-${area.toLowerCase()}-${timeOfDay.toLowerCase()}`,
        type: group.length >= 2 ? "SPIKE" : "HOTSPOT",
        severity: sevScore,
        severityLabel: sevScore >= 8 ? "Critical" : sevScore >= 6 ? "High" : "Medium",
        area,
        crimeType: formatStatusLabel(top.category),
        timeOfDay,
        message: `${formatStatusLabel(top.category)} ${group.length >= 2 ? "spike" : "hotspot"} in ${area} (${timeOfDay})`,
        description: `${group.length} active/verified report(s) centered near ${top.address_text ?? area} during ${timeOfDay.toLowerCase()} hours.`,
        count: group.length,
        trend: highSev > 0 ? "increasing" : "stable",
        lat: top.lat,
        lng: top.lng,
      });
    }
  }

  for (const [cat, group] of byCategory.entries()) {
    const areas = Array.from(new Set(group.map((g) => g.area_name)));
    const first = group[0];
    const sevScore = Math.min(9, Math.max(4, group.length + areas.length + 2));
    alerts.push({
      id: `trend-${cat}`,
      type: "TREND",
      severity: sevScore,
      severityLabel: sevScore >= 8 ? "Critical" : sevScore >= 6 ? "High" : sevScore >= 4 ? "Medium" : "Low",
      area: areas.join(", "),
      crimeType: formatStatusLabel(cat),
      timeOfDay: "All hours",
      message: `${formatStatusLabel(cat)} pattern across ${areas.length} Dhaka division(s)`,
      description: `${group.length} report(s) logged across ${areas.join(", ")} with ${group.reduce((s, r) => s + r.corroboration_count, 0)} witness corroborations.`,
      count: group.length,
      trend: group.some((r) => r.severity === "high" || r.severity === "critical") ? "increasing" : "stable",
      lat: first.lat,
      lng: first.lng,
    });
  }

  return alerts.sort((a, b) => b.severity - a.severity || b.count - a.count);
}

const TILE_SIZE = 256;

export function latLngToWorldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function worldPxToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function latLngToTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = latLngToWorldPx(lat, lng, zoom);
  return {
    x: Math.floor(world.x / TILE_SIZE),
    y: Math.floor(world.y / TILE_SIZE),
  };
}

export function projectLatLngToViewport(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number } {
  const pt = latLngToWorldPx(lat, lng, zoom);
  const center = latLngToWorldPx(centerLat, centerLng, zoom);
  return {
    x: width / 2 + (pt.x - center.x),
    y: height / 2 + (pt.y - center.y),
  };
}

export const DEMO_BASE_TIMESTAMP_MS = Date.UTC(2026, 10, 23, 12, 0, 0);

export const AREA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  dhanmondi: { lat: 23.7465, lng: 90.376 },
  "mirpur-10": { lat: 23.8069, lng: 90.3688 },
  mirpur: { lat: 23.8069, lng: 90.3688 },
  shahbagh: { lat: 23.7385, lng: 90.3954 },
  mohammadpur: { lat: 23.7654, lng: 90.3587 },
  uttara: { lat: 23.8759, lng: 90.4005 },
  gulshan: { lat: 23.7925, lng: 90.4152 },
  motijheel: { lat: 23.733, lng: 90.4173 },
  chattogram: { lat: 22.3384, lng: 91.8339 },
};

export function resolveAreaCoordinates(areaName: string): { lat: number; lng: number } {
  const key = areaName.trim().toLowerCase();
  if (AREA_COORDINATES[key]) return AREA_COORDINATES[key];
  const matched = Object.entries(AREA_COORDINATES).find(([k]) => key.includes(k));
  return matched ? matched[1] : AREA_COORDINATES.dhanmondi;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  claimed: "Claimed",
  responding: "Responding",
  resolved: "Resolved",
  cancelled: "Cancelled",
  false_alarm: "False alarm",
  pending: "Pending",
  verified: "Verified",
  investigating: "Investigating",
  rejected: "Rejected",
  none: "None",
  flagged: "Flagged",
  cleared: "Cleared",
  confirmed_false: "Confirmed false",
  wanted: "Wanted",
  in_custody: "In custody",
  archived: "Archived",
  panic_button: "Panic SOS",
  safe_walk_timeout: "Safe Walk timeout",
  distress_signals: "Distress signals",
  reports: "Crime reports",
  snatching: "Snatching",
  harassment: "Harassment",
  theft: "Theft",
  fraud: "Fraud",
  vandalism: "Vandalism",
  assault: "Assault",
  suspicious_activity: "Suspicious activity",
  traffic_hazard: "Traffic hazard",
  other: "Other",
};

export function formatStatusLabel(raw: string): string {
  const mapped = STATUS_LABELS[raw];
  if (mapped) return mapped;
  const cleaned = raw.replace(/_/g, " ").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

export function createInitialDemoDataset(nowMs: number = DEMO_BASE_TIMESTAMP_MS): DaakDataset {
  const isoAgo = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();
  const isoAhead = (minutes: number) => new Date(nowMs + minutes * 60_000).toISOString();

  return {
    profiles: {
      citizen: {
        id: "11111111-1111-4111-8111-111111111101",
        email: "demo.citizen@daak.bd",
        full_name: "Nadia Rahman",
        role: "citizen",
        phone: "+8801711000101",
        credibility_score: 88,
      },
      police: {
        id: "11111111-1111-4111-8111-111111111102",
        email: "demo.police@daak.bd",
        full_name: "SI Tariqul Islam",
        role: "police",
        phone: "+8801711000102",
        credibility_score: 98,
        station_name: "Dhanmondi Model Police Station",
      },
      admin: {
        id: "11111111-1111-4111-8111-111111111103",
        email: "demo.admin@daak.bd",
        full_name: "Farhana Karim (Admin)",
        role: "admin",
        phone: "+8801711000103",
        credibility_score: 100,
      },
    },
    policeStations: [
      { id: "22222222-2222-4222-8222-222222222201", name_en: "Dhanmondi Model Police Station", name_bn: "ধানমন্ডি মডেল থানা", aliases: ["dhanmondi", "kalabagan", "science lab", "ধানমন্ডি"], district: "Dhaka", phone: "+8801320039660", lat: 23.7461, lng: 90.3742 },
      { id: "22222222-2222-4222-8222-222222222202", name_en: "Shahbagh Police Station", name_bn: "শাহবাগ থানা", aliases: ["shahbagh", "tsc", "dhaka university", "শাহবাগ"], district: "Dhaka", phone: "+8801320039520", lat: 23.7385, lng: 90.3954 },
      { id: "22222222-2222-4222-8222-222222222203", name_en: "Mohammadpur Police Station", name_bn: "মোহাম্মদপুর থানা", aliases: ["mohammadpur", "adabor", "lalmatia", "মোহাম্মদপুর"], district: "Dhaka", phone: "+8801320040800", lat: 23.7654, lng: 90.3587 },
      { id: "22222222-2222-4222-8222-222222222204", name_en: "Mirpur Model Police Station", name_bn: "মিরপুর মডেল থানা", aliases: ["mirpur", "mirpur-10", "kazipara", "মিরপুর"], district: "Dhaka", phone: "+8801320041200", lat: 23.8069, lng: 90.3688 },
      { id: "22222222-2222-4222-8222-222222222205", name_en: "Gulshan Police Station", name_bn: "গুলশান থানা", aliases: ["gulshan", "banani", "baridhara", "গুলশান"], district: "Dhaka", phone: "+8801320041000", lat: 23.7925, lng: 90.4152 },
      { id: "22222222-2222-4222-8222-222222222206", name_en: "Uttara East Police Station", name_bn: "উত্তরা পূর্ব থানা", aliases: ["uttara", "azampur", "উত্তরা"], district: "Dhaka", phone: "+8801320041900", lat: 23.8759, lng: 90.4005 },
      { id: "22222222-2222-4222-8222-222222222207", name_en: "Motijheel Police Station", name_bn: "মতিঝিল থানা", aliases: ["motijheel", "paltan", "মতিঝিল"], district: "Dhaka", phone: "+8801320039740", lat: 23.7330, lng: 90.4173 },
      { id: "22222222-2222-4222-8222-222222222208", name_en: "Kotwali Police Station, Chattogram", name_bn: "কোতোয়ালী থানা, চট্টগ্রাম", aliases: ["chattogram", "kotwali", "চট্টগ্রাম"], district: "Chattogram", phone: "+8801320053100", lat: 22.3384, lng: 91.8339 },
    ],
    reports: [
      { id: "33333333-3333-4333-8333-333333333301", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: true, category: "snatching", severity: "high", title: "Phone snatching near Kalabagan footover bridge", description: "Two riders on a dark motorcycle snatched a commuter phone near the east stair exit and sped toward Science Lab.", area_name: "Dhanmondi", address_text: "Kalabagan Bus Stand, Mirpur Road", lat: 23.7495, lng: 90.3806, occurred_at: isoAgo(35), created_at: isoAgo(35), status: "verified", corroboration_count: 2, suspicion_score: 8, flag_status: "none", suspicion_reasons: [] },
      { id: "33333333-3333-4333-8333-333333333302", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "traffic_hazard", severity: "medium", title: "Streetlights out along Dhanmondi Road 27 north lane", description: "Three consecutive lamp posts are dark near the lake turnoff creating blind spots for pedestrians at night.", area_name: "Dhanmondi", address_text: "Road 27, Dhanmondi", lat: 23.7512, lng: 90.3735, occurred_at: isoAgo(180), created_at: isoAgo(180), status: "resolved", corroboration_count: 1, suspicion_score: 5, flag_status: "none", suspicion_reasons: [], moderation_note: "DNCC electrical crew dispatched" },
      { id: "33333333-3333-4333-8333-333333333303", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: true, category: "harassment", severity: "high", title: "Repeated evening harassment outside Mirpur-10 metro exit", description: "Group blocking the footpath near Gate B harassing students returning from coaching after 20:00.", area_name: "Mirpur-10", address_text: "Metro Rail Station Gate B, Mirpur-10", lat: 23.8072, lng: 90.3690, occurred_at: isoAgo(120), created_at: isoAgo(120), status: "investigating", corroboration_count: 3, suspicion_score: 10, flag_status: "none", suspicion_reasons: [], moderation_note: "Evening patrol assigned" },
      { id: "33333333-3333-4333-8333-333333333304", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "theft", severity: "medium", title: "Locked bicycle stolen outside TSC library rack", description: "Cable lock cut between 18:30 and 19:15 near the Dhaka University TSC south gate.", area_name: "Shahbagh", address_text: "TSC South Gate, Dhaka University", lat: 23.7329, lng: 90.3958, occurred_at: isoAgo(1440), created_at: isoAgo(1440), status: "resolved", corroboration_count: 0, suspicion_score: 12, flag_status: "none", suspicion_reasons: [] },
      { id: "33333333-3333-4333-8333-333333333305", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "fraud", severity: "medium", title: "Fake bKash agent kiosk targeting commuters at Uttara Azampur", description: "Unlicensed mobile-money booth attempting PIN social engineering near Azampur footover.", area_name: "Uttara", address_text: "Azampur Bus Stop, Uttara Sector 7", lat: 23.8686, lng: 90.4008, occurred_at: isoAgo(360), created_at: isoAgo(360), status: "verified", corroboration_count: 1, suspicion_score: 14, flag_status: "none", suspicion_reasons: [] },
      { id: "33333333-3333-4333-8333-333333333306", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "suspicious_activity", severity: "low", title: "Unattended bag reported near Gulshan-2 circle", description: "Security patrol inspected and confirmed lost luggage returned to owner.", area_name: "Gulshan", address_text: "Gulshan-2 Circle South", lat: 23.7945, lng: 90.4148, occurred_at: isoAgo(2880), created_at: isoAgo(2880), status: "resolved", corroboration_count: 0, suspicion_score: 6, flag_status: "none", suspicion_reasons: [] },
      { id: "33333333-3333-4333-8333-333333333307", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "vandalism", severity: "low", title: "Test spam report click link http://bit.ly/fake-promo", description: "test test urgent free reward click link now", area_name: "Mohammadpur", address_text: "Town Hall Market", lat: 23.7638, lng: 90.3636, occurred_at: isoAgo(50), created_at: isoAgo(50), status: "pending", corroboration_count: 0, suspicion_score: 84, flag_status: "flagged", suspicion_reasons: ["Suspicious promotional link or test keyword detected", "Short generic description"] },
      { id: "33333333-3333-4333-8333-333333333308", reporter_id: "11111111-1111-4111-8111-111111111101", reporter_display_name: "Nadia Rahman", is_anonymous_public: false, category: "snatching", severity: "high", title: "Duplicate unverified snatching claim near Town Hall", description: "Same incident copy pasted multiple times without clear landmark details.", area_name: "Mohammadpur", address_text: "Town Hall Corner", lat: 23.7640, lng: 90.3638, occurred_at: isoAgo(42), created_at: isoAgo(42), status: "pending", corroboration_count: 0, suspicion_score: 72, flag_status: "flagged", suspicion_reasons: ["Near-duplicate spatial and category report within 60 minutes", "Rapid submission pattern"] },
    ],
    reportTips: [
      {
        id: "tip-1",
        report_id: "33333333-3333-4333-8333-333333333301",
        author_display_name: "Anonymous Citizen",
        is_anonymous_public: true,
        body: "Saw the black pulsar motorcycle turn east into Kalabagan 1st Lane around 17:20; CCTV camera on pharmacy corner.",
        votes: 4,
        created_at: isoAgo(24),
      },
      {
        id: "tip-2",
        report_id: "33333333-3333-4333-8333-333333333303",
        author_display_name: "Commuter Witness",
        is_anonymous_public: false,
        body: "Traffic police box is 60m north of Gate B; best lit footpath is on the west side.",
        votes: 3,
        created_at: isoAgo(85),
      },
    ],
    emergencyContacts: [
      { id: "ec-1", name: "Tasnim Rahman (Sister)", phone: "+8801712-440192", relation: "Family", notify_on_sos: true, notify_on_safe_walk: true },
      { id: "ec-2", name: "Rafiqul Islam (Father)", phone: "+8801819-330214", relation: "Parent", notify_on_sos: true, notify_on_safe_walk: false },
      { id: "ec-3", name: "Hall Provost Desk (DU)", phone: "+8801755-902110", relation: "Campus", notify_on_sos: true, notify_on_safe_walk: true },
    ],
    distressSignals: [
      { id: "66666666-6666-4666-8666-666666666601", user_id: "11111111-1111-4111-8111-111111111101", citizen_name: "Nadia Rahman", trigger_source: "panic_button", lat: 23.8065, lng: 90.3692, area_name: "Mirpur-10", battery_level: 34, note: "Followed near metro pillar 254, need assistance.", status: "active", claimed_by: null, assigned_unit: null, triggered_at: isoAgo(2.35), sla_target_seconds: 300, dispatch_timeline: [{ at: isoAgo(2.35), status: "active", note: "Panic SOS triggered (Demo Simulated 999 Relay)" }] },
      { id: "66666666-6666-4666-8666-666666666602", user_id: "11111111-1111-4111-8111-111111111101", citizen_name: "Nadia Rahman", trigger_source: "panic_button", lat: 23.7448, lng: 90.3755, area_name: "Dhanmondi", battery_level: 61, note: "Altercation outside shopping complex gate.", status: "claimed", claimed_by: "11111111-1111-4111-8111-111111111102", assigned_unit: "Dhanmondi Patrol-04", triggered_at: isoAgo(6.25), sla_target_seconds: 300, dispatch_timeline: [{ at: isoAgo(6.25), status: "active", note: "Panic SOS triggered" }, { at: isoAgo(4), status: "claimed", note: "Claimed by SI Tariqul Islam — Dhanmondi Patrol-04" }] },
      { id: "66666666-6666-4666-8666-666666666603", user_id: "11111111-1111-4111-8111-111111111101", citizen_name: "Nadia Rahman", trigger_source: "safe_walk_timeout", lat: 23.8721, lng: 90.4012, area_name: "Uttara Sector 7", battery_level: 19, note: "Safe Walk check-in missed past ETA.", status: "responding", claimed_by: "11111111-1111-4111-8111-111111111102", assigned_unit: "Uttara Mobile-02", triggered_at: isoAgo(11.15), sla_target_seconds: 300, dispatch_timeline: [{ at: isoAgo(11.15), status: "active", note: "Auto-escalated from Safe Walk timer" }, { at: isoAgo(8), status: "responding", note: "Uttara Mobile-02 en route" }] },
    ],
    safeWalks: [
      { id: "77777777-7777-4777-8777-777777777701", user_id: "11111111-1111-4111-8111-111111111101", destination_name: "TSC, Dhaka University", lat: 23.7420, lng: 90.3821, expected_arrival_at: isoAhead(18), status: "active", escalated_sos_id: null },
    ],
    shiftHandovers: [
      { id: "88888888-8888-4888-8888-888888888801", officer_name: "SI Tariqul Islam", shift_label: "Day -> Evening Shift (14:00–22:00)", summary: "Increased motorcycle snatching reports around Kalabagan footover and Mirpur-10 Gate B. Keep Patrol-04 near Road 27.", priority_areas: ["Dhanmondi", "Mirpur-10", "Uttara"], created_at: isoAgo(60) },
    ],
    criminals: [
      { id: "99999999-9999-4999-8999-999999999901", full_name: "Kamrul Hasan (Synthetic Demo)", aliases: ["Kala Kamrul"], crime_categories: ["snatching", "theft"], risk_level: "high", last_known_area: "Kalabagan / Dhanmondi", status: "wanted", details: "Synthetic demo watchlist entry linked to motorcycle snatching cluster near Mirpur Road." },
      { id: "99999999-9999-4999-8999-999999999902", full_name: "Sajib Mia (Synthetic Demo)", aliases: ["Sajib"], crime_categories: ["fraud"], risk_level: "medium", last_known_area: "Uttara Azampur", status: "wanted", details: "Synthetic demo entry for mobile financial service impersonation." },
      { id: "99999999-9999-4999-8999-999999999903", full_name: "Rashedul Alam (Synthetic Demo)", aliases: ["Rashed"], crime_categories: ["assault", "harassment"], risk_level: "critical", last_known_area: "Mirpur-10", status: "in_custody", details: "Synthetic demo entry — apprehended during Mirpur-10 patrol sweep." },
    ],
    activityLogs: [
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01", actor_role: "police", action: "sos.claimed", target_type: "distress_signals", summary: "Claimed Dhanmondi SOS -> Dhanmondi Patrol-04", created_at: isoAgo(4) },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02", actor_role: "admin", action: "report.flagged", target_type: "reports", summary: "Auto-flagged Mohammadpur spam report (score 84)", created_at: isoAgo(50) },
    ],
  };
}
