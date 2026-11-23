"use client";

import React, { useEffect, useState } from "react";
import CitizenPreviewDeck from "@/components/CitizenPreviewDeck";
import SpatialMapDeck from "@/components/SpatialMapDeck";
import {
  computeAreaSafetyScores,
  createInitialDemoDataset,
  filterAndSortFalseReports,
  formatSlaChronometer,
  maskReportForRole,
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
  const [dataset, setDataset] = useState<DaakDataset>(() => createInitialDemoDataset());
  const [role, setRole] = useState<UserRole>("police");
  const [section, setSection] = useState<NavSection>("sos");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [uiState, setUiState] = useState<UiStateMode>("live");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
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
  };

  const handleDispatchSos = (
    sosId: string,
    nextStatus: DistressSignal["status"],
    unitName?: string
  ) => {
    const nowIso = new Date().toISOString();
    setDataset((prev) => ({
      ...prev,
      distressSignals: prev.distressSignals.map((sig) =>
        sig.id !== sosId
          ? sig
          : {
              ...sig,
              status: nextStatus,
              claimed_by: sig.claimed_by ?? currentProfile.id,
              assigned_unit: unitName ?? sig.assigned_unit ?? unitDraft,
              dispatch_timeline: [
                ...sig.dispatch_timeline,
                {
                  at: nowIso,
                  status: nextStatus,
                  note: `${currentProfile.full_name} set status to ${nextStatus}`,
                },
              ],
            }
      ),
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          actor_role: role,
          action: `sos.${nextStatus}`,
          target_type: "distress_signals",
          summary: `${currentProfile.full_name} updated SOS to ${nextStatus}`,
          created_at: nowIso,
        },
        ...prev.activityLogs,
      ],
    }));
    setStatusNotice(`Alert updated to ${nextStatus}`);
  };

  const handleModerateReport = (
    reportId: string,
    updates: Partial<Pick<CrimeReport, "status" | "flag_status" | "moderation_note">>
  ) => {
    const nowIso = new Date().toISOString();
    setDataset((prev) => ({
      ...prev,
      reports: prev.reports.map((rep) => (rep.id === reportId ? { ...rep, ...updates } : rep)),
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          actor_role: role,
          action: "report.moderated",
          target_type: "reports",
          summary: `Report moderated (${updates.status ?? updates.flag_status})`,
          created_at: nowIso,
        },
        ...prev.activityLogs,
      ],
    }));
    setStatusNotice("Report moderation saved");
  };

  const handleTriggerSosFromCitizen = (lat: number, lng: number, area: string, note: string) => {
    const nowIso = new Date().toISOString();
    const newId = `sos-${Date.now()}`;
    const created: DistressSignal = {
      id: newId,
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
          id: `log-${Date.now()}`,
          actor_role: "citizen",
          action: "sos.triggered",
          target_type: "distress_signals",
          summary: `New SOS triggered in ${area}`,
          created_at: nowIso,
        },
        ...prev.activityLogs,
      ],
    }));
    setSelectedSosId(newId);
    setSelectedReportId(null);
  };

  const handleCitizenSubmitReport = (input: {
    category: CrimeReport["category"];
    severity: CrimeReport["severity"];
    title: string;
    description: string;
    area_name: string;
    is_anonymous_public: boolean;
  }) => {
    const nowIso = new Date().toISOString();
    const suspicious = /http|bit\.ly|promo|test test/i.test(`${input.title} ${input.description}`);
    const newRep: CrimeReport = {
      id: `rep-${Date.now()}`,
      reporter_id: dataset.profiles.citizen.id,
      reporter_display_name: dataset.profiles.citizen.full_name,
      is_anonymous_public: input.is_anonymous_public,
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      area_name: input.area_name,
      lat: 23.7465,
      lng: 90.376,
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
  };

  const handleCorroborate = (reportId: string) => {
    setDataset((prev) => ({
      ...prev,
      reports: prev.reports.map((r) =>
        r.id === reportId ? { ...r, corroboration_count: r.corroboration_count + 1 } : r
      ),
    }));
    setStatusNotice("Corroboration recorded (+1 witness within 1 km)");
  };

  const handleEscalateWalk = (walkId: string) => {
    const walk = dataset.safeWalks.find((w) => w.id === walkId);
    if (!walk) return;
    handleTriggerSosFromCitizen(walk.lat, walk.lng, "Dhanmondi", `Safe Walk timeout to ${walk.destination_name}`);
    setDataset((prev) => ({
      ...prev,
      safeWalks: prev.safeWalks.map((w) => (w.id === walkId ? { ...w, status: "escalated" } : w)),
    }));
  };

  const handleCompleteWalk = (walkId: string) => {
    setDataset((prev) => ({
      ...prev,
      safeWalks: prev.safeWalks.map((w) => (w.id === walkId ? { ...w, status: "completed" } : w)),
    }));
    setStatusNotice("Safe Walk completed safely");
  };

  const handleCreateHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverSummary.trim()) return;
    setDataset((prev) => ({
      ...prev,
      shiftHandovers: [
        {
          id: `ho-${Date.now()}`,
          officer_name: currentProfile.full_name,
          shift_label: handoverShift,
          summary: handoverSummary.trim(),
          priority_areas: ["Dhanmondi", "Mirpur-10"],
          created_at: new Date().toISOString(),
        },
        ...prev.shiftHandovers,
      ],
    }));
    setHandoverSummary("");
    setStatusNotice("Shift handover logged");
  };

  const handleAddCriminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrimName.trim()) return;
    const item: CriminalRecord = {
      id: `crim-${Date.now()}`,
      full_name: newCrimName.trim(),
      aliases: [],
      crime_categories: ["snatching"],
      risk_level: "high",
      last_known_area: newCrimArea,
      status: "wanted",
      details: "Added via Admin Watchlist console (synthetic demo).",
    };
    setDataset((prev) => ({ ...prev, criminals: [item, ...prev.criminals] }));
    setNewCrimName("");
    setStatusNotice("Watchlist entry created");
  };

  const activeSosList = dataset.distressSignals.filter((s) =>
    ["active", "claimed", "responding"].includes(s.status)
  );
  const falseQueue = filterAndSortFalseReports(dataset.reports);
  const safetyScores = computeAreaSafetyScores(dataset.reports);
  const showDrawer =
    uiState === "live" && (section === "sos" || section === "reports") && Boolean(selectedSos || selectedReport);

  return (
    <div className="daak-shell">
      {/* Left Navigation Rail */}
      <aside className="daak-rail" aria-label="Primary navigation">
        <div className="daak-brand">
          <div>
            <h1 className="daak-brand-title">Daak v2</h1>
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Bangladesh Civic Dispatch</div>
          </div>
          <span className="mono" style={{ fontSize: "0.75rem", opacity: 0.8 }}>999</span>
        </div>

        <nav className="daak-nav-group" aria-label="Dispatch views">
          <p className="daak-nav-heading">Dispatch Operations</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "sos" ? "page" : undefined}
            onClick={() => setSection("sos")}
          >
            <span>SOS Monitor</span>
            <span className="mono">{activeSosList.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "reports" ? "page" : undefined}
            onClick={() => setSection("reports")}
          >
            <span>Crime Reports</span>
            <span className="mono">{dataset.reports.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "heatmap" ? "page" : undefined}
            onClick={() => setSection("heatmap")}
          >
            <span>Spatial Heatmap</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "handovers" ? "page" : undefined}
            onClick={() => setSection("handovers")}
          >
            <span>Shift Handovers</span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "10px" }}>Admin Governance</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "false_reports" ? "page" : undefined}
            onClick={() => setSection("false_reports")}
          >
            <span>False-Report Queue</span>
            <span className="mono">{falseQueue.length}</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "criminals" ? "page" : undefined}
            onClick={() => setSection("criminals")}
          >
            <span>Criminal Watchlist</span>
          </button>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "analytics" ? "page" : undefined}
            onClick={() => setSection("analytics")}
          >
            <span>Analytics & Logs</span>
          </button>

          <p className="daak-nav-heading" style={{ marginTop: "10px" }}>Mobile Surface</p>
          <button
            type="button"
            className="daak-nav-btn"
            aria-current={section === "citizen_preview" ? "page" : undefined}
            onClick={() => setSection("citizen_preview")}
          >
            <span>Citizen Mobile Preview</span>
          </button>
        </nav>

        <div style={{ marginTop: "auto", fontSize: "0.75rem", opacity: 0.78 }}>
          Synthetic Bangladesh demo dataset · simulated 999 relay
        </div>
      </aside>

      {/* Main Content + Topbar + Right Inspector */}
      <div className="daak-main-wrap">
        <header className="daak-topbar">
          <div>
            <h2 className="daak-topbar-title">
              {section === "sos" && "Live SOS Monitor & SLA Dispatch"}
              {section === "reports" && "Crime Reports & Community Corroboration"}
              {section === "heatmap" && "Dhaka PostGIS Heatmap & Area Safety"}
              {section === "handovers" && "Police Shift Handover Log"}
              {section === "false_reports" && "Automated 5-Factor False-Report Triage"}
              {section === "criminals" && "Criminal Watchlist Management"}
              {section === "analytics" && "Operational Analytics & Audit Trail"}
              {section === "citizen_preview" && "Citizen Mobile App (Expo Web Preview)"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
              Signed in: <strong>{currentProfile.full_name}</strong> ({currentProfile.role})
              {statusNotice ? ` · ${statusNotice}` : ""}
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
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
          </div>
        </header>

        <div className={`daak-workspace ${showDrawer ? "" : "no-drawer"}`}>
          <main className="daak-center">
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
                <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>No active records in this queue</h3>
                <p style={{ margin: "0 0 12px", color: "var(--ink-secondary)" }}>
                  Open Citizen Mobile Preview to trigger a simulated SOS or report, or restore live demo data.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
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
                <h3 style={{ margin: "0 0 6px", color: "var(--signal-emergency)" }}>
                  Dispatch stream unavailable
                </h3>
                <p style={{ margin: "0 0 12px", color: "var(--ink-secondary)" }}>
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
                      onSelectReport={(id) => {
                        setSelectedReportId(id);
                        setSelectedSosId(null);
                      }}
                      onSelectSos={(id) => {
                        setSelectedSosId(id);
                        setSelectedReportId(null);
                      }}
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
                                onClick={() => {
                                  setSelectedSosId(sig.id);
                                  setSelectedReportId(null);
                                }}
                              >
                                <td className="mono">{sig.id.slice(-6)}</td>
                                <td><strong>{sig.area_name}</strong></td>
                                <td>{sig.trigger_source === "safe_walk_timeout" ? "Safe Walk Timeout" : "Panic SOS"}</td>
                                <td>{sig.status}</td>
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
                        {dataset.reports.map((raw) => {
                          const rep = maskReportForRole(raw, role, currentProfile.id);
                          return (
                            <tr
                              key={rep.id}
                              data-selected={selectedReportId === rep.id}
                              onClick={() => {
                                setSelectedReportId(rep.id);
                                setSelectedSosId(null);
                              }}
                            >
                              <td><strong>{rep.title}</strong></td>
                              <td>{rep.area_name}</td>
                              <td>{rep.reporter_display_name}</td>
                              <td className="tabular">{rep.corroboration_count}</td>
                              <td>
                                <span className={`pill ${rep.status === "resolved" ? "pill-safe" : "pill-normal"}`}>
                                  {rep.status}
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
                      onSelectReport={(id) => {
                        setSelectedReportId(id);
                        setSection("reports");
                      }}
                      onSelectSos={(id) => {
                        setSelectedSosId(id);
                        setSection("sos");
                      }}
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
                      <h3 style={{ margin: 0, fontSize: "1rem" }}>Log Outgoing Shift Briefing</h3>
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
                        <p style={{ margin: "0 0 8px" }}>{ho.summary}</p>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          Priority areas: {ho.priority_areas.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section === "false_reports" && (
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
                            <td style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
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

                {section === "criminals" && (
                  <div style={{ display: "grid", gap: "14px" }}>
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
                              <td>{crim.risk_level}</td>
                              <td>{crim.status}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={role !== "admin"}
                                  onClick={() =>
                                    setDataset((prev) => ({
                                      ...prev,
                                      criminals: prev.criminals.map((c) =>
                                        c.id === crim.id
                                          ? { ...c, status: c.status === "wanted" ? "in_custody" : "wanted" }
                                          : c
                                      ),
                                    }))
                                  }
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
                              <td>{log.actor_role}</td>
                              <td>{log.target_type}</td>
                              <td>{log.summary}</td>
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
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>
                      Case <span className="mono">#{selectedSos.id.slice(-6)}</span>
                    </h3>
                    <button type="button" className="btn" onClick={() => setSelectedSosId(null)}>
                      Close
                    </button>
                  </div>
                  <div className="surface-muted" style={{ padding: "10px 12px", display: "grid", gap: "4px" }}>
                    <div><strong>{selectedSos.area_name}</strong> · {selectedSos.status}</div>
                    <div className="mono" style={{ fontSize: "0.75rem" }}>
                      {selectedSos.lat.toFixed(4)}, {selectedSos.lng.toFixed(4)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                      Citizen: {selectedSos.citizen_name} · Battery: {selectedSos.battery_level ?? "N/A"}%
                    </div>
                  </div>
                  <p style={{ margin: 0 }}>{selectedSos.note}</p>

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
                    <h4 style={{ margin: "6px 0", fontSize: "0.8125rem" }}>Dispatch Timeline</h4>
                    <div style={{ display: "grid", gap: "6px", fontSize: "0.75rem" }}>
                      {selectedSos.dispatch_timeline.map((ev, idx) => (
                        <div key={idx} className="surface-muted" style={{ padding: "6px 8px" }}>
                          <strong>{ev.status}</strong> — {ev.note}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedReport && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Report Inspector</h3>
                    <button type="button" className="btn" onClick={() => setSelectedReportId(null)}>
                      Close
                    </button>
                  </div>
                  <strong>{selectedReport.title}</strong>
                  <p style={{ margin: 0 }}>{selectedReport.description}</p>
                  <div className="surface-muted" style={{ padding: "10px 12px", fontSize: "0.75rem" }}>
                    <div>Area: {selectedReport.area_name}</div>
                    <div>Witnesses (&lt;= 1 km): {selectedReport.corroboration_count}</div>
                    {role !== "citizen" && <div>Suspicion score: {selectedReport.suspicion_score}/100</div>}
                  </div>
                  {role !== "citizen" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleModerateReport(selectedReport.id, { status: "verified" })}
                      >
                        Verify report
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleModerateReport(selectedReport.id, { status: "investigating" })}
                      >
                        Mark investigating
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleModerateReport(selectedReport.id, { status: "resolved" })}
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
