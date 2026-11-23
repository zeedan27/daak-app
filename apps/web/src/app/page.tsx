"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CitizenPreviewDeck from "@/components/CitizenPreviewDeck";
import SpatialMapDeck from "@/components/SpatialMapDeck";
import {
  apiAskDaakAi,
  apiCompleteSafeWalk,
  apiCorroborateReport,
  apiCreateCriminal,
  apiCreateHandover,
  apiCreateReport,
  apiDemoLogin,
  apiDispatchSos,
  apiEscalateSafeWalk,
  apiFetchDataset,
  apiModerateReport,
  apiTriggerSos,
  apiUpdateCriminalStatus,
  isLiveApiConfigured,
} from "@/lib/apiClient";
import {
  computeAreaSafetyScores,
  computeFalseReportBreakdown,
  createInitialDemoDataset,
  DEMO_BASE_TIMESTAMP_MS,
  filterAndSortFalseReports,
  findNearestStation,
  formatSlaChronometer,
  formatStatusLabel,
  generatePredictiveAlerts,
  maskReportForRole,
  resolveAreaCoordinates,
  type CrimeReport,
  type CriminalRecord,
  type DaakDataset,
  type DistressSignal,
  type EmergencyContact,
  type UserRole,
} from "@/lib/opsLogic";

type NavSection =
  | "sos"
  | "reports"
  | "heatmap"
  | "alerts"
  | "handovers"
  | "false_reports"
  | "criminals"
  | "analytics"
  | "citizen_preview";

type UiStateMode = "live" | "loading" | "empty" | "partial_error" | "fatal_error";

function NavIcon({ name }: { name: NavSection }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "sos":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "reports":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    case "heatmap":
      return (
        <svg {...props}>
          <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
      );
    case "alerts":
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "handovers":
      return (
        <svg {...props}>
          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
      );
    case "false_reports":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "criminals":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      );
    case "citizen_preview":
      return (
        <svg {...props}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      );
  }
}

