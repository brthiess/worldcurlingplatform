"use client";
import { useEffect, useState } from "react";
import { ResponsibilityControls } from "./authority-workbench";
import {
  disciplines,
  nextEdition,
  type ApplicationInput,
} from "@/domain/applications";
type Summary = {
  id: string;
  name: string;
  startsOn: string;
  status: string;
  version: number;
  reviewerName: string;
};
type Detail = Omit<ApplicationInput, "divisions"> &
  Summary & {
    origin: string;
    registrationStatus: string;
    canReview: boolean;
    canEdit: boolean;
    canReassign: boolean;
    authorityName: string;
    responsibilityActive: boolean;
    organizationName: string;
    seriesName: string;
    divisions: (ApplicationInput["divisions"][number] & {
      rankingStatus: string;
    })[];
    history: {
      version: number;
      action: string;
      reason: string;
      actorName: string;
      createdAt: string;
      snapshot: ApplicationInput & {
        authorityName?: string;
        reviewerName?: string;
      };
    }[];
  };
type Workspace = {
  organizations: { id: string; name: string; reviewerName: string }[];
  series: { id: string; name: string; organizationId: string }[];
  applications: Summary[];
  isAdministrator: boolean;
};
type Pending = { id: string; creating: boolean; body: Record<string, unknown> };
function blank(organizationId = "", seriesId = ""): ApplicationInput {
  return {
    organizationId,
    seriesId,
    name: "",
    startsOn: "",
    endsOn: "",
    city: "",
    country: "",
    venue: "",
    timezone: "UTC",
    divisions: [{ id: crypto.randomUUID(), name: "", discipline: "men_four" }],
  };
}
export function ApplicationsWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [form, setForm] = useState<ApplicationInput | null>(null),
    [newId, setNewId] = useState(""),
    [loading, setLoading] = useState(true),
    [working, setBusy] = useState(false),
    [responsibilityPending, setResponsibilityPending] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState<Pending | null>(null),
    [queue, setQueue] = useState("all");
  const busy = working || responsibilityPending;
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/applications", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Sign in to work on event applications."
            : "Applications could not be loaded.",
        );
      setWorkspace(await r.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function open(id: string) {
    setBusy(true);
    setNotice("");
    setError("");
    setFields({});
    setPending(null);
    try {
      const r = await fetch(`/api/v1/applications/${id}`, {
        cache: "no-store",
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setDetail(result);
      setForm(result);
      setReason("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function start() {
    const org = workspace?.organizations[0]?.id ?? "";
    setDetail(null);
    setForm(
      blank(org, workspace?.series.find((s) => s.organizationId === org)?.id),
    );
    setNewId(crypto.randomUUID());
    setError("");
    setFields({});
    setNotice("");
    setPending(null);
  }
  async function save(command: Pending) {
    setBusy(true);
    setError("");
    setFields({});
    setNotice("");
    setPending(command);
    try {
      const r = await fetch(
        command.creating
          ? "/api/v1/applications"
          : `/api/v1/applications/${command.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command.body),
        },
      );
      const result = await r.json();
      if (!r.ok) {
        setFields(result.fields ?? {});
        if (r.status < 500) setPending(null);
        throw new Error(result.error);
      }
      setDetail(result);
      setForm(result);
      setPending(null);
      setNotice(
        command.body.action === "submit"
          ? "Application submitted."
          : command.body.action === "approve"
            ? "Edition admitted to the public calendar."
            : command.body.action === "reject"
              ? "Application returned to the organizer."
              : "Saved to the database.",
      );
      setReason("");
      const w = await fetch("/api/v1/applications", { cache: "no-store" });
      if (w.ok) setWorkspace(await w.json());
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Your save could not be confirmed. Reconnect and retry the last save."
          : (e as Error).message || "The save could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function command(action: string) {
    void save({
      id: detail?.id ?? newId,
      creating: !detail,
      body: {
        requestId: crypto.randomUUID(),
        id: detail?.id ?? newId,
        action,
        version: detail?.version,
        ...(action === "create" || action === "edit"
          ? { application: form }
          : {}),
        reason,
      },
    });
  }
  function update(key: keyof ApplicationInput, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }
  function field(
    key: keyof ApplicationInput,
    label: string,
    type = "text",
    optional = false,
  ) {
    return (
      <div>
        <label htmlFor={`app-${key}`}>
          {label}
          {optional ? " (optional)" : ""}
        </label>
        <input
          id={`app-${key}`}
          type={type}
          value={String(form?.[key] ?? "")}
          maxLength={key === "name" || key === "venue" ? 160 : 80}
          aria-invalid={!!fields[key]}
          aria-describedby={fields[key] ? `error-${key}` : undefined}
          onChange={(e) => update(key, e.target.value)}
        />
        {fields[key] && (
          <p className="field-error" id={`error-${key}`}>
            {fields[key]}
          </p>
        )}
      </div>
    );
  }
  const dirty = !!detail && JSON.stringify(form) !== JSON.stringify(detail);
  return (
    <main id="main" className="applications">
      <p className="eyebrow">Event operations</p>
      <h1>Event applications</h1>
      <p className="muted">
        Apply for a dated edition, review admission, and preserve each year's
        record.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          {detail && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void open(detail.id)}
            >
              Reload current version
            </button>
          )}
          {pending && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void save(pending)}
            >
              Retry last save
            </button>
          )}
          {!workspace && (
            <>
              <a href="/admin">Sign in / workspace</a>{" "}
              <button className="secondary" onClick={() => void load()}>
                Try again
              </button>
            </>
          )}
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading event applications…
        </p>
      ) : (
        workspace && (
          <>
            <div className="application-actions">
              {workspace.organizations.length > 0 && (
                <button onClick={start} disabled={busy}>
                  New edition
                </button>
              )}
              <a href="/events">Public calendar</a>
              <a href="/admin">Your workspace</a>
            </div>
            <div className="application-layout">
              <aside className="application-queue">
                <h2>
                  {workspace.isAdministrator ? "Review queue" : "Your editions"}
                </h2>
                <label htmlFor="queue-status">Application status</label>
                <select
                  id="queue-status"
                  disabled={busy}
                  value={queue}
                  onChange={(e) => setQueue(e.target.value)}
                >
                  <option value="all">All applications</option>
                  <option value="submitted">Awaiting review</option>
                  <option value="draft">Drafts</option>
                  <option value="approved">Admitted</option>
                  <option value="rejected">Returned</option>
                </select>
                <ul className="workspace-list">
                  {workspace.applications
                    .filter((a) => queue === "all" || a.status === queue)
                    .map((a) => (
                      <li key={a.id}>
                        <span className="badge">{a.status}</span>
                        <h3>{a.name}</h3>
                        <p className="muted">
                          {a.startsOn} · v{a.version}
                        </p>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => void open(a.id)}
                          aria-label={`Review ${a.name}`}
                        >
                          Open application
                        </button>
                      </li>
                    ))}
                </ul>
                {!workspace.applications.some(
                  (a) => queue === "all" || a.status === queue,
                ) && <p className="empty">No applications in this view.</p>}
              </aside>
              <section
                aria-label="Application details"
                className="application-detail"
              >
                {!form ? (
                  <p className="empty">
                    Choose an application or begin a new edition.
                  </p>
                ) : (
                  <>
                    <h2>{detail ? detail.name : "New dated edition"}</h2>
                    {detail && (
                      <>
                        <p>
                          <span className="badge">{detail.status}</span> ·
                          Version {detail.version}
                        </p>
                        <p>
                          <strong>Responsible authority:</strong>{" "}
                          {detail.authorityName}
                          {" · "}
                          {detail.reviewerName}
                        </p>
                        {!detail.responsibilityActive && (
                          <p className="notice">
                            This responsibility is inactive or outside its
                            grant. World Curling must explicitly reassign the
                            application.
                          </p>
                        )}
                        <p className="muted">
                          Application identifier: {detail.id}
                        </p>
                        <div className="application-states">
                          <p>Registration: {detail.registrationStatus}</p>
                          <p>
                            Public admission:{" "}
                            {detail.status === "approved"
                              ? "admitted"
                              : "not admitted"}
                          </p>
                          <p>
                            Ranking eligibility is determined separately for
                            each division.
                          </p>
                        </div>
                        {!detail.venue && (
                          <p className="muted">Venue not confirmed</p>
                        )}
                        {detail.status === "approved" && (
                          <p>
                            <a href={`/events/${detail.id}`}>
                              View public edition
                            </a>
                          </p>
                        )}
                        {workspace.organizations.length > 0 && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => {
                              const year = (date: string) =>
                                `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`;
                              setForm(
                                nextEdition(
                                  detail,
                                  year(detail.startsOn),
                                  year(detail.endsOn),
                                  detail.divisions.map(() =>
                                    crypto.randomUUID(),
                                  ),
                                ),
                              );
                              setDetail(null);
                              setNewId(crypto.randomUUID());
                              setFields({});
                              setNotice(
                                "New edition copied. Review its dates and details before saving.",
                              );
                              setError("");
                              setPending(null);
                            }}
                          >
                            Create next year's edition
                          </button>
                        )}
                      </>
                    )}
                    <form
                      noValidate
                      className="form-card application-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        command(detail ? "edit" : "create");
                      }}
                    >
                      <p className="muted">
                        Save essential dates, location and divisions as a draft.
                        The venue and competition setup may follow later.
                      </p>
                      <fieldset
                        disabled={
                          busy || !!pending || (!!detail && !detail.canEdit)
                        }
                      >
                        <legend>Edition details</legend>
                        <label htmlFor="app-organization">
                          Organizing organization
                        </label>
                        <select
                          id="app-organization"
                          value={form.organizationId}
                          disabled={!!detail}
                          onChange={(e) => {
                            const org = e.target.value;
                            setForm({
                              ...form,
                              organizationId: org,
                              seriesId:
                                workspace.series.find(
                                  (s) => s.organizationId === org,
                                )?.id ?? "",
                              newSeriesName: undefined,
                            });
                          }}
                        >
                          {!workspace.organizations.some(
                            (o) => o.id === form.organizationId,
                          ) && (
                            <option value={form.organizationId}>
                              {detail?.organizationName ??
                                "Choose organization"}
                            </option>
                          )}
                          {workspace.organizations.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        {fields.organizationId && (
                          <p className="field-error">{fields.organizationId}</p>
                        )}
                        <label htmlFor="app-series">
                          Recurring event series
                        </label>
                        <select
                          id="app-series"
                          value={
                            form.newSeriesName !== undefined
                              ? "new"
                              : form.seriesId
                          }
                          disabled={!!detail}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              seriesId:
                                e.target.value === "new"
                                  ? crypto.randomUUID()
                                  : e.target.value,
                              newSeriesName:
                                e.target.value === "new" ? "" : undefined,
                            })
                          }
                        >
                          {!workspace.series.some(
                            (s) => s.id === form.seriesId,
                          ) && (
                            <option value={form.seriesId}>
                              {detail?.seriesName ?? "Choose series"}
                            </option>
                          )}
                          {workspace.series
                            .filter(
                              (s) => s.organizationId === form.organizationId,
                            )
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          {!detail && (
                            <option value="new">
                              Create a new recurring series
                            </option>
                          )}
                        </select>
                        {form.newSeriesName !== undefined &&
                          field("newSeriesName", "New recurring series name")}
                        {fields.seriesId && (
                          <p className="field-error">{fields.seriesId}</p>
                        )}
                        {field("name", "Edition name")}
                        <div className="form-grid">
                          {field("startsOn", "Start date", "date")}
                          {field("endsOn", "End date", "date")}
                          {field("city", "City")}
                          {field("country", "Country")}
                        </div>
                        {field("venue", "Venue", "text", true)}
                        {field("timezone", "Venue time zone")}
                        <label htmlFor="app-category">Event category</label>
                        <input
                          id="app-category"
                          value={form.category ?? "open"}
                          onChange={(e) => update("category", e.target.value)}
                          maxLength={80}
                        />
                        {fields.category && (
                          <p className="field-error">{fields.category}</p>
                        )}
                        <h3>Proposed divisions</h3>
                        {fields.divisions && (
                          <p className="field-error">{fields.divisions}</p>
                        )}
                        {form.divisions.map((d, i) => (
                          <div className="division-form" key={d.id}>
                            <label htmlFor={`division-${d.id}`}>
                              Division {i + 1} name
                            </label>
                            <input
                              id={`division-${d.id}`}
                              maxLength={80}
                              value={d.name}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  divisions: form.divisions.map((v) =>
                                    v.id === d.id
                                      ? { ...v, name: e.target.value }
                                      : v,
                                  ),
                                })
                              }
                            />
                            <label htmlFor={`discipline-${d.id}`}>
                              Division {i + 1} discipline
                            </label>
                            <select
                              id={`discipline-${d.id}`}
                              value={d.discipline}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  divisions: form.divisions.map((v) =>
                                    v.id === d.id
                                      ? { ...v, discipline: e.target.value }
                                      : v,
                                  ),
                                })
                              }
                            >
                              {Object.entries(disciplines).map(
                                ([value, label]) => (
                                  <option value={value} key={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            {fields[`divisions.${i}`] && (
                              <p className="field-error">
                                {fields[`divisions.${i}`]}
                              </p>
                            )}
                            {detail && (
                              <p className="muted">
                                Ranking eligibility:{" "}
                                {detail.divisions.find((v) => v.id === d.id)
                                  ?.rankingStatus ?? "unresolved"}
                              </p>
                            )}
                            {form.divisions.length > 1 && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    divisions: form.divisions.filter(
                                      (v) => v.id !== d.id,
                                    ),
                                  })
                                }
                              >
                                Remove division {i + 1}
                              </button>
                            )}
                          </div>
                        ))}
                        {form.divisions.length < 12 && (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                divisions: [
                                  ...form.divisions,
                                  {
                                    id: crypto.randomUUID(),
                                    name: "",
                                    discipline: "men_four",
                                  },
                                ],
                              })
                            }
                          >
                            Add division
                          </button>
                        )}
                        <div>
                          {(!detail || detail.canEdit) && (
                            <button type="submit">
                              {busy
                                ? "Saving…"
                                : detail
                                  ? "Save changes"
                                  : "Save draft"}
                            </button>
                          )}
                        </div>
                      </fieldset>
                    </form>
                    {detail && (
                      <div className="review-actions">
                        <p className="muted">
                          Submit or review the saved version above. Save any
                          field changes first.
                        </p>
                        {detail.canEdit &&
                          ["draft", "rejected"].includes(detail.status) && (
                            <button
                              disabled={busy || !!pending || dirty}
                              onClick={() => command("submit")}
                            >
                              Submit for review
                            </button>
                          )}
                        {detail.status === "submitted" && detail.canReview && (
                          <>
                            <label htmlFor="review-reason">
                              Review note / rejection reason
                            </label>
                            <textarea
                              id="review-reason"
                              value={reason}
                              maxLength={1000}
                              onChange={(e) => setReason(e.target.value)}
                            />
                            {fields.reason && (
                              <p className="field-error">{fields.reason}</p>
                            )}
                            <div className="application-actions">
                              <button
                                disabled={busy || !!pending || dirty}
                                onClick={() => command("approve")}
                              >
                                Approve onto calendar
                              </button>
                              <button
                                className="secondary"
                                disabled={busy || !!pending || dirty}
                                onClick={() => command("reject")}
                              >
                                Return to organizer
                              </button>
                            </div>
                          </>
                        )}
                        {detail.status === "submitted" && !detail.canReview && (
                          <p>Awaiting the responsible reviewer's decision.</p>
                        )}
                        {detail.canReassign && (
                          <ResponsibilityControls
                            id={detail.id}
                            version={detail.version}
                            onPendingChange={setResponsibilityPending}
                            onSaved={async () => {
                              if (!(await open(detail.id)))
                                throw new Error("Application refresh failed");
                              try {
                                const response = await fetch(
                                  "/api/v1/applications",
                                  { cache: "no-store" },
                                );
                                if (!response.ok) throw new Error();
                                setWorkspace(await response.json());
                              } catch {
                                setError(
                                  "Responsibility changed, but the queue could not be refreshed. Reload the current version.",
                                );
                                throw new Error("Queue refresh failed");
                              }
                            }}
                          />
                        )}
                        <h3>Application history</h3>
                        {detail.history.length === 0 ? (
                          <p>
                            No application changes recorded for this foundation
                            edition.
                          </p>
                        ) : (
                          <ol className="history-list">
                            {detail.history.map((h) => (
                              <li key={h.version}>
                                <strong>
                                  Version {h.version} ·{" "}
                                  {(
                                    {
                                      create: "Draft created",
                                      edit: "Edition details saved",
                                      submit: "Submitted for review",
                                      approve: "Admitted",
                                      reject: "Returned to organizer",
                                      reassign: "Responsibility reassigned",
                                      override_approve:
                                        "World Curling override: admitted",
                                      override_reject:
                                        "World Curling override: returned",
                                    } as Record<string, string>
                                  )[h.action] ?? h.action}
                                </strong>
                                <p>
                                  {h.actorName} ·{" "}
                                  {new Date(h.createdAt).toLocaleString(
                                    "en-CA",
                                    { timeZone: "UTC" },
                                  )}{" "}
                                  UTC
                                </p>
                                {h.reason && <p>{h.reason}</p>}
                                <details>
                                  <summary>
                                    View recorded edition details
                                  </summary>
                                  <p>
                                    {h.snapshot.name} · {h.snapshot.startsOn} –{" "}
                                    {h.snapshot.endsOn}
                                  </p>
                                  <p>
                                    {h.snapshot.city}, {h.snapshot.country} ·{" "}
                                    {h.snapshot.venue || "Venue not confirmed"}
                                  </p>
                                  {h.snapshot.authorityName && (
                                    <p>
                                      Responsible authority:{" "}
                                      {h.snapshot.authorityName} ·{" "}
                                      {h.snapshot.reviewerName}
                                    </p>
                                  )}
                                  <ul>
                                    {h.snapshot.divisions.map((d) => (
                                      <li key={d.id}>
                                        {d.name} ·{" "}
                                        {
                                          disciplines[
                                            d.discipline as keyof typeof disciplines
                                          ]
                                        }
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )
      )}
    </main>
  );
}
