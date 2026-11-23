"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  computeAreaSafetyScores,
  CrimeReport,
  CriminalRecord,
  DemoProfile,
  EmergencyContact,
  findNearestStation,
  formatStatusLabel,
  haversineMeters,
  PoliceStation,
  resolveAreaCoordinates,
  SafeWalk,
} from "../lib/opsLogic";
import SpatialMapDeck from "./SpatialMapDeck";

interface CitizenPreviewDeckProps {
  citizenProfile: DemoProfile;
  stations: PoliceStation[];
  reports: CrimeReport[];
  safeWalks: SafeWalk[];
  criminals: CriminalRecord[];
  emergencyContacts: EmergencyContact[];
  theme?: "light" | "dark";
  onTriggerSos: (lat: number, lng: number, area: string, note: string) => void;
  onSubmitReport: (input: {
    category: CrimeReport["category"];
    severity: CrimeReport["severity"];
    title: string;
    description: string;
    area_name: string;
    lat?: number;
    lng?: number;
    is_anonymous_public: boolean;
  }) => void;
  onCorroborate: (reportId: string) => void;
  onStartWalk: (destinationName: string, etaMinutes: number) => void;
  onExtendWalk: (walkId: string, minutes: number) => void;
  onEscalateWalk: (walkId: string) => void;
  onCompleteWalk: (walkId: string) => void;
  onUpdateContact: (contact: EmergencyContact) => void;
  onRemoveContact: (contactId: string) => void;
  onAskAi?: (prompt: string, lat: number, lng: number) => Promise<string | null>;
}

type CitizenTab = "Home" | "Map" | "Reports" | "DaakAI";

const CITIZEN_POS = { lat: 23.7465, lng: 90.376 };

const REPORT_CATEGORIES: CrimeReport["category"][] = [
  "snatching",
  "theft",
  "harassment",
  "assault",
  "fraud",
  "vandalism",
  "suspicious_activity",
  "traffic_hazard",
  "other",
];

const SEVERITIES: CrimeReport["severity"][] = ["low", "medium", "high", "critical"];

const DHAKA_AREAS = [
  "Dhanmondi",
  "Mirpur 10",
  "Gulshan 2",
  "Uttara",
  "Mohammadpur",
  "Motijheel",
  "Banani",
];

const QUICK_AI_PROMPTS = [
  "Dhanmondi ektu safe naki?",
  "Nearest Thana phone number?",
  "Safe Walk timer ki?",
];

