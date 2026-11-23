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
}

export interface DaakDataset {
  profiles: Record<UserRole, DemoProfile>;
  policeStations: PoliceStation[];
  reports: CrimeReport[];
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
    .filter((r) => r.flag_status === "flagged" || r.suspicion_score >= 50)
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
    const freq = Math.max(10, 100 - Math.min(items.length, 15) * 6);
    const resolvedCount = items.filter((i) => i.status === "resolved").length;
    const resRate = (resolvedCount / items.length) * 100;
    const nightHits = items.filter((i) => {
      const hourBdt = (new Date(i.occurred_at).getUTCHours() + 6) % 24;
      return hourBdt >= 20 || hourBdt < 5;
    }).length;
    const tod = Math.max(15, 100 - (nightHits / items.length) * 70);
    const score = Math.max(0, Math.min(100, Math.round(freq * 0.4 + resRate * 0.35 + tod * 0.25)));
    const level: AreaSafetyScore["level"] =
      score >= 75 ? "Safe" : score >= 50 ? "Moderate" : score >= 30 ? "Caution" : "High Risk";
    out.push({ area, score, level, reportCount: items.length, resolvedCount });
  }
  return out.sort((a, b) => a.score - b.score);
}

export function createInitialDemoDataset(nowMs: number = Date.now()): DaakDataset {
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
