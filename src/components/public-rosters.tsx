"use client";
import { useEffect, useState } from "react";
type Player = {
  playerId: string;
  name: string;
  identityStatus: string;
  origin?: string;
  role?: string;
  position?: string;
  participation?: string;
};
type Registration = {
  id: string;
  season: string;
  version: number;
  name: string;
  members: Player[];
};
type Entry = {
  admissionState: string;
  registrationConfigured: boolean;
  entryAdmission: string;
  id: string;
  name: string;
  eventId: string;
  divisionId: string;
  eventName: string;
  discipline: string;
  status: string;
  version: number;
  coreKnown: boolean;
  teamId: string | null;
  core: Player[];
  lineup: { version: number; members: Player[] };
  registration: Registration | null;
  origin: string;
};
type Team = {
  id: string;
  name: string;
  discipline: string;
  core: Player[];
  registrations: Registration[];
  entries: {
    admissionState: string;
    registrationConfigured: boolean;
    entryAdmission: string;
    id: string;
    name: string;
    eventId: string;
    eventName: string;
    divisionId: string;
  }[];
};
const disciplineName = (d: string) =>
  ({
    men_four: "Men’s four-player",
    women_four: "Women’s four-player",
    mixed_doubles: "Mixed doubles",
  })[d] ?? d;
