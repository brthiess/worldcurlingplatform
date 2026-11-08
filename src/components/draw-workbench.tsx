"use client";
import { useEffect, useRef, useState } from "react";
import type { drawWorkspace } from "@/modules/draws/draws";
import { DrawPanel } from "./draw-panel";
import type { RetainedAuthorityCommand } from "./authority-command";
import { SINGLE_TEMPLATE, TRIPLE_TEMPLATE } from "@/domain/draws";
type Data = Awaited<ReturnType<typeof drawWorkspace>>;
type Choice = { id: string; name: string; eventId: string; eventName: string };
export function DrawWorkbench() {
  const sequence = useRef(0);
  const [divisions, setDivisions] = useState<Choice[]>([]),
    [divisionId, setDivisionId] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [seeds, setSeeds] = useState<string[]>(Array(6).fill("")),
    [count, setCount] = useState(6),
    [template, setTemplate] = useState(SINGLE_TEMPLATE),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<RetainedAuthorityCommand | null>(null),
    [stale, setStale] = useState(false);
  async function load(id: string) {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/v1/divisions/${encodeURIComponent(id)}/draw`,
        { cache: "no-store" },
      );
      const next = await r.json();
      if (current !== sequence.current) return;
      if (!r.ok) throw new Error(next.error);
      setData(next);
      setStale(false);
      const raw = sessionStorage.getItem(
        `wcp.draw-command.${next.actorId}.${id}`,
      );
      if (raw) {
        const saved = JSON.parse(raw) as RetainedAuthorityCommand;
        if (
          saved.actorId !== next.actorId ||
          saved.path !== `/api/v1/divisions/${encodeURIComponent(id)}/draw` ||
          typeof saved.body !== "string" ||
          typeof JSON.parse(saved.body)?.requestId !== "string"
        )
          throw new Error(
            "Retained command could not be read. Editing stays locked until this tab’s recovery data is reviewed.",
          );
        setPending(saved);
      } else setPending(null);
      setError("");
      setCount(next.seeds.length || 6);
      setTemplate(next.template);
      setSeeds(
        next.seeds.length
          ? next.seeds.map((s: { entryId: string }) => s.entryId)
          : Array(6).fill(""),
      );
      setReason("");
      setStatus("Loaded accepted draw revision.");
    } catch (e) {
      if (current === sequence.current) {
        setError((e as Error).message || "Draw could not be loaded.");
        setStale(true);
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await fetch("/api/v1/entries", { cache: "no-store" });
        const w = await r.json();
        if (!r.ok) throw new Error(w.error);
        if (!active) return;
        const editable = w.divisions.filter(
          (d: Choice & { manual: boolean }) => d.manual,
        );
        setDivisions(editable);
        const requested = new URLSearchParams(window.location.search).get(
          "division",
        );
        const id = requested ?? editable[0]?.id ?? "";
        if (editable.some((d: Choice) => d.id === id)) {
          setDivisionId(id);
          await load(id);
        } else {
          setLoading(false);
          if (requested)
            setError("This division is outside your editable scope.");
        }
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      sequence.current++;
    };
  }, []);
  async function save(command: unknown, retained?: RetainedAuthorityCommand) {
    if (!data || busy || (pending && !retained)) return;
    const saved = retained ?? {
      actorId: data.actorId,
      path: `/api/v1/divisions/${encodeURIComponent(divisionId)}/draw`,
      body: JSON.stringify(command),
      message: "Draw revision",
      acknowledged: false,
    };
    const key = `wcp.draw-command.${saved.actorId}.${divisionId}`;
    try {
      sessionStorage.setItem(key, JSON.stringify(saved));
    } catch {
      setError("Recovery storage is unavailable. No command was sent.");
      setStale(true);
      return;
    }
    setBusy(true);
    setError("");
    setPending(saved);
    setStatus("Sending draw revision…");
    try {
      const r = await fetch(saved.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WCP-Actor": saved.actorId,
        },
        body: saved.body,
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status < 500 && !retained) {
          sessionStorage.removeItem(key);
          setPending(null);
          if (r.status === 409) setStale(true);
        }
        throw new Error(result.error);
      }
      setData((old) => (old ? { ...old, ...result } : old));
      sessionStorage.removeItem(key);
      setPending(null);
      setStatus(`Saved ${result.state} revision ${result.version}.`);
      setReason("");
      // Keep the accepted command response visible even if a history refresh fails.
      try {
        const history = await fetch(
          `/api/v1/divisions/${encodeURIComponent(divisionId)}/draw`,
          { cache: "no-store" },
        );
        if (history.ok) setData(await history.json());
      } catch {
        setError(
          "The draw was saved. Revision history could not refresh; reload the accepted draw to review it.",
        );
      }
    } catch (e) {
      setError(
        (e as Error).message ||
          "Save could not be confirmed. Retry the same request safely.",
      );
      setStatus("Save needs attention.");
    } finally {
      setBusy(false);
    }
  }
  function command(action: "preview" | "publish") {
    if (!data) return;
    void save({
      requestId: crypto.randomUUID(),
      expectedVersion: data.version,
      action,
      reason,
      ...(action === "preview" ? { seedEntryIds: seeds, template } : {}),
    });
  }
  const locked =
    busy || !!pending || stale || loading || data?.state === "published";
  return (
    <main id="main" className="workspace draw-workspace">
      <p className="eyebrow">Organizer operations</p>
      <h1>Competition draw</h1>
      <p>
        <a href="/admin">← Workspace</a> ·{" "}
        <a href="/admin/schedule">Draw scheduling</a>
      </p>
      <p>
        Choose a documented profile and distinct entries in seed order. Review
        every stored route before publication. Schedule actual games separately.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{loading ? "Loading saved draw…" : status}</p>
      {!!pending && !busy && (
        <div className="notice">
          The original command is retained for this signed-in account in this
          tab. Editing stays locked after a reload until the same request is
          confirmed.{" "}
          <button onClick={() => void save(JSON.parse(pending.body), pending)}>
            Retry same request
          </button>
        </div>
      )}
      {!pending && divisionId && (
        <button
          className="secondary"
          disabled={busy || loading}
          onClick={() => void load(divisionId)}
        >
          Reload accepted draw
        </button>
      )}
      <label htmlFor="draw-division">Division</label>
      <select
        id="draw-division"
        value={divisionId}
        disabled={busy || !!pending || loading}
        onChange={(e) => {
          const id = e.target.value;
          setDivisionId(id);
          setData(null);
          setStale(false);
          const url = new URL(window.location.href);
          url.searchParams.set("division", id);
          window.history.replaceState({}, "", url);
          void load(id);
        }}
      >
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.eventName} · {d.name}
          </option>
        ))}
      </select>
      {!loading && !divisions.length && !error && (
        <p className="empty">
          No editable divisions are assigned to this account.
        </p>
      )}
      {data && (
        <>
          <h2>
            {data.division.eventName} · {data.division.name}
          </h2>
          <p>
            Revision {data.version} · {data.state}. Template {data.template},
            version {data.templateVersion}.
          </p>
          {data.state !== "published" && (
            <form
              className="form-card"
              onSubmit={(e) => {
                e.preventDefault();
                command("preview");
              }}
              onChange={() => setStatus("Unsaved draw edit.")}
            >
              <fieldset disabled={locked}>
                <legend>Seed and preview</legend>
                <p>
                  Choose entries explicitly. Lineup readiness is separate from a
                  place in this field.
                </p>
                <label htmlFor="field-count">Field size</label>
                <label htmlFor="competition-profile">Competition profile</label>
                <select
                  id="competition-profile"
                  value={template}
                  onChange={(e) => {
                    const value = e.target.value,
                      n = value === TRIPLE_TEMPLATE ? 16 : 6;
                    setTemplate(value);
                    setCount(n);
                    setSeeds((old) =>
                      Array.from({ length: n }, (_, i) => old[i] ?? ""),
                    );
                  }}
                >
                  <option value={SINGLE_TEMPLATE}>
                    Single knockout · six or eight entries
                  </option>
                  <option value={TRIPLE_TEMPLATE}>
                    Triple knockout · sixteen entries · 2 A / 3 B / 3 C
                  </option>
                </select>
                <p>
                  {template === TRIPLE_TEMPLATE
                    ? "Exactly sixteen teams, no byes. Eight qualifiers enter seven fixed playoff games. A first loss follows B, a second follows C; C losers leave qualification. Playoff losses end championship participation."
                    : "Eight slots. With six entries, seeds 1 and 2 enter the semifinals directly; byes create no physical game or win. No bronze game."}
                </p>
                <select
                  id="field-count"
                  value={count}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setCount(n);
                    setSeeds((old) =>
                      Array.from({ length: n }, (_, i) => old[i] ?? ""),
                    );
                  }}
                >
                  {template === TRIPLE_TEMPLATE ? (
                    <option value={16}>Sixteen entries · no byes</option>
                  ) : (
                    <>
                      <option value={6}>
                        Six entries · two structural byes
                      </option>
                      <option value={8}>Eight entries · no byes</option>
                    </>
                  )}
                </select>
                {Array.from({ length: count }, (_, i) => (
                  <div key={i}>
                    <label htmlFor={`draw-seed-${i + 1}`}>Seed {i + 1}</label>
                    <select
                      id={`draw-seed-${i + 1}`}
                      required
                      value={seeds[i] ?? ""}
                      onChange={(e) =>
                        setSeeds((old) =>
                          old.map((s, n) => (n === i ? e.target.value : s)),
                        )
                      }
                    >
                      <option value="">Choose entry</option>
                      {data.entries.map((en: { id: string; name: string }) => (
                        <option key={en.id} value={en.id}>
                          {en.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <label htmlFor="draw-reason">Revision reason</label>
                <input
                  id="draw-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  required
                />
                <button type="submit">Save preview</button>
              </fieldset>
            </form>
          )}
          {data.graph && (
            <section aria-label="Saved draw preview">
              <h2>
                {data.state === "published"
                  ? "Published draw"
                  : "Saved preview"}
              </h2>
              <p>
                This is the stored revision. Unsaved seed changes do not change
                this preview.
              </p>
              <DrawPanel data={data} view="list" />
              {data.state === "preview" && (
                <div className="form-card">
                  <label htmlFor="publish-reason">Publication reason</label>
                  <input
                    id="publish-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={locked}
                    maxLength={500}
                  />
                  <button
                    disabled={locked || !reason.trim()}
                    onClick={() => command("publish")}
                  >
                    Publish reviewed draw
                  </button>
                  <p>
                    Publishing preserves this graph and seed snapshot. Schedule
                    its games separately; no time or result is invented.
                  </p>
                </div>
              )}
              {data.state === "published" && (
                <p>
                  <a
                    href={`/events/${data.division.eventId}/bracket?division=${encodeURIComponent(data.divisionId)}`}
                  >
                    Open public bracket and game list →
                  </a>
                </p>
              )}
            </section>
          )}
          <details>
            <summary>Draw revision history</summary>
            {data.history.length ? (
              <ol>
                {data.history.map(
                  (h: {
                    version: number;
                    state: string;
                    reason: string;
                    createdAt: Date | string;
                  }) => (
                    <li key={h.version}>
                      Revision {h.version} · {h.state} · {h.reason} ·{" "}
                      {new Date(h.createdAt).toISOString()}
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p>No saved draw revisions.</p>
            )}
          </details>
        </>
      )}
    </main>
  );
}
