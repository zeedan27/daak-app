import assert from "node:assert/strict";
import test from "node:test";

import {
  computeAreaSafetyScores,
  computeFalseReportBreakdown,
  createInitialDemoDataset,
  DEMO_BASE_TIMESTAMP_MS,
  filterAndSortFalseReports,
  formatSlaChronometer,
  formatStatusLabel,
  generatePredictiveAlerts,
  latLngToTileXY,
  maskReportForRole,
  projectLatLngToViewport,
  resolveAreaCoordinates,
} from "../src/lib/opsLogic.ts";

test("formatSlaChronometer returns MM:SS and normal/warning/breach tiers", () => {
  const base = Date.UTC(2026, 10, 23, 12, 0, 0);
  const normal = formatSlaChronometer(new Date(base - 140_000).toISOString(), base, 300);
  assert.equal(normal.formatted, "02:20");
  assert.equal(normal.tier, "normal");

  const warning = formatSlaChronometer(new Date(base - 375_000).toISOString(), base, 300);
  assert.equal(warning.formatted, "06:15");
  assert.equal(warning.tier, "warning");

  const breach = formatSlaChronometer(new Date(base - 670_000).toISOString(), base, 300);
  assert.equal(breach.formatted, "11:10");
  assert.equal(breach.tier, "breach");
});

test("maskReportForRole masks reporter identity for non-owner citizens", () => {
  const anonReport = {
    id: "r1",
    reporter_id: "u-police",
    reporter_display_name: "SI Tariqul Islam",
    is_anonymous_public: true,
    category: "snatching" as const,
    severity: "high" as const,
    title: "Snatching",
    description: "Details",
    area_name: "Dhanmondi",
    lat: 23.7495,
    lng: 90.3806,
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    status: "verified" as const,
    corroboration_count: 2,
    suspicion_score: 8,
    flag_status: "none" as const,
    suspicion_reasons: [],
  };

  const citizenView = maskReportForRole(anonReport, "citizen", "u-other");
  assert.equal(citizenView.reporter_id, null);
  assert.equal(citizenView.reporter_display_name, "Anonymous Citizen");

  const policeView = maskReportForRole(anonReport, "police", "u-police");
  assert.equal(policeView.reporter_id, "u-police");
  assert.equal(policeView.reporter_display_name, "SI Tariqul Islam");

  const nonAnonCitizenView = maskReportForRole({ ...anonReport, is_anonymous_public: false }, "citizen", "u-other");
  assert.equal(nonAnonCitizenView.reporter_id, null);
  assert.equal(nonAnonCitizenView.reporter_display_name, "SI Tariqul Islam");
});

test("filterAndSortFalseReports filters flagged/high-suspicion items descending and excludes triaged items", () => {
  const dataset = createInitialDemoDataset();
  const flagged = filterAndSortFalseReports(dataset.reports);
  assert.ok(flagged.length >= 2);
  assert.ok(flagged[0].suspicion_score >= flagged[1].suspicion_score);
  assert.ok(flagged.every((r) => r.flag_status === "flagged" || r.suspicion_score >= 50));

  const moderated = dataset.reports.map((r, idx) =>
    idx === flagged.length - 1 ? r : r.id === flagged[0].id ? { ...r, flag_status: "confirmed_false" as const } : r
  );
  const afterConfirm = filterAndSortFalseReports(moderated);
  assert.equal(afterConfirm.length, flagged.length - 1);
  assert.ok(afterConfirm.every((r) => r.id !== flagged[0].id));

  const clearedAll = dataset.reports.map((r) => ({ ...r, flag_status: "cleared" as const }));
  assert.equal(filterAndSortFalseReports(clearedAll).length, 0);
});

test("createInitialDemoDataset seeds 8 Thanas, 8 reports, 3 SOS, and safety scores", () => {
  const dataset = createInitialDemoDataset();
  assert.equal(dataset.policeStations.length, 8);
  assert.equal(dataset.reports.length, 8);
  assert.equal(dataset.distressSignals.length, 3);
  assert.equal(dataset.safeWalks.length, 1);
  assert.equal(dataset.criminals.length, 3);

  const scores = computeAreaSafetyScores(dataset.reports);
  assert.ok(scores.length >= 4);
  assert.ok(scores.every((item) => item.score >= 0 && item.score <= 100));
});

test("createInitialDemoDataset default timestamp is deterministic for SSR hydration", () => {
  const first = createInitialDemoDataset();
  const second = createInitialDemoDataset();
  assert.equal(first.distressSignals[0].triggered_at, second.distressSignals[0].triggered_at);
  assert.equal(first.reports[0].created_at, second.reports[0].created_at);
  assert.equal(
    first.safeWalks[0].expected_arrival_at,
    new Date(DEMO_BASE_TIMESTAMP_MS + 18 * 60_000).toISOString()
  );
});

