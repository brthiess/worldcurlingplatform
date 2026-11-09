"use client";
import { useEffect, useState } from "react";
import { canonicalEntryCommand } from "@/domain/entries";
import { currencyDigits, formatMoney, parseMoney } from "@/domain/payments";
import { AuthorityRecovery, useAuthorityCommand } from "./authority-command";

type Fee = {
  version: number;
  feeMinor: number;
  currency: string;
  paymentTerms: string;
  reason: string;
  createdAt: string;
};
type Charge = {
  feeVersion: number;
  feeMinor: number;
  currency: string;
  paymentTerms: string;
  createdAt: string;
};
type Credit = {
  id: string;
  kind: string;
  amountMinor: number;
  currency: string;
  reason: string;
  externalReference: string | null;
  createdAt: string;
};
type Entry = {
  id: string;
  divisionId: string;
  name: string;
  admissionState: string;
  deadline: string | null;
  rosterStatus: string;
  staff: boolean;
  version: number;
  charge: Charge | null;
  history: Credit[];
  balance: {
    dueMinor: number;
    discountMinor: number;
    waivedMinor: number;
    externalMinor: number;
    status: string;
  } | null;
};
type Division = {
  id: string;
  name: string;
  eventName: string;
  staff: boolean;
  configured: boolean;
  fee: Fee | null;
  feeHistory: Fee[];
};
type Workspace = {
  actorId: string;
  now: string;
  divisions: Division[];
  entries: Entry[];
  receipts: { requestId: string; command: unknown }[];
};
const admissions: Record<string, string> = {
  pending: "Pending admission",
  invited: "Invited — no reserved place",
  held: "Held — awaiting settlement",
  accepted: "Accepted",
  expired: "Expired — capacity released",
  waitlisted: "Waitlisted — no reserved place",
};
const kinds: Record<string, string> = {
  discount: "Reasoned discount",
  waiver: "Remaining fee waived",
  external_receipt: "Staff-attested external receipt",
};
function inputAmount(amount: number, currency: string) {
  return formatMoney(amount, currency).split(" ")[1];
}
export function ChargeWorkbench() {
  const [w, setW] = useState<Workspace | null>(null),
    [selected, setSelected] = useState(""),
    [entryId, setEntryId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [formError, setFormError] = useState("");
  const [kind, setKind] = useState("discount"),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [reference, setReference] = useState("");
  const [feeAmount, setFeeAmount] = useState(""),
    [currency, setCurrency] = useState("CAD"),
    [paymentTerms, setPaymentTerms] = useState(""),
    [feeReason, setFeeReason] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/entry-charges", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Sign in to view entry charges."
            : "Entry charges could not be loaded.",
        );
      const next: Workspace = await r.json();
      setW(next);
      setSelected((old) =>
        next.divisions.some((d) => d.id === old)
          ? old
          : (next.divisions[0]?.id ?? ""),
      );
      setError("");
      setStale(false);
      return next;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }
  const recovery = useAuthorityCommand(
    w ? `wcp-entry-charges:${w.actorId}` : null,
    w?.actorId,
    async (saved) => {
      await load();
      const v = JSON.parse(saved.body);
      setSelected(v.divisionId);
      if (v.entryId) setEntryId(v.entryId);
      setReason("");
      setReference("");
      setAmount("");
    },
    async (saved) => {
      const next = await load(),
        v = JSON.parse(saved.body);
      return next.receipts.some(
        (r) =>
          r.requestId === v.requestId &&
          canonicalEntryCommand(r.command) === canonicalEntryCommand(v),
      );
    },
    (status) => {
      if (status === 409) setStale(true);
    },
  );
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  const d = w?.divisions.find((d) => d.id === selected),
    entries = w?.entries.filter((e) => e.divisionId === selected) ?? [],
    en = entries.find((e) => e.id === entryId) ?? entries[0];
  useEffect(() => {
    setEntryId("");
    setFormError("");
    setAmount("");
    setReason("");
    setReference("");
  }, [selected]);
  useEffect(() => {
    if (!recovery.pending) return;
    const saved = JSON.parse(recovery.pending.body);
    if (selected !== saved.divisionId) {
      setSelected(saved.divisionId);
      return;
    }
    if (saved.entryId) setEntryId(saved.entryId);
  }, [recovery.pending, selected]);
  useEffect(() => {
    if (d?.fee) {
      setCurrency(d.fee.currency);
      setFeeAmount(inputAmount(d.fee.feeMinor, d.fee.currency));
      setPaymentTerms(d.fee.paymentTerms);
    } else {
      setFeeAmount("");
      setPaymentTerms("");
    }
    setFeeReason("");
  }, [d?.id, d?.fee?.version]);
  const locked = recovery.locked || loading || !!error || stale;
  async function submit(action: string) {
    if (!d) return;
    setFormError("");
    try {
      let body: Record<string, unknown> = {
        action,
        divisionId: d.id,
        requestId: crypto.randomUUID(),
      };
      if (action === "revise_fee")
        body = {
          ...body,
          version: d.fee?.version ?? 0,
          terms: {
            feeMinor: parseMoney(feeAmount, currency),
            currency,
            paymentTerms,
          },
          reason: feeReason,
        };
      else {
        if (!en) return;
        body = {
          ...body,
          entryId: en.id,
          version: en.version,
          ...(action === "freeze"
            ? { expectedFeeVersion: d.fee?.version }
            : {}),
          reason,
          ...(action === "freeze"
            ? {}
            : {
                amountMinor: parseMoney(amount, en.charge!.currency),
                currency: en.charge!.currency,
                ...(action === "external_receipt"
                  ? { externalReference: reference }
                  : {}),
              }),
        };
      }
      await recovery.submit(
        "/api/v1/entry-charges",
        body,
        "Financial command recorded. Current balance and admission refreshed.",
      );
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  return (
    <main
      id="main"
      className="workspace registration-workspace"
      style={{ overflowWrap: "anywhere" }}
    >
      <p className="eyebrow">Entry finances</p>
      <h1>Entry charges &amp; external receipts</h1>
      <p>
        Review the normal entry fee, recorded exceptions and amount due.
        External receipts are staff attestations of money received elsewhere. No
        online payment is claimed.
      </p>
      <p>
        <a href="/admin/registration">
          Entry places &amp; registration terms →
        </a>{" "}
        · <a href="/admin">Your workspace</a>
      </p>
      {error && (
        <p role="alert" className="error">
          {w ? "Current financial view is stale. " : ""}
          {error}
        </p>
      )}
      {stale && (
        <p role="alert" className="error">
          The financial version changed. Refresh the ledger and review its
          current balance before preparing another command.
        </p>
      )}
      {formError && (
        <p role="alert" className="error">
          {formError}
        </p>
      )}
      <AuthorityRecovery state={recovery} label="financial" />
      <button
        className="secondary"
        disabled={loading || (!!w && recovery.locked)}
        onClick={() => void load().catch(() => {})}
      >
        {loading ? "Refreshing ledger…" : "Refresh ledger"}
      </button>
      {loading && !w ? (
        <p role="status">Loading entry charges…</p>
      ) : (
        w &&
        (!w.divisions.length ? (
          <p>
            No entry finances are available in your current organizer or
            team-season payment scope.
          </p>
        ) : (
          <>
            <label className="field-label" htmlFor="charge-division">
              Division
            </label>
            <select
              id="charge-division"
              value={selected}
              disabled={recovery.locked}
              onChange={(e) => setSelected(e.target.value)}
            >
              {w.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.eventName} · {d.name}
                </option>
              ))}
            </select>
            {d && (
              <>
                <p>
                  {d.eventName} · {d.name}
                </p>
                <section
                  className="ranking-history"
                  aria-label="Current fee policy"
                >
                  <h2>Fee for new charges</h2>
                  {d.fee ? (
                    <>
                      <p>
                        <strong>
                          {formatMoney(d.fee.feeMinor, d.fee.currency)}
                        </strong>{" "}
                        · fee version {d.fee.version}
                      </p>
                      <p>{d.fee.paymentTerms}</p>
                    </>
                  ) : (
                    <p>
                      Fee terms are unknown or not open. This does not mean the
                      entry is free or paid.
                    </p>
                  )}
                  <p>
                    Each entry keeps the fee version frozen at its first
                    admission request or invitation, or when staff explicitly
                    freezes its normal charge. Future fee revisions affect new
                    charges only. Manual and invited entries pay the normal fee
                    unless an explicit reasoned exception is recorded.
                  </p>
                  {d.staff && d.configured && (
                    <details>
                      <summary>Revise fees for new charges</summary>
                      <form
                        className="form-card registration-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submit("revise_fee");
                        }}
                      >
                        <fieldset disabled={locked}>
                          <legend>New fee version</legend>
                          <label htmlFor="fee-currency">Fee currency</label>
                          <select
                            id="fee-currency"
                            value={currency}
                            disabled={!!d.fee}
                            onChange={(e) => setCurrency(e.target.value)}
                          >
                            {Object.keys(currencyDigits).map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <label htmlFor="new-fee-amount">
                            New fee amount ({currency})
                          </label>
                          <input
                            id="new-fee-amount"
                            required
                            inputMode="decimal"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                          />
                          <label htmlFor="new-payment-terms">
                            New payment terms
                          </label>
                          <textarea
                            id="new-payment-terms"
                            required
                            maxLength={2000}
                            value={paymentTerms}
                            onChange={(e) => setPaymentTerms(e.target.value)}
                          />
                          <label htmlFor="fee-revision-reason">
                            Fee revision reason
                          </label>
                          <textarea
                            id="fee-revision-reason"
                            required
                            maxLength={1000}
                            value={feeReason}
                            onChange={(e) => setFeeReason(e.target.value)}
                          />
                          <p>
                            The division currency is fixed. Opened capacity,
                            format and reservation window stay as recorded.
                          </p>
                          <button type="submit">Save new fee version</button>
                        </fieldset>
                      </form>
                    </details>
                  )}
                  {d.feeHistory.length > 1 && (
                    <details>
                      <summary>Fee version history</summary>
                      <ol>
                        {d.feeHistory.map((f) => (
                          <li key={f.version}>
                            Version {f.version}:{" "}
                            {formatMoney(f.feeMinor, f.currency)} ·{" "}
                            {f.paymentTerms} · {f.reason}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </section>
                {!entries.length ? (
                  <p>
                    No team entries in this division are visible in your current
                    financial scope.
                  </p>
                ) : (
                  <>
                    <label className="field-label" htmlFor="charge-entry">
                      Team entry
                    </label>
                    <select
                      id="charge-entry"
                      value={en?.id ?? ""}
                      disabled={recovery.locked}
                      onChange={(e) => {
                        setEntryId(e.target.value);
                        setAmount("");
                        setReason("");
                        setReference("");
                        setFormError("");
                      }}
                    >
                      {entries.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {en && (
                      <section
                        className="ranking-history"
                        aria-label="Entry ledger"
                      >
                        <h2>{en.name}</h2>
                        <p>
                          Admission:{" "}
                          <strong>
                            {admissions[en.admissionState] ?? en.admissionState}
                          </strong>
                        </p>
                        <p>
                          Lineup: {en.rosterStatus}. Ranking eligibility is
                          assessed separately. This ledger does not record
                          withdrawal or promise a refund.
                        </p>
                        {en.deadline && (
                          <p>
                            Reservation deadline:{" "}
                            {new Date(en.deadline).toISOString()} (UTC). The
                            database deadline controls acceptance; refresh to
                            check expiry.
                          </p>
                        )}
                        {en.charge && en.balance ? (
                          <>
                            <dl>
                              <dt>Frozen normal fee</dt>
                              <dd>
                                {formatMoney(
                                  en.charge.feeMinor,
                                  en.charge.currency,
                                )}{" "}
                                · fee version {en.charge.feeVersion}
                              </dd>
                              <dt>Frozen payment terms</dt>
                              <dd>{en.charge.paymentTerms}</dd>
                              <dt>Discounts</dt>
                              <dd>
                                {formatMoney(
                                  en.balance.discountMinor,
                                  en.charge.currency,
                                )}
                              </dd>
                              <dt>Waivers</dt>
                              <dd>
                                {formatMoney(
                                  en.balance.waivedMinor,
                                  en.charge.currency,
                                )}
                              </dd>
                              <dt>External receipts</dt>
                              <dd>
                                {formatMoney(
                                  en.balance.externalMinor,
                                  en.charge.currency,
                                )}
                              </dd>
                              <dt>Amount due</dt>
                              <dd>
                                <strong data-testid="amount-due">
                                  {formatMoney(
                                    en.balance.dueMinor,
                                    en.charge.currency,
                                  )}
                                </strong>
                              </dd>
                            </dl>
                            <p>
                              {en.balance.status === "no_fee"
                                ? "No fee under the frozen terms."
                                : en.balance.dueMinor === 0
                                  ? "Balance cleared by the recorded exceptions and external receipts."
                                  : "An amount remains due."}{" "}
                              No online payment is claimed.
                            </p>
                            {en.balance.dueMinor === 0 &&
                              en.admissionState !== "accepted" && (
                                <p className="notice">
                                  <strong>Staff attention required.</strong> The
                                  balance does not reserve or restore a place.
                                  Expired, pending and waitlisted entries
                                  require a separate admission decision;
                                  released capacity is never reclaimed by this
                                  ledger.
                                </p>
                              )}
                            <h3>Charge history</h3>
                            <p>
                              Normal fee frozen from version{" "}
                              {en.charge.feeVersion} at{" "}
                              {new Date(en.charge.createdAt).toISOString()}{" "}
                              (UTC).
                            </p>
                            {!en.history.length ? (
                              <p>
                                No fee exceptions or external receipts recorded.
                              </p>
                            ) : (
                              <ol className="workspace-list">
                                {en.history.map((h) => (
                                  <li key={h.id}>
                                    <strong>{kinds[h.kind]}</strong>
                                    <p>
                                      {formatMoney(h.amountMinor, h.currency)} ·{" "}
                                      {new Date(h.createdAt).toISOString()}{" "}
                                      (UTC)
                                    </p>
                                    <p>{h.reason}</p>
                                    {h.externalReference && (
                                      <p>
                                        External reference:{" "}
                                        <span
                                          style={{ overflowWrap: "anywhere" }}
                                        >
                                          {h.externalReference}
                                        </span>
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                            {en.staff && en.balance.dueMinor > 0 && (
                              <form
                                className="form-card registration-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void submit(kind);
                                }}
                              >
                                <fieldset disabled={locked}>
                                  <legend>
                                    Record an exception or external receipt
                                  </legend>
                                  <label htmlFor="credit-kind">
                                    Adjustment type
                                  </label>
                                  <select
                                    id="credit-kind"
                                    value={kind}
                                    onChange={(e) => {
                                      setKind(e.target.value);
                                      if (e.target.value === "waiver")
                                        setAmount(
                                          inputAmount(
                                            en.balance!.dueMinor,
                                            en.charge!.currency,
                                          ),
                                        );
                                    }}
                                  >
                                    <option value="discount">Discount</option>
                                    <option value="waiver">
                                      Waive remaining fee
                                    </option>
                                    <option value="external_receipt">
                                      External receipt
                                    </option>
                                  </select>
                                  <label htmlFor="credit-amount">
                                    Amount ({en.charge.currency})
                                  </label>
                                  <input
                                    id="credit-amount"
                                    required
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                  />
                                  <label htmlFor="credit-reason">
                                    Adjustment reason
                                  </label>
                                  <textarea
                                    id="credit-reason"
                                    required
                                    maxLength={1000}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                  />
                                  {kind === "external_receipt" && (
                                    <div>
                                      <label htmlFor="credit-reference">
                                        External receipt reference
                                      </label>
                                      <input
                                        id="credit-reference"
                                        required
                                        maxLength={200}
                                        value={reference}
                                        onChange={(e) =>
                                          setReference(e.target.value)
                                        }
                                      />
                                    </div>
                                  )}
                                  <p>
                                    {kind === "external_receipt"
                                      ? "Confirm funds have actually been received outside this platform. This creates a staff-attested receipt, separate from provider transactions."
                                      : kind === "waiver"
                                        ? "A waiver covers the entire remaining amount. Use a discount for a partial exception."
                                        : "Record the approved reason for this reduction in the normal fee."}{" "}
                                    Credits cannot exceed the amount due.
                                  </p>
                                  <button type="submit">
                                    Record adjustment
                                  </button>
                                </fieldset>
                              </form>
                            )}
                          </>
                        ) : (
                          <>
                            <p>
                              No charge is frozen for this entry. Its fee is
                              unknown until terms can be established; no payment
                              or zero fee is implied.
                            </p>
                            {en.staff && d.fee && (
                              <form
                                className="form-card registration-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void submit("freeze");
                                }}
                              >
                                <fieldset disabled={locked}>
                                  <legend>
                                    Freeze the normal entry charge
                                  </legend>
                                  <p>
                                    New unadmitted entries use{" "}
                                    {formatMoney(
                                      d.fee.feeMinor,
                                      d.fee.currency,
                                    )}{" "}
                                    under fee version {d.fee.version}. Earlier
                                    admissions require their retained original
                                    terms.
                                  </p>
                                  <label htmlFor="credit-reason">
                                    Adjustment reason
                                  </label>
                                  <textarea
                                    id="credit-reason"
                                    required
                                    maxLength={1000}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                  />
                                  <button type="submit">
                                    Freeze normal charge
                                  </button>
                                </fieldset>
                              </form>
                            )}
                          </>
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        ))
      )}
    </main>
  );
}