function Players({ players }: { players: Player[] }) {
  return !players.length ? (
    <p className="empty">No players recorded.</p>
  ) : (
    <ul className="public-roster">
      {players.map((p) => (
        <li key={p.playerId}>
          <a href={`/players/${p.playerId}`}>{p.name}</a>
          <div className="roster-labels">
            {p.role && <span className="badge">{p.role}</span>}
            {p.position && <span>{p.position}</span>}
            {p.participation && <span>{p.participation}</span>}
            {p.identityStatus === "provisional" && (
              <span className="notice">Provisional identity</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
function Season({ r }: { r: Registration }) {
  return (
    <section className="roster-section">
      <h2>
        Season roster · {r.season} · version {r.version}
      </h2>
      <p>{r.name}</p>
      <Players players={r.members} />
    </section>
  );
}
export function PublicRoster({
  kind,
  id,
}: {
  kind: "entries" | "teams";
  id?: string;
}) {
  const [data, setData] = useState<Entry | Team | Team[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/v1/public/${kind}${id ? `/${id}` : ""}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Roster could not be loaded.");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [kind, id]);
  if (loading)
    return (
      <main id="main">
        <h1>{kind === "teams" ? "Teams" : "Event entry"}</h1>
        <p className="loading" role="status">
          Loading roster…
        </p>
      </main>
    );
  if (error)
    return (
      <main id="main">
        <h1>Roster unavailable</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <button onClick={() => void load()}>Retry roster</button>
        <p>
          <a href="/events">Browse events</a>
        </p>
      </main>
    );
  if (Array.isArray(data))
    return (
      <main id="main">
        <p className="eyebrow">Core compositions</p>
        <h1>Teams</h1>
        <p>
          Team identity follows the discipline and regular core. Event lineups
          and season registrations remain separate.
        </p>
        <div className="calendar-filters">
          <div>
            <label htmlFor="team-filter">Search teams or core players</label>
            <input
              id="team-filter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ul className="workspace-list">
          {data
            .filter((t) =>
              `${t.name} ${t.core.map((p) => p.name).join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((t) => (
              <li key={t.id}>
                <h2>
                  <a href={`/teams/${t.id}`}>{t.name}</a>
                </h2>
                <p>
                  {disciplineName(t.discipline)} · {t.core.length} regular core
                </p>
                <p>{t.core.map((p) => p.name).join(" · ")}</p>
              </li>
            ))}
        </ul>
        {!data.some((t) =>
          `${t.name} ${t.core.map((p) => p.name).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ) && <p className="empty">No teams match this search.</p>}
      </main>
    );
  if (!data) return null;
  if (kind === "entries") {
    const e = data as Entry;
    return (
      <main id="main">
        {e.registrationConfigured ? (
          <p className="notice">
            Admission: {e.admissionState}
            {e.admissionState === "pending"
              ? "; this submission does not reserve a place"
              : ""}
            . Payment, lineup readiness and ranking eligibility are separate.
          </p>
        ) : (
          e.entryAdmission === "submitted_pending" && (
            <p className="notice">
              Team submission recorded. Entry acceptance, capacity and payment
              are unresolved; this submission does not reserve a place.
            </p>
          )
        )}
        <a
          className="back"
          href={`/events/${e.eventId}?division=${e.divisionId}`}
        >
          ← {e.eventName}
        </a>
        <p className="eyebrow">Event entry · {disciplineName(e.discipline)}</p>
        <h1>{e.name}</h1>
        <span className="badge">{e.status}</span>
        {e.origin === "fictional_demo" && (
          <p className="notice">Fictional demonstration record.</p>
        )}
        <p>
          {e.coreKnown
            ? "Regular core membership is recorded."
            : "Regular core membership remains incomplete."}{" "}
          Ranking eligibility has not been assessed by this roster record.
        </p>
        {e.teamId && (
          <p>
            <a href={`/teams/${e.teamId}`}>View core-composition team</a>
          </p>
        )}
        <section className="roster-section">
          <h2>Event lineup · version {e.lineup.version}</h2>
          <p className="muted">
            Declared/defaulted roster evidence. This does not verify who
            delivered stones in a game.
          </p>
          <Players players={e.lineup.members} />
        </section>
        <section className="roster-section">
          <h2>Regular core</h2>
          <p className="muted">
            Regular membership includes players absent from this event lineup.
          </p>
          <Players players={e.core} />
        </section>
        {e.registration ? (
          <Season r={e.registration} />
        ) : (
          <p className="notice">
            No season registration is linked to this entry.
          </p>
        )}
      </main>
    );
  }
  const t = data as Team;
  return (
    <main id="main">
      <a className="back" href="/teams">
        ← Teams
      </a>
      <p className="eyebrow">
        {disciplineName(t.discipline)} · core composition
      </p>
      <h1>{t.name}</h1>
      {t.core.every((p) => p.origin === "fictional_demo") && (
        <p className="notice">Fictional demonstration team.</p>
      )}
      <p>
        Names, positions, alternates and temporary substitutes can change while
        this regular core identity stays the same.
      </p>
      <section className="roster-section">
        <h2>Regular core</h2>
        <Players players={t.core} />
      </section>
      {t.registrations.map((r) => (
        <Season key={r.id} r={r} />
      ))}
      {!t.registrations.length && (
        <p className="empty">No season roster registered.</p>
      )}
      <section className="roster-section">
        <h2>Public event entries</h2>
        <ul className="workspace-list">
          {t.entries.map((e) => (
            <li key={e.id}>
              {e.registrationConfigured ? (
                <p className="muted">Admission: {e.admissionState}</p>
              ) : (
                e.entryAdmission === "submitted_pending" && (
                  <p className="muted">Submitted · acceptance unresolved</p>
                )
              )}
              <h3>
                <a href={`/entries/${e.id}`}>{e.name}</a>
              </h3>
              <p>
                <a href={`/events/${e.eventId}?division=${e.divisionId}`}>
                  {e.eventName}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
export function EventEntryLinks({
  eventId,
  divisionId,
}: {
  eventId: string;
  divisionId?: string;
}) {
  const [entries, setEntries] = useState<
      | {
          id: string;
          name: string;
          version: number;
          status: string;
          divisionId: string;
          divisionName: string;
          entryAdmission: string;
          admissionState: string;
          registrationConfigured: boolean;
        }[]
      | null
    >(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/public/events/${eventId}/entries`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((e) => {
        if (active) setEntries(e);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  return (
    <section className="roster-section">
      <h2>Entries and rosters</h2>
      {error ? (
        <p className="error">
          Entry summaries could not be loaded. Reload this page to retry.
        </p>
      ) : entries === null ? (
        <p role="status">Loading entries…</p>
      ) : !entries.some((e) => !divisionId || e.divisionId === divisionId) ? (
        <p className="empty">No entries recorded.</p>
      ) : (
        <ul className="entry-link-list">
          {entries
            .filter((e) => !divisionId || e.divisionId === divisionId)
            .map((e) => (
              <li key={e.id}>
                <a href={`/entries/${e.id}`}>{e.name}</a>
                <span className="muted">
                  {e.divisionName} ·{" "}
                  {e.registrationConfigured
                    ? `Admission: ${e.admissionState} · `
                    : e.entryAdmission === "submitted_pending"
                      ? "Submitted · acceptance unresolved · "
                      : ""}
                  {e.version
                    ? `${e.status} · lineup v${e.version}`
                    : "Provisional · no lineup recorded"}
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
