"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import SpatialMapDeck from "@/components/SpatialMapDeck";
import {
  computeAreaSafetyScores,
  findNearestStation,
  formatStatusLabel,
  haversineMeters,
  maskReportForRole,
  resolveAreaCoordinates,
  type CrimeReport,
  type CriminalRecord,
  type DemoProfile,
  type EmergencyContact,
  type PoliceStation,
  type SafeWalk,
} from "@/lib/opsLogic";

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

type MobileTab = "home" | "map" | "reports" | "ai";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timeLabel: string;
}

const WALK_DESTINATIONS = [
  "TSC, Dhaka University",
  "Mirpur-10 Metro Gate B",
  "Dhanmondi Road 27",
  "Uttara Azampur Stop",
  "Gulshan-2 Circle",
];

const QUICK_AI_PROMPTS = [
  "Mirpur 10 e raat e hata safe?",
  "ধানমন্ডি থানার নাম্বার কি?",
  "Snatching hole ki korbo?",
];

function CitizenPreviewDeck({
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
  const [tab, setTab] = useState<MobileTab>("home");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosSentBanner, setSosSentBanner] = useState<string | null>(null);
  const [corroboratedIds, setCorroboratedIds] = useState<string[]>([]);
  const [mapCatFilter, setMapCatFilter] = useState<string>("all");
  const [selectedMapItem, setSelectedMapItem] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>("Dhanmondi");

  // Safe Walk Creator
  const [walkDest, setWalkDest] = useState<string>(WALK_DESTINATIONS[0]);
  const [walkEta, setWalkEta] = useState<number>(15);

  // Contacts Editor
  const [newContactName, setNewContactName] = useState<string>("");
  const [newContactPhone, setNewContactPhone] = useState<string>("");

  // Report form state
  const [category, setCategory] = useState<CrimeReport["category"]>("snatching");
  const [severity, setSeverity] = useState<CrimeReport["severity"]>("high");
  const [areaName, setAreaName] = useState("Dhanmondi");
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number }>({
    lat: 23.7465,
    lng: 90.376,
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  // DaakAI chat thread
  const [aiPrompt, setAiPrompt] = useState("Mirpur 10 e raat e hata safe?");
  const [chatThread, setChatThread] = useState<ChatMessage[]>([
    {
      id: "ai-welcome",
      sender: "bot",
      text: "Hello, I am DaakAI. Ask in English, Bangla, or Banglish about Dhaka area safety, nearest Thana contacts, or emergency steps.",
      timeLabel: "Now",
    },
  ]);
  const [aiBusy, setAiBusy] = useState<boolean>(false);

  const userLat = 23.7465;
  const userLng = 90.376;
  const nearest = findNearestStation(stations, userLat, userLng);
  const safetyScores = useMemo(() => computeAreaSafetyScores(reports), [reports]);
  const dhanmondiScore =
    safetyScores.find((s) => s.area.toLowerCase().includes("dhanmondi"))?.score ?? 78;
  const activeWalk = safeWalks.find((w) => w.status === "active");
  const activeAreaDetail =
    safetyScores.find((s) => s.area === selectedArea) ?? safetyScores[0] ?? null;

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
      setSosSentBanner("SOS alert sent to Police Monitor & trusted contacts.");
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
      lat: pickedCoords.lat,
      lng: pickedCoords.lng,
      is_anonymous_public: isAnonymous,
    });
    setTitle("");
    setDescription("");
    setReportMsg("Report submitted to triage & Police queue.");
  };

  const sendAiQuery = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setChatThread((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: "user", text: trimmed, timeLabel: "Just now" },
    ]);
    setAiPrompt("");
    setAiBusy(true);

    let replyText: string | null = null;
    if (onAskAi) {
      replyText = await onAskAi(trimmed, userLat, userLng);
    }

    if (!replyText) {
      const lowered = trimmed.toLowerCase();
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
      const guidance = lowered.includes("snatch")
        ? "Move to a well-lit shop or police box immediately, keep IMEI/SIM block ready, and log a geo-pinned report for Police dispatch."
        : "Stay on well-lit arterial roads and start a Safe Walk escort timer so missed check-ins auto-escalate to 999.";
      replyText = `Area brief: ${localHits.length} recent report(s) matched. Nearest Thana: ${stationName} (${stationPhone}). ${guidance}`;
    }

    setAiBusy(false);
    setChatThread((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, sender: "bot", text: replyText as string, timeLabel: "DaakAI" },
    ]);
  };

  const handleAskAiForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendAiQuery(aiPrompt);
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    onUpdateContact({
      id: `ec-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: "Trusted Contact",
      notify_on_sos: true,
      notify_on_safe_walk: true,
    });
    setNewContactName("");
    setNewContactPhone("");
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
          width: "396px",
          maxWidth: "100%",
          height: "780px",
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
            <div style={{ fontSize: "0.75rem", color: "var(--ink-on-rail-muted)" }}>
              ডাক · Dhanmondi, Dhaka
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{citizenProfile.full_name}</div>
          </div>
          <span className="pill pill-safe tabular">Safety: {dhanmondiScore}</span>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
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
                gap: "8px",
              }}
            >
              <span>{sosSentBanner}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSosSentBanner(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {tab === "home" && (
            <>
              {/* Active Safe Walk OR New Safe Walk Creator */}
              {activeWalk ? (
                <div
                  className="surface-muted"
                  style={{
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "0.8125rem", display: "block" }}>
                        Safe Walk to {activeWalk.destination_name}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                        Auto-escalates to Police SOS if check-in is missed
                      </span>
                    </div>
                    <span className="pill pill-normal mono">Active</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ minHeight: "44px", flex: "1 1 110px" }}
                      onClick={() => onCompleteWalk(activeWalk.id)}
                    >
                      Check in safe
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ minHeight: "44px" }}
                      onClick={() => onExtendWalk(activeWalk.id, 5)}
                    >
                      +5m
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ minHeight: "44px", flex: "1 1 110px" }}
                      onClick={() => onEscalateWalk(activeWalk.id)}
                    >
                      Simulate timeout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="surface-muted" style={{ padding: "12px", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.8125rem" }}>Start Safe Walk Escort</strong>
                    <span className="pill pill-neutral">Timer guard</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 78px", gap: "6px" }}>
                    <select
                      aria-label="Safe Walk destination"
                      className="field-select"
                      style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                      value={walkDest}
                      onChange={(e) => setWalkDest(e.target.value)}
                    >
                      {WALK_DESTINATIONS.map((dest) => (
                        <option key={dest} value={dest}>
                          {dest}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Expected arrival minutes"
                      className="field-select"
                      style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                      value={walkEta}
                      onChange={(e) => setWalkEta(Number(e.target.value))}
                    >
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ minHeight: "44px" }}
                    onClick={() => onStartWalk(walkDest, walkEta)}
                  >
                    Start Safe Walk
                  </button>
                </div>
              )}

              {/* Tactile 5-Second Cancelable SOS Panic Ring */}
              <div
                className="surface-panel"
                style={{
                  padding: "16px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
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
                <h2 style={{ margin: "2px 0 8px", fontSize: "0.9375rem", fontWeight: 600 }}>
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

              {/* Trusted Emergency Contacts */}
              <div className="surface-panel" style={{ padding: "12px", display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>
                    Trusted Emergency Contacts ({emergencyContacts.length}/3)
                  </h3>
                  <span className="pill pill-safe">Auto-SMS on SOS</span>
                </div>
                {emergencyContacts.map((ec) => (
                  <div
                    key={ec.id}
                    className="surface-muted"
                    style={{
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem" }}>
                      <strong>{ec.name}</strong>
                      <div className="mono" style={{ color: "var(--ink-secondary)" }}>
                        {ec.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onRemoveContact(ec.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {emergencyContacts.length < 3 && (
                  <form onSubmit={handleAddContact} style={{ display: "grid", gap: "6px" }}>
                    <input
                      aria-label="Contact name"
                      className="field-input"
                      style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="Contact name (e.g. Mother)"
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        aria-label="Contact phone"
                        className="field-input"
                        style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        placeholder="+88017..."
                      />
                      <button type="submit" className="btn btn-primary btn-sm">
                        Add
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          {tab === "map" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <SpatialMapDeck
                stations={stations}
                reports={publicReports}
                signals={[]}
                selectedId={selectedMapItem}
                categoryFilter={mapCatFilter}
                onCategoryFilterChange={setMapCatFilter}
                onSelectReport={(id) => setSelectedMapItem(id)}
                onSelectSos={() => {}}
                compact
                heightPx={260}
                theme={theme}
                showSearch={false}
              />

              <h2 style={{ margin: "4px 0 0", fontSize: "0.9375rem" }}>Dhaka Area Safety Scores</h2>
              {safetyScores.map((item) => {
                const isSelected = activeAreaDetail?.area === item.area;
                return (
                  <button
                    key={item.area}
                    type="button"
                    className="surface-panel"
                    onClick={() => setSelectedArea(item.area)}
                    style={{
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: isSelected ? "var(--accent-interactive)" : "var(--border-hairline)",
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
                  </button>
                );
              })}

              {activeAreaDetail && (
                <div className="surface-muted" style={{ padding: "12px", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.8125rem" }}>
                      {activeAreaDetail.area} — 3-Factor Safety Breakdown
                    </strong>
                    <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                      {activeAreaDetail.score}/100
                    </span>
                  </div>
                  {[
                    { label: "Frequency (40%)", val: activeAreaDetail.factors.crimeFrequency, color: "var(--signal-info)" },
                    { label: "Resolution (35%)", val: activeAreaDetail.factors.resolutionRate, color: "var(--signal-safe)" },
                    { label: "Day/Night (25%)", val: activeAreaDetail.factors.timeOfDay, color: "var(--signal-warning)" },
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
              )}
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
              <SpatialMapDeck
                stations={stations}
                reports={[]}
                signals={[]}
                selectedId={null}
                categoryFilter="all"
                onCategoryFilterChange={() => {}}
                onSelectReport={() => {}}
                onSelectSos={() => {}}
                compact
                heightPx={190}
                theme={theme}
                pickedPoint={pickedCoords}
                onPickLocation={(lat, lng) => setPickedCoords({ lat, lng })}
                showSearch={false}
              />
              <div>
                <label htmlFor="mob-cat" className="field-label">
                  Category
                </label>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label htmlFor="mob-area" className="field-label">
                    Area
                  </label>
                  <select
                    id="mob-area"
                    className="field-select"
                    value={areaName}
                    onChange={(e) => {
                      const nextArea = e.target.value;
                      setAreaName(nextArea);
                      setPickedCoords(resolveAreaCoordinates(nextArea));
                    }}
                  >
                    <option value="Dhanmondi">Dhanmondi</option>
                    <option value="Mirpur-10">Mirpur-10</option>
                    <option value="Shahbagh">Shahbagh</option>
                    <option value="Mohammadpur">Mohammadpur</option>
                    <option value="Uttara">Uttara</option>
                    <option value="Gulshan">Gulshan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mob-sev" className="field-label">
                    Severity
                  </label>
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
              </div>
              <div>
                <label htmlFor="mob-title" className="field-label">
                  Headline
                </label>
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
                <label htmlFor="mob-desc" className="field-label">
                  Details
                </label>
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
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  minHeight: "44px",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
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

              {/* Quick Bangla/Banglish prompt chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {QUICK_AI_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="map-chip"
                    onClick={() => void sendAiQuery(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Multi-turn Chat Thread */}
              <div className="surface-panel" style={{ padding: "10px", display: "grid", gap: "8px" }}>
                {chatThread.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      fontSize: "0.8125rem",
                      alignSelf: msg.sender === "user" ? "end" : "start",
                      backgroundColor:
                        msg.sender === "user" ? "var(--bg-rail-committed)" : "var(--bg-rail-light)",
                      color: msg.sender === "user" ? "var(--ink-on-rail)" : "var(--ink-primary)",
                      border: "1px solid var(--border-hairline)",
                    }}
                  >
                    <div>{msg.text}</div>
                    <div style={{ fontSize: "0.6875rem", opacity: 0.78, marginTop: "3px" }}>
                      {msg.timeLabel}
                    </div>
                  </div>
                ))}
                {aiBusy && (
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                    DaakAI is checking PostGIS reports...
                  </div>
                )}
              </div>

              <form onSubmit={handleAskAiForm} style={{ display: "flex", gap: "6px" }}>
                <label htmlFor="daakai-input" className="skip-link">
                  Ask DaakAI about an area or emergency step
                </label>
                <input
                  id="daakai-input"
                  className="field-input"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ask in Bangla, Banglish, or English..."
                />
                <button type="submit" className="btn btn-primary" style={{ minHeight: "44px", flexShrink: 0 }}>
                  Ask DaakAI
                </button>
              </form>

              <h3 style={{ margin: "6px 0 2px", fontSize: "0.8125rem" }}>Emergency &amp; Watchlist</h3>
              <div className="surface-panel" style={{ padding: "10px 12px", fontSize: "0.75rem" }}>
                <div>
                  National Emergency: <strong className="mono">999</strong>
                </div>
                <div>
                  {nearest?.station.name_en}: <strong className="mono">{nearest?.station.phone}</strong>
                </div>
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
            Demo dataset · simulated Bangladesh incidents &amp; 999 relay
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
      <div className="surface-panel" style={{ flex: "1 1 280px", padding: "18px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700 }}>
          Live End-to-End Demo Flow
        </h2>
        <p className="prose-measure" style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--ink-secondary)" }}>
          This Expo Web Preview shares live state with the Police &amp; Admin Command Deck:
        </p>
        <ol
          className="prose-measure"
          style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.875rem" }}
        >
          <li>
            Tap <strong>SOS</strong> in the phone frame (watch the 5-second cancelable countdown) or tap{" "}
            <strong>Simulate timeout</strong> on the Safe Walk banner.
          </li>
          <li>
            Open the <strong>Map</strong> tab inside the phone frame to explore the live Dhaka street map, thermal
            crime heatmap, and 3-factor neighborhood safety score breakdown.
          </li>
          <li>
            Drop a pin on the map under <strong>Reports</strong> to submit an anonymous incident, then switch back to{" "}
            <strong>Police</strong> in the header to dispatch or verify.
          </li>
        </ol>
      </div>
    </div>
  );
}

export default React.memo(CitizenPreviewDeck);