export default function CitizenPreviewDeck({
  citizenProfile,
  stations,
  reports,
  safeWalks,
  criminals,
  emergencyContacts,
  theme = "light",
  onTriggerSos,
  onSubmitReport,
  onCorroborate,
  onStartWalk,
  onExtendWalk,
  onEscalateWalk,
  onCompleteWalk,
  onUpdateContact,
  onRemoveContact,
  onAskAi,
}: CitizenPreviewDeckProps) {
  const [surfaceMode, setSurfaceMode] = useState<"web" | "phone">("web");
  const [activeTab, setActiveTab] = useState<CitizenTab>("Home");

  // SOS 5-second countdown
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [sosStatusNote, setSosStatusNote] = useState<string>(
    "Ready · Holds 5s safety cancel buffer before Police Control Room dispatch"
  );

  // Map selection & filter state
  const [mapCategory, setMapCategory] = useState<string>("all");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  // Safe Walk creation state
  const [walkDestination, setWalkDestination] = useState("Science Lab Crossing, Dhanmondi");
  const [walkMinutes, setWalkMinutes] = useState(15);

  // Crime report submission + pin picker state
  const [repCat, setRepCat] = useState<CrimeReport["category"]>("snatching");
  const [repSev, setRepSev] = useState<CrimeReport["severity"]>("high");
  const [repArea, setRepArea] = useState("Dhanmondi");
  const [repTitle, setRepTitle] = useState("");
  const [repDesc, setRepDesc] = useState("");
  const [repAnon, setRepAnon] = useState(false);
  const [pickedPin, setPickedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [reportBanner, setReportBanner] = useState<string | null>(null);

  // Corroboration tracking so each user gets crisp visual feedback
  const [corroboratedIds, setCorroboratedIds] = useState<Record<string, boolean>>({});

  // Trusted contact inline composer
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRel, setNewContactRel] = useState("Family");

  // DaakAI safety assistant state
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiThread, setAiThread] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: "Assalamu Alaikum. Ask in English, Bangla, or Banglish about area safety, nearest Thana helpline, or Safe Walk escorts.",
    },
  ]);

  // Refs for smooth anchor jumps when user clicks Citizen tabs in Full Web Surface mode
  const homeSectionRef = useRef<HTMLDivElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const reportsSectionRef = useRef<HTMLDivElement | null>(null);
  const aiSectionRef = useRef<HTMLDivElement | null>(null);

  const areaScores = useMemo(() => computeAreaSafetyScores(reports), [reports]);
  const dhanmondiScore = useMemo(() => {
    return (
      areaScores.find((a) => a.area.toLowerCase().includes("dhanmondi")) ??
      areaScores[0] ?? {
        area: "Dhanmondi",
        score: 78,
        level: "Safe" as const,
        reportCount: 2,
        resolvedCount: 1,
        pendingCount: 1,
        nightCount: 0,
        dominantCategory: "snatching",
        lat: 23.7465,
        lng: 90.376,
        factors: {
          crimeFrequency: 82,
          resolutionRate: 50,
          timeOfDay: 100,
        },
      }
    );
  }, [areaScores]);

  const nearestStation = useMemo(() => findNearestStation(stations, CITIZEN_POS.lat, CITIZEN_POS.lng), [stations]);

  const activeWalk = useMemo(
    () => safeWalks.find((w) => w.status === "active" || w.status === "escalated") ?? null,
    [safeWalks]
  );

  const nearbyReports = useMemo(() => {
    return [...reports]
      .filter((r) => r.status !== "rejected" && r.status !== "resolved")
      .map((r) => ({
        report: r,
        distMeters: Math.round(haversineMeters(CITIZEN_POS.lat, CITIZEN_POS.lng, r.lat, r.lng)),
      }))
      .sort((a, b) => a.distMeters - b.distMeters)
      .slice(0, 6);
  }, [reports]);

  // 5-second countdown effect
  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown <= 0) {
      setSosCountdown(null);
      const areaCoords = resolveAreaCoordinates(repArea);
      onTriggerSos(
        CITIZEN_POS.lat ?? areaCoords.lat,
        CITIZEN_POS.lng ?? areaCoords.lng,
        "Dhanmondi",
        "Citizen SOS triggered via 5s panic ring — immediate dispatch requested"
      );
      setSosStatusNote("Dispatched to Dhanmondi Model Police Station · Live telemetry active");
      return;
    }
    const timer = window.setTimeout(() => {
      setSosCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [onTriggerSos, repArea, sosCountdown]);

  const handleTabSelect = (tab: CitizenTab) => {
    setActiveTab(tab);
    if (surfaceMode === "web") {
      const target =
        tab === "Home"
          ? homeSectionRef.current
          : tab === "Map"
            ? mapSectionRef.current
            : tab === "Reports"
              ? reportsSectionRef.current
              : aiSectionRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handlePublishReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTitle.trim() || !repDesc.trim()) return;
    const coords = pickedPin ?? resolveAreaCoordinates(repArea);
    onSubmitReport({
      category: repCat,
      severity: repSev,
      title: repTitle.trim(),
      description: repDesc.trim(),
      area_name: repArea,
      lat: coords.lat,
      lng: coords.lng,
      is_anonymous_public: repAnon,
    });
    setRepTitle("");
    setRepDesc("");
    setPickedPin(null);
    setReportBanner(`Published ${formatStatusLabel(repCat)} alert in ${repArea} with GPS coordinates.`);
  };

  const handleSubmitAi = async (promptText?: string) => {
    const query = (promptText ?? aiInput).trim();
    if (!query || aiBusy) return;
    setAiInput("");
    setAiThread((prev) => [...prev, { role: "user", text: query }]);
    setAiBusy(true);

    let reply: string | null = null;
    if (onAskAi) {
      try {
        reply = await onAskAi(query, CITIZEN_POS.lat, CITIZEN_POS.lng);
      } catch {
        reply = null;
      }
    }

    if (!reply) {
      const q = query.toLowerCase();
      if (q.includes("safe") || q.includes("dhanmondi") || q.includes("mirpur")) {
        reply = `${dhanmondiScore.area} currently scores ${dhanmondiScore.score}/100 (${dhanmondiScore.level}) based on ${
          dhanmondiScore.reportCount
        } recent reports (${dhanmondiScore.resolvedCount} resolved). Nearest patrol base is ${
          nearestStation?.station.name_en ?? "Dhanmondi Model Police Station"
        } (${nearestStation ? Math.round(nearestStation.distanceMeters) : 850}m away).`;
      } else if (q.includes("thana") || q.includes("police") || q.includes("phone") || q.includes("number")) {
        reply = nearestStation
          ? `Nearest Thana: ${nearestStation.station.name_en} (${nearestStation.station.name_bn}) · Call ${nearestStation.station.phone} (${Math.round(
              nearestStation.distanceMeters
            )}m from Dhanmondi Rd 15). National helpline: 999.`
          : "National Emergency Helpline: 999 · Nearest Thana: Dhanmondi Model Police Station (+880-2-58616011).";
      } else if (q.includes("walk")) {
        reply =
          "Safe Walk shares a live heartbeat timer with Dhaka Control Room and your trusted contacts. Tap Check in safe upon arrival; if missed, SOS escalates automatically.";
      } else {
        reply = `Monitoring ${dhanmondiScore.area} (Safety ${dhanmondiScore.score}/100). Use the SOS ring for 999 police dispatch, or drop a map pin under Reports to alert nearby citizens.`;
      }
    }

    setAiThread((prev) => [...prev, { role: "assistant", text: reply }]);
    setAiBusy(false);
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim() || emergencyContacts.length >= 3) return;
    onUpdateContact({
      id: `ec-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: newContactRel.trim() || "Contact",
      notify_on_sos: true,
      notify_on_safe_walk: true,
    });
    setNewContactName("");
    setNewContactPhone("");
  };

  // Shared inner UI building blocks used across both Full Web Surface & Handheld Preview Mode
  const sosReactorCard = (
    <div className="ts-card" ref={homeSectionRef}>
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title">Emergency SOS 999</h3>
          <p className="section-header-sub">Instant GPS relay to Dhaka Police Control Room</p>
        </div>
        <span className="pill pill-breach">5s buffer</span>
      </div>

      <div className="sos-reactor-wrap">
        {sosCountdown === null ? (
          <button
            type="button"
            className="sos-reactor-btn"
            onClick={() => setSosCountdown(5)}
            aria-label="SOS Tap for 5s countdown"
          >
            <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>SOS</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 500, opacity: 0.92 }}>
              Tap for 5s countdown
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="sos-reactor-btn is-counting"
              onClick={() => setSosCountdown(0)}
              aria-label={`Dispatching SOS in ${sosCountdown} seconds`}
            >
              <span className="font-mono" style={{ fontSize: "2.25rem", fontWeight: 700, lineHeight: 1 }}>
                {sosCountdown}
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Dispatching now</span>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSosCountdown(null);
                setSosStatusNote("SOS canceled during 5s buffer · No alert sent");
              }}
            >
              Cancel SOS
            </button>
          </>
        )}

        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--p-muted)", maxWidth: "36ch" }}>
          {sosStatusNote}
        </p>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          <span className="pill pill-neutral font-mono">23.7465, 90.3760</span>
          <span className="pill pill-safe">
            {nearestStation
              ? `${nearestStation.station.name_en.replace(" Model Police Station", "")} · ${Math.round(
                  nearestStation.distanceMeters
                )}m`
              : "Dhanmondi Thana · 850m"}
          </span>
        </div>
      </div>
    </div>
  );

  const safeWalkCard = (
    <div className="ts-card">
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title">Safe Walk Escort</h3>
          <p className="section-header-sub">Live arrival timer backed by Control Room escalation</p>
        </div>
        <span
          className={`pill ${
            activeWalk
              ? activeWalk.status === "escalated"
                ? "pill-breach"
                : "pill-safe"
              : "pill-neutral"
          }`}
        >
          {activeWalk ? formatStatusLabel(activeWalk.status) : "Standby"}
        </span>
      </div>

      {activeWalk ? (
        <div className="surface-muted" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.8125rem", color: "var(--p-muted)" }}>Destination</div>
              <strong style={{ fontSize: "1rem" }}>{activeWalk.destination_name}</strong>
            </div>
            <span className="pill pill-normal font-mono">
              ETA {new Date(activeWalk.expected_arrival_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onCompleteWalk(activeWalk.id)}
            >
              Check in safe
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onExtendWalk(activeWalk.id, 5)}
            >
              +5m
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEscalateWalk(activeWalk.id)}
            >
              Simulate timeout
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label htmlFor="citizen-walk-dest" className="field-label">
              Destination in Dhaka
            </label>
            <input
              id="citizen-walk-dest"
              className="field-input"
              value={walkDestination}
              onChange={(e) => setWalkDestination(e.target.value)}
              placeholder="e.g. Kalabagan Bus Stand"
            />
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 130px" }}>
              <label htmlFor="citizen-walk-mins" className="field-label">
                Minutes
              </label>
              <select
                id="citizen-walk-mins"
                className="field-select"
                value={walkMinutes}
                onChange={(e) => setWalkMinutes(Number(e.target.value))}
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={25}>25 minutes</option>
                <option value={40}>40 minutes</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onStartWalk(walkDestination.trim() || "Home", walkMinutes)}
            >
              Start Safe Walk
              <span className="m-arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const nearbyFeedCard = (
    <div className="ts-card m-lift" ref={reportsSectionRef}>
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title">Nearby Verified Alerts</h3>
          <p className="section-header-sub">Within 1–5 km · Tap to corroborate eyewitness sightings</p>
        </div>
        <span className="pill pill-normal font-mono">{nearbyReports.length} nearby</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {nearbyReports.map(({ report, distMeters }) => {
          const corroborated = Boolean(corroboratedIds[report.id]);
          const within1Km = distMeters <= 1500;
          return (
            <div
              key={report.id}
              className="surface-muted"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <span className={`pill ${report.severity === "critical" || report.severity === "high" ? "pill-warning" : "pill-normal"}`}>
                    {formatStatusLabel(report.category)}
                  </span>
                  <span className="pill pill-neutral font-mono">{distMeters}m</span>
                  {within1Km && <span className="pill pill-safe">1km zone</span>}
                </div>
                <strong style={{ display: "block", fontSize: "0.9375rem" }}>{report.title}</strong>
                <span style={{ fontSize: "0.8125rem", color: "var(--p-muted)" }}>
                  {report.area_name} · {report.corroboration_count} witnesses
                </span>
              </div>

              <button
                type="button"
                className={`btn btn-sm ${corroborated ? "btn-primary" : ""}`}
                onClick={() => {
                  if (!corroborated) {
                    setCorroboratedIds((prev) => ({ ...prev, [report.id]: true }));
                    onCorroborate(report.id);
                  }
                }}
              >
                {corroborated ? "Corroborated" : "I saw this too"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const daakAiLitCard = (
    <div className="ts-panel--lit" ref={aiSectionRef}>
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title" style={{ color: "var(--p-inv-ink)" }}>
            DaakAI Safety Copilot
          </h3>
          <p className="section-header-sub" style={{ color: "var(--p-inv-muted)" }}>
            English, Bangla &amp; Banglish guidance grounded in live Dhaka Police data
          </p>
        </div>
        <span
          className="pill"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "var(--p-inv-ink)",
          }}
        >
          Live RAG
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {QUICK_AI_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            className="btn btn-sm"
            style={{
              background: "rgba(255,255,255,0.1)",
              borderColor: "rgba(255,255,255,0.22)",
              color: "var(--p-inv-ink)",
            }}
            onClick={() => handleSubmitAi(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxHeight: "230px",
          overflowY: "auto",
          padding: "12px",
          borderRadius: "14px",
          background: "rgba(0, 0, 0, 0.22)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        {aiThread.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: "9px 12px",
              borderRadius: "12px",
              fontSize: "0.875rem",
              background:
                msg.role === "user" ? "rgba(255, 255, 255, 0.18)" : "rgba(6, 59, 66, 0.72)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "var(--p-inv-ink)",
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitAi();
        }}
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <input
          id="daakai-input"
          className="field-input"
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            borderColor: "rgba(255, 255, 255, 0.24)",
            color: "#ffffff",
          }}
          placeholder="Ask DaakAI (e.g. Dhanmondi ektu safe naki?)..."
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn"
          disabled={aiBusy}
          style={{
            background: "var(--p-inv-accent)",
            borderColor: "var(--p-inv-accent)",
            color: "var(--p-inv-accent-ink)",
          }}
        >
          {aiBusy ? "Sending..." : "Ask DaakAI"}
        </button>
      </form>
    </div>
  );

  const reportComposerCard = (
    <div className="ts-card">
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title">File Incident Report</h3>
          <p className="section-header-sub">
            Drop an exact pin on the map or choose a Dhaka division
          </p>
        </div>
        <span className="pill pill-normal">GPS Tagged</span>
      </div>

      <SpatialMapDeck
        stations={stations}
        reports={reports}
        signals={[]}
        selectedId={selectedMapId}
        categoryFilter={mapCategory}
        onCategoryFilterChange={setMapCategory}
        onSelectReport={(id) => setSelectedMapId(id)}
        onSelectSos={(id) => setSelectedMapId(id)}
        compact
        heightPx={220}
        theme={theme}
        pickedPoint={pickedPin}
        onPickLocation={(lat, lng) => setPickedPin({ lat, lng })}
        showSearch={false}
      />

      <form onSubmit={handlePublishReport} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="cards-grid-3">
          <div>
            <label htmlFor="mob-cat" className="field-label">
              Category
            </label>
            <select
              id="mob-cat"
              className="field-select"
              value={repCat}
              onChange={(e) => setRepCat(e.target.value as CrimeReport["category"])}
            >
              {REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {formatStatusLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mob-area" className="field-label">
              Area
            </label>
            <select
              id="mob-area"
              className="field-select"
              value={repArea}
              onChange={(e) => setRepArea(e.target.value)}
            >
              {DHAKA_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mob-sev" className="field-label">
              Severity
            </label>
            <select
              id="mob-sev"
              className="field-select"
              value={repSev}
              onChange={(e) => setRepSev(e.target.value as CrimeReport["severity"])}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="mob-title" className="field-label">
            Incident headline
          </label>
          <input
            id="mob-title"
            className="field-input"
            value={repTitle}
            onChange={(e) => setRepTitle(e.target.value)}
            placeholder="e.g. Two-wheeler phone snatching near Satmasjid Rd"
            required
          />
        </div>

        <div>
          <label htmlFor="mob-desc" className="field-label">
            Details for patrol units &amp; nearby citizens
          </label>
          <textarea
            id="mob-desc"
            className="field-textarea"
            value={repDesc}
            onChange={(e) => setRepDesc(e.target.value)}
            placeholder="Describe direction of travel, landmarks, or immediate hazard..."
            required
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={repAnon}
              onChange={(e) => setRepAnon(e.target.checked)}
            />
            Mask my name publicly (police still verify identity)
          </label>

          <button type="submit" className="btn btn-primary">
            Publish report
            <span className="m-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>

        {reportBanner && (
          <div role="status" className="pill pill-safe" style={{ alignSelf: "flex-start" }}>
            {reportBanner}
          </div>
        )}
      </form>
    </div>
  );

  const contactsAndWatchlistCard = (
    <div className="ts-card m-lift">
      <div className="section-header-row">
        <div>
          <h3 className="section-header-title">Trusted Circle &amp; Alerts</h3>
          <p className="section-header-sub">
            Emergency SMS recipients ({emergencyContacts.length}/3) &amp; active Metro wanted alerts
          </p>
        </div>
        <span className="pill pill-neutral font-mono">{emergencyContacts.length}/3 active</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {emergencyContacts.map((c) => (
          <div
            key={c.id}
            className="surface-muted"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.9375rem" }}>{c.name}</strong>
              <div className="font-mono" style={{ fontSize: "0.8125rem", color: "var(--p-muted)" }}>
                {c.relation} · {c.phone}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onRemoveContact(c.id)}
              aria-label={`Remove contact ${c.name}`}
            >
              Remove
            </button>
          </div>
        ))}

        {emergencyContacts.length < 3 && (
          <form onSubmit={handleAddContact} style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            <input
              className="field-input"
              style={{ flex: "1 1 120px" }}
              placeholder="Contact name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
            />
            <input
              className="field-input"
              style={{ flex: "1 1 130px" }}
              placeholder="+88017..."
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
            />
            <input
              className="field-input"
              style={{ flex: "0 1 100px" }}
              placeholder="Relation"
              value={newContactRel}
              onChange={(e) => setNewContactRel(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Add
            </button>
          </form>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <strong style={{ fontSize: "0.875rem" }}>Police Wanted Watchlist</strong>
          <span className="pill pill-breach">{criminals.filter((c) => c.status === "wanted").length} active</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {criminals.slice(0, 2).map((crim) => (
            <div
              key={crim.id}
              className="surface-muted"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.875rem" }}>{crim.full_name}</strong>
                <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--p-muted)" }}>
                  Last seen: {crim.last_known_area}
                </span>
              </div>
              <span className={`pill ${crim.risk_level === "critical" ? "pill-breach" : "pill-warning"}`}>
                {formatStatusLabel(crim.risk_level)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section aria-label="Citizen Expo Web Preview" className="citizen-stage">
      {/* Citizen Command Status Banner + Surface Switcher */}
      <div className="ts-card citizen-top-strip">
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div
            className="conic-gauge"
            style={{
              background: `conic-gradient(var(--p-accent) ${dhanmondiScore.score * 3.6}deg, var(--p-surface) 0deg)`,
            }}
            aria-label={`Area safety score ${dhanmondiScore.score} out of 100`}
          >
            <div className="conic-gauge-inner font-mono">{dhanmondiScore.score}</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 className="section-header-title" style={{ fontSize: "1.35rem" }}>
                ডাক Citizen · {citizenProfile.full_name}
              </h2>
              <span className="pill pill-safe">
                {dhanmondiScore.area} · {dhanmondiScore.level}
              </span>
            </div>
            <p className="section-header-sub">
              Verified Citizen ID · Nearest Thana:{" "}
              <strong>{nearestStation?.station.name_en ?? "Dhanmondi Model Police Station"}</strong> (
              <span className="font-mono">{nearestStation?.station.phone ?? "+880-2-58616011"}</span>)
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Tab Strip (works as anchor jump in Full Web Surface, and route tabs in Mobile Handset Frame) */}
          <nav aria-label="Citizen mobile tabs" className="citizen-tab-bar">
            {(["Home", "Map", "Reports", "DaakAI"] as CitizenTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`citizen-tab-btn ${activeTab === tab ? "is-active" : ""}`}
                aria-pressed={activeTab === tab}
                onClick={() => handleTabSelect(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="role-pill-group" role="group" aria-label="Citizen view layout mode">
            <button
              type="button"
              className={`role-pill-btn ${surfaceMode === "web" ? "is-active" : ""}`}
              onClick={() => setSurfaceMode("web")}
            >
              Full Web Surface
            </button>
            <button
              type="button"
              className={`role-pill-btn ${surfaceMode === "phone" ? "is-active" : ""}`}
              onClick={() => setSurfaceMode("phone")}
            >
              Mobile Handset Frame
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Full-Screen 12-Column Citizen Bento (Default) */}
      {surfaceMode === "web" ? (
        <div className="citizen-bento-grid">
          {/* Split Hero Left (span-5): SOS Reactor + Safe Walk */}
          <div className="span-5" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sosReactorCard}
            {safeWalkCard}
          </div>

          {/* Split Hero Right (span-7): Live Street Map + 3-Factor Safety Telemetry */}
          <div className="span-7" ref={mapSectionRef} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SpatialMapDeck
              stations={stations}
              reports={reports}
              signals={[]}
              selectedId={selectedMapId}
              categoryFilter={mapCategory}
              onCategoryFilterChange={setMapCategory}
              onSelectReport={(id) => setSelectedMapId(id)}
              onSelectSos={(id) => setSelectedMapId(id)}
              heightPx={390}
              theme={theme}
              showSearch
            />

            <div className="ts-card ts-card--surface">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <strong style={{ fontSize: "0.9375rem" }}>
                  {dhanmondiScore.area} Safety Formula (3-Factor Transparent Telemetry)
                </strong>
                <span className="pill pill-normal font-mono">{dhanmondiScore.score} / 100</span>
              </div>

              <div className="cards-grid-3">
                <div className="factor-meter-row">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                    <span>Crime frequency (40%)</span>
                    <span className="font-mono">{dhanmondiScore.factors.crimeFrequency}%</span>
                  </div>
                  <div className="factor-track">
                    <div
                      className="factor-fill"
                      style={{
                        width: `${Math.min(100, dhanmondiScore.factors.crimeFrequency)}%`,
                        background: "var(--p-accent)",
                      }}
                    />
                  </div>
                </div>

                <div className="factor-meter-row">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                    <span>Resolution rate (35%)</span>
                    <span className="font-mono">{dhanmondiScore.factors.resolutionRate}%</span>
                  </div>
                  <div className="factor-track">
                    <div
                      className="factor-fill"
                      style={{
                        width: `${Math.min(100, dhanmondiScore.factors.resolutionRate)}%`,
                        background: "var(--safe)",
                      }}
                    />
                  </div>
                </div>

                <div className="factor-meter-row">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                    <span>Time-of-day safety (25%)</span>
                    <span className="font-mono">{dhanmondiScore.factors.timeOfDay}%</span>
                  </div>
                  <div className="factor-track">
                    <div
                      className="factor-fill"
                      style={{
                        width: `${Math.min(100, dhanmondiScore.factors.timeOfDay)}%`,
                        background: "var(--amber)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2x2 Bento Row 1 */}
          <div className="span-6">{nearbyFeedCard}</div>
          <div className="span-6">{daakAiLitCard}</div>

          {/* 2x2 Bento Row 2 */}
          <div className="span-6">{reportComposerCard}</div>
          <div className="span-6">{contactsAndWatchlistCard}</div>
        </div>
      ) : (
        /* Mode 2: Realistic Mobile Handset Frame Preview */
        <div className="phone-frame-stage">
          <div className="phone-chassis" aria-label="Mobile handset preview">
            <div className="phone-chassis-notch">
              <span>ডাক Mobile</span>
              <span>Dhanmondi · 999 Ready</span>
            </div>

            <div className="phone-chassis-scroll">
              {activeTab === "Home" && (
                <>
                  {sosReactorCard}
                  {safeWalkCard}
                  {contactsAndWatchlistCard}
                </>
              )}

              {activeTab === "Map" && (
                <SpatialMapDeck
                  stations={stations}
                  reports={reports}
                  signals={[]}
                  selectedId={selectedMapId}
                  categoryFilter={mapCategory}
                  onCategoryFilterChange={setMapCategory}
                  onSelectReport={(id) => setSelectedMapId(id)}
                  onSelectSos={(id) => setSelectedMapId(id)}
                  compact
                  heightPx={380}
                  theme={theme}
                  showSearch
                />
              )}

              {activeTab === "Reports" && (
                <>
                  {reportComposerCard}
                  {nearbyFeedCard}
                </>
              )}

              {activeTab === "DaakAI" && daakAiLitCard}
            </div>

            <div className="phone-chassis-nav">
              {(["Home", "Map", "Reports", "DaakAI"] as CitizenTab[]).map((tab) => (
                <button
                  key={`handset-${tab}`}
                  type="button"
                  className={`citizen-tab-btn ${activeTab === tab ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
