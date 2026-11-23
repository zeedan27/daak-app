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
  createInitialDemoDataset,
  DEMO_BASE_TIMESTAMP_MS,
  filterAndSortFalseReports,
  findNearestStation,
  formatSlaChronometer,
  formatStatusLabel,
  maskReportForRole,
  resolveAreaCoordinates,
  type CrimeReport,
  type CriminalRecord,
  type DaakDataset,
  type DistressSignal,
  type UserRole,
} from "@/lib/opsLogic";

type NavSection =
  | "sos"
  | "reports"
  | "heatmap"
  | "handovers"
  | "false_reports"
  | "criminals"
  | "analytics"
  | "citizen_preview";

type UiStateMode = "live" | "loading" | "empty" | "partial_error" | "fatal_error";

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
  const [selectedSosId, setSelectedSosId] = useState<string | null>(
    "66666666-6666-4666-8666-666666666601"
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [unitDraft, setUnitDraft] = useState<string>("Mirpur Patrol-09");
  const [handoverShift, setHandoverShift] = useState<string>("Night Shift (22:00–06:00)");
  const [handoverSummary, setHandoverSummary] = useState<string>("");
  const [newCrimName, setNewCrimName] = useState<string>("");
  const [newCrimArea, setNewCrimArea] = useState<string>("Dhanmondi");
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
      try {
        const token = await ensureToken(targetRole);
        if (!token) return;
        const partial = await apiFetchDataset(token, targetRole);
        setNowMs(Date.now());
        setDataset((prev) => ({
          ...prev,
          ...partial,
        }));
      } catch {
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
      if (isLiveApiConfigured() && (nextStatus === "claimed" || nextStatus === "responding" || nextStatus === "resolved" || nextStatus === "false_alarm")) {
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
      is_anonymous_public: boolean;
    }) => {
      const ts = nowMsRef.current;
      const nowIso = new Date(ts).toISOString();
      const coords = resolveAreaCoordinates(input.area_name);
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
        lat: coords.lat,
        lng: coords.lng,
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
                  lat: coords.lat,
                  lng: coords.lng,
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
    const ts = nowMsRef.current;
    const tempId = `crim-${ts}`;
    const item: CriminalRecord = {
      id: tempId,
      full_name: fullName,
      aliases: [],
      crime_categories: ["snatching"],
      risk_level: "high",
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
                risk_level: "high",
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
    () => dataset.distressSignals.filter((s) => ["active", "claimed", "responding"].includes(s.status)),
    [dataset.distressSignals]
  );
  const visibleReports = useMemo(() => {
    if (role !== "citizen") return dataset.reports;
    return dataset.reports.filter(
      (r) =>
        r.status !== "rejected" &&
        r.flag_status !== "confirmed_false" &&
        r.flag_status !== "flagged" &&
        (r.status !== "pending" || r.reporter_id === currentProfile.id)
    );
  }, [currentProfile.id, dataset.reports, role]);
  const falseQueue = useMemo(() => filterAndSortFalseReports(dataset.reports), [dataset.reports]);
  const safetyScores = useMemo(() => computeAreaSafetyScores(dataset.reports), [dataset.reports]);
  const nearestSelectedThana = useMemo(
    () =>
      selectedSos
        ? findNearestStation(dataset.policeStations, selectedSos.lat, selectedSos.lng)
        : null,
    [dataset.policeStations, selectedSos]
  );
  const maskedSelectedReport = useMemo(
    () => (selectedReport ? maskReportForRole(selectedReport, role, currentProfile.id) : null),
    [currentProfile.id, role, selectedReport]
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

      {/* Left Navigation Rail */}
      <aside className="daak-rail" aria-label="Primary navigation">
        <div className="daak-brand">
          <div>
            <div className="daak-brand-title">Daak v2</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-on-rail-muted)" }}>
              Bangladesh Civic Dispatch
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-on-rail-muted)" }}>
              999
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
            <span>SOS Monitor</span>
            <span className="mono">{activeSosList.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "reports" ? "page" : undefined}
            onClick={() => selectNavSection("reports")}
          >
            <span>Crime Reports</span>
            <span className="mono">{dataset.reports.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "heatmap" ? "page" : undefined}
            onClick={() => selectNavSection("heatmap")}
          >
            <span>Spatial Heatmap</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "handovers" ? "page" : undefined}
            onClick={() => selectNavSection("handovers")}
          >
            <span>Shift Handovers</span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "10px" }}>Admin governance</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "false_reports" ? "page" : undefined}
            onClick={() => selectNavSection("false_reports")}
          >
            <span>False-Report Queue</span>
            <span className="mono">{falseQueue.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "criminals" ? "page" : undefined}
            onClick={() => selectNavSection("criminals")}
          >
            <span>Criminal Watchlist</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "analytics" ? "page" : undefined}
            onClick={() => selectNavSection("analytics")}
          >
            <span>Analytics & Logs</span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "10px" }}>Mobile surface</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "citizen_preview" ? "page" : undefined}
            onClick={() => selectNavSection("citizen_preview")}
          >
            <span>Citizen Mobile Preview</span>
          </button>
        </nav>

        <div className="daak-rail-footer" data-open={mobileNavOpen ? "true" : "false"}>
          Synthetic Bangladesh demo dataset · simulated 999 relay
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
              {section === "handovers" && "Police Shift Handover Log"}
              {section === "false_reports" && "Automated 5-Factor False-Report Triage"}
              {section === "criminals" && "Criminal Watchlist Management"}
              {section === "analytics" && "Operational Analytics & Audit Trail"}
              {section === "citizen_preview" && "Citizen Mobile App (Expo Web Preview)"}
            </h1>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
              Signed in: <strong>{currentProfile.full_name}</strong> ({formatStatusLabel(currentProfile.role)})
              <span role="status" aria-live="polite">
                {statusNotice ? ` · ${statusNotice}` : ""}
              </span>
            </p>
          </div>

          <div className="daak-controls-row">
            <label htmlFor="demo-role-select" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
              1-Click Demo
            </label>
            <select
              id="demo-role-select"
              className="field-select"
              style={{ width: "auto" }}
              value={role}
              onChange={(e) => switchDemoRole(e.target.value as UserRole)}
            >
              <option value="police">Demo Police (SI Tariqul)</option>
              <option value="admin">Demo Admin (Farhana)</option>
              <option value="citizen">Demo Citizen (Nadia)</option>
            </select>

            <label htmlFor="ui-state-select" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
              State
            </label>
            <select
              id="ui-state-select"
              className="field-select"
              style={{ width: "auto" }}
              value={uiState}
              onChange={(e) => setUiState(e.target.value as UiStateMode)}
            >
              <option value="live">Live Data</option>
              <option value="loading">Loading Skeleton</option>
              <option value="empty">Empty Queue</option>
              <option value="partial_error">Partial Error</option>
              <option value="fatal_error">Fatal Error</option>
            </select>

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
                <div className="skeleton-bar" style={{ width: "100%", height: "160px" }} />
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
                role="status"
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "var(--signal-warning-soft)",
                  color: "var(--signal-warning)",
                  border: "1px solid var(--border-hairline)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Live safety score recomputation delayed — showing cached Dhaka dispatch snapshot.</span>
                <button type="button" className="btn" onClick={() => setUiState("live")}>
                  Retry sync
                </button>
              </div>
            )}

            {(uiState === "live" || uiState === "partial_error") && (
              <>
                {section === "sos" && (
                  <>
                    <div className="kpi-strip">
                      <div className="kpi-cell">
                        <p className="kpi-label">Active SOS</p>
                        <p className="kpi-val tabular" style={{ color: "var(--signal-emergency)" }}>
                          {dataset.distressSignals.filter((s) => s.status === "active").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Claimed / En Route</p>
                        <p className="kpi-val tabular">
                          {dataset.distressSignals.filter((s) => s.status === "claimed" || s.status === "responding").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Safe Walk Escalations</p>
                        <p className="kpi-val tabular">
                          {dataset.distressSignals.filter((s) => s.trigger_source === "safe_walk_timeout").length}
                        </p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Target SLA</p>
                        <p className="kpi-val mono">05:00</p>
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
                      compact
                    />

                    <div className="daak-table-wrap">
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Alert ID</th>
                            <th>Area</th>
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
                                    {sig.id.slice(-6)}
                                  </button>
                                </td>
                                <td><strong>{sig.area_name}</strong></td>
                                <td>{formatStatusLabel(sig.trigger_source)}</td>
                                <td>{formatStatusLabel(sig.status)}</td>
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
                  <div className="daak-table-wrap">
                    <table className="daak-table">
                      <thead>
                        <tr>
                          <th>Headline</th>
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
                              <td>{rep.area_name}</td>
                              <td>{rep.reporter_display_name}</td>
                              <td className="tabular">{rep.corroboration_count}</td>
                              <td>
                                <span className={`pill ${rep.status === "resolved" ? "pill-safe" : "pill-normal"}`}>
                                  {formatStatusLabel(rep.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                    />
                    <div className="daak-table-wrap">
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Neighborhood</th>
                            <th>Safety Score (40/35/25)</th>
                            <th>Level</th>
                            <th>Active / Resolved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safetyScores.map((s) => (
                            <tr key={s.area}>
                              <td><strong>{s.area}</strong></td>
                              <td className="mono">{s.score}/100</td>
                              <td>
                                <span className={`pill ${s.score >= 75 ? "pill-safe" : "pill-warning"}`}>
                                  {s.level}
                                </span>
                              </td>
                              <td className="tabular">{s.reportCount} total · {s.resolvedCount} resolved</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {section === "handovers" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    <form onSubmit={handleCreateHandover} className="surface-panel" style={{ padding: "14px", display: "grid", gap: "10px" }}>
                      <h2 style={{ margin: 0, fontSize: "1rem" }}>Log Outgoing Shift Briefing</h2>
                      {role === "citizen" && (
                        <div role="note" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          Viewing read-only as citizen. Switch 1-Click Demo to Police or Admin to log handovers.
                        </div>
                      )}
                      <div>
                        <label htmlFor="ho-shift" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Shift window</label>
                        <input id="ho-shift" className="field-input" value={handoverShift} onChange={(e) => setHandoverShift(e.target.value)} required />
                      </div>
                      <div>
                        <label htmlFor="ho-summary" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Operational notes</label>
                        <textarea id="ho-summary" className="field-textarea" rows={3} value={handoverSummary} onChange={(e) => setHandoverSummary(e.target.value)} placeholder="Summarize active patrols, open SOS alerts, and priority Thanas" required />
                      </div>
                      <div>
                        <button type="submit" className="btn btn-primary" disabled={role === "citizen"}>
                          Save shift handover
                        </button>
                      </div>
                    </form>

                    {dataset.shiftHandovers.map((ho) => (
                      <div key={ho.id} className="surface-panel" style={{ padding: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <strong>{ho.shift_label}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>{ho.officer_name}</span>
                        </div>
                        <p className="prose-measure" style={{ margin: "0 0 8px" }}>{ho.summary}</p>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          Priority areas: {ho.priority_areas.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section === "false_reports" && (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {role !== "admin" && (
                      <div className="surface-muted" role="note" style={{ padding: "10px 14px", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>
                        Viewing read-only as {formatStatusLabel(role)}. Switch 1-Click Demo to Admin to moderate flagged reports.
                      </div>
                    )}
                    {falseQueue.length === 0 ? (
                      <div className="surface-panel" style={{ padding: "24px" }}>
                        <h2 style={{ margin: "0 0 6px", fontSize: "1rem" }}>All flagged reports have been triaged</h2>
                        <p className="prose-measure" style={{ margin: 0, color: "var(--ink-secondary)" }}>
                          No pending false-report alerts remain in the automated 5-factor heuristic queue.
                        </p>
                      </div>
                    ) : (
                      <div className="daak-table-wrap">
                        <table className="daak-table">
                          <thead>
                            <tr>
                              <th>Flagged Report</th>
                              <th>Area</th>
                              <th>Suspicion</th>
                              <th>Heuristic Reasons</th>
                              <th>Admin Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {falseQueue.map((rep) => (
                              <tr key={rep.id}>
                                <td><strong>{rep.title}</strong></td>
                                <td>{rep.area_name}</td>
                                <td>
                                  <span className="pill pill-breach mono">{rep.suspicion_score}/100</span>
                                </td>
                                <td className="prose-measure" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                                  {rep.suspicion_reasons.join(" · ")}
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      className="btn"
                                      disabled={role !== "admin"}
                                      onClick={() => handleModerateReport(rep.id, { flag_status: "cleared", status: "verified" })}
                                    >
                                      Clear & verify
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-emergency"
                                      disabled={role !== "admin"}
                                      onClick={() => handleModerateReport(rep.id, { flag_status: "confirmed_false", status: "rejected" })}
                                    >
                                      Confirm false
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {section === "criminals" && (
                  <div style={{ display: "grid", gap: "14px" }}>
                    {role !== "admin" && (
                      <div className="surface-muted" role="note" style={{ padding: "10px 14px", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>
                        Viewing read-only as {formatStatusLabel(role)}. Switch 1-Click Demo to Admin to edit the watchlist.
                      </div>
                    )}
                    <form onSubmit={handleAddCriminal} className="surface-panel" style={{ padding: "14px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <label htmlFor="crim-name" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Suspect name</label>
                        <input id="crim-name" className="field-input" value={newCrimName} onChange={(e) => setNewCrimName(e.target.value)} placeholder="Name (Synthetic Demo)" required />
                      </div>
                      <div style={{ flex: "1 1 160px" }}>
                        <label htmlFor="crim-area" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Last known area</label>
                        <input id="crim-area" className="field-input" value={newCrimArea} onChange={(e) => setNewCrimArea(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={role !== "admin"}>
                        Add watchlist entry
                      </button>
                    </form>

                    <div className="daak-table-wrap">
                      <table className="daak-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Last Known Area</th>
                            <th>Risk</th>
                            <th>Status</th>
                            <th>Admin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataset.criminals.map((crim) => (
                            <tr key={crim.id}>
                              <td><strong>{crim.full_name}</strong></td>
                              <td>{crim.last_known_area}</td>
                              <td>{formatStatusLabel(crim.risk_level)}</td>
                              <td>{formatStatusLabel(crim.status)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={role !== "admin"}
                                  onClick={() => handleToggleCriminalCustody(crim)}
                                >
                                  Toggle custody
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                        <p className="kpi-val tabular">{dataset.reports.filter((r) => r.status === "resolved").length}</p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Flagged False</p>
                        <p className="kpi-val tabular">{falseQueue.length}</p>
                      </div>
                      <div className="kpi-cell">
                        <p className="kpi-label">Wanted Watchlist</p>
                        <p className="kpi-val tabular">{dataset.criminals.filter((c) => c.status === "wanted").length}</p>
                      </div>
                    </div>
                    <div className="daak-table-wrap">
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
                    onTriggerSos={handleTriggerSosFromCitizen}
                    onSubmitReport={handleCitizenSubmitReport}
                    onCorroborate={handleCorroborate}
                    onEscalateWalk={handleEscalateWalk}
                    onCompleteWalk={handleCompleteWalk}
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
                  <div className="surface-muted" style={{ padding: "10px 12px", display: "grid", gap: "4px" }}>
                    <div>
                      <strong>{selectedSos.area_name}</strong> · {formatStatusLabel(selectedSos.status)}
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
                  <p className="prose-measure" style={{ margin: 0 }}>{selectedSos.note}</p>

                  <div>
                    <label htmlFor="unit-assign-input" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
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
                    <div style={{ display: "grid", gap: "6px", fontSize: "0.75rem" }}>
                      {selectedSos.dispatch_timeline.map((ev, idx) => (
                        <div key={idx} className="surface-muted" style={{ padding: "6px 8px" }}>
                          <strong>{formatStatusLabel(ev.status)}</strong> — {ev.note}
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
                  <p className="prose-measure" style={{ margin: 0 }}>{maskedSelectedReport.description}</p>
                  <div className="surface-muted" style={{ padding: "10px 12px", fontSize: "0.75rem", display: "grid", gap: "4px" }}>
                    <div>Area: {maskedSelectedReport.area_name}</div>
                    <div>Reporter: {maskedSelectedReport.reporter_display_name}</div>
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
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