test("formatStatusLabel maps snake_case codes to sentence-case labels", () => {
  assert.equal(formatStatusLabel("safe_walk_timeout"), "Safe Walk timeout");
  assert.equal(formatStatusLabel("in_custody"), "In custody");
  assert.equal(formatStatusLabel("panic_button"), "Panic SOS");
  assert.equal(formatStatusLabel("distress_signals"), "Distress signals");
  assert.equal(formatStatusLabel("confirmed_false"), "Confirmed false");
  assert.equal(formatStatusLabel("traffic_hazard"), "Traffic hazard");
  assert.equal(formatStatusLabel("suspicious_activity"), "Suspicious activity");
  assert.equal(formatStatusLabel("custom_field_state"), "Custom field state");
});

test("resolveAreaCoordinates maps Dhaka neighborhoods to distinct coordinates", () => {
  const dhanmondi = resolveAreaCoordinates("Dhanmondi");
  const mirpur = resolveAreaCoordinates("Mirpur-10");
  const uttara = resolveAreaCoordinates("Uttara");
  const gulshan = resolveAreaCoordinates("Gulshan");
  assert.notEqual(dhanmondi.lat, mirpur.lat);
  assert.notEqual(mirpur.lat, uttara.lat);
  assert.notEqual(uttara.lng, gulshan.lng);
});

test("computeAreaSafetyScores returns enriched 3-factor breakdown, nightCount, and dominantCategory", () => {
  const dataset = createInitialDemoDataset();
  const scores = computeAreaSafetyScores(dataset.reports);
  assert.ok(scores.length >= 4);
  for (const item of scores) {
    assert.ok(item.factors);
    assert.ok(item.factors.crimeFrequency >= 0 && item.factors.crimeFrequency <= 100);
    assert.ok(item.factors.resolutionRate >= 0 && item.factors.resolutionRate <= 100);
    assert.ok(item.factors.timeOfDay >= 0 && item.factors.timeOfDay <= 100);
    assert.equal(item.pendingCount, item.reportCount - item.resolvedCount);
    assert.ok(item.nightCount >= 0);
    assert.ok(item.dominantCategory.length > 0);
  }
});

test("computeFalseReportBreakdown returns 5 deterministic factor scores and riskLevel", () => {
  const dataset = createInitialDemoDataset();
  const flagged = filterAndSortFalseReports(dataset.reports);
  assert.ok(flagged.length >= 2);
  const breakdown = computeFalseReportBreakdown(flagged[0]);
  assert.ok(["Critical", "High", "Medium", "Low"].includes(breakdown.riskLevel));
  assert.ok(breakdown.userCredibility >= 0 && breakdown.userCredibility <= 100);
  assert.ok(breakdown.duplicatePattern >= 0 && breakdown.duplicatePattern <= 100);
  assert.ok(breakdown.rapidSubmission >= 0 && breakdown.rapidSubmission <= 100);
  assert.ok(breakdown.detailConsistency >= 0 && breakdown.detailConsistency <= 100);
  assert.ok(breakdown.suspiciousContent >= 0 && breakdown.suspiciousContent <= 100);
});

test("generatePredictiveAlerts produces SPIKE, HOTSPOT, and TREND alerts from Dhaka reports", () => {
  const dataset = createInitialDemoDataset();
  const alerts = generatePredictiveAlerts(dataset.reports);
  assert.ok(alerts.length >= 3);
  const types = new Set(alerts.map((a) => a.type));
  assert.ok(types.has("SPIKE") || types.has("HOTSPOT"));
  assert.ok(types.has("TREND"));
  for (const alert of alerts) {
    assert.ok(alert.id.length > 0);
    assert.ok(alert.severity >= 1 && alert.severity <= 10);
    assert.ok(["Critical", "High", "Medium", "Low"].includes(alert.severityLabel));
    assert.ok(alert.message.length > 0);
    assert.ok(alert.description.length > 0);
    assert.ok(Number.isFinite(alert.lat) && Number.isFinite(alert.lng));
    assert.ok(alert.trend === "increasing" || alert.trend === "stable");
  }
});

test("Web Mercator helpers accurately project Dhaka coordinates to tiles and viewport pixels", () => {
  const tile = latLngToTileXY(23.7465, 90.3760, 13);
  assert.equal(tile.x, 6152);
  assert.equal(tile.y, 3539);

  const center = projectLatLngToViewport(23.7465, 90.3760, 23.7465, 90.3760, 13, 800, 400);
  assert.ok(Math.abs(center.x - 400) < 0.5);
  assert.ok(Math.abs(center.y - 200) < 0.5);

  const north = projectLatLngToViewport(23.8069, 90.3688, 23.7465, 90.3760, 13, 800, 400);
  assert.ok(north.y < center.y);
  assert.ok(north.x < center.x);
});
