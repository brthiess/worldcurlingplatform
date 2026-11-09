"use client";
import { useEffect, useState } from "react";
import { canonicalEntryCommand } from "@/domain/entries";
import type { RegistrationTerms, AdmissionState } from "@/domain/registration";
import { AuthorityRecovery, useAuthorityCommand } from "./authority-command";
import { currencyDigits, formatMoney } from "@/domain/payments";
type Division = Partial<RegistrationTerms> & {
  id: string;
  name: string;
  eventName: string;
  version: number;
  manual: boolean;
  remaining: number | null;
  openedAt: string | null;
  feeVersion: number | null;
};
type Entry = {
  id: string;
  divisionId: string;
  name: string;
  state: AdmissionState;
  version: number;
  deadline: string | null;
  rosterStatus: string;
  canReadPayment: boolean;
  payment: {
    feeVersion: number;
    feeMinor: number;
    currency: string;
    dueMinor: number;
    discountMinor: number;
    waivedMinor: number;
    externalMinor: number;
    status: string;
  } | null;
};
function paymentLabel(entry: Entry) {
  if (!entry.canReadPayment)
    return "financial details require current team-season payment authority";
  const p = entry.payment;
  if (!p) return "unresolved — frozen fee terms have not been established";
  if (p.feeMinor === 0) return "not required under the frozen zero-fee terms";
  if (p.dueMinor > 0)
    return `unpaid — ${formatMoney(p.dueMinor, p.currency)} due under frozen fee version ${p.feeVersion}`;
  const records = [
    p.discountMinor > 0 ? "discounts" : null,
    p.waivedMinor > 0 ? "waivers" : null,
    p.externalMinor > 0 ? "staff-attested external receipts" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `balance cleared by recorded ${records} (${formatMoney(0, p.currency)} due)`;
}
type Workspace = {
  actorId: string;
  now: string;
  divisions: Division[];
  entries: Entry[];
  receipts: { requestId: string; commandDigest: string }[];
};
const initial: RegistrationTerms = {
  mode: "open",
  capacity: 16,
  requirements: "",
  feeMinor: 0,
  currency: "CAD",
  paymentTerms: "",
  paymentWindowMinutes: 60,
  format: "single_knockout",
  formatNotes: "",
};
const labels: Record<AdmissionState, string> = {
  pending: "Pending admission",
  invited: "Invited — place not reserved",
  held: "Held — awaiting payment",
  accepted: "Accepted",
  expired: "Expired — capacity released",
  waitlisted: "Waitlisted — no reserved place",
};
export function RegistrationWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [selected, setSelected] = useState(""),
    [terms, setTerms] = useState(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/registration", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Sign in to manage or request an entry place."
            : "Entry places could not be loaded.",
        );
      const w: Workspace = await r.json();
      setWorkspace(w);
      setSelected((old) => old || w.divisions[0]?.id || "");
      setError("");
      setStale(false);
      return w;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }
  const recovery = useAuthorityCommand(
    workspace ? `wcp-registration:${workspace.actorId}` : null,
    workspace?.actorId,
    async (saved) => {
      await load();
      setSelected(JSON.parse(saved.body).divisionId);
    },
    async (saved) => {
      const w = await load(),
        v = JSON.parse(saved.body);
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalEntryCommand(v)),
      );
      const commandDigest = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const found = w.receipts.some(
        (r) => r.requestId === v.requestId && r.commandDigest === commandDigest,
      );
      if (found) setSelected(v.divisionId);
      return found;
    },
    (status) => {
      if (status === 409) setStale(true);
    },
  );
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  const d = workspace?.divisions.find((d) => d.id === selected);
  const entries =
    workspace?.entries.filter((e) => e.divisionId === selected) ?? [];
  async function send(action: string, entry?: Entry) {
    await recovery.submit(
      "/api/v1/registration",
      {
        action,
        divisionId: selected,
        requestId: crypto.randomUUID(),
        version: entry?.version ?? d?.version ?? 0,
        expectedFeeVersion: d?.feeVersion,
        ...(entry ? { entryId: entry.id } : {}),
        ...(action === "open" ? { terms } : {}),
      },
      "Registration command recorded. Current capacity and admission states refreshed.",
    );
  }
  return (
    <main id="main" className="workspace registration-workspace">
      <p className="eyebrow">Entries & capacity</p>
      <h1>Division entry places</h1>
      <p>
        Review entry terms, request a place or accept a team. Admission, event
        lineup, payment and ranking assessment are recorded separately.
      </p>
      <p>
        <a href="/admin/entries">Create or amend a team entry →</a> ·{" "}
        <a href="/admin/entry-charges">Entry charge ledger →</a> ·{" "}
        <a href="/admin">Your workspace</a>
      </p>
      {error && (
        <p role="alert" className="error">
          {workspace ? "Current capacity is stale. " : ""}
          {error}
        </p>
      )}
      {stale && (
        <p role="alert" className="error">
          Admission changed in another tab. Refresh capacity before sending a
          new decision.
        </p>
      )}
      <AuthorityRecovery state={recovery} label="registration" />
      <button
        className="secondary"
        disabled={loading || (!!workspace && recovery.locked)}
        onClick={() => void load().catch(() => {})}
      >
        {loading ? "Refreshing capacity…" : "Refresh capacity"}
      </button>
      {loading && !workspace ? (
        <p role="status">Loading entry terms and capacity…</p>
      ) : (
        workspace && (
          <>
            {!workspace.divisions.length ? (
              <p>
                No divisions are available in your current organizer or
                team-season scope.
              </p>
            ) : (
              <>
                <label className="field-label" htmlFor="registration-division">
                  Division
                </label>
                <select
                  id="registration-division"
                  value={selected}
                  disabled={recovery.locked}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setTerms(initial);
                    setStale(false);
                  }}
                >
                  {workspace.divisions.map((d) => (
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
                      aria-label="Entry terms"
                    >
                      <h2>
                        {d.mode
                          ? `${d.mode === "invited" ? "Invitation-only" : d.mode === "reviewed" ? "Reviewed" : "Open"} entry`
                          : "Registration not open"}
                      </h2>
                      {d.mode ? (
                        <>
                          <p className="notice">
                            <strong>
                              {d.remaining} of {d.capacity} places remaining
                            </strong>{" "}
                            · checked {new Date(workspace.now).toLocaleString()}{" "}
                            (your local time)
                          </p>
                          <dl>
                            <dt>Entry requirements</dt>
                            <dd>{d.requirements}</dd>
                            <dt>Entry fee</dt>
                            <dd>
                              {!d.feeVersion ||
                              !d.currency ||
                              !Object.hasOwn(currencyDigits, d.currency)
                                ? "Fee terms are unknown or unsupported; staff review is required."
                                : d.feeMinor === 0
                                  ? "No entry fee"
                                  : formatMoney(d.feeMinor!, d.currency)}
                            </dd>
                            <dt>Payment terms</dt>
                            <dd>{d.paymentTerms}</dd>
                            <dt>Payment reservation window</dt>
                            <dd>
                              {d.paymentWindowMinutes} minutes after acceptance;
                              unpaid holds expire and release their place.
                            </dd>
                            <dt>Documented format</dt>
                            <dd>
                              {d.format?.replaceAll("_", " ")} · {d.formatNotes}
                            </dd>
                          </dl>
                          <p>
                            Capacity, requirements and format are retained as
                            opened. The fee shown applies to new charges; each
                            entry retains its frozen fee in the charge ledger. A
                            held place has an unpaid balance. Late settlement
                            after expiry requires staff attention and cannot
                            restore a released place.
                          </p>
                          {d.manual && (
                            <button
                              className="secondary"
                              disabled={recovery.locked || !!error || stale}
                              onClick={() => void send("expire")}
                            >
                              Release expired holds
                            </button>
                          )}
                        </>
                      ) : d.manual ? (
                        <form
                          className="form-card registration-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void send("open");
                          }}
                        >
                          <p>
                            Complete all terms before opening. The edition must
                            be approved and published, with no competition draw
                            yet.
                          </p>
                          <fieldset
                            disabled={recovery.locked || !!error || stale}
                          >
                            <legend>Opening terms</legend>
                            <label htmlFor="registration-mode">
                              Entry mode
                            </label>
                            <select
                              id="registration-mode"
                              value={terms.mode}
                              onChange={(e) =>
                                setTerms({
                                  ...terms,
                                  mode: e.target
                                    .value as RegistrationTerms["mode"],
                                })
                              }
                            >
                              <option value="open">Open</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="invited">Invitation-only</option>
                            </select>
                            <label>
                              Capacity
                              <input
                                type="number"
                                required
                                min={1}
                                max={256}
                                value={terms.capacity}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    capacity: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Entry requirements
                              <textarea
                                required
                                maxLength={2000}
                                value={terms.requirements}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    requirements: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Fee in minor units
                              <input
                                type="number"
                                required
                                min={0}
                                max={100000000}
                                value={terms.feeMinor}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    feeMinor: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Currency code
                              <input
                                required
                                pattern="[A-Z]{3}"
                                maxLength={3}
                                value={terms.currency}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    currency: e.target.value.toUpperCase(),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Payment terms
                              <textarea
                                required
                                maxLength={2000}
                                value={terms.paymentTerms}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    paymentTerms: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Payment window in minutes
                              <input
                                required
                                type="number"
                                min={1}
                                max={43200}
                                value={terms.paymentWindowMinutes}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    paymentWindowMinutes: Number(
                                      e.target.value,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label htmlFor="registration-format">
                              Format family
                            </label>
                            <select
                              id="registration-format"
                              value={terms.format}
                              onChange={(e) =>
                                setTerms({ ...terms, format: e.target.value })
                              }
                            >
                              {[
                                "single_knockout",
                                "double_knockout",
                                "triple_knockout",
                                "round_robin",
                                "page_playoff",
                                "swiss",
                                "pool_playoff",
                              ].map((f) => (
                                <option key={f} value={f}>
                                  {f.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                            <label>
                              Format configuration
                              <textarea
                                required
                                maxLength={2000}
                                value={terms.formatNotes}
                                onChange={(e) =>
                                  setTerms({
                                    ...terms,
                                    formatNotes: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <button type="submit">
                              Open entries with these terms
                            </button>
                          </fieldset>
                        </form>
                      ) : (
                        <p>
                          The organizer has not opened entry terms. A submitted
                          lineup does not reserve a place.
                        </p>
                      )}
                    </section>
                    <section aria-label="Admission decisions">
                      <h2>Team admission</h2>
                      {!entries.length ? (
                        <p>
                          No team entries in this division are visible in your
                          current scope. Create an entry before requesting a
                          place.
                        </p>
                      ) : (
                        <ul className="workspace-list">
                          {entries.map((e) => (
                            <li key={e.id}>
                              <h3>{e.name}</h3>
                              <p>
                                <strong>{labels[e.state]}</strong> · admission
                                version {e.version}
                              </p>
                              {e.deadline && (
                                <p>
                                  Payment deadline:{" "}
                                  <time dateTime={e.deadline}>
                                    {new Date(e.deadline).toISOString()}
                                  </time>{" "}
                                  (UTC). Refresh capacity to check expiry.
                                </p>
                              )}
                              <p>
                                Lineup: {e.rosterStatus}. Payment:{" "}
                                {paymentLabel(e)}. Ranking eligibility: separate
                                assessment.
                              </p>
                              {e.canReadPayment && (
                                <p>
                                  <a
                                    href={`/admin/entry-charges?division=${encodeURIComponent(e.divisionId)}&entry=${encodeURIComponent(e.id)}`}
                                  >
                                    Review this entry’s charge history →
                                  </a>
                                </p>
                              )}
                              {d.mode &&
                                ["pending", "invited"].includes(e.state) && (
                                  <div className="ranking-actions">
                                    {(d.mode !== "invited" ||
                                      e.state === "invited") && (
                                      <button
                                        disabled={
                                          recovery.locked || !!error || stale
                                        }
                                        onClick={() => void send("request", e)}
                                      >
                                        {d.mode === "reviewed"
                                          ? "Submit for review"
                                          : "Request entry place"}
                                      </button>
                                    )}
                                    {d.manual && d.mode === "reviewed" && (
                                      <button
                                        disabled={
                                          recovery.locked || !!error || stale
                                        }
                                        onClick={() => void send("accept", e)}
                                      >
                                        Accept entry
                                      </button>
                                    )}
                                    {d.manual &&
                                      d.mode === "invited" &&
                                      e.state === "pending" && (
                                        <button
                                          disabled={
                                            recovery.locked || !!error || stale
                                          }
                                          onClick={() => void send("invite", e)}
                                        >
                                          Invite entry
                                        </button>
                                      )}
                                  </div>
                                )}
                              {["expired", "waitlisted"].includes(e.state) && (
                                <p>
                                  No automatic promotion or reservation
                                  recovery. Contact the organizer for a separate
                                  staff decision.
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </>
        )
      )}
    </main>
  );
}
