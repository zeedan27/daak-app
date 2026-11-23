import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelSosCountdown,
  canCorroborateIncident,
  createSosCountdown,
  evaluateSafeWalkDeadline,
  resolveBanglaOrBanglishThana,
  tickSosCountdown,
} from "../src/citizenCore.ts";

test("SOS 5-second countdown ticks cleanly to transmitting and supports cancel", () => {
  let state = createSosCountdown(5);
  assert.equal(state.status, "countdown");
  assert.equal(state.secondsRemaining, 5);

  const cancelled = cancelSosCountdown(state);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.secondsRemaining, 0);

  for (let i = 0; i < 4; i++) {
    state = tickSosCountdown(state);
    assert.equal(state.status, "countdown");
  }
  state = tickSosCountdown(state);
  assert.equal(state.status, "transmitting");
  assert.equal(state.secondsRemaining, 0);
});

test("evaluateSafeWalkDeadline detects overdue check-in for auto-escalation", () => {
  const base = Date.UTC(2026, 10, 23, 14, 0, 0);
  const futureIso = new Date(base + 120_000).toISOString();
  const active = evaluateSafeWalkDeadline(futureIso, base);
  assert.equal(active.shouldAutoEscalate, false);
  assert.equal(active.remainingSeconds, 120);

  const overdueIso = new Date(base - 10_000).toISOString();
  const overdue = evaluateSafeWalkDeadline(overdueIso, base);
  assert.equal(overdue.shouldAutoEscalate, true);
  assert.equal(overdue.remainingSeconds, 0);
});

test("canCorroborateIncident enforces 1km proximity and forbids self-corroboration", () => {
  const near = canCorroborateIncident(23.7495, 90.3806, 23.7501, 90.3810, false);
  assert.equal(near.allowed, true);
  assert.ok(near.distanceMeters <= 1000);

  const far = canCorroborateIncident(23.7495, 90.3806, 23.8069, 90.3688, false);
  assert.equal(far.allowed, false);
  assert.equal(far.reason, "CORROBORATION_OUT_OF_RANGE");

  const own = canCorroborateIncident(23.7495, 90.3806, 23.7495, 90.3806, true);
  assert.equal(own.allowed, false);
  assert.equal(own.reason, "SELF_CORROBORATION_FORBIDDEN");
});

test("resolveBanglaOrBanglishThana matches Bangla and Banglish queries", () => {
  const bangla = resolveBanglaOrBanglishThana("ধানমন্ডি তে ছিনতাই হয়েছে");
  assert.equal(bangla.name_en, "Dhanmondi Model Police Station");

  const banglish = resolveBanglaOrBanglishThana("Mirpur 10 e raat e hata safe?");
  assert.equal(banglish.name_en, "Mirpur Model Police Station");

  const tsc = resolveBanglaOrBanglishThana("Around TSC Dhaka University");
  assert.equal(tsc.name_en, "Shahbagh Police Station");
});
