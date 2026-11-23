"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEMO_BASE_TIMESTAMP_MS,
  formatStatusLabel,
  latLngToWorldPx,
  projectLatLngToViewport,
  worldPxToLatLng,
  type CrimeReport,
  type DistressSignal,
  type PoliceStation,
} from "@/lib/opsLogic";

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
  heightPx?: number;
  theme?: "light" | "dark";
  focusPoint?: { lat: number; lng: number; zoom?: number; label?: string } | null;
  pickedPoint?: { lat: number; lng: number } | null;
  onPickLocation?: (lat: number, lng: number) => void;
  showSearch?: boolean;
}

const TILE_SIZE = 256;
const DEFAULT_CENTER = { lat: 23.776, lng: 90.386, zoom: 12 };

const AREA_PRESETS: Array<{ label: string; lat: number; lng: number; zoom: number; keywords: string[] }> = [
  { label: "All Dhaka", lat: 23.776, lng: 90.386, zoom: 12, keywords: ["dhaka", "all", "metro"] },
  { label: "Dhanmondi", lat: 23.7465, lng: 90.376, zoom: 14, keywords: ["dhanmondi", "kalabagan", "science lab", "ধানমন্ডি"] },
  { label: "Mirpur-10", lat: 23.8069, lng: 90.3688, zoom: 14, keywords: ["mirpur", "mirpur-10", "kazipara", "মিরপুর"] },
  { label: "Shahbagh", lat: 23.7385, lng: 90.3954, zoom: 14, keywords: ["shahbagh", "tsc", "university", "শাহবাগ"] },
  { label: "Mohammadpur", lat: 23.7654, lng: 90.3587, zoom: 14, keywords: ["mohammadpur", "adabor", "town hall", "মোহাম্মদপুর"] },
  { label: "Uttara", lat: 23.8759, lng: 90.4005, zoom: 14, keywords: ["uttara", "azampur", "sector 7", "উত্তরা"] },
  { label: "Gulshan", lat: 23.7925, lng: 90.4152, zoom: 14, keywords: ["gulshan", "banani", "baridhara", "গুলশান"] },
  { label: "Motijheel", lat: 23.733, lng: 90.4173, zoom: 14, keywords: ["motijheel", "paltan", "মতিঝিল"] },
  { label: "Chattogram", lat: 22.3384, lng: 91.8339, zoom: 13, keywords: ["chattogram", "chittagong", "kotwali", "চট্টগ্রাম"] },
];

const SEVERITY_WEIGHT: Record<CrimeReport["severity"], number> = {
  low: 0.35,
  medium: 0.6,
  high: 0.85,
  critical: 1.0,
};

