"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  computeAreaSafetyScores,
  findNearestStation,
  formatStatusLabel,
  haversineMeters,
  maskReportForRole,
  type CrimeReport,
  type CriminalRecord,
  type DemoProfile,
  type PoliceStation,
  type SafeWalk,
} from "@/lib/opsLogic";

interface CitizenPreviewDeckProps {
  citizenProfile: DemoProfile;
  stations: PoliceStation[];
  reports: CrimeReport[];
  safeWalks: SafeWalk[];
  criminals: CriminalRecord[];
  onTriggerSos: (lat: number, lng: number, area: string, note: string) => void;
  onSubmitReport: (input: {
    category: CrimeReport["category"];
    severity: CrimeReport["severity"];
    title: string;
    description: string;
    area_name: string;
    is_anonymous_public: boolean;
  }) => void;
  onCorroborate: (reportId: string) => void;
  onEscalateWalk: (walkId: string) => void;
  onCompleteWalk: (walkId: string) => void;
  onAskAi?: (prompt: string, lat: number, lng: number) => Promise<string | null>;
}

type MobileTab = "home" | "map" | "reports" | "ai";

function CitizenPreviewDeck({
  citizenProfile,
  stations,
  reports,
  safeWalks,
  criminals,
  onTriggerSos,
  onSubmitReport,
  onCorroborate,
  onEscalateWalk,
  onCompleteWalk,
  onAskAi,
}: CitizenPreviewDeckProps) {
  const [tab, setTab] = useState<MobileTab>("home");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosSentBanner, setSosSentBanner] = useState<string | null>(null);
  const [corroboratedIds, setCorroboratedIds] = useState<string[]>([]);

  // Report form state
  const [category, setCategory] = useState<CrimeReport["category"]>("snatching");
  const [severity, setSeverity] = useState<CrimeReport["severity"]>("high");
  const [areaName, setAreaName] = useState("Dhanmondi");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  // DaakAI chat state
  const [aiPrompt, setAiPrompt] = useState("Mirpur 10 e raat e hata safe?");
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const userLat = 23.7465;
  const userLng = 90.3760;
  const nearest = findNearestStation(stations, userLat, userLng);
  const safetyScores = computeAreaSafetyScores(reports);
  const dhanmondiScore = safetyScores.find((s) => s.area.toLowerCase().includes("dhanmondi"))?.score ?? 78;
  const activeWalk = safeWalks.find((w) => w.status === "active");

  const triggerSosRef = useRef(onTriggerSos);
  useEffect(() => {
    triggerSosRef.current = onTriggerSos;
  }, [onTriggerSos]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      triggerSosRef.current(
        userLat,
        userLng,
        "Dhanmondi",
        "Citizen SOS triggered from Mobile Preview (Simulated 999 Relay)"
      );
      setSosSentBanner("SOS alert sent to Police Monitor.");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handlePublishReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmitReport({
      category,
      severity,
      title: title.trim(),
      description: description.trim(),
      area_name: areaName,
      is_anonymous_public: isAnonymous,
    });
    setTitle("");
    setDescription("");
    setReportMsg("Report submitted to triage & Police queue.");
  };

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    if (onAskAi) {
      const liveReply = await onAskAi(aiPrompt, userLat, userLng);
      if (liveReply) {
        setAiResponse(liveReply);
        return;
      }
    }
    const lowered = aiPrompt.toLowerCase();
    const matchedStation = findNearestStation(stations, userLat, userLng, lowered);
    const stationAliases = matchedStation
      ? [
          matchedStation.station.name_en.toLowerCase(),
          ...matchedStation.station.aliases.map((a) => a.toLowerCase()),
        ]
      : [];
    const matchedAreaToken =
      stationAliases.find((alias) => lowered.includes(alias)) ??
      matchedStation?.station.name_en.toLowerCase().split(" ")[0] ??
      "dhanmondi";
    const localHits = reports.filter(
      (r) =>
        r.status !== "rejected" &&
        r.flag_status !== "flagged" &&
        r.flag_status !== "confirmed_false" &&
        (lowered.includes(r.area_name.toLowerCase().split("-")[0]) ||
          r.area_name.toLowerCase().includes(matchedAreaToken))
    );
    const stationName = matchedStation?.station.name_en ?? "Dhanmondi Model Police Station";
    const stationPhone = matchedStation?.station.phone ?? "999";
    setAiResponse(
      `Area brief: ${localHits.length} recent report(s) matched. Nearest Thana: ${stationName} (${stationPhone}). Stay on lit main roads and activate Safe Walk if walking alone.`
    );
  };

  const publicReports = reports
    .filter((r) => r.status === "verified" || r.status === "investigating" || r.status === "resolved")
    .map((r) => maskReportForRole(r, "citizen", citizenProfile.id));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
      {/* 390x844 Mobile Frame */}
      <div
        className="surface-panel"
        style={{
          width: "390px",
          maxWidth: "100%",
          height: "760px",
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        aria-label="Citizen Expo Web Preview"
      >
        {/* Top Context Bar */}
        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "var(--bg-rail-committed)",
            color: "var(--ink-on-rail)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>Dhanmondi, Dhaka</div>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
              {citizenProfile.full_name}
            </div>
          </div>
          <span className="pill pill-safe tabular">Safety: {dhanmondiScore}</span>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {sosSentBanner && (
            <div
              role="status"
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--signal-emergency-soft)",
                color: "var(--signal-emergency)",
                border: "1px solid var(--signal-emergency)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{sosSentBanner}</span>
              <button
                type="button"
                className="btn"
                onClick={() => setSosSentBanner(null)}
                style={{ minHeight: "40px", minWidth: "44px", padding: "4px 10px" }}
              >
                Dismiss
              </button>
            </div>
          )}

          {tab === "home" && (
            <>
              {activeWalk && (
                <div
                  className="surface-muted"
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.8125rem" }}>
                      Safe Walk: {activeWalk.destination_name}
                    </strong>
                    <span className="pill pill-normal mono">Active</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ minHeight: "44px", flex: 1 }}
                      onClick={() => onCompleteWalk(activeWalk.id)}
                    >
                      Check in safe
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ minHeight: "44px", flex: 1 }}
                      onClick={() => onEscalateWalk(activeWalk.id)}
                    >
                      Simulate timeout
                    </button>
                  </div>
                </div>
              )}

              {/* Tactile 5-Second Cancelable SOS Panic Ring */}
              <div
                className="surface-panel"
                style={{
                  padding: "18px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "center",
                }}
              >
                {countdown === null ? (
                  <button
                    type="button"
                    onClick={() => setCountdown(5)}
                    className="btn-emergency"
                    style={{
                      width: "148px",
                      height: "148px",
                      borderRadius: "999px",
                      backgroundColor: "var(--signal-emergency-fill)",
                      color: "var(--signal-emergency-on-fill)",
                      border: "4px solid var(--signal-emergency-soft)",
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span>SOS</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 500, marginTop: "4px" }}>
                      Tap for 5s countdown
                    </span>
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <div
                      className="mono"
                      role="timer"
                      aria-live="assertive"
                      aria-atomic="true"
                      aria-label={`SOS sending in ${countdown} seconds`}
                      style={{
                        width: "120px",
                        height: "120px",
                        borderRadius: "999px",
                        backgroundColor: "var(--signal-emergency-soft)",
                        color: "var(--signal-emergency)",
                        border: "3px solid var(--signal-emergency)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        fontWeight: 700,
                      }}
                    >
                      {countdown}
                    </div>
                    <button
                      type="button"
                      className="btn"
                      style={{ minHeight: "48px", minWidth: "180px", fontWeight: 700 }}
                      onClick={() => setCountdown(null)}
                    >
                      Cancel SOS
                    </button>
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                  Nearest Thana: {nearest?.station.name_en} ({nearest?.distanceMeters} m) · Demo simulated 999
                </div>
              </div>

              {/* Nearby Reports with 1 km Corroboration */}
              <div>
                <h2 style={{ margin: "4px 0 8px", fontSize: "0.9375rem", fontWeight: 600 }}>
                  Nearby Verified Reports
                </h2>
                <div className="surface-panel" style={{ overflow: "hidden" }}>
                  {publicReports.slice(0, 4).map((rep) => {
                    const dist = haversineMeters(userLat, userLng, rep.lat, rep.lng);
                    const within1Km = dist <= 1000;
                    const alreadyCorroborated = corroboratedIds.includes(rep.id);
                    const isOwn = rep.reporter_id === citizenProfile.id;
                    return (
                      <div
                        key={rep.id}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--border-hairline)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <strong style={{ fontSize: "0.8125rem" }}>{rep.title}</strong>
                          <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                            {dist}m
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                          {rep.area_name} · By {rep.reporter_display_name} · {formatStatusLabel(rep.status)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ minHeight: "44px", fontSize: "0.75rem" }}
                            disabled={!within1Km || isOwn || alreadyCorroborated}
                            onClick={() => {
                              setCorroboratedIds((prev) => (prev.includes(rep.id) ? prev : [...prev, rep.id]));
                              onCorroborate(rep.id);
                            }}
                          >
                            {alreadyCorroborated
                              ? `Corroborated (${rep.corroboration_count})`
                              : within1Km
                              ? `I saw this too (${rep.corroboration_count})`
                              : `Outside 1 km (${rep.corroboration_count})`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === "map" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "0.9375rem" }}>Dhaka Area Safety Scores</h2>
              {safetyScores.map((item) => (
                <div
                  key={item.area}
                  className="surface-panel"
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.area}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                      {item.reportCount} reports · {item.resolvedCount} resolved
                    </div>
                  </div>
                  <span className={`pill tabular ${item.score >= 75 ? "pill-safe" : "pill-warning"}`}>
                    {item.score} · {item.level}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "reports" && (
            <form onSubmit={handlePublishReport} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "0.9375rem" }}>Report an Incident</h2>
              {reportMsg && (
                <div className="pill pill-safe" style={{ padding: "8px 10px", borderRadius: "6px" }}>
                  {reportMsg}
                </div>
              )}
              <div>
                <label htmlFor="mob-cat" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Category</label>
                <select
                  id="mob-cat"
                  className="field-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CrimeReport["category"])}
                >
                  <option value="snatching">Snatching</option>
                  <option value="harassment">Harassment</option>
                  <option value="theft">Theft</option>
                  <option value="fraud">Fraud</option>
                  <option value="traffic_hazard">Traffic hazard</option>
                </select>
              </div>
              <div>
                <label htmlFor="mob-area" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Area</label>
                <select id="mob-area" className="field-select" value={areaName} onChange={(e) => setAreaName(e.target.value)}>
                  <option value="Dhanmondi">Dhanmondi</option>
                  <option value="Mirpur-10">Mirpur-10</option>
                  <option value="Shahbagh">Shahbagh</option>
                  <option value="Mohammadpur">Mohammadpur</option>
                  <option value="Uttara">Uttara</option>
                  <option value="Gulshan">Gulshan</option>
                </select>
              </div>
              <div>
                <label htmlFor="mob-sev" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Severity</label>
                <select
                  id="mob-sev"
                  className="field-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as CrimeReport["severity"])}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label htmlFor="mob-title" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Headline</label>
                <input
                  id="mob-title"
                  className="field-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Snatching near Science Lab"
                  required
                />
              </div>
              <div>
                <label htmlFor="mob-desc" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Details</label>
                <textarea
                  id="mob-desc"
                  className="field-textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe landmark, direction, and time"
                  required
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "0.8125rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  style={{ width: "18px", height: "18px", flexShrink: 0 }}
                />
                Hide my name publicly (retained internally for Police)
              </label>
              <button type="submit" className="btn btn-primary" style={{ minHeight: "48px" }}>
                Publish report
              </button>
            </form>
          )}

          {tab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "0.9375rem" }}>DaakAI (Bangla / Banglish)</h2>
              <form onSubmit={handleAskAi} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor="daakai-input" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  Ask about an area or emergency step
                </label>
                <input
                  id="daakai-input"
                  className="field-input"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ minHeight: "44px" }}>
                  Ask DaakAI
                </button>
              </form>
              {aiResponse && (
                <div className="surface-muted" style={{ padding: "10px 12px", fontSize: "0.8125rem" }}>
                  {aiResponse}
                </div>
              )}

              <h3 style={{ margin: "6px 0 2px", fontSize: "0.8125rem" }}>Emergency & Watchlist</h3>
              <div className="surface-panel" style={{ padding: "10px 12px", fontSize: "0.75rem" }}>
                <div>National Emergency: <strong className="mono">999</strong></div>
                <div>{nearest?.station.name_en}: <strong className="mono">{nearest?.station.phone}</strong></div>
              </div>
              {criminals
                .filter((c) => c.status !== "archived")
                .map((c) => (
                  <div key={c.id} className="surface-panel" style={{ padding: "8px 10px", fontSize: "0.75rem" }}>
                    <strong>{c.full_name}</strong> · {c.last_known_area} ({formatStatusLabel(c.status)})
                  </div>
                ))}
            </div>
          )}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-hairline)",
              fontSize: "0.6875rem",
              color: "var(--ink-secondary)",
              textAlign: "center",
            }}
          >
            Demo dataset · simulated Bangladesh incidents & 999 relay
          </div>
        </div>

        {/* Native 4-Tab Bottom Bar */}
        <nav
          aria-label="Citizen mobile tabs"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderTop: "1px solid var(--border-hairline)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          {(["home", "map", "reports", "ai"] as MobileTab[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-current={tab === item ? "page" : undefined}
              onClick={() => setTab(item)}
              style={{
                minHeight: "50px",
                border: "none",
                background: tab === item ? "var(--bg-rail-light)" : "transparent",
                color: tab === item ? "var(--accent-interactive)" : "var(--ink-secondary)",
                fontWeight: tab === item ? 700 : 500,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {item === "home" ? "Home" : item === "map" ? "Map" : item === "reports" ? "Reports" : "DaakAI"}
            </button>
          ))}
        </nav>
      </div>

      {/* Live Walkthrough Instructions for Portfolio Reviewers */}
      <div className="surface-panel" style={{ flex: "1 1 280px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 600 }}>
          Live End-to-End Demo Flow
        </h2>
        <p className="prose-measure" style={{ margin: "0 0 10px", fontSize: "0.875rem", color: "var(--ink-secondary)" }}>
          This Expo Web Preview shares live state with the Police & Admin Command Deck:
        </p>
        <ol className="prose-measure" style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.875rem" }}>
          <li>Tap <strong>SOS</strong> in the phone frame (watch the 5-second cancelable countdown) or tap <strong>Simulate timeout</strong> on the Safe Walk banner.</li>
          <li>Switch back to <strong>SOS Monitor</strong> in the left rail (or select <strong>Demo Police</strong>) to watch the new alert appear with a live <span className="mono">MM:SS</span> SLA chronometer.</li>
          <li>Submit an anonymous report under <strong>Reports</strong> and verify that public views mask the citizen identity while Police/Admin triage retains internal accountability.</li>
        </ol>
      </div>
    </div>
  );
}

export default React.memo(CitizenPreviewDeck);
