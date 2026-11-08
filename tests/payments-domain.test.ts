import { test } from "node:test";
import assert from "node:assert/strict";
import { feeTerms, formatMoney, parseMoney } from "../src/domain/payments";
test("currency values retain exact minor units and display their declared currency", () => {
  assert.equal(parseMoney("123.45", "CAD"), 12345);
  assert.equal(parseMoney("1500", "JPY"), 1500);
  assert.equal(parseMoney("1.005", "KWD"), 1005);
  assert.equal(formatMoney(12345, "CAD"), "CAD 123.45");
  for (const value of ["1.001", "1e2", "-2", "NaN", "1000000.01"])
    assert.throws(() => parseMoney(value, "CAD"));
  assert.throws(() =>
    feeTerms({ feeMinor: 10, currency: "XYZ", paymentTerms: "Pay on entry" }),
  );
});

test("a normal frozen charge reconciles independent discounts, waivers and external receipts", async () => {
  const { reconcileCharge, creditAmount } = await import(
    "../src/domain/payments"
  );
  const terms = feeTerms({
    feeMinor: 12500,
    currency: "CAD",
    paymentTerms: "Pay within the reservation",
  });
  const history = [
    { kind: "discount", amountMinor: 1500, currency: "CAD" },
    { kind: "external_receipt", amountMinor: 4000, currency: "CAD" },
  ];
  assert.deepEqual(reconcileCharge(terms, history), {
    feeMinor: 12500,
    discountMinor: 1500,
    waivedMinor: 0,
    externalMinor: 4000,
    dueMinor: 7000,
    status: "amount_due",
  });
  assert.equal(creditAmount("waiver", 7000, 7000), 7000);
  assert.equal(
    reconcileCharge(terms, [
      ...history,
      { kind: "waiver", amountMinor: 7000, currency: "CAD" },
    ]).status,
    "settled_by_records",
  );
  for (const [kind, amount] of [
    ["discount", 7001],
    ["waiver", 6999],
    ["external_receipt", 0],
    ["provider_payment", 1],
    ["discount", 1.5],
  ] as const)
    assert.throws(() => creditAmount(kind, amount, 7000));
  assert.throws(() =>
    reconcileCharge(terms, [
      { kind: "external_receipt", amountMinor: 1, currency: "USD" },
    ]),
  );
  assert.throws(() =>
    reconcileCharge(terms, [
      { kind: "discount", amountMinor: 12501, currency: "CAD" },
    ]),
  );
  assert.equal(terms.feeMinor, 12500);
  assert.equal(
    reconcileCharge(
      feeTerms({ feeMinor: 0, currency: "JPY", paymentTerms: "No fee" }),
      [],
    ).status,
    "no_fee",
  );
});
test("fee snapshots are immutable and reject unsupported or unsafe arithmetic inputs", () => {
  const t = feeTerms({
    feeMinor: 19999,
    currency: "EUR",
    paymentTerms: "Original terms",
  });
  assert.throws(() => {
    (t as any).feeMinor = 1;
  });
  assert.equal(t.feeMinor, 19999);
  assert.equal(t.paymentTerms, "Original terms");
  for (const feeMinor of [
    NaN,
    Infinity,
    -1,
    0.1,
    100000001,
    Number.MAX_SAFE_INTEGER,
    "1200",
  ])
    assert.throws(() =>
      feeTerms({ feeMinor, currency: "EUR", paymentTerms: "Terms" }),
    );
  for (const currency of ["cad", "AAA", "", null, "US"])
    assert.throws(() =>
      feeTerms({ feeMinor: 0, currency, paymentTerms: "Terms" }),
    );
  assert.throws(() =>
    feeTerms({ feeMinor: 0, currency: "CAD", paymentTerms: "" }),
  );
  assert.equal(formatMoney(100000000, "JPY"), "JPY 100000000");
  assert.equal(parseMoney("0.01", "USD"), 1);
  assert.equal(parseMoney("0.001", "KWD"), 1);
});
test("several independent reductions preserve a one-minor-unit remainder without floating rounding", async () => {
  const { reconcileCharge } = await import("../src/domain/payments");
  assert.deepEqual(
    reconcileCharge(
      feeTerms({
        feeMinor: 1001,
        currency: "KWD",
        paymentTerms: "Three decimal currency",
      }),
      [
        { kind: "discount", amountMinor: 333, currency: "KWD" },
        { kind: "external_receipt", amountMinor: 667, currency: "KWD" },
      ],
    ),
    {
      feeMinor: 1001,
      discountMinor: 333,
      waivedMinor: 0,
      externalMinor: 667,
      dueMinor: 1,
      status: "amount_due",
    },
  );
});
