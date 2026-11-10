"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicRankingList } from "@/domain/ranking-publication";
import { RankingList } from "./ranking-list";
type Header = {
  id: string;
  effectiveDate: string;
  publishedAt: string;
  version: number;
  list: PublicRankingList["list"];
  replacesId: string | null;
  publicDigest: string;
};
type View = {
  publications: Header[];
  selected: (Header & { data: PublicRankingList }) | null;
};
export function Rankings() {
  const [view, setView] = useState<View | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [discipline, setDiscipline] = useState(""),
    [family, setFamily] = useState(""),
    [season, setSeason] = useState(""),
    [id, setId] = useState("");
  const sequence = useRef(0);
  async function load(d = discipline, f = family, s = season, selectedId = id) {
    const seq = ++sequence.current;
    setLoading(true);
    setError("");
    setDiscipline(d);
    setFamily(f);
    setSeason(s);
    setId(selectedId);
    try {
      const q = new URLSearchParams();
      if (d) q.set("discipline", d);
      if (f) q.set("family", f);
      if (s) q.set("season", s);
      if (selectedId) q.set("id", selectedId);
      const r = await fetch(`/api/v1/rankings?${q}`, { cache: "no-store" }),
        data = await r.json();
      if (!r.ok)
        throw new Error(data.error ?? "Approved rankings could not be loaded.");
      if (sequence.current !== seq) return;
      setView(data);
      setDiscipline(d);
      setFamily(f);
      setSeason(s);
      setId(selectedId);
      const url = new URL(location.href);
      if (selectedId) url.searchParams.set("publication", selectedId);
      else url.searchParams.delete("publication");
      history.replaceState(null, "", url);
    } catch (e) {
      if (sequence.current === seq) setError((e as Error).message);
    } finally {
      if (sequence.current === seq) setLoading(false);
    }
  }
  useEffect(() => {
    void load(
      "",
      "",
      "",
      new URLSearchParams(location.search).get("publication") ?? "",
    );
  }, []);
  const selected = view?.selected;
  const replacement = selected
    ? view?.publications.find((p) => p.replacesId === selected.id)
    : undefined;
  return (
    <main id="main" className="workspace publication-page">
      <p className="eyebrow">WCTRS · approved publications</p>
      <h1>Rankings</h1>
      <p>
        Exact approved lists, with their effective date, publication history and
        counting contributions.
      </p>
      <p className="notice">
        Independent demonstration. Synthetic records are not official World
        Curling publications. Imported observations and private drafts do not
        appear here.
      </p>
      <section className="publication-filters" aria-label="Ranking filters">
        <label>
          Discipline
          <select
            value={discipline}
            disabled={loading}
            onChange={(e) => void load(e.target.value, family, season, "")}
          >
            <option value="">All disciplines</option>
            <option value="men_four">Men’s four-player</option>
            <option value="women_four">Women’s four-player</option>
            <option value="mixed_doubles">Mixed doubles</option>
          </select>
        </label>
        <label>
          List
          <select
            value={family}
            disabled={loading}
            onChange={(e) => void load(discipline, e.target.value, season, "")}
          >
            <option value="">All approved lists</option>
            <option value="overall">Overall</option>
            <option value="series">Series</option>
            <option value="mixed-doubles">Mixed doubles</option>
          </select>
        </label>
        <label>
          Season
          <select
            value={season}
            disabled={loading}
            onChange={(e) => void load(discipline, family, e.target.value, "")}
          >
            <option value="">All seasons</option>
            {[
              ...new Set(view?.publications.map((x) => x.list.season) ?? []),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </section>
      {loading && <p role="status">Loading approved rankings…</p>}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <p>
            {view
              ? "The last approved list remains below; this selection is stale."
              : "No approved list has been loaded."}
          </p>
          <button onClick={() => void load()}>Retry rankings</button>
        </div>
      )}
      {view && (
        <>
          <label className="publication-select">
            Effective date / approved version
            <select
              disabled={loading}
              value={view.selected?.id ?? ""}
              onChange={(e) =>
                void load(discipline, family, season, e.target.value)
              }
            >
              {!view.publications.length && (
                <option value="">No approved publications</option>
              )}
              {view.publications.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.effectiveDate} · {p.list.discipline.replaceAll("_", " ")} ·{" "}
                  {p.list.family} · version {p.version}
                </option>
              ))}
            </select>
          </label>
          {view.selected ? (
            <section
              aria-label="Approved ranking publication"
              aria-busy={loading}
            >
              <div className="publication-heading">
                <div>
                  <span className="status">Published · calculated</span>
                  <h2>{view.selected.data.title}</h2>
                  <p>
                    <strong>Effective {view.selected.effectiveDate}</strong> ·{" "}
                    {view.selected.list.season}
                  </p>
                  <p className="muted">
                    Published{" "}
                    {new Date(view.selected.publishedAt).toUTCString()} ·
                    version {view.selected.version}
                    {view.selected.replacesId
                      ? " · direct replacement; earlier approval retained"
                      : ""}
                  </p>
                </div>
                <a href={`/rankings?publication=${view.selected.id}`}>
                  Link to this exact publication
                </a>
              </div>
              {replacement && (
                <p className="notice" role="status">
                  Historical approval.{" "}
                  <a href={`/rankings?publication=${replacement.id}`}>
                    Open later replacement version {replacement.version}
                  </a>
                  . This exact approved list remains unchanged.
                </p>
              )}
              <RankingList data={view.selected.data} />
              <details className="publication-digest">
                <summary>Frozen publication fingerprint</summary>
                <p>{view.selected.publicDigest}</p>
              </details>
            </section>
          ) : (
            !loading && (
              <p className="empty">
                No approved publication matches these filters. A private draft
                or imported observation is not an approved list.
              </p>
            )
          )}
        </>
      )}
    </main>
  );
}
