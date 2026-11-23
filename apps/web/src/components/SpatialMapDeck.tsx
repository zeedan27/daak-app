"use client";

import React from "react";
import type { CrimeReport, DistressSignal, PoliceStation } from "@/lib/opsLogic";

interface SpatialMapDeckProps {
  stations: PoliceStation[];
  reports: CrimeReport[];
  signals: DistressSignal[];
  selectedId: string | null;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onSelectReport: (id: string) => void;
  onSelectSos: (id: string) => void;
  compact?: boolean;
}

const DHAKA_BOUNDS = {
  minLat: 23.715,
  maxLat: 23.890,
  minLng: 90.345,
  maxLng: 90.435,
};

function projectPoint(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - DHAKA_BOUNDS.minLng) / (DHAKA_BOUNDS.maxLng - DHAKA_BOUNDS.minLng)) * 100;
  const y = (1 - (lat - DHAKA_BOUNDS.minLat) / (DHAKA_BOUNDS.maxLat - DHAKA_BOUNDS.minLat)) * 100;
  return {
    x: Math.min(95, Math.max(5, x)),
    y: Math.min(94, Math.max(6, y)),
  };
}

function SpatialMapDeck({
  stations,
  reports,
  signals,
  selectedId,
  categoryFilter,
  onCategoryFilterChange,
  onSelectReport,
  onSelectSos,
  compact = false,
}: SpatialMapDeckProps) {
  const categories = ["all", "snatching", "harassment", "theft", "fraud", "traffic_hazard"];
  const visibleReports = reports.filter((r) => {
    if (r.status === "rejected" || r.flag_status === "confirmed_false" || r.flag_status === "flagged") {
      return false;
    }
    return categoryFilter === "all" || r.category === categoryFilter;
  });

  const activeSignals = signals.filter((s) =>
    ["active", "claimed", "responding"].includes(s.status)
  );

  return (
    <section className="surface-panel" aria-label="Dhaka PostGIS Spatial Map and Heatmap">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            Dhaka Metro PostGIS Spatial Deck
          </h2>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
            SRID 4326 clusters · {activeSignals.length} live SOS · {visibleReports.length} verified/active reports
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <label htmlFor="map-category-filter" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
            Category
          </label>
          <select
            id="map-category-filter"
            className="field-select"
            style={{ width: "auto", padding: "5px 8px", fontSize: "0.75rem" }}
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all" ? "All categories" : cat.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height: compact ? "248px" : "360px",
          backgroundColor: "var(--bg-rail-light)",
          overflow: "hidden",
        }}
      >
        {/* Minimalist cartographic SVG grid & Buriganga/Dhaka transit corridors */}
        <svg
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            <pattern id="dhaka-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="var(--border-hairline)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="400" fill="url(#dhaka-grid)" />
          {/* Buriganga / Turag river trace */}
          <path
            d="M 0 340 Q 190 365 380 350 T 800 380 L 800 400 L 0 400 Z"
            fill="var(--signal-info-soft)"
            opacity="0.7"
          />
          {/* Mirpur Road & Airport Road transit lines */}
          <path d="M 180 20 L 210 160 L 285 285 L 440 355" fill="none" stroke="var(--border-hairline)" strokeWidth="3" />
          <path d="M 480 15 L 470 180 L 520 340" fill="none" stroke="var(--border-hairline)" strokeWidth="3" />
        </svg>

        {/* Bangladesh Thana stations */}
        {stations
          .filter((s) => s.district === "Dhaka")
          .map((station) => {
            const pos = projectPoint(station.lat, station.lng);
            return (
              <div
                key={station.id}
                title={`${station.name_en} (${station.name_bn}) · ${station.phone}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-hairline)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--ink-primary)",
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--bg-rail-committed)",
                  }}
                />
                {station.name_en.replace(" Model Police Station", "").replace(" Police Station", "")}
              </div>
            );
          })}

        {/* Report heat clusters & pins */}
        {visibleReports.map((report) => {
          const pos = projectPoint(report.lat, report.lng);
          const isSelected = selectedId === report.id;
          const color =
            report.severity === "critical" || report.severity === "high"
              ? "var(--signal-warning)"
              : "var(--signal-info)";
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelectReport(report.id)}
              title={`${report.area_name}: ${report.title}`}
              aria-pressed={isSelected}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                width: isSelected ? "28px" : "24px",
                height: isSelected ? "28px" : "24px",
                borderRadius: "999px",
                backgroundColor: color,
                border: isSelected ? "2px solid var(--ink-primary)" : "2px solid var(--bg-surface)",
                cursor: "pointer",
                zIndex: isSelected ? 4 : 2,
              }}
              aria-label={`Inspect report ${report.title} in ${report.area_name}`}
            />
          );
        })}

        {/* Live SOS signals */}
        {activeSignals.map((sig) => {
          const pos = projectPoint(sig.lat, sig.lng);
          const isSelected = selectedId === sig.id;
          return (
            <button
              key={sig.id}
              type="button"
              onClick={() => onSelectSos(sig.id)}
              title={`SOS (${sig.status}) in ${sig.area_name}`}
              aria-pressed={isSelected}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                width: isSelected ? "34px" : "30px",
                height: isSelected ? "34px" : "30px",
                borderRadius: "999px",
                backgroundColor: "var(--signal-emergency-fill)",
                color: "var(--signal-emergency-on-fill)",
                fontSize: "0.625rem",
                fontWeight: 700,
                border: isSelected ? "2px solid var(--ink-primary)" : "2px solid var(--signal-emergency-on-fill)",
                cursor: "pointer",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={`Inspect SOS alert in ${sig.area_name}`}
            >
              SOS
            </button>
          );
        })}

        {visibleReports.length === 0 && (
          <div
            role="status"
            style={{
              position: "absolute",
              left: "12px",
              bottom: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-hairline)",
              fontSize: "0.75rem",
              color: "var(--ink-secondary)",
              zIndex: 6,
            }}
          >
            {activeSignals.length === 0
              ? "No active reports match this category filter."
              : "No verified reports match this category filter."}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          padding: "8px 14px",
          borderTop: "1px solid var(--border-hairline)",
          fontSize: "0.75rem",
          color: "var(--ink-secondary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-emergency)" }} />
          Live SOS signal
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-warning)" }} />
          High-severity report
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-info)" }} />
          Standard report
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "var(--bg-rail-committed)" }} />
          Dhaka Thana station
        </span>
      </div>
    </section>
  );
}

export default React.memo(SpatialMapDeck);