function getTileUrl(z: number, x: number, y: number): string {
  const maxTile = Math.pow(2, z);
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  const sub = ["a", "b", "c"][Math.abs(wrappedX + y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
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
  heightPx,
  theme = "light",
  focusPoint = null,
  pickedPoint = null,
  onPickLocation,
  showSearch = true,
}: SpatialMapDeckProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startLat: number; startLng: number; moved: boolean } | null>(
    null
  );

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: compact ? 360 : 780,
    height: heightPx ?? (compact ? 290 : 420),
  });
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
  });
  const [zoom, setZoom] = useState<number>(DEFAULT_CENTER.zoom);
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const [timeWindow, setTimeWindow] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [showHeat, setShowHeat] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);
  const [showReports, setShowReports] = useState<boolean>(true);
  const [showSos, setShowSos] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const resolvedHeight = heightPx ?? (compact ? 290 : 420);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [resolvedHeight]);

  useEffect(() => {
    if (!focusPoint) return;
    setCenter({ lat: focusPoint.lat, lng: focusPoint.lng });
    if (focusPoint.zoom) {
      setZoom(Math.min(16, Math.max(11, focusPoint.zoom)));
    }
  }, [focusPoint]);

  useEffect(() => {
    if (!selectedId) return;
    const matchedSos = signals.find((s) => s.id === selectedId);
    if (matchedSos) {
      setCenter({ lat: matchedSos.lat, lng: matchedSos.lng });
      setZoom((z) => Math.max(z, 14));
      return;
    }
    const matchedRep = reports.find((r) => r.id === selectedId);
    if (matchedRep) {
      setCenter({ lat: matchedRep.lat, lng: matchedRep.lng });
      setZoom((z) => Math.max(z, 14));
    }
  }, [selectedId, signals, reports]);

  const categories = ["all", "snatching", "harassment", "theft", "fraud", "traffic_hazard"];

  const visibleReports = useMemo(() => {
    const nowAnchor = DEMO_BASE_TIMESTAMP_MS;
    const windowHours = timeWindow === "24h" ? 24 : timeWindow === "7d" ? 168 : timeWindow === "30d" ? 720 : null;
    return reports.filter((r) => {
      if (r.status === "rejected" || r.flag_status === "confirmed_false" || r.flag_status === "flagged") {
        return false;
      }
      if (categoryFilter !== "all" && r.category !== categoryFilter) {
        return false;
      }
      if (windowHours !== null) {
        const diffHrs = Math.abs(nowAnchor - new Date(r.occurred_at).getTime()) / 3_600_000;
        if (diffHrs > windowHours) return false;
      }
      return true;
    });
  }, [categoryFilter, reports, timeWindow]);

  const activeSignals = useMemo(
    () => signals.filter((s) => ["active", "claimed", "responding"].includes(s.status)),
    [signals]
  );

  // Compute visible slippy tiles for the current viewport
  const tiles = useMemo(() => {
    const centerWorld = latLngToWorldPx(center.lat, center.lng, zoom);
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    const minTileX = Math.floor((centerWorld.x - halfW) / TILE_SIZE);
    const maxTileX = Math.floor((centerWorld.x + halfW) / TILE_SIZE);
    const maxYIndex = Math.pow(2, zoom) - 1;
    const minTileY = Math.max(0, Math.floor((centerWorld.y - halfH) / TILE_SIZE));
    const maxTileY = Math.min(maxYIndex, Math.floor((centerWorld.y + halfH) / TILE_SIZE));

    const list: Array<{ key: string; left: number; top: number; url: string }> = [];
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const left = halfW + (tx * TILE_SIZE - centerWorld.x);
        const top = halfH + (ty * TILE_SIZE - centerWorld.y);
        list.push({
          key: `${zoom}-${tx}-${ty}`,
          left,
          top,
          url: getTileUrl(zoom, tx, ty),
        });
      }
    }
    return list;
  }, [center.lat, center.lng, size.height, size.width, zoom]);

  // Draw thermal heatmap overlay on HTML5 canvas
  useEffect(() => {
    const canvas = heatCanvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(size.width));
    canvas.height = Math.max(1, Math.round(size.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showHeat) return;

    const heatRadius = Math.max(30, Math.min(68, 22 + (zoom - 11) * 8));
    const points: Array<{ lat: number; lng: number; weight: number; emergency?: boolean }> = [
      ...visibleReports.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        weight: SEVERITY_WEIGHT[r.severity] ?? 0.6,
      })),
      ...activeSignals.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        weight: 1.0,
        emergency: true,
      })),
    ];

    for (const pt of points) {
      const pos = projectLatLngToViewport(pt.lat, pt.lng, center.lat, center.lng, zoom, size.width, size.height);
      if (pos.x < -heatRadius || pos.y < -heatRadius || pos.x > size.width + heatRadius || pos.y > size.height + heatRadius) {
        continue;
      }
      const grad = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, heatRadius);
      if (pt.emergency) {
        grad.addColorStop(0, "rgba(200, 30, 43, 0.56)");
        grad.addColorStop(0.45, "rgba(217, 119, 6, 0.34)");
        grad.addColorStop(1, "rgba(217, 119, 6, 0)");
      } else {
        grad.addColorStop(0, `rgba(217, 119, 6, ${0.42 * pt.weight})`);
        grad.addColorStop(0.5, `rgba(14, 116, 144, ${0.24 * pt.weight})`);
        grad.addColorStop(1, "rgba(14, 116, 144, 0)");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, heatRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [activeSignals, center.lat, center.lng, showHeat, size.height, size.width, visibleReports, zoom]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const presetHits = AREA_PRESETS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.some((k) => k.includes(q))
    ).map((a) => ({ id: `area-${a.label}`, title: a.label, sub: "Dhaka Metro Area", lat: a.lat, lng: a.lng, zoom: a.zoom }));

    const stationHits = stations
      .filter(
        (s) =>
          s.name_en.toLowerCase().includes(q) ||
          s.name_bn.toLowerCase().includes(q) ||
          s.aliases.some((al) => al.toLowerCase().includes(q))
      )
      .map((s) => ({
        id: s.id,
        title: s.name_en,
        sub: `${s.name_bn} · ${s.phone}`,
        lat: s.lat,
        lng: s.lng,
        zoom: 15,
      }));

    return [...presetHits, ...stationHits].slice(0, 6);
  }, [searchQuery, stations]);

  const selectedSosItem = activeSignals.find((s) => s.id === selectedId) ?? null;
  const selectedReportItem = visibleReports.find((r) => r.id === selectedId) ?? null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, select, a")) return;
    setIsGrabbing(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLat: center.lat,
      startLng: center.lng,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }
    const startWorld = latLngToWorldPx(drag.startLat, drag.startLng, zoom);
    const next = worldPxToLatLng(startWorld.x - dx, startWorld.y - dy, zoom);
    setCenter(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    setIsGrabbing(false);
    dragRef.current = null;
    if (drag && !drag.moved && onPickLocation && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      const centerWorld = latLngToWorldPx(center.lat, center.lng, zoom);
      const picked = worldPxToLatLng(centerWorld.x + offsetX, centerWorld.y + offsetY, zoom);
      onPickLocation(Number(picked.lat.toFixed(5)), Number(picked.lng.toFixed(5)));
    }
  };

  const handleLocateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUserGps({ lat: 23.7465, lng: 90.376 });
      setCenter({ lat: 23.7465, lng: 90.376 });
      setZoom(14);
      setGpsStatus("Demo GPS: Dhanmondi");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGps(coords);
        setCenter(coords);
        setZoom(15);
        setGpsStatus("Centered on GPS");
      },
      () => {
        setUserGps({ lat: 23.7465, lng: 90.376 });
        setCenter({ lat: 23.7465, lng: 90.376 });
        setZoom(14);
        setGpsStatus("GPS fallback: Dhanmondi");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  // Geo-referenced offline fallback vectors (Buriganga river & major Dhaka arterial roads)
  const fallbackRiverPath = useMemo(() => {
    const pts = [
      [23.715, 90.345],
      [23.712, 90.372],
      [23.704, 90.402],
      [23.694, 90.435],
    ].map(([lat, lng]) => projectLatLngToViewport(lat, lng, center.lat, center.lng, zoom, size.width, size.height));
    return `M ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} T ${pts[3].x} ${pts[3].y} L ${size.width + 60} ${size.height + 60} L -60 ${size.height + 60} Z`;
  }, [center.lat, center.lng, size.height, size.width, zoom]);

  const fallbackRoads = useMemo(() => {
    const segments: Array<Array<[number, number]>> = [
      // Mirpur Road corridor
      [
        [23.876, 90.365],
        [23.807, 90.369],
        [23.752, 90.376],
        [23.733, 90.386],
      ],
      // Airport / Pragati Sarani corridor
      [
        [23.876, 90.401],
        [23.812, 90.408],
        [23.782, 90.415],
        [23.733, 90.417],
      ],
      // Bijoy Sarani - Satmasjid cross link
      [
        [23.765, 90.358],
        [23.764, 90.388],
        [23.761, 90.416],
      ],
    ];
    return segments.map((seg) =>
      seg
        .map(([lat, lng], idx) => {
          const p = projectLatLngToViewport(lat, lng, center.lat, center.lng, zoom, size.width, size.height);
          return `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ")
    );
  }, [center.lat, center.lng, size.height, size.width, zoom]);

  return (
    <section className="surface-panel map-shell" aria-label="Dhaka PostGIS Spatial Map and Heatmap">
      {/* Header & Filters */}
      <div className="map-toolbar">
        <div>
          <h2 className="section-header-title">Dhaka Metro Interactive Street &amp; Heatmap</h2>
          <p className="section-header-sub">
            PostGIS SRID 4326 · {activeSignals.length} live SOS · {visibleReports.length} incident pins · Zoom {zoom}x
            {gpsStatus ? ` · ${gpsStatus}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <label htmlFor="map-category-filter" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
            Crime
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
                {cat === "all" ? "All categories" : formatStatusLabel(cat)}
              </option>
            ))}
          </select>

          {!compact && (
            <>
              <label htmlFor="map-time-filter" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                Window
              </label>
              <select
                id="map-time-filter"
                className="field-select"
                style={{ width: "auto", padding: "5px 8px", fontSize: "0.75rem" }}
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as "all" | "24h" | "7d" | "30d")}
              >
                <option value="all">All time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </>
          )}

          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={showHeat}
            onClick={() => setShowHeat((v) => !v)}
          >
            {showHeat ? "Heatmap on" : "Heatmap off"}
          </button>
          <button type="button" className="btn btn-sm" onClick={handleLocateMe}>
            Locate me
          </button>
        </div>
      </div>

      {/* Quick Dhaka Division Jump Chips & Layer Toggles */}
      <div className="map-area-strip">
        {AREA_PRESETS.slice(0, compact ? 5 : AREA_PRESETS.length).map((area) => {
          const isNear =
            Math.abs(center.lat - area.lat) < 0.012 && Math.abs(center.lng - area.lng) < 0.012;
          return (
            <button
              key={area.label}
              type="button"
              className="map-chip"
              aria-pressed={isNear}
              onClick={() => {
                setCenter({ lat: area.lat, lng: area.lng });
                setZoom(area.zoom);
              }}
            >
              {area.label}
            </button>
          );
        })}

        {!compact && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="map-chip"
              aria-pressed={showSos}
              onClick={() => setShowSos((v) => !v)}
            >
              SOS ({activeSignals.length})
            </button>
            <button
              type="button"
              className="map-chip"
              aria-pressed={showReports}
              onClick={() => setShowReports((v) => !v)}
            >
              Reports ({visibleReports.length})
            </button>
            <button
              type="button"
              className="map-chip"
              aria-pressed={showStations}
              onClick={() => setShowStations((v) => !v)}
            >
              Thanas
            </button>
          </div>
        )}
      </div>

      {/* Interactive Slippy Map Canvas */}
      <div
        ref={viewportRef}
        className={`map-viewport ${isGrabbing ? "is-grabbing" : ""} ${onPickLocation ? "is-pick-mode" : ""}`}
        style={{ height: `${resolvedHeight}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setIsGrabbing(false);
          dragRef.current = null;
        }}
        onWheel={(e) => {
          if (e.ctrlKey || Math.abs(e.deltaY) > 10) {
            e.preventDefault();
            setZoom((z) => Math.min(16, Math.max(11, z + (e.deltaY < 0 ? 1 : -1))));
          }
        }}
      >
        {/* Geo-referenced Offline Dhaka Vector Underlay (always present beneath tiles) */}
        <svg
          width={size.width}
          height={size.height}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
        >
          <path d={fallbackRiverPath} fill="var(--map-river)" opacity="0.85" />
          {fallbackRoads.map((d, idx) => (
            <path key={idx} d={d} fill="none" stroke="var(--map-road)" strokeWidth="4" strokeLinecap="round" />
          ))}
        </svg>

        {/* Real OpenStreetMap Street Tiles */}
        <div
          aria-hidden="true"
          className={theme === "dark" ? "dark-osm-tiles" : undefined}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
        >
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              width={TILE_SIZE}
              height={TILE_SIZE}
              loading="eager"
              draggable={false}
              onError={(ev) => {
                (ev.currentTarget as HTMLImageElement).style.display = "none";
              }}
              style={{
                position: "absolute",
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
                display: "block",
              }}
            />
          ))}
        </div>

        {/* Thermal Heatmap Canvas Overlay */}
        <canvas
          ref={heatCanvasRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
        />

        {/* Bangladesh Area & Thana Search Overlay */}
        {showSearch && (
          <div className="map-search-overlay">
            <label htmlFor="map-bd-search" className="skip-link">
              Search Dhaka area or Thana
            </label>
            <input
              id="map-bd-search"
              className="field-input"
              style={{ fontSize: "0.75rem", padding: "6px 10px" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area or Thana (e.g. Mirpur, ধানমন্ডি)..."
            />
            {searchMatches.length > 0 && (
              <div className="map-search-results">
                {searchMatches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="map-search-item"
                    onClick={() => {
                      setCenter({ lat: m.lat, lng: m.lng });
                      setZoom(m.zoom);
                      setSearchQuery("");
                    }}
                  >
                    <strong>{m.title}</strong>
                    <span style={{ color: "var(--ink-secondary)" }}>{m.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map Zoom & Reset HUD */}
        <div className="map-hud-stack">
          <button
            type="button"
            className="map-hud-btn"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(16, z + 1))}
          >
            +
          </button>
          <button
            type="button"
            className="map-hud-btn"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(11, z - 1))}
          >
            −
          </button>
          <button
            type="button"
            className="map-hud-btn"
            aria-label="Reset Dhaka view"
            title="Reset Dhaka view"
            onClick={() => {
              setCenter({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
              setZoom(DEFAULT_CENTER.zoom);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* Thana Police Stations */}
        {showStations &&
          stations.map((station) => {
            const pos = projectLatLngToViewport(
              station.lat,
              station.lng,
              center.lat,
              center.lng,
              zoom,
              size.width,
              size.height
            );
            if (pos.x < -60 || pos.y < -40 || pos.x > size.width + 60 || pos.y > size.height + 40) {
              return null;
            }
            return (
              <div
                key={station.id}
                title={`${station.name_en} (${station.name_bn}) · ${station.phone}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: "translate(-50%, -50%)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 7px",
                  borderRadius: "6px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-strong)",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--ink-primary)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "999px",
                    backgroundColor: "var(--bg-rail-committed)",
                  }}
                />
                {station.name_en.replace(" Model Police Station", "").replace(" Police Station", "")}
              </div>
            );
          })}

        {/* Crime Report Pins */}
        {showReports &&
          visibleReports.map((report) => {
            const pos = projectLatLngToViewport(
              report.lat,
              report.lng,
              center.lat,
              center.lng,
              zoom,
              size.width,
              size.height
            );
            if (pos.x < -30 || pos.y < -30 || pos.x > size.width + 30 || pos.y > size.height + 30) {
              return null;
            }
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
                aria-label={`Inspect report ${report.title} in ${report.area_name}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: "translate(-50%, -50%)",
                  width: isSelected ? "28px" : "24px",
                  height: isSelected ? "28px" : "24px",
                  borderRadius: "999px",
                  backgroundColor: color,
                  color: "#ffffff",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  border: isSelected ? "2px solid var(--ink-primary)" : "2px solid var(--bg-surface)",
                  cursor: "pointer",
                  zIndex: isSelected ? 9 : 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {report.corroboration_count > 0 ? report.corroboration_count : ""}
              </button>
            );
          })}

        {/* Live SOS Signals with Pulsing Halos */}
        {showSos &&
          activeSignals.map((sig) => {
            const pos = projectLatLngToViewport(
              sig.lat,
              sig.lng,
              center.lat,
              center.lng,
              zoom,
              size.width,
              size.height
            );
            if (pos.x < -40 || pos.y < -40 || pos.x > size.width + 40 || pos.y > size.height + 40) {
              return null;
            }
            const isSelected = selectedId === sig.id;
            return (
              <React.Fragment key={sig.id}>
                <div
                  className="sos-pulse-halo"
                  aria-hidden="true"
                  style={{ left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 7 }}
                />
                <button
                  type="button"
                  onClick={() => onSelectSos(sig.id)}
                  title={`SOS (${sig.status}) in ${sig.area_name}`}
                  aria-pressed={isSelected}
                  aria-label={`Inspect SOS alert in ${sig.area_name}`}
                  style={{
                    position: "absolute",
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    transform: "translate(-50%, -50%)",
                    width: isSelected ? "36px" : "32px",
                    height: isSelected ? "36px" : "32px",
                    borderRadius: "999px",
                    backgroundColor: "var(--signal-emergency-fill)",
                    color: "var(--signal-emergency-on-fill)",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    border: isSelected
                      ? "2px solid var(--ink-primary)"
                      : "2px solid var(--signal-emergency-on-fill)",
                    cursor: "pointer",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  SOS
                </button>
              </React.Fragment>
            );
          })}

        {/* User GPS Marker */}
        {userGps && (() => {
          const gpsPos = projectLatLngToViewport(
            userGps.lat,
            userGps.lng,
            center.lat,
            center.lng,
            zoom,
            size.width,
            size.height
          );
          return (
            <div
              title="Your current GPS position"
              style={{
                position: "absolute",
                left: `${gpsPos.x}px`,
                top: `${gpsPos.y}px`,
                transform: "translate(-50%, -50%)",
                width: "14px",
                height: "14px",
                borderRadius: "999px",
                backgroundColor: "var(--signal-info)",
                border: "3px solid #ffffff",
                zIndex: 11,
                pointerEvents: "none",
              }}
            />
          );
        })()}

        {/* Pin-Picker Crosshair Marker (Report submission mode) */}
        {pickedPoint && (() => {
          const pickPos = projectLatLngToViewport(
            pickedPoint.lat,
            pickedPoint.lng,
            center.lat,
            center.lng,
            zoom,
            size.width,
            size.height
          );
          return (
            <div
              title={`Selected incident coordinates: ${pickedPoint.lat.toFixed(4)}, ${pickedPoint.lng.toFixed(4)}`}
              style={{
                position: "absolute",
                left: `${pickPos.x}px`,
                top: `${pickPos.y}px`,
                transform: "translate(-50%, -100%)",
                zIndex: 12,
                pointerEvents: "none",
              }}
            >
              <svg width="26" height="32" viewBox="0 0 24 30" fill="var(--signal-emergency)" stroke="#ffffff" strokeWidth="2">
                <path d="M12 2C7 2 3 6 3 11c0 7 9 17 9 17s9-10 9-17c0-5-4-9-9-9z" />
                <circle cx="12" cy="11" r="3" fill="#ffffff" />
              </svg>
            </div>
          );
        })()}

        {/* Floating Callout for Selected SOS or Report */}
        {(selectedSosItem || selectedReportItem) && !onPickLocation && (
          <div className="map-callout">
            {selectedSosItem ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span className="pill pill-breach">Live SOS · {formatStatusLabel(selectedSosItem.status)}</span>
                  <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                    {selectedSosItem.lat.toFixed(4)}, {selectedSosItem.lng.toFixed(4)}
                  </span>
                </div>
                <strong style={{ fontSize: "0.8125rem" }}>
                  {selectedSosItem.area_name} — {selectedSosItem.citizen_name}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                  {selectedSosItem.note}
                </span>
              </>
            ) : selectedReportItem ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span className="pill pill-warning">
                    {formatStatusLabel(selectedReportItem.category)} · {formatStatusLabel(selectedReportItem.severity)}
                  </span>
                  <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                    {selectedReportItem.corroboration_count} witnesses
                  </span>
                </div>
                <strong style={{ fontSize: "0.8125rem" }}>{selectedReportItem.title}</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                  {selectedReportItem.address_text ?? selectedReportItem.area_name}
                </span>
              </>
            ) : null}
          </div>
        )}

        {onPickLocation && (
          <div className="map-callout">
            <strong style={{ fontSize: "0.75rem" }}>Tap map to drop incident pin</strong>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
              {pickedPoint
                ? `${pickedPoint.lat.toFixed(4)}, ${pickedPoint.lng.toFixed(4)}`
                : "Defaulting to selected Dhaka division"}
            </span>
          </div>
        )}

        {visibleReports.length === 0 && (
          <div
            role="status"
            style={{
              position: "absolute",
              left: "12px",
              bottom: "42px",
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-hairline)",
              fontSize: "0.75rem",
              color: "var(--ink-secondary)",
              zIndex: 14,
            }}
          >
            No verified reports match this category or time window.
          </div>
        )}

        <div className="map-attribution">
          © OpenStreetMap contributors
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          padding: "9px 16px",
          borderTop: "1px solid var(--border-hairline)",
          fontSize: "0.75rem",
          color: "var(--ink-secondary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-emergency)" }} />
          Live SOS beacon
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-warning)" }} />
          High-severity / heat core
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "var(--signal-info)" }} />
          Standard report (witness count)
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