export default function DaakCommandPortal() {
  const [dataset, setDataset] = useState<DaakDataset>(() =>
    createInitialDemoDataset(DEMO_BASE_TIMESTAMP_MS)
  );
  const [role, setRole] = useState<UserRole>("police");
  const [section, setSection] = useState<NavSection>("sos");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [uiState, setUiState] = useState<UiStateMode>("live");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(DEMO_BASE_TIMESTAMP_MS);
  const nowMsRef = useRef<number>(DEMO_BASE_TIMESTAMP_MS);
  const roleTokensRef = useRef<Partial<Record<UserRole, string>>>({});
  const syncSeqRef = useRef<number>(0);

  const [selectedSosId, setSelectedSosId] = useState<string | null>(
    "66666666-6666-4666-8666-666666666601"
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [mapFocusPoint, setMapFocusPoint] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    label?: string;
  } | null>(null);

  // Reports filters & tips
  const [reportSearch, setReportSearch] = useState<string>("");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("all");
  const [newTipText, setNewTipText] = useState<string>("");
  const [newTipAnon, setNewTipAnon] = useState<boolean>(true);

  // Predictive alerts filters
  const [alertTypeFilter, setAlertTypeFilter] = useState<"ALL" | "SPIKE" | "HOTSPOT" | "TREND">("ALL");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Area safety score selection
  const [selectedSafetyArea, setSelectedSafetyArea] = useState<string>("Dhanmondi");

  // False-report triage notes & filters
  const [falseRiskFilter, setFalseRiskFilter] = useState<"ALL" | "Critical" | "High" | "Medium" | "Low">("ALL");
  const [triageNotes, setTriageNotes] = useState<Record<string, string>>({});

  // Watchlist search & form
  const [criminalSearch, setCriminalSearch] = useState<string>("");
  const [newCrimName, setNewCrimName] = useState<string>("");
  const [newCrimArea, setNewCrimArea] = useState<string>("Dhanmondi");
  const [newCrimRisk, setNewCrimRisk] = useState<CriminalRecord["risk_level"]>("high");

  // Dispatch & Handover
  const [unitDraft, setUnitDraft] = useState<string>("Mirpur Patrol-09");
  const [handoverShift, setHandoverShift] = useState<string>("Night Shift (22:00–06:00)");
  const [handoverSummary, setHandoverSummary] = useState<string>("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const ensureToken = useCallback(async (targetRole: UserRole): Promise<string | null> => {
    if (!isLiveApiConfigured()) return null;
    const cached = roleTokensRef.current[targetRole];
    if (cached) return cached;
    const { access_token } = await apiDemoLogin(targetRole);
    roleTokensRef.current[targetRole] = access_token;
    return access_token;
  }, []);

  const syncFromLiveApi = useCallback(
    async (targetRole: UserRole) => {
      if (!isLiveApiConfigured()) return;
      const seq = ++syncSeqRef.current;
      try {
        const token = await ensureToken(targetRole);
        if (!token || seq !== syncSeqRef.current) return;
        const partial = await apiFetchDataset(token, targetRole);
        if (seq !== syncSeqRef.current) return;
        setNowMs(Date.now());
        setDataset((prev) => ({
          ...prev,
          ...partial,
        }));
        setUiState((prev) => (prev === "partial_error" ? "live" : prev));
      } catch {
        if (seq !== syncSeqRef.current) return;
        setUiState("partial_error");
        setStatusNotice("Live API unavailable — using local Dhaka demo snapshot");
      }
    },
    [ensureToken]
  );

  useEffect(() => {
    void syncFromLiveApi("police");
  }, [syncFromLiveApi]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    nowMsRef.current = nowMs;
  }, [nowMs]);

  useEffect(() => {
    if (uiState !== "live" && uiState !== "partial_error") return;
    const tick = setInterval(() => {
      setNowMs((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(tick);
  }, [uiState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSosId(null);
        setSelectedReportId(null);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentProfile = dataset.profiles[role];
  const selectedSos = dataset.distressSignals.find((s) => s.id === selectedSosId) ?? null;
  const selectedReport = dataset.reports.find((r) => r.id === selectedReportId) ?? null;

  const switchDemoRole = (nextRole: UserRole) => {
    setRole(nextRole);
    if (nextRole === "citizen") {
      setSection("citizen_preview");
    } else if (nextRole === "admin" && section === "citizen_preview") {
      setSection("false_reports");
    } else if (nextRole === "police" && (section === "false_reports" || section === "criminals")) {
      setSection("sos");
    }
    setStatusNotice(`Switched demo session to ${dataset.profiles[nextRole].full_name} (${nextRole})`);
    void syncFromLiveApi(nextRole);
  };

  const handleDispatchSos = useCallback(
    (sosId: string, nextStatus: DistressSignal["status"], unitName?: string) => {
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const shouldAssignUnit = nextStatus === "claimed" || nextStatus === "responding";
      setDataset((prev) => ({
        ...prev,
        distressSignals: prev.distressSignals.map((sig) =>
          sig.id !== sosId
            ? sig
            : {
                ...sig,
                status: nextStatus,
                claimed_by: sig.claimed_by ?? currentProfile.id,
                assigned_unit:
                  unitName ?? sig.assigned_unit ?? (shouldAssignUnit ? unitDraft : null),
                dispatch_timeline: [
                  ...sig.dispatch_timeline,
                  {
                    at: nowIso,
                    status: nextStatus,
                    note: `${currentProfile.full_name} set status to ${formatStatusLabel(nextStatus)}`,
                  },
                ],
              }
        ),
        activityLogs: [
          {
            id: `log-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            actor_role: role,
            action: `sos.${nextStatus}`,
            target_type: "distress_signals",
            summary: `${currentProfile.full_name} updated SOS to ${formatStatusLabel(nextStatus)}`,
            created_at: nowIso,
          },
          ...prev.activityLogs,
        ],
      }));
      setStatusNotice(`Alert updated to ${formatStatusLabel(nextStatus)}`);
      if (
        isLiveApiConfigured() &&
        (nextStatus === "claimed" ||
          nextStatus === "responding" ||
          nextStatus === "resolved" ||
          nextStatus === "false_alarm")
      ) {
        void ensureToken(role)
          .then((token) =>
            token
              ? apiDispatchSos(token, sosId, {
                  status: nextStatus,
                  assigned_unit: unitName ?? (shouldAssignUnit ? unitDraft : undefined),
                })
              : null
          )
          .then((updated) => {
            if (updated) {
              setDataset((prev) => ({
                ...prev,
                distressSignals: prev.distressSignals.map((s) => (s.id === updated.id ? updated : s)),
              }));
            }
          })
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [currentProfile.full_name, currentProfile.id, ensureToken, role, unitDraft]
  );

  const handleModerateReport = useCallback(
    (
      reportId: string,
      updates: Partial<Pick<CrimeReport, "status" | "flag_status" | "moderation_note">>
    ) => {
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const targetState = updates.status ?? updates.flag_status ?? "updated";
      const nextStatus = updates.flag_status === "confirmed_false" ? "rejected" : updates.status;
      setDataset((prev) => ({
        ...prev,
        reports: prev.reports.map((rep) =>
          rep.id === reportId
            ? {
                ...rep,
                ...updates,
                ...(nextStatus ? { status: nextStatus } : {}),
              }
            : rep
        ),
        activityLogs: [
          {
            id: `log-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            actor_role: role,
            action: "report.moderated",
            target_type: "reports",
            summary: `Report moderated (${formatStatusLabel(targetState)})`,
            created_at: nowIso,
          },
          ...prev.activityLogs,
        ],
      }));
      setStatusNotice("Report moderation saved");
      if (isLiveApiConfigured()) {
        void ensureToken(role)
          .then((token) => (token ? apiModerateReport(token, reportId, updates) : null))
          .then((updated) => {
            if (updated) {
              setDataset((prev) => ({
                ...prev,
                reports: prev.reports.map((r) => (r.id === updated.id ? updated : r)),
              }));
            }
          })
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [ensureToken, role]
  );

  const handleTriggerSosFromCitizen = useCallback(
    (lat: number, lng: number, area: string, note: string) => {
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const tempId = `sos-${ts}`;
      const created: DistressSignal = {
        id: tempId,
        user_id: dataset.profiles.citizen.id,
        citizen_name: dataset.profiles.citizen.full_name,
        trigger_source: "panic_button",
        lat,
        lng,
        area_name: area,
        battery_level: 72,
        note,
        status: "active",
        claimed_by: null,
        assigned_unit: null,
        triggered_at: nowIso,
        sla_target_seconds: 300,
        dispatch_timeline: [{ at: nowIso, status: "active", note }],
      };
      setDataset((prev) => ({
        ...prev,
        distressSignals: [created, ...prev.distressSignals],
        activityLogs: [
          {
            id: `log-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            actor_role: "citizen",
            action: "sos.triggered",
            target_type: "distress_signals",
            summary: `New SOS triggered in ${area}`,
            created_at: nowIso,
          },
          ...prev.activityLogs,
        ],
      }));
      setSelectedSosId(tempId);
      setSelectedReportId(null);

      if (isLiveApiConfigured()) {
        void ensureToken("citizen")
          .then((token) =>
            token ? apiTriggerSos(token, { lat, lng, area_name: area, note, battery_level: 72 }) : null
          )
          .then((saved) => {
            if (saved) {
              setDataset((prev) => ({
                ...prev,
                distressSignals: prev.distressSignals.map((s) => (s.id === tempId ? saved : s)),
              }));
              setSelectedSosId(saved.id);
            }
          })
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [dataset.profiles.citizen.full_name, dataset.profiles.citizen.id, ensureToken]
  );

  const handleCitizenSubmitReport = useCallback(
    (input: {
      category: CrimeReport["category"];
      severity: CrimeReport["severity"];
      title: string;
      description: string;
      area_name: string;
      lat?: number;
      lng?: number;
      is_anonymous_public: boolean;
    }) => {
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const fallbackCoords = resolveAreaCoordinates(input.area_name);
      const lat = input.lat ?? fallbackCoords.lat;
      const lng = input.lng ?? fallbackCoords.lng;
      const suspicious = /http|bit\.ly|promo|test test/i.test(`${input.title} ${input.description}`);
      const tempId = `rep-${ts}`;
      const newRep: CrimeReport = {
        id: tempId,
        reporter_id: dataset.profiles.citizen.id,
        reporter_display_name: dataset.profiles.citizen.full_name,
        is_anonymous_public: input.is_anonymous_public,
        category: input.category,
        severity: input.severity,
        title: input.title,
        description: input.description,
        area_name: input.area_name,
        lat,
        lng,
        occurred_at: nowIso,
        created_at: nowIso,
        status: "pending",
        corroboration_count: 0,
        suspicion_score: suspicious ? 76 : 10,
        flag_status: suspicious ? "flagged" : "none",
        suspicion_reasons: suspicious ? ["Suspicious promotional keyword detected"] : [],
      };
      setDataset((prev) => ({
        ...prev,
        reports: [newRep, ...prev.reports],
      }));

      if (isLiveApiConfigured()) {
        void ensureToken("citizen")
          .then((token) =>
            token
              ? apiCreateReport(token, {
                  ...input,
                  lat,
                  lng,
                })
              : null
          )
          .then((saved) => {
            if (saved) {
              setDataset((prev) => ({
                ...prev,
                reports: prev.reports.map((r) => (r.id === tempId ? saved : r)),
              }));
            }
          })
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [dataset.profiles.citizen.full_name, dataset.profiles.citizen.id, ensureToken]
  );

  const handleCorroborate = useCallback(
    (reportId: string) => {
      setDataset((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId ? { ...r, corroboration_count: r.corroboration_count + 1 } : r
        ),
      }));
      setStatusNotice("Corroboration recorded (+1 witness within 1 km)");
      if (isLiveApiConfigured()) {
        void ensureToken("citizen")
          .then((token) => (token ? apiCorroborateReport(token, reportId, 23.7465, 90.376) : null))
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [ensureToken]
  );

  const handleStartWalk = useCallback(
    (destinationName: string, etaMinutes: number) => {
      const ts = nowMsRef.current;
      const coords = resolveAreaCoordinates(destinationName);
      setDataset((prev) => ({
        ...prev,
        safeWalks: [
          {
            id: `walk-${ts}`,
            user_id: prev.profiles.citizen.id,
            destination_name: destinationName,
            lat: coords.lat,
            lng: coords.lng,
            expected_arrival_at: new Date(ts + etaMinutes * 60_000).toISOString(),
            status: "active",
            escalated_sos_id: null,
          },
          ...prev.safeWalks,
        ],
      }));
      setStatusNotice(`Safe Walk started to ${destinationName} (${etaMinutes}m ETA)`);
    },
    []
  );

  const handleExtendWalk = useCallback((walkId: string, minutes: number) => {
    setDataset((prev) => ({
      ...prev,
      safeWalks: prev.safeWalks.map((w) => {
        if (w.id !== walkId) return w;
        const base = new Date(w.expected_arrival_at).getTime();
        return { ...w, expected_arrival_at: new Date(base + minutes * 60_000).toISOString() };
      }),
    }));
    setStatusNotice(`Safe Walk extended by +${minutes}m`);
  }, []);

  const handleEscalateWalk = useCallback(
    (walkId: string) => {
      const walk = dataset.safeWalks.find((w) => w.id === walkId);
      if (!walk) return;
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const tempId = `sos-${ts}`;
      const note = `Safe Walk timeout to ${walk.destination_name}`;
      const created: DistressSignal = {
        id: tempId,
        user_id: dataset.profiles.citizen.id,
        citizen_name: dataset.profiles.citizen.full_name,
        trigger_source: "safe_walk_timeout",
        lat: walk.lat,
        lng: walk.lng,
        area_name: "Dhanmondi",
        battery_level: 72,
        note,
        status: "active",
        claimed_by: null,
        assigned_unit: null,
        triggered_at: nowIso,
        sla_target_seconds: 300,
        dispatch_timeline: [{ at: nowIso, status: "active", note }],
      };
      setDataset((prev) => ({
        ...prev,
        distressSignals: [created, ...prev.distressSignals],
        safeWalks: prev.safeWalks.map((w) =>
          w.id === walkId ? { ...w, status: "escalated", escalated_sos_id: tempId } : w
        ),
        activityLogs: [
          {
            id: `log-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            actor_role: "citizen",
            action: "safe_walk.escalated",
            target_type: "distress_signals",
            summary: `Safe Walk timeout escalated to SOS in Dhanmondi`,
            created_at: nowIso,
          },
          ...prev.activityLogs,
        ],
      }));
      setSelectedSosId(tempId);
      setSelectedReportId(null);
      setStatusNotice("Safe Walk timeout escalated to Police Monitor");

      if (isLiveApiConfigured()) {
        void ensureToken("citizen")
          .then((token) => (token ? apiEscalateSafeWalk(token, walkId) : null))
          .then((res) => {
            if (res) {
              setDataset((prev) => ({
                ...prev,
                distressSignals: prev.distressSignals.map((s) =>
                  s.id === tempId ? res.distress_signal : s
                ),
                safeWalks: prev.safeWalks.map((w) => (w.id === walkId ? res.safe_walk : w)),
              }));
              setSelectedSosId(res.distress_signal.id);
            }
          })
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [dataset.profiles.citizen.full_name, dataset.profiles.citizen.id, dataset.safeWalks, ensureToken]
  );

  const handleCompleteWalk = useCallback(
    (walkId: string) => {
      setDataset((prev) => ({
        ...prev,
        safeWalks: prev.safeWalks.map((w) => (w.id === walkId ? { ...w, status: "completed" } : w)),
      }));
      setStatusNotice("Safe Walk completed safely");
      if (isLiveApiConfigured()) {
        void ensureToken("citizen")
          .then((token) => (token ? apiCompleteSafeWalk(token, walkId) : null))
          .catch(() => {
            setUiState("partial_error");
          });
      }
    },
    [ensureToken]
  );

  const handleUpdateContact = useCallback((contact: EmergencyContact) => {
    setDataset((prev) => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, contact],
    }));
    setStatusNotice(`Added trusted contact ${contact.name}`);
  }, []);

  const handleRemoveContact = useCallback((contactId: string) => {
    setDataset((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((c) => c.id !== contactId),
    }));
  }, []);

  const handleAskAi = useCallback(
    async (prompt: string, lat: number, lng: number): Promise<string | null> => {
      if (!isLiveApiConfigured()) return null;
      try {
        const token = await ensureToken("citizen");
        if (!token) return null;
        const res = await apiAskDaakAi(token, prompt, lat, lng);
        return res.reply;
      } catch {
        return null;
      }
    },
    [ensureToken]
  );

  const handleAddTip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !newTipText.trim()) return;
    const ts = nowMsRef.current;
    setDataset((prev) => ({
      ...prev,
      reportTips: [
        {
          id: `tip-${ts}`,
          report_id: selectedReport.id,
          author_display_name: newTipAnon ? "Anonymous Citizen" : currentProfile.full_name,
          is_anonymous_public: newTipAnon,
          body: newTipText.trim(),
          votes: 1,
          created_at: new Date(ts).toISOString(),
        },
        ...prev.reportTips,
      ],
    }));
    setNewTipText("");
    setStatusNotice("Community tip added");
  };

  const handleVoteTip = (tipId: string, delta: 1 | -1) => {
    setDataset((prev) => ({
      ...prev,
      reportTips: prev.reportTips.map((t) =>
        t.id === tipId ? { ...t, votes: Math.max(0, t.votes + delta) } : t
      ),
    }));
  };

  const handleSelectReport = useCallback((id: string) => {
    setSelectedReportId(id);
    setSelectedSosId(null);
  }, []);

  const handleSelectSos = useCallback((id: string) => {
    setSelectedSosId(id);
    setSelectedReportId(null);
  }, []);

  const handleSelectReportFromHeatmap = useCallback((id: string) => {
    setSelectedReportId(id);
    setSelectedSosId(null);
    setSection("reports");
  }, []);

  const handleSelectSosFromHeatmap = useCallback((id: string) => {
    setSelectedSosId(id);
    setSelectedReportId(null);
    setSection("sos");
  }, []);

  const selectNavSection = useCallback((next: NavSection) => {
    setSection(next);
    setMobileNavOpen(false);
  }, []);

  const handleCreateHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverSummary.trim()) return;
    const summaryText = handoverSummary.trim();
    const ts = nowMsRef.current;
    const tempId = `ho-${ts}`;
    setDataset((prev) => ({
      ...prev,
      shiftHandovers: [
        {
          id: tempId,
          officer_name: currentProfile.full_name,
          shift_label: handoverShift,
          summary: summaryText,
          priority_areas: ["Dhanmondi", "Mirpur-10"],
          created_at: new Date(ts).toISOString(),
        },
        ...prev.shiftHandovers,
      ],
    }));
    setHandoverSummary("");
    setStatusNotice("Shift handover logged");
    if (isLiveApiConfigured()) {
      void ensureToken(role)
        .then((token) =>
          token
            ? apiCreateHandover(token, {
                shift_label: handoverShift,
                summary: summaryText,
                priority_areas: ["Dhanmondi", "Mirpur-10"],
              })
            : null
        )
        .then((saved) => {
          if (saved) {
            setDataset((prev) => ({
              ...prev,
              shiftHandovers: prev.shiftHandovers.map((h) => (h.id === tempId ? saved : h)),
            }));
          }
        })
        .catch(() => setUiState("partial_error"));
    }
  };

  const handleAddCriminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrimName.trim()) return;
    const fullName = newCrimName.trim();
    const areaVal = newCrimArea;
    const riskVal = newCrimRisk;
    const ts = nowMsRef.current;
    const tempId = `crim-${ts}`;
    const item: CriminalRecord = {
      id: tempId,
      full_name: fullName,
      aliases: [],
      crime_categories: ["snatching"],
      risk_level: riskVal,
      last_known_area: areaVal,
      status: "wanted",
      details: "Added via Admin Watchlist console (synthetic demo).",
    };
    setDataset((prev) => ({ ...prev, criminals: [item, ...prev.criminals] }));
    setNewCrimName("");
    setStatusNotice("Watchlist entry created");
    if (isLiveApiConfigured()) {
      void ensureToken(role)
        .then((token) =>
          token
            ? apiCreateCriminal(token, {
                full_name: fullName,
                last_known_area: areaVal,
                risk_level: riskVal,
              })
            : null
        )
        .then((saved) => {
          if (saved) {
            setDataset((prev) => ({
              ...prev,
              criminals: prev.criminals.map((c) => (c.id === tempId ? saved : c)),
            }));
          }
        })
        .catch(() => setUiState("partial_error"));
    }
  };

  const handleToggleCriminalCustody = (crim: CriminalRecord) => {
    const nextStatus: CriminalRecord["status"] =
      crim.status === "wanted" ? "in_custody" : "wanted";
    setDataset((prev) => ({
      ...prev,
      criminals: prev.criminals.map((c) =>
        c.id === crim.id ? { ...c, status: nextStatus } : c
      ),
    }));
    setStatusNotice(`Watchlist status updated to ${formatStatusLabel(nextStatus)}`);
    if (isLiveApiConfigured()) {
      void ensureToken(role)
        .then((token) => (token ? apiUpdateCriminalStatus(token, crim.id, nextStatus) : null))
        .catch(() => setUiState("partial_error"));
    }
  };

  const activeSosList = useMemo(
    () =>
      dataset.distressSignals.filter((s) =>
        ["active", "claimed", "responding"].includes(s.status)
      ),
    [dataset.distressSignals]
  );

  const unclaimedActiveCount = useMemo(
    () => dataset.distressSignals.filter((s) => s.status === "active").length,
    [dataset.distressSignals]
  );

  const visibleReports = useMemo(() => {
    const base =
      role !== "citizen"
        ? dataset.reports
        : dataset.reports.filter(
            (r) =>
              r.status !== "rejected" &&
              r.flag_status !== "confirmed_false" &&
              r.flag_status !== "flagged" &&
              (r.status !== "pending" || r.reporter_id === currentProfile.id)
          );
    const q = reportSearch.trim().toLowerCase();
    return base.filter((r) => {
      if (reportStatusFilter !== "all" && r.status !== reportStatusFilter) return false;
      if (q && !`${r.title} ${r.area_name} ${r.category} ${r.description}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [currentProfile.id, dataset.reports, reportSearch, reportStatusFilter, role]);

  const falseQueue = useMemo(() => filterAndSortFalseReports(dataset.reports), [dataset.reports]);
  const filteredFalseQueue = useMemo(() => {
    if (falseRiskFilter === "ALL") return falseQueue;
    return falseQueue.filter(
      (r) => computeFalseReportBreakdown(r).riskLevel === falseRiskFilter
    );
  }, [falseQueue, falseRiskFilter]);

  const safetyScores = useMemo(() => computeAreaSafetyScores(dataset.reports), [dataset.reports]);
  const selectedSafetyDetail = useMemo(
    () => safetyScores.find((s) => s.area === selectedSafetyArea) ?? safetyScores[0] ?? null,
    [safetyScores, selectedSafetyArea]
  );

  const predictiveAlerts = useMemo(
    () => generatePredictiveAlerts(dataset.reports).filter((a) => !dismissedAlertIds.includes(a.id)),
    [dataset.reports, dismissedAlertIds]
  );

  const filteredPredictiveAlerts = useMemo(() => {
    if (alertTypeFilter === "ALL") return predictiveAlerts;
    return predictiveAlerts.filter((a) => a.type === alertTypeFilter);
  }, [alertTypeFilter, predictiveAlerts]);

  const filteredCriminals = useMemo(() => {
    const q = criminalSearch.trim().toLowerCase();
    if (!q) return dataset.criminals;
    return dataset.criminals.filter((c) =>
      `${c.full_name} ${c.aliases.join(" ")} ${c.last_known_area} ${c.crime_categories.join(" ")}`
        .toLowerCase()
        .includes(q)
    );
  }, [criminalSearch, dataset.criminals]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of dataset.reports) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const maxVal = entries[0]?.[1] ?? 1;
    return entries.map(([cat, count]) => ({
      category: cat,
      label: formatStatusLabel(cat),
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [dataset.reports]);

  const nearestSelectedThana = useMemo(
    () =>
      selectedSos
        ? findNearestStation(dataset.policeStations, selectedSos.lat, selectedSos.lng)
        : null,
    [dataset.policeStations, selectedSos]
  );

  const nearestReportThana = useMemo(
    () =>
      selectedReport
        ? findNearestStation(dataset.policeStations, selectedReport.lat, selectedReport.lng)
        : null,
    [dataset.policeStations, selectedReport]
  );

  const maskedSelectedReport = useMemo(
    () => (selectedReport ? maskReportForRole(selectedReport, role, currentProfile.id) : null),
    [currentProfile.id, role, selectedReport]
  );

  const selectedReportTips = useMemo(
    () =>
      selectedReport
        ? dataset.reportTips.filter((t) => t.report_id === selectedReport.id)
        : [],
    [dataset.reportTips, selectedReport]
  );

  const showDrawer =
    (uiState === "live" || uiState === "partial_error") &&
    (section === "sos" || section === "reports") &&
    Boolean(selectedSos || selectedReport);

  return (
    <div className="daak-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Left Navigation Rail — Dhaka Civic Teal Municipal Enamel */}
      <aside className="daak-rail" aria-label="Primary navigation">
        <div className="daak-brand">
          <div className="daak-crest">
            <div className="daak-crest-badge" aria-hidden="true">
              ডাক
            </div>
            <div>
              <div className="daak-brand-title">Daak v2</div>
              <p className="daak-brand-tagline">When nobody hears, we do</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="daak-live-badge" title="Emergency Dispatch Relay Active">
              <span className="daak-live-dot" aria-hidden="true" />
              <span className="mono">999</span>
            </span>
            <button
              type="button"
              className="daak-mobile-nav-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="daak-primary-nav"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                {mobileNavOpen ? (
                  <>
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <nav
          id="daak-primary-nav"
          className="daak-nav-group"
          data-open={mobileNavOpen ? "true" : "false"}
          aria-label="Dispatch views"
        >
          <p className="daak-nav-heading">Dispatch operations</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "sos" ? "page" : undefined}
            onClick={() => selectNavSection("sos")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="sos" />
              <span>SOS Monitor</span>
            </span>
            <span className={`daak-nav-count mono ${unclaimedActiveCount > 0 ? "is-alert" : ""}`}>
              {activeSosList.length}
            </span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "reports" ? "page" : undefined}
            onClick={() => selectNavSection("reports")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="reports" />
              <span>Crime Reports</span>
            </span>
            <span className="daak-nav-count mono">{visibleReports.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "heatmap" ? "page" : undefined}
            onClick={() => selectNavSection("heatmap")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="heatmap" />
              <span>Spatial Heatmap</span>
            </span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "alerts" ? "page" : undefined}
            onClick={() => selectNavSection("alerts")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="alerts" />
              <span>Predictive Alerts</span>
            </span>
            <span className="daak-nav-count mono">{predictiveAlerts.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "handovers" ? "page" : undefined}
            onClick={() => selectNavSection("handovers")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="handovers" />
              <span>Shift Handovers</span>
            </span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "8px" }}>
            Admin governance
          </p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "false_reports" ? "page" : undefined}
            onClick={() => selectNavSection("false_reports")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="false_reports" />
              <span>False-Report Queue</span>
            </span>
            <span className="daak-nav-count mono">{falseQueue.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "criminals" ? "page" : undefined}
            onClick={() => selectNavSection("criminals")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="criminals" />
              <span>Criminal Watchlist</span>
            </span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "analytics" ? "page" : undefined}
            onClick={() => selectNavSection("analytics")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="analytics" />
              <span>Analytics &amp; Logs</span>
            </span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "8px" }}>
            Mobile surface
          </p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "citizen_preview" ? "page" : undefined}
            onClick={() => selectNavSection("citizen_preview")}
          >
            <span className="daak-nav-btn-label">
              <NavIcon name="citizen_preview" />
              <span>Citizen Mobile Preview</span>
            </span>
          </button>
        </nav>

        <div className="daak-rail-footer" data-open={mobileNavOpen ? "true" : "false"}>
          <div>
            Synthetic Bangladesh demo dataset · simulated 999 dispatch relay
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <label htmlFor="ui-state-select" style={{ fontSize: "0.75rem", color: "var(--ink-on-rail-muted)" }}>
              Preview state
            </label>
            <select
              id="ui-state-select"
              className="field-select"
              style={{ width: "auto", padding: "3px 6px", fontSize: "0.75rem" }}
              value={uiState}
              onChange={(e) => setUiState(e.target.value as UiStateMode)}
            >
              <option value="live">Live Data</option>
              <option value="loading">Loading Skeleton</option>
              <option value="empty">Empty Queue</option>
              <option value="partial_error">Partial Error</option>
              <option value="fatal_error">Fatal Error</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Main Content + Topbar + Right Inspector */}
      <div className="daak-main-wrap">
        <header className="daak-topbar">
          <div>
            <h1 className="daak-topbar-title">
              {section === "sos" && "Live SOS Monitor & SLA Dispatch"}
              {section === "reports" && "Crime Reports & Community Corroboration"}
              {section === "heatmap" && "Dhaka PostGIS Heatmap & Area Safety"}
              {section === "alerts" && "Predictive Crime Alerts & Anomaly Detection"}
              {section === "handovers" && "Police Shift Handover Log"}
              {section === "false_reports" && "Automated 5-Factor False-Report Triage"}
              {section === "criminals" && "Criminal Watchlist Management"}
              {section === "analytics" && "Operational Analytics & Audit Trail"}
              {section === "citizen_preview" && "Citizen Mobile App (Expo Web Preview)"}
            </h1>
            <p className="daak-topbar-sub">
              <span>
                Signed in: <strong>{currentProfile.full_name}</strong> ({formatStatusLabel(currentProfile.role)})
              </span>
              {currentProfile.station_name && (
                <span className="pill pill-neutral">{currentProfile.station_name}</span>
              )}
              <span role="status" aria-live="polite" style={{ color: "var(--accent-interactive)", fontWeight: 600 }}>
                {statusNotice ? statusNotice : ""}
              </span>
            </p>
          </div>

          <div className="daak-controls-row">
            <div className="role-pill-group" role="group" aria-label="1-Click Demo Role Switcher">
              {(["police", "admin", "citizen"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="role-pill-btn"
                  aria-pressed={role === r}
                  onClick={() => switchDemoRole(r)}
                >
                  {r === "police"
                    ? "Police · SI Tariqul"
                    : r === "admin"
                    ? "Admin · Farhana"
                    : "Citizen · Nadia"}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn"
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {theme === "light" ? (
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </>
                )}
              </svg>
              <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            </button>
          </div>
        </header>

        <div className={`daak-workspace ${showDrawer ? "" : "no-drawer"}`}>
          <main id="main-content" tabIndex={-1} className="daak-center">
            {uiState === "loading" && (
              <div className="surface-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--ink-secondary)" }}>
                  Waking API service and loading PostGIS dispatch queue...
                </div>
                <div className="skeleton-bar" style={{ width: "45%" }} />
                <div className="skeleton-bar" style={{ width: "100%", height: "220px" }} />
                <div className="skeleton-bar" style={{ width: "85%" }} />
                <div className="skeleton-bar" style={{ width: "70%" }} />
              </div>
            )}

            {uiState === "empty" && (
              <div className="surface-panel" style={{ padding: "24px", textAlign: "left" }}>
                <h2 style={{ margin: "0 0 6px", fontSize: "1rem" }}>No active records in this queue</h2>
                <p className="prose-measure" style={{ margin: "0 0 12px", color: "var(--ink-secondary)" }}>
                  Open Citizen Mobile Preview to trigger a simulated SOS or report, or restore live demo data.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary" onClick={() => setSection("citizen_preview")}>
                    Open Citizen Preview
                  </button>
                  <button type="button" className="btn" onClick={() => setUiState("live")}>
                    Show live demo data
                  </button>
                </div>
              </div>
            )}

            {uiState === "fatal_error" && (
              <div
                className="surface-panel"
                role="alert"
                style={{ padding: "24px", borderColor: "var(--signal-emergency)" }}
              >
                <h2 style={{ margin: "0 0 6px", fontSize: "1.125rem", color: "var(--signal-emergency)" }}>
                  Dispatch stream unavailable
                </h2>
                <p className="prose-measure" style={{ margin: "0 0 12px", color: "var(--ink-secondary)" }}>
                  FastAPI or Supabase Realtime failed to respond. Retry connecting or restore local demo snapshot.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => setUiState("live")}>
                  Reload workspace
                </button>
              </div>
            )}

            {uiState === "partial_error" && (
              <div
                className="surface-warning"
                role="status"
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span>Live safety score recomputation delayed — showing cached Dhaka dispatch snapshot.</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setUiState("live");
                    void syncFromLiveApi(role);
                  }}
                >
                  Retry sync
                </button>
              </div>
            )}

            {(uiState === "live" || uiState === "partial_error") && (
              <>
                {section === "sos" && (
                  <>
                    {unclaimedActiveCount > 0 && (
                      <div className="sos-banner">
                        <div className="sos-banner-left">
                          <div className="sos-banner-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <path d="M12 9v4M12 17h.01" />
                            </svg>
                          </div>
                          <div>
                            <strong style={{ display: "block", fontSize: "0.9375rem", color: "var(--signal-emergency)" }}>
                              {unclaimedActiveCount} Unclaimed Emergency Distress Signal{unclaimedActiveCount > 1 ? "s" : ""}
                            </strong>
                            <span style={{ fontSize: "0.75rem", color: "var(--ink-primary)" }}>
                              Immediate Thana patrol assignment required within 05:00 target SLA.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-emergency"
                          disabled={role === "citizen"}
                          onClick={() => {
                            const first = dataset.distressSignals.find((s) => s.status === "active");
                            if (first) {
                              setSelectedSosId(first.id);
                              handleDispatchSos(first.id, "claimed", unitDraft);
                            }
                          }}
                        >
                          Claim priority SOS
                        </button>
                      </div>
                    )}

                    <div className="kpi-strip">
                      <div className="kpi-cell">
                        <p className="kpi-label">Active SOS</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-emergency)" }}>
                          {unclaimedActiveCount}
                        </p>
                        <span className="kpi-meta">Awaiting unit claim</span>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Claimed / En Route</p>
                        <p className="kpi-val tabular">
                          {dataset.distressSignals.filter((s) => s.status === "claimed" || s.status === "responding").length}
                        </p>
                        <span className="kpi-meta">Active Dhaka patrols</span>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Safe Walk Escalations</p>
                        <p className="kpi-val tabular">
                          {dataset.distressSignals.filter((s) => s.trigger_source === "safe_walk_timeout").length}
                        </p>
                        <span className="kpi-meta">Missed check-in triggers</span>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Target SLA</p>
                        <p className="kpi-val mono">05:00</p>
                        <span className="kpi-meta">Max 10:00 breach threshold</span>
                      </div>
                    </div>

                    <SpatialMapDeck
                      stations={dataset.policeStations}
                      reports={dataset.reports}
                      signals={dataset.distressSignals}
                      selectedId={selectedSosId ?? selectedReportId}
                      categoryFilter={categoryFilter}
                      onCategoryFilterChange={setCategoryFilter}
                      onSelectReport={handleSelectReport}
                      onSelectSos={handleSelectSos}
                      heightPx={390}
                      theme={theme}
                      focusPoint={mapFocusPoint}
                    />

                    <div className="daak-table-wrap">
                      <div className="section-header-row">
                        <div>
                          <h2 className="section-header-title">Live SOS Dispatch Queue</h2>
                          <p className="section-header-sub">
                            Click any row to center the Dhaka street map and open the dispatch inspector
                          </p>
                        </div>
                        <span className="pill pill-neutral mono">{dataset.distressSignals.length} total signals</span>
                      </div>
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Alert ID</th>
                            <th>Area</th>
                            <th>Citizen</th>
                            <th>Trigger</th>
                            <th>Status</th>
                            <th>Unit</th>
                            <th>SLA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataset.distressSignals.map((sig) => {
                            const sla = formatSlaChronometer(sig.triggered_at, nowMs, sig.sla_target_seconds);
                            return (
                              <tr
                                key={sig.id}
                                data-selected={selectedSosId === sig.id}
                                onClick={() => handleSelectSos(sig.id)}
                              >
                                <td className="mono">
                                  <button
                                    type="button"
                                    className="row-trigger-btn mono"
                                    aria-pressed={selectedSosId === sig.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectSos(sig.id);
                                    }}
                                  >
                                    #{sig.id.slice(-6)}
                                  </button>
                                </td>
                                <td>
                                  <strong>{sig.area_name}</strong>
                                </td>
                                <td>{sig.citizen_name}</td>
                                <td>{formatStatusLabel(sig.trigger_source)}</td>
                                <td>
                                  <span
                                    className={`pill ${
                                      sig.status === "active"
                                        ? "pill-breach"
                                        : sig.status === "resolved"
                                        ? "pill-safe"
                                        : "pill-normal"
                                    }`}
                                  >
                                    {formatStatusLabel(sig.status)}
                                  </span>
                                </td>
                                <td>{sig.assigned_unit ?? "Unassigned"}</td>
                                <td>
                                  <span
                                    className={`pill mono ${
                                      sla.tier === "breach"
                                        ? "pill-breach"
                                        : sla.tier === "warning"
                                        ? "pill-warning"
                                        : "pill-normal"
                                    }`}
                                  >
                                    {sla.formatted}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {section === "reports" && (
                  <>
                    {/* Search & Status Filters */}
                    <div
                      className="surface-panel"
                      style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}
                    >
                      <div style={{ flex: "1 1 240px" }}>
                        <label htmlFor="report-search-input" className="field-label">
                          Search reports
                        </label>
                        <input
                          id="report-search-input"
                          className="field-input"
                          value={reportSearch}
                          onChange={(e) => setReportSearch(e.target.value)}
                          placeholder="Filter by title, area (Mirpur, Dhanmondi), or category..."
                        />
                      </div>
                      <div style={{ flex: "0 1 180px" }}>
                        <label htmlFor="report-status-filter" className="field-label">
                          Status
                        </label>
                        <select
                          id="report-status-filter"
                          className="field-select"
                          value={reportStatusFilter}
                          onChange={(e) => setReportStatusFilter(e.target.value)}
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="verified">Verified</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>

                    {/* Reports by Category Visual Breakdown */}
                    <div className="surface-panel" style={{ padding: "14px 16px", display: "grid", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h2 className="section-header-title">Reported Incidents by Category</h2>
                        <span className="pill pill-neutral mono">{visibleReports.length} shown</span>
                      </div>
                      <div className="cards-grid-2">
                        {categoryDistribution.map((item) => (
                          <div key={item.category} className="factor-meter-row">
                            <span>{item.label}</span>
                            <div className="factor-track">
                              <div
                                className="factor-fill"
                                style={{ width: `${item.pct}%`, backgroundColor: "var(--bg-rail-committed)" }}
                              />
                            </div>
                            <span className="mono" style={{ textAlign: "right" }}>
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="daak-table-wrap">
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Headline</th>
                            <th>Category</th>
                            <th>Area</th>
                            <th>Reporter</th>
                            <th>Witnesses</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleReports.map((raw) => {
                            const rep = maskReportForRole(raw, role, currentProfile.id);
                            return (
                              <tr
                                key={rep.id}
                                data-selected={selectedReportId === rep.id}
                                onClick={() => handleSelectReport(rep.id)}
                              >
                                <td>
                                  <button
                                    type="button"
                                    className="row-trigger-btn"
                                    aria-pressed={selectedReportId === rep.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectReport(rep.id);
                                    }}
                                  >
                                    {rep.title}
                                  </button>
                                </td>
                                <td>
                                  <span className="pill pill-neutral">{formatStatusLabel(rep.category)}</span>
                                </td>
                                <td>{rep.area_name}</td>
                                <td>{rep.reporter_display_name}</td>
                                <td className="tabular">{rep.corroboration_count}</td>
                                <td>
                                  <span
                                    className={`pill ${
                                      rep.status === "resolved"
                                        ? "pill-safe"
                                        : rep.status === "rejected"
                                        ? "pill-breach"
                                        : "pill-normal"
                                    }`}
                                  >
                                    {formatStatusLabel(rep.status)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {section === "heatmap" && (
                  <>
                    <SpatialMapDeck
                      stations={dataset.policeStations}
                      reports={dataset.reports}
                      signals={dataset.distressSignals}
                      selectedId={selectedSosId ?? selectedReportId}
                      categoryFilter={categoryFilter}
                      onCategoryFilterChange={setCategoryFilter}
                      onSelectReport={handleSelectReportFromHeatmap}
                      onSelectSos={handleSelectSosFromHeatmap}
                      heightPx={480}
                      theme={theme}
                      focusPoint={mapFocusPoint}
                    />

                    {/* 3-Factor Area Safety Score Inspector + Cards */}
                    {selectedSafetyDetail && (
                      <div className="surface-panel" style={{ padding: "16px", display: "grid", gap: "14px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <div
                              className="conic-gauge"
                              style={{
                                background: `conic-gradient(${
                                  selectedSafetyDetail.score >= 75
                                    ? "var(--signal-safe)"
                                    : selectedSafetyDetail.score >= 50
                                    ? "var(--signal-warning)"
                                    : "var(--signal-emergency)"
                                } ${selectedSafetyDetail.score * 3.6}deg, var(--border-hairline) 0deg)`,
                              }}
                            >
                              <div className="conic-gauge-inner">
                                <strong className="mono" style={{ fontSize: "1.125rem" }}>
                                  {selectedSafetyDetail.score}
                                </strong>
                                <span style={{ fontSize: "0.625rem", color: "var(--ink-secondary)" }}>/100</span>
                              </div>
                            </div>
                            <div>
                              <h2 className="section-header-title">
                                {selectedSafetyDetail.area} — Area Safety Score ({selectedSafetyDetail.level})
                              </h2>
                              <p className="section-header-sub">
                                Weighted PostGIS formula: 40% crime frequency · 35% resolution rate · 25% day/night distribution
                              </p>
                              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                                <span className="pill pill-neutral tabular">
                                  {selectedSafetyDetail.reportCount} total reports
                                </span>
                                <span className="pill pill-safe tabular">
                                  {selectedSafetyDetail.resolvedCount} resolved
                                </span>
                                <span className="pill pill-warning tabular">
                                  {selectedSafetyDetail.pendingCount} open
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn"
                            onClick={() =>
                              setMapFocusPoint({
                                lat: selectedSafetyDetail.lat,
                                lng: selectedSafetyDetail.lng,
                                zoom: 14,
                                label: selectedSafetyDetail.area,
                              })
                            }
                          >
                            Center map on {selectedSafetyDetail.area}
                          </button>
                        </div>

                        <div style={{ display: "grid", gap: "8px" }}>
                          {[
                            {
                              label: "Crime frequency (40%)",
                              val: selectedSafetyDetail.factors.crimeFrequency,
                              color: "var(--signal-info)",
                            },
                            {
                              label: "Resolution rate (35%)",
                              val: selectedSafetyDetail.factors.resolutionRate,
                              color: "var(--signal-safe)",
                            },
                            {
                              label: "Time-of-day safety (25%)",
                              val: selectedSafetyDetail.factors.timeOfDay,
                              color: "var(--signal-warning)",
                            },
                          ].map((f) => (
                            <div key={f.label} className="factor-meter-row">
                              <span>{f.label}</span>
                              <div className="factor-track">
                                <div className="factor-fill" style={{ width: `${f.val}%`, backgroundColor: f.color }} />
                              </div>
                              <span className="mono" style={{ textAlign: "right" }}>
                                {f.val}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="daak-table-wrap">
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Neighborhood</th>
                            <th>Safety Score (40/35/25)</th>
                            <th>Level</th>
                            <th>Dominant Category</th>
                            <th>Active / Resolved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safetyScores.map((s) => (
                            <tr
                              key={s.area}
                              data-selected={selectedSafetyArea === s.area}
                              onClick={() => setSelectedSafetyArea(s.area)}
                            >
                              <td>
                                <strong>{s.area}</strong>
                              </td>
                              <td className="mono">{s.score}/100</td>
                              <td>
                                <span className={`pill ${s.score >= 75 ? "pill-safe" : "pill-warning"}`}>
                                  {s.level}
                                </span>
                              </td>
                              <td>{formatStatusLabel(s.dominantCategory)}</td>
                              <td className="tabular">
                                {s.reportCount} total · {s.resolvedCount} resolved
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {section === "alerts" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div
                      className="surface-panel"
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <h2 className="section-header-title">Turning Daak Preventive — Crime Pattern Alerts</h2>
                        <p className="section-header-sub">
                          Detects time-of-day crime spikes, localized category hotspots, and citywide emerging trends.
                        </p>
                      </div>
                      <div className="filter-tabs-row" role="tablist" aria-label="Predictive alert filters">
                        {(["ALL", "SPIKE", "HOTSPOT", "TREND"] as const).map((t) => {
                          const count =
                            t === "ALL"
                              ? predictiveAlerts.length
                              : predictiveAlerts.filter((a) => a.type === t).length;
                          return (
                            <button
                              key={t}
                              type="button"
                              role="tab"
                              aria-selected={alertTypeFilter === t}
                              className="map-chip"
                              aria-pressed={alertTypeFilter === t}
                              onClick={() => setAlertTypeFilter(t)}
                            >
                              {t === "ALL" ? "All alerts" : formatStatusLabel(t.toLowerCase())} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {filteredPredictiveAlerts.length === 0 ? (
                      <div className="surface-panel" style={{ padding: "24px" }}>
                        <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>No active predictive anomalies</h3>
                        <p className="prose-measure" style={{ margin: "0 0 10px", color: "var(--ink-secondary)" }}>
                          All detected pattern alerts have been reviewed or dismissed.
                        </p>
                        {dismissedAlertIds.length > 0 && (
                          <button type="button" className="btn" onClick={() => setDismissedAlertIds([])}>
                            Restore dismissed alerts
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="cards-grid-2">
                        {filteredPredictiveAlerts.map((alert) => (
                          <article
                            key={alert.id}
                            className="surface-panel"
                            style={{ padding: "14px 16px", display: "grid", gap: "10px" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <span
                                  className={`pill ${
                                    alert.severity >= 8
                                      ? "pill-breach"
                                      : alert.severity >= 6
                                      ? "pill-warning"
                                      : "pill-normal"
                                  }`}
                                >
                                  {alert.type} · Severity {alert.severity}/10
                                </span>
                                <span className="pill pill-neutral">{alert.timeOfDay}</span>
                              </div>
                              <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                                {alert.count} reports
                              </span>
                            </div>
                            <div>
                              <h3 style={{ margin: "0 0 4px", fontSize: "0.9375rem" }}>{alert.message}</h3>
                              <p className="prose-measure" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>
                                {alert.description}
                              </p>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                                Area: <strong>{alert.area}</strong> · Trend: {formatStatusLabel(alert.trend)}
                              </span>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setMapFocusPoint({
                                      lat: alert.lat,
                                      lng: alert.lng,
                                      zoom: 14,
                                      label: alert.area,
                                    });
                                    setSection("heatmap");
                                  }}
                                >
                                  Focus on map
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => setDismissedAlertIds((prev) => [...prev, alert.id])}
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {section === "handovers" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <form
                      onSubmit={handleCreateHandover}
                      className="surface-panel"
                      style={{ padding: "16px", display: "grid", gap: "10px" }}
                    >
                      <h2 className="section-header-title">Log Outgoing Shift Briefing</h2>
                      {role === "citizen" && (
                        <div role="note" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          Viewing read-only as citizen. Switch 1-Click Demo to Police or Admin to log handovers.
                        </div>
                      )}
                      <div>
                        <label htmlFor="ho-shift" className="field-label">
                          Shift window
                        </label>
                        <input
                          id="ho-shift"
                          className="field-input"
                          value={handoverShift}
                          onChange={(e) => setHandoverShift(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="ho-summary" className="field-label">
                          Operational notes
                        </label>
                        <textarea
                          id="ho-summary"
                          className="field-textarea"
                          rows={3}
                          value={handoverSummary}
                          onChange={(e) => setHandoverSummary(e.target.value)}
                          placeholder="Summarize active patrols, open SOS alerts, and priority Thanas"
                          required
                        />
                      </div>
                      <div>
                        <button type="submit" className="btn btn-primary" disabled={role === "citizen"}>
                          Save shift handover
                        </button>
                      </div>
                    </form>

                    {dataset.shiftHandovers.map((ho) => (
                      <div key={ho.id} className="surface-panel" style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <strong>{ho.shift_label}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>{ho.officer_name}</span>
                        </div>
                        <p className="prose-measure" style={{ margin: "0 0 8px" }}>
                          {ho.summary}
                        </p>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          Priority areas: {ho.priority_areas.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section === "false_reports" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    {role !== "admin" && (
                      <div
                        className="surface-muted"
                        role="note"
                        style={{ padding: "10px 14px", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}
                      >
                        Viewing read-only as {formatStatusLabel(role)}. Switch 1-Click Demo to Admin to moderate flagged reports.
                      </div>
                    )}

                    {/* Summary Strip + Risk Filter */}
                    <div className="kpi-strip">
                      <div className="kpi-cell">
                        <p className="kpi-label">Flagged Queue</p>
                        <p className="kpi-val tabular">{falseQueue.length}</p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Critical Risk</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-emergency)" }}>
                          {falseQueue.filter((r) => computeFalseReportBreakdown(r).riskLevel === "Critical").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">High Risk</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-warning)" }}>
                          {falseQueue.filter((r) => computeFalseReportBreakdown(r).riskLevel === "High").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <label htmlFor="false-risk-filter" className="kpi-label">
                          Filter risk level
                        </label>
                        <select
                          id="false-risk-filter"
                          className="field-select"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          value={falseRiskFilter}
                          onChange={(e) =>
                            setFalseRiskFilter(e.target.value as "ALL" | "Critical" | "High" | "Medium" | "Low")
                          }
                        >
                          <option value="ALL">All risks</option>
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    {filteredFalseQueue.length === 0 ? (
                      <div className="surface-panel" style={{ padding: "24px" }}>
                        <h2 style={{ margin: "0 0 6px", fontSize: "1rem" }}>All flagged reports have been triaged</h2>
                        <p className="prose-measure" style={{ margin: 0, color: "var(--ink-secondary)" }}>
                          No pending false-report alerts remain in the automated 5-factor heuristic queue.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "12px" }}>
                        {filteredFalseQueue.map((rep) => {
                          const breakdown = computeFalseReportBreakdown(rep);
                          return (
                            <div
                              key={rep.id}
                              className="surface-panel"
                              style={{ padding: "16px", display: "grid", gap: "12px" }}
                            >
                              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                                    <span className={`pill mono ${breakdown.riskLevel === "Critical" ? "pill-breach" : "pill-warning"}`}>
                                      {breakdown.riskLevel} · {rep.suspicion_score}/100
                                    </span>
                                    <span className="pill pill-neutral">{rep.area_name}</span>
                                    <span className="pill pill-neutral">{formatStatusLabel(rep.category)}</span>
                                  </div>
                                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{rep.title}</h3>
                                  <p className="prose-measure" style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>
                                    {rep.description}
                                  </p>
                                </div>
                              </div>

                              {/* 5-Factor Heuristic Breakdown */}
                              <div className="surface-muted" style={{ padding: "12px", display: "grid", gap: "7px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-primary)" }}>
                                  5-Factor Heuristic Breakdown
                                </div>
                                {[
                                  { label: "User credibility", val: breakdown.userCredibility, color: "var(--signal-info)" },
                                  { label: "Duplicate pattern", val: breakdown.duplicatePattern, color: "var(--signal-warning)" },
                                  { label: "Rapid submission", val: breakdown.rapidSubmission, color: "var(--signal-emergency)" },
                                  { label: "Detail consistency", val: breakdown.detailConsistency, color: "var(--signal-warning)" },
                                  { label: "Suspicious content", val: breakdown.suspiciousContent, color: "var(--signal-emergency)" },
                                ].map((f) => (
                                  <div key={f.label} className="factor-meter-row">
                                    <span>{f.label}</span>
                                    <div className="factor-track">
                                      <div className="factor-fill" style={{ width: `${f.val}%`, backgroundColor: f.color }} />
                                    </div>
                                    <span className="mono" style={{ textAlign: "right" }}>
                                      {f.val}%
                                    </span>
                                  </div>
                                ))}
                                <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)", marginTop: "4px" }}>
                                  Triggers: {rep.suspicion_reasons.join(" · ")}
                                </div>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end", justifyContent: "space-between" }}>
                                <div style={{ flex: "1 1 260px" }}>
                                  <label htmlFor={`note-${rep.id}`} className="field-label">
                                    Admin review note
                                  </label>
                                  <input
                                    id={`note-${rep.id}`}
                                    className="field-input"
                                    value={triageNotes[rep.id] ?? ""}
                                    onChange={(e) =>
                                      setTriageNotes((prev) => ({ ...prev, [rep.id]: e.target.value }))
                                    }
                                    placeholder="Optional moderation rationale..."
                                  />
                                </div>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={role !== "admin"}
                                    onClick={() =>
                                      handleModerateReport(rep.id, {
                                        flag_status: "cleared",
                                        status: "verified",
                                        moderation_note: triageNotes[rep.id] || "Verified by Admin triage",
                                      })
                                    }
                                  >
                                    Clear &amp; verify
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-emergency"
                                    disabled={role !== "admin"}
                                    onClick={() =>
                                      handleModerateReport(rep.id, {
                                        flag_status: "confirmed_false",
                                        status: "rejected",
                                        moderation_note: triageNotes[rep.id] || "Confirmed spam / false report",
                                      })
                                    }
                                  >
                                    Confirm false
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {section === "criminals" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    {role !== "admin" && (
                      <div
                        className="surface-muted"
                        role="note"
                        style={{ padding: "10px 14px", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}
                      >
                        Viewing read-only as {formatStatusLabel(role)}. Switch 1-Click Demo to Admin to edit the watchlist.
                      </div>
                    )}

                    <div
                      className="surface-panel"
                      style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}
                    >
                      <div style={{ flex: "1 1 240px" }}>
                        <label htmlFor="crim-search" className="field-label">
                          Search watchlist
                        </label>
                        <input
                          id="crim-search"
                          className="field-input"
                          value={criminalSearch}
                          onChange={(e) => setCriminalSearch(e.target.value)}
                          placeholder="Search by suspect name, alias, crime, or Thana area..."
                        />
                      </div>
                    </div>

                    <form
                      onSubmit={handleAddCriminal}
                      className="surface-panel"
                      style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}
                    >
                      <div style={{ flex: "1 1 200px" }}>
                        <label htmlFor="crim-name" className="field-label">
                          Suspect name
                        </label>
                        <input
                          id="crim-name"
                          className="field-input"
                          value={newCrimName}
                          onChange={(e) => setNewCrimName(e.target.value)}
                          placeholder="Name (Synthetic Demo)"
                          required
                        />
                      </div>
                      <div style={{ flex: "1 1 150px" }}>
                        <label htmlFor="crim-area" className="field-label">
                          Last known area
                        </label>
                        <input
                          id="crim-area"
                          className="field-input"
                          value={newCrimArea}
                          onChange={(e) => setNewCrimArea(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ flex: "0 1 130px" }}>
                        <label htmlFor="crim-risk" className="field-label">
                          Risk level
                        </label>
                        <select
                          id="crim-risk"
                          className="field-select"
                          value={newCrimRisk}
                          onChange={(e) => setNewCrimRisk(e.target.value as CriminalRecord["risk_level"])}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={role !== "admin"}>
                        Add watchlist entry
                      </button>
                    </form>

                    <div className="cards-grid-3">
                      {filteredCriminals.map((crim) => (
                        <div
                          key={crim.id}
                          className="surface-panel"
                          style={{ padding: "14px", display: "grid", gap: "10px" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div>
                              <strong style={{ fontSize: "0.9375rem", display: "block" }}>{crim.full_name}</strong>
                              <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                                {crim.aliases.length > 0 ? `Alias: ${crim.aliases.join(", ")}` : "No known alias"}
                              </span>
                            </div>
                            <span
                              className={`pill ${
                                crim.risk_level === "critical" || crim.risk_level === "high"
                                  ? "pill-breach"
                                  : "pill-warning"
                              }`}
                            >
                              {formatStatusLabel(crim.risk_level)}
                            </span>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {crim.crime_categories.map((cat) => (
                              <span key={cat} className="pill pill-neutral">
                                {formatStatusLabel(cat)}
                              </span>
                            ))}
                          </div>

                          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                            <strong>Last seen:</strong> {crim.last_known_area}
                            <br />
                            {crim.details}
                          </p>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className={`pill ${crim.status === "wanted" ? "pill-breach" : "pill-safe"}`}>
                              {formatStatusLabel(crim.status)}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={role !== "admin"}
                              onClick={() => handleToggleCriminalCustody(crim)}
                            >
                              Toggle custody
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section === "analytics" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div className="kpi-strip">
                      <div className="kpi-cell">
                        <p className="kpi-label">Total Reports</p>
                        <p className="kpi-val tabular">{dataset.reports.length}</p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Resolved</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-safe)" }}>
                          {dataset.reports.filter((r) => r.status === "resolved").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Flagged False</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-warning)" }}>
                          {falseQueue.length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Wanted Watchlist</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-emergency)" }}>
                          {dataset.criminals.filter((c) => c.status === "wanted").length}
                        </p>
                      </div>
                    </div>

                    <div className="cards-grid-2">
                      <div className="surface-panel" style={{ padding: "14px 16px", display: "grid", gap: "10px" }}>
                        <h2 className="section-header-title">Report Status Distribution</h2>
                        {[
                          {
                            label: "Resolved",
                            count: dataset.reports.filter((r) => r.status === "resolved").length,
                            color: "var(--signal-safe)",
                          },
                          {
                            label: "Verified / Active",
                            count: dataset.reports.filter(
                              (r) => r.status === "verified" || r.status === "investigating"
                            ).length,
                            color: "var(--signal-info)",
                          },
                          {
                            label: "Pending Review",
                            count: dataset.reports.filter((r) => r.status === "pending").length,
                            color: "var(--signal-warning)",
                          },
                          {
                            label: "Rejected",
                            count: dataset.reports.filter((r) => r.status === "rejected").length,
                            color: "var(--signal-emergency)",
                          },
                        ].map((row) => {
                          const pct =
                            dataset.reports.length > 0
                              ? Math.round((row.count / dataset.reports.length) * 100)
                              : 0;
                          return (
                            <div key={row.label} className="factor-meter-row">
                              <span>{row.label}</span>
                              <div className="factor-track">
                                <div className="factor-fill" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                              </div>
                              <span className="mono" style={{ textAlign: "right" }}>
                                {row.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="surface-panel" style={{ padding: "14px 16px", display: "grid", gap: "10px" }}>
                        <h2 className="section-header-title">Crime Category Breakdown</h2>
                        {categoryDistribution.map((item) => (
                          <div key={item.category} className="factor-meter-row">
                            <span>{item.label}</span>
                            <div className="factor-track">
                              <div
                                className="factor-fill"
                                style={{ width: `${item.pct}%`, backgroundColor: "var(--bg-rail-committed)" }}
                              />
                            </div>
                            <span className="mono" style={{ textAlign: "right" }}>
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="daak-table-wrap">
                      <div className="section-header-row">
                        <h2 className="section-header-title">Immutable Audit Trail</h2>
                        <span className="pill pill-neutral mono">{dataset.activityLogs.length} events</span>
                      </div>
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Actor Role</th>
                            <th>Target</th>
                            <th>Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataset.activityLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="mono">{log.action}</td>
                              <td>{formatStatusLabel(log.actor_role)}</td>
                              <td>{formatStatusLabel(log.target_type)}</td>
                              <td className="prose-measure">{log.summary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {section === "citizen_preview" && (
                  <CitizenPreviewDeck
                    citizenProfile={dataset.profiles.citizen}
                    stations={dataset.policeStations}
                    reports={dataset.reports}
                    safeWalks={dataset.safeWalks}
                    criminals={dataset.criminals}
                    emergencyContacts={dataset.emergencyContacts}
                    theme={theme}
                    onTriggerSos={handleTriggerSosFromCitizen}
                    onSubmitReport={handleCitizenSubmitReport}
                    onCorroborate={handleCorroborate}
                    onStartWalk={handleStartWalk}
                    onExtendWalk={handleExtendWalk}
                    onEscalateWalk={handleEscalateWalk}
                    onCompleteWalk={handleCompleteWalk}
                    onUpdateContact={handleUpdateContact}
                    onRemoveContact={handleRemoveContact}
                    onAskAi={handleAskAi}
                  />
                )}
              </>
            )}
          </main>

          {/* Collapsible Right Case Inspector Drawer */}
          {showDrawer && (
            <aside className="daak-drawer" aria-label="Case inspector drawer">
              {selectedSos && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>
                      Case <span className="mono">#{selectedSos.id.slice(-6)}</span>
                    </h2>
                    <button
                      type="button"
                      className="btn"
                      aria-label="Close case inspector"
                      onClick={() => setSelectedSosId(null)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                      <span>Close</span>
                    </button>
                  </div>
                  <div className="surface-muted" style={{ padding: "12px", display: "grid", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{selectedSos.area_name}</strong>
                      <span className="pill pill-breach">{formatStatusLabel(selectedSos.status)}</span>
                    </div>
                    <div className="mono" style={{ fontSize: "0.75rem" }}>
                      {selectedSos.lat.toFixed(4)}, {selectedSos.lng.toFixed(4)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                      Citizen: {selectedSos.citizen_name} · Battery: {selectedSos.battery_level ?? "N/A"}%
                    </div>
                    {nearestSelectedThana && (
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                        Nearest Thana: <strong>{nearestSelectedThana.station.name_en}</strong> (
                        {(nearestSelectedThana.distanceMeters / 1000).toFixed(2)} km ·{" "}
                        <span className="mono">{nearestSelectedThana.station.phone}</span>)
                      </div>
                    )}
                  </div>
                  <p className="prose-measure" style={{ margin: 0 }}>
                    {selectedSos.note}
                  </p>

                  <div>
                    <label htmlFor="unit-assign-input" className="field-label">
                      Assign patrol unit
                    </label>
                    <input
                      id="unit-assign-input"
                      className="field-input"
                      value={unitDraft}
                      onChange={(e) => setUnitDraft(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {selectedSos.status === "active" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={role === "citizen"}
                        onClick={() => handleDispatchSos(selectedSos.id, "claimed", unitDraft)}
                      >
                        Claim alert
                      </button>
                    )}
                    {(selectedSos.status === "active" || selectedSos.status === "claimed") && (
                      <button
                        type="button"
                        className="btn"
                        disabled={role === "citizen"}
                        onClick={() => handleDispatchSos(selectedSos.id, "responding", unitDraft)}
                      >
                        Mark responding
                      </button>
                    )}
                    {["active", "claimed", "responding"].includes(selectedSos.status) && (
                      <button
                        type="button"
                        className="btn"
                        disabled={role === "citizen"}
                        onClick={() => handleDispatchSos(selectedSos.id, "resolved")}
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 style={{ margin: "6px 0", fontSize: "0.8125rem" }}>Dispatch Timeline</h3>
                    <div className="timeline-list">
                      {selectedSos.dispatch_timeline.map((ev, idx) => (
                        <div key={idx} className="timeline-item">
                          <strong>{formatStatusLabel(ev.status)}</strong>
                          <span style={{ color: "var(--ink-secondary)" }}>{ev.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {maskedSelectedReport && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>Report Inspector</h2>
                    <button
                      type="button"
                      className="btn"
                      aria-label="Close report inspector"
                      onClick={() => setSelectedReportId(null)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                      <span>Close</span>
                    </button>
                  </div>
                  <strong>{maskedSelectedReport.title}</strong>
                  <p className="prose-measure" style={{ margin: 0, fontSize: "0.8125rem" }}>
                    {maskedSelectedReport.description}
                  </p>

                  {/* Mini-map centered on the report */}
                  <SpatialMapDeck
                    stations={dataset.policeStations}
                    reports={[maskedSelectedReport]}
                    signals={[]}
                    selectedId={maskedSelectedReport.id}
                    categoryFilter="all"
                    onCategoryFilterChange={() => {}}
                    onSelectReport={() => {}}
                    onSelectSos={() => {}}
                    compact
                    heightPx={180}
                    theme={theme}
                    showSearch={false}
                  />

                  <div className="surface-muted" style={{ padding: "10px 12px", fontSize: "0.75rem", display: "grid", gap: "4px" }}>
                    <div>
                      Area: <strong>{maskedSelectedReport.area_name}</strong>
                    </div>
                    <div>Reporter: {maskedSelectedReport.reporter_display_name}</div>
                    {nearestReportThana && (
                      <div>
                        Nearest Thana: <strong>{nearestReportThana.station.name_en}</strong> (
                        {(nearestReportThana.distanceMeters / 1000).toFixed(2)} km)
                      </div>
                    )}
                    {maskedSelectedReport.is_anonymous_public && (
                      <div>
                        <span className="pill pill-normal">Publicly anonymous · internal accountability active</span>
                      </div>
                    )}
                    <div>Witnesses (&lt;= 1 km): {maskedSelectedReport.corroboration_count}</div>
                    {role !== "citizen" && <div>Suspicion score: {maskedSelectedReport.suspicion_score}/100</div>}
                  </div>

                  {role !== "citizen" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleModerateReport(maskedSelectedReport.id, { status: "verified" })}
                      >
                        Verify report
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleModerateReport(maskedSelectedReport.id, { status: "investigating" })}
                      >
                        Mark investigating
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleModerateReport(maskedSelectedReport.id, { status: "resolved" })}
                      >
                        Mark resolved
                      </button>
                    </div>
                  )}

                  {/* Community Tips & Witness Notes with Voting */}
                  <div style={{ display: "grid", gap: "8px", borderTop: "1px solid var(--border-hairline)", paddingTop: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "0.875rem" }}>
                      Community Tips ({selectedReportTips.length})
                    </h3>
                    {selectedReportTips.length === 0 ? (
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                        No community tips added for this incident yet.
                      </div>
                    ) : (
                      selectedReportTips.map((tip) => (
                        <div key={tip.id} className="timeline-item">
                          <div style={{ fontSize: "0.8125rem" }}>{tip.body}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", color: "var(--ink-secondary)" }}>
                            <span>By {tip.author_display_name}</span>
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                aria-label="Upvote tip"
                                onClick={() => handleVoteTip(tip.id, 1)}
                              >
                                ▲
                              </button>
                              <span className="mono">{tip.votes}</span>
                              <button
                                type="button"
                                className="btn btn-sm"
                                aria-label="Downvote tip"
                                onClick={() => handleVoteTip(tip.id, -1)}
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    <form onSubmit={handleAddTip} style={{ display: "grid", gap: "6px" }}>
                      <label htmlFor="new-tip-input" className="field-label">
                        Add a helpful witness tip
                      </label>
                      <textarea
                        id="new-tip-input"
                        className="field-textarea"
                        rows={2}
                        value={newTipText}
                        onChange={(e) => setNewTipText(e.target.value)}
                        placeholder="Share CCTV sighting, patrol location, or landmark..."
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={newTipAnon}
                            onChange={(e) => setNewTipAnon(e.target.checked)}
                          />
                          Post anonymously
                        </label>
                        <button type="submit" className="btn btn-sm btn-primary">
                          Add tip
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
