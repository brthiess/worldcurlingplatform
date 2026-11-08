"use client";
import { useEffect, useRef, useState } from "react";
import type { drawWorkspace } from "@/modules/draws/draws";
import { DrawPanel } from "./draw-panel";
type Data = Awaited<ReturnType<typeof drawWorkspace>>;
type Choice = { id: string; name: string; eventId: string; eventName: string };
export function DrawWorkbench() {
  const sequence = useRef(0);
  const [divisions, setDivisions] = useState<Choice[]>([]),
    [divisionId, setDivisionId] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [seeds, setSeeds] = useState<string[]>(Array(6).fill("")),
    [count, setCount] = useState(6),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<unknown>(null),
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
      setPending(null);
      setError("");
      setCount(next.seeds.length || 6);
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
        setDivisions(w.divisions);
        const requested = new URLSearchParams(window.location.search).get(
          "division",
        );
        const id = requested ?? w.divisions[0]?.id ?? "";
        if (w.divisions.some((d: Choice) => d.id === id)) {
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
  async function save(command: unknown) {
    setBusy(true);
    setError("");
    setPending(command);
    setStatus("Sending draw revision…");
    try {
      const r = await fetch(
        `/api/v1/divisions/${encodeURIComponent(divisionId)}/draw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const result = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          setPending(null);
          if (r.status === 409) setStale(true);
        }
        throw new Error(result.error);
      }
      setData((old) => (old ? { ...old, ...result } : old));
      setPending(null);
      setStatus(`Saved ${result.state} revision ${result.version}.`);
      setReason("");
      // Keep the accepted command response visible even if a history refresh fails.
      const history = await fetch(
        `/api/v1/divisions/${encodeURIComponent(divisionId)}/draw`,
        { cache: "no-store" },
      );
      if (history.ok) setData(await history.json());
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
      ...(action === "preview" ? { seedEntryIds: seeds } : {}),
    });
  }
  const locked =
    busy || !!pending || stale || loading || data?.state === "published";
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">Organizer operations</p>
      <h1>Single knockout draw</h1>
      <p>
        <a href="/admin">← Workspace</a> ·{" "}
        <a href="/admin/schedule">Draw scheduling</a>
      </p>
      <p>
        Eight slots; choose six or eight distinct entries in seed order. With
        six entries, seeds 1 and 2 enter the semifinals directly. No bronze
        game. Publish the reviewed preview before scoring.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{loading ? "Loading saved draw…" : status}</p>
      {!!pending && !busy && (
        <div className="notice">
          The save outcome is uncertain.{" "}
          <button onClick={() => void save(pending)}>Retry same request</button>
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
                  <option value={6}>Six entries · two structural byes</option>
                  <option value={8}>Eight entries · no byes</option>
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
