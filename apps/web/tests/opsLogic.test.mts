import assert from "node:assert/strict";
import test from "node:test";

import {
  computeAreaSafetyScores,
  createInitialDemoDataset,
  filterAndSortFalseReports,
  formatSlaChronometer,
  maskReportForRole,
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

test("filterAndSortFalseReports filters flagged/high-suspicion items descending", () => {
  const dataset = createInitialDemoDataset();
  const flagged = filterAndSortFalseReports(dataset.reports);
  assert.ok(flagged.length >= 2);
  assert.ok(flagged[0].suspicion_score >= flagged[1].suspicion_score);
  assert.ok(flagged.every((r) => r.flag_status === "flagged" || r.suspicion_score >= 50));
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
