import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registrationTerms,
  requestAdmission,
  effectiveAdmission,
  occupiedPlaces,
  canEnterDraw,
  paymentDisposition,
} from "../src/domain/registration";

test("opening requires capacity, entry requirements, explicit fee terms and documented format", () => {
  const terms = {
    mode: "open",
    capacity: 16,
    requirements: "Four players; provisional records allowed",
    feeMinor: 0,
    currency: "CAD",
    paymentTerms: "No entry fee",
    paymentWindowMinutes: 60,
    format: "triple_knockout",
    formatNotes: "16-team A/B/C qualification and eight-team playoff",
  };
  assert.equal(registrationTerms(terms).capacity, 16);
  for (const key of Object.keys(terms)) {
    assert.throws(
      () => registrationTerms({ ...terms, [key]: undefined }),
      /./,
      key,
    );
  }
});

test("open and reviewed entry keep acceptance, reservation deadline and payment distinct", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.deepEqual(requestAdmission("open", "pending", 0, 90, 1, now, false), {
    state: "accepted",
    deadline: null,
  });
  assert.deepEqual(
    requestAdmission("open", "pending", 25000, 90, 1, now, false),
    { state: "held", deadline: "2026-11-08T13:30:00.000Z" },
  );
  assert.deepEqual(
    requestAdmission("reviewed", "pending", 25000, 90, 1, now, false),
    { state: "pending", deadline: null },
  );
  assert.deepEqual(
    requestAdmission("reviewed", "pending", 25000, 90, 1, now, true),
    { state: "held", deadline: "2026-11-08T13:30:00.000Z" },
  );
  assert.throws(
    () => requestAdmission("invited", "pending", 0, 90, 1, now, false),
    /invitation/i,
  );
  assert.deepEqual(
    requestAdmission("invited", "invited", 0, 90, 1, now, false),
    { state: "accepted", deadline: null },
  );
  assert.deepEqual(requestAdmission("open", "pending", 0, 90, 0, now, false), {
    state: "waitlisted",
    deadline: null,
  });
  assert.throws(
    () => requestAdmission("reviewed", "pending", 0, 90, 0, now, true),
    /capacity/i,
  );
});

test("expiry boundary releases only live holds and never revives on retry or late payment", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(
    effectiveAdmission("held", "2026-11-08T12:00:00Z", now),
    "expired",
  );
  assert.equal(
    effectiveAdmission("held", "2026-11-08T12:00:00.001Z", now),
    "held",
  );
  assert.equal(
    occupiedPlaces(
      [
        { state: "accepted", deadline: null },
        { state: "held", deadline: "2026-11-08T12:00:01Z" },
        { state: "held", deadline: "2026-11-08T12:00:00Z" },
        { state: "pending", deadline: null },
        { state: "waitlisted", deadline: null },
      ],
      now,
    ),
    2,
  );
  assert.throws(
    () => requestAdmission("open", "expired", 25000, 90, 1, now, false),
    /expired/i,
  );
  assert.equal(paymentDisposition("expired"), "staff_attention");
  assert.equal(paymentDisposition("held"), "within_reservation");
  for (const state of [
    "pending",
    "invited",
    "held",
    "expired",
    "waitlisted",
  ] as const)
    assert.equal(
      canEnterDraw({
        entryAdmission: "submitted_pending",
        admissionState: state,
        registrationConfigured: true,
      }),
      false,
    );
  assert.equal(
    canEnterDraw({
      entryAdmission: "submitted_pending",
      admissionState: "accepted",
      registrationConfigured: true,
    }),
    true,
  );
  assert.equal(
    canEnterDraw({
      entryAdmission: "organizer_recorded",
      admissionState: "pending",
      registrationConfigured: false,
    }),
    true,
  );
  assert.equal(
    canEnterDraw({
      entryAdmission: "submitted_pending",
      admissionState: "pending",
      registrationConfigured: false,
    }),
    false,
  );
});
