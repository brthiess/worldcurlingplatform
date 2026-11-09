"use client";
import { useEffect, useState } from "react";
import { AuthorityRecovery, useAuthorityCommand } from "./authority-command";
import { canonicalEntryCommand } from "@/domain/entries";
type Person = { playerId: string; name: string; identityStatus: string };
type Member = Person & {
  role: "core" | "alternate" | "coach" | "substitute";
  position: string;
  participation: "declared" | "defaulted";
};
type Row = Member & { present: boolean; isNew?: boolean };
type Registration = {
  id: string;
  teamId: string;
  season: string;
  version: number;
  name: string;
  members: Member[];
};
type Team = {
  id: string;
  name: string;
  discipline: string;
  core: Person[];
  registrations: Registration[];
};
type Entry = {
  id: string;
  name: string;
  divisionId: string;
  version: number;
  teamId: string | null;
  status: string;
  coreKnown: boolean;
  core: Person[];
  lineup: { members: Member[] };
  registration: Registration | null;
};
type Workspace = {
  actorId: string;
  actorName: string;
  representations: {
    id: string;
    teamId: string;
    registrationId: string;
    season: string;
    actions: string[];
    discipline: string;
    name: string;
  }[];
  divisions: {
    id: string;
    name: string;
    eventId: string;
    eventName: string;
    discipline: string;
    season: string | null;
    manual: boolean;
  }[];
  entries: { id: string; name: string; divisionId: string; version: number }[];
  isAdministrator: boolean;
};
export function EntriesWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [players, setPlayers] = useState<
      { id: string; name: string; identityStatus?: string; origin?: string; contexts?: string[] }[]
    >([]),
    [teams, setTeams] = useState<Team[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [id, setId] = useState(""),
    [editing, setEditing] = useState(false),
    [version, setVersion] = useState(0),
    [divisionId, setDivisionId] = useState(""),
    [name, setName] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [coreKnown, setCoreKnown] = useState(false),
    [teamId, setTeamId] = useState<string | undefined>(),
    [registrationId, setRegistrationId] = useState<string | undefined>(),
    [season, setSeason] = useState("2026-27"),
    [registerSeason, setRegisterSeason] = useState(false),
    [dirty, setDirty] = useState(true),
    [saved, setSaved] = useState(false),
    [stale, setStale] = useState(false);
  const [playerSearch, setPlayerSearch] = useState(""),
    [teamSearch, setTeamSearch] = useState(""),
    [newName, setNewName] = useState(""),
    [provisional, setProvisional] = useState(false),
    [newRole, setNewRole] = useState<Member["role"]>("core");
  const recovery = useAuthorityCommand(
    workspace ? `wcp-entry:${workspace.actorId}` : null,
    workspace?.actorId,
    async (saved) => {
      const body = JSON.parse(saved.body),
        entryId = body.id ?? saved.path.split("/").pop();
      await load();
      const r = await fetch(`/api/v1/entries/${entryId}`, {
        cache: "no-store",
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      applyEntry(result);
      setSaved(true);
    },
    async (saved) => {
      const body = JSON.parse(saved.body),
        entryId = body.id ?? saved.path.split("/").pop();
      const r = await fetch(
        `/api/v1/entries/${entryId}?version=${body.version + 1}`,
        { cache: "no-store" },
      );
      if (!r.ok) return false;
      const result = await r.json();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          canonicalEntryCommand({ id: entryId, command: body }),
        ),
      );
      const hex = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (
        result.attribution?.actorId !== saved.actorId ||
        result.attribution.commandDigest !== hex
      )
        return false;
      await load();
      applyEntry(result);
      setSaved(true);
      return true;
    },
    (status) => {
      if (status === 409) setStale(true);
    },
  );
  async function load() {
    setLoading(true);
    try {
      const [w, p, t] = await Promise.all([
        fetch("/api/v1/entries", { cache: "no-store" }),
        fetch("/api/v1/public/players", { cache: "no-store" }),
        fetch("/api/v1/public/teams", { cache: "no-store" }),
      ]);
      if (!w.ok)
        throw new Error(
          w.status === 401
            ? "Sign in with an organizer account to enter teams."
            : "The entry workspace could not be loaded.",
        );
      if (!p.ok || !t.ok)
        throw new Error("Player and team search could not be loaded.");
      const ws = await w.json();
      setWorkspace(ws);
      setPlayers(await p.json());
      setTeams(await t.json());
      if (!id) {
        setId(crypto.randomUUID());
        setDivisionId(ws.divisions[0]?.id ?? "");
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  function changed() {
    setDirty(true);
    setSaved(false);
  }
  function startNew() {
    setId(crypto.randomUUID());
    setEditing(false);
    setVersion(0);
    setName("");
    setRows([]);
    setCoreKnown(false);
    setTeamId(undefined);
    setRegistrationId(undefined);
    setRegisterSeason(false);
    setError("");
    setStale(false);
    changed();
  }
  function applyEntry(e: Entry) {
    setId(e.id);
    setEditing(true);
    setVersion(e.version);
    setDivisionId(e.divisionId);
    setName(e.name);
    setCoreKnown(e.coreKnown);
    setTeamId(e.teamId ?? undefined);
    setRegistrationId(e.registration?.id);
    setSeason(e.registration?.season ?? "2026-27");
    setRows([
      ...e.lineup.members.map((m) => ({ ...m, present: true })),
      ...e.core
        .filter((p) => !e.lineup.members.some((m) => m.playerId === p.playerId))
        .map((p) => ({
          ...p,
          role: "core" as const,
          position: "",
          participation: "declared" as const,
          present: false,
        })),
    ]);
    setRegisterSeason(false);
    setStale(false);
    setDirty(false);
  }
  async function openEntry(entryId: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/entries/${entryId}`, {
          cache: "no-store",
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      applyEntry(data);
      setSaved(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function selectTeam(t: Team, registration?: Registration) {
    setNewRole(
      workspace?.divisions.find((d) => d.id === divisionId)?.manual
        ? "core"
        : "substitute",
    );
    setTeamId(t.id);
    setCoreKnown(true);
    setRegistrationId(registration?.id);
    setRegisterSeason(false);
    setName(registration?.name ?? t.name);
    setSeason(registration?.season ?? "2026-27");
    setRows(
      registration
        ? registration.members.map((m) => ({
            ...m,
            participation: "defaulted",
            present: true,
          }))
        : t.core.map((p) => ({
            ...p,
            role: "core",
            position: "",
            participation: "defaulted",
            present: true,
          })),
    );
    changed();
  }
  function addPlayer(p: Person, isNew = false) {
    if (rows.some((r) => r.playerId === p.playerId)) return;
    setRows([
      ...rows,
      {
        ...p,
        role: newRole,
        position: "",
        participation: "declared",
        present: true,
        isNew,
      },
    ]);
    changed();
  }
  function save() {
    const entry = {
      divisionId,
      name,
      coreKnown,
      corePlayerIds: rows
        .filter((r) => r.role === "core")
        .map((r) => r.playerId),
      members: rows
        .filter((r) => r.present)
        .map(({ playerId, role, position, participation }) => ({
          playerId,
          role,
          position,
          participation,
        })),
      teamId,
      registrationId,
      registerSeason: registerSeason
        ? {
            season,
            version:
              teams
                .find((t) => t.id === teamId)
                ?.registrations.find((r) => r.season === season)?.version ?? 0,
          }
        : undefined,
      newPlayers: rows
        .filter((r) => r.isNew)
        .map((r) => ({
          id: r.playerId,
          name: r.name,
          provisional: r.identityStatus === "provisional",
        })),
    };
    void recovery.submit(
      editing ? `/api/v1/entries/${id}` : "/api/v1/entries",
      {
        id,
        requestId: crypto.randomUUID(),
        version,
        entry,
      },
      "Entry command recorded.",
    );
  }
  const discipline = workspace?.divisions.find(
      (d) => d.id === divisionId,
    )?.discipline,
    selectedTeam = teams.find((t) => t.id === teamId),
    selectedDivision = workspace?.divisions.find((d) => d.id === divisionId),
    manual = !!selectedDivision?.manual,
    permitted =
      workspace?.representations.filter(
        (g) =>
          g.season === selectedDivision?.season && g.discipline === discipline,
      ) ?? [],
    selectedAuthority = permitted.find(
      (g) => g.teamId === teamId && g.registrationId === registrationId,
    ),
    canSave =
      manual ||
      !!selectedAuthority?.actions.includes(editing ? "amend" : "submit");
  return (
    <main id="main">
      <a className="back" href="/admin">
        ← Your workspace
      </a>
      <p className="eyebrow">Team entry operations</p>
      <p>
        <a href="/admin/registration">
          Review division entry terms & request a place →
        </a>
      </p>
      <h1>
        {workspace?.divisions.some((d) => d.manual)
          ? "Manual entries"
          : "Team entries"}
      </h1>
      <p>
        Choose an existing team or assemble existing and new player sport
        records. Player accounts are optional.
      </p>
      <AuthorityRecovery
        state={recovery}
        label="entry"
        retryLabel="Retry last save"
      />
      {workspace && !manual && (
        <p className="notice">
          Self-entry records a team submission. Entry acceptance, capacity and
          payment are unresolved; saving does not reserve a place or open
          registration.
        </p>
      )}
      {workspace && (
        <p className="notice">
          Signed in as {workspace.actorName}.{" "}
          {selectedDivision?.manual
            ? "Organizer manual entry authority for this edition."
            : selectedAuthority
              ? `Acting on behalf of ${selectedAuthority.name} · ${selectedAuthority.season}. Permitted actions: ${selectedAuthority.actions.join(", ")}.`
              : "Choose a granted team-season to submit or amend an entry. Profile ownership grants no team authority."}{" "}
          <a href="/admin/representatives">Review team-season authority</a>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && !workspace ? (
        <p role="status" className="loading">
          Loading entries and player search…
        </p>
      ) : !workspace ? (
        <p>
          <a href="/admin">Sign in</a>{" "}
          <button onClick={() => void load().catch(() => {})}>
            Retry loading entries
          </button>
        </p>
      ) : !workspace.divisions.length ? (
        <p className="empty">
          No entry divisions are available under your current authority. A World
          Curling team-season grant and matching configured division season are
          required for self-entry.
        </p>
      ) : (
        <div className="application-layout">
          <aside className="application-queue">
            <h2>Edition entries</h2>
            <button
              onClick={startNew}
              disabled={
                busy ||
                recovery.locked ||
                (!manual &&
                  !permitted.some((g) => g.actions.includes("submit")))
              }
            >
              New entry
            </button>
            <label className="field-label" htmlFor="entry-division">
              Division
            </label>
            <select
              id="entry-division"
              value={divisionId}
              disabled={busy || editing || recovery.locked}
              onChange={(e) => {
                setDivisionId(e.target.value);
                setTeamId(undefined);
                setRegistrationId(undefined);
                setRows([]);
                setCoreKnown(false);
                changed();
              }}
            >
              {workspace.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.eventName} · {d.name}
                </option>
              ))}
            </select>
            <ul className="workspace-list">
              {workspace.entries
                .filter((e) => e.divisionId === divisionId)
                .map((e) => (
                  <li key={e.id}>
                    <p>{e.name}</p>
                    <p className="muted">
                      {e.version
                        ? `Lineup version ${e.version}`
                        : "No recorded lineup"}
                    </p>
                    <button
                      className="secondary"
                      disabled={busy || recovery.locked}
                      onClick={() => void openEntry(e.id)}
                    >
                      Edit {e.name}
                    </button>
                  </li>
                ))}
            </ul>
          </aside>
          <section className="application-detail">
            <h2>{editing ? "Edit entry" : "Assemble entry"}</h2>
            <p className="notice">
              Regular core membership determines identity. An event substitute
              changes this lineup only. Declared and defaulted lineups do not
              verify who delivered stones.
            </p>
            <form
              className="form-card application-form"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <fieldset disabled={busy || recovery.locked}>
                <label htmlFor="entry-name">Entry name</label>
                <input
                  id="entry-name"
                  value={name}
                  maxLength={160}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                    changed();
                  }}
                />
                <h3>Choose an existing team</h3>
                <label htmlFor="team-search">
                  Search teams or core players
                </label>
                <input
                  id="team-search"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                />
                <ul className="search-results">
                  {teams
                    .filter(
                      (t) => manual || permitted.some((g) => g.teamId === t.id),
                    )
                    .filter(
                      (t) =>
                        t.discipline === discipline &&
                        `${t.name} ${t.core.map((p) => p.name).join(" ")}`
                          .toLowerCase()
                          .includes(teamSearch.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((t) => (
                      <li key={t.id}>
                        <strong>{t.name}</strong>
                        <p className="muted">
                          {t.core.map((p) => p.name).join(" · ")}
                        </p>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            selectTeam(
                              t,
                              manual
                                ? t.registrations[0]
                                : t.registrations.find((r) =>
                                    permitted.some(
                                      (g) => g.registrationId === r.id,
                                    ),
                                  ),
                            )
                          }
                        >
                          Select {t.name}
                        </button>
                      </li>
                    ))}
                </ul>
                {!teams.some(
                  (t) =>
                    t.discipline === discipline &&
                    `${t.name} ${t.core.map((p) => p.name).join(" ")}`
                      .toLowerCase()
                      .includes(teamSearch.toLowerCase()),
                ) && (
                  <p className="muted">
                    No teams match. Assemble players below.
                  </p>
                )}
                {selectedTeam && (
                  <div className="application-states">
                    <p>Selected identity: {selectedTeam.name}</p>
                    <label htmlFor="season-source">Prefill season roster</label>
                    <select
                      id="season-source"
                      value={registrationId ?? ""}
                      onChange={(e) =>
                        selectTeam(
                          selectedTeam,
                          selectedTeam.registrations.find(
                            (r) => r.id === e.target.value,
                          ),
                        )
                      }
                    >
                      {manual && (
                        <option value="">Core only · defaulted</option>
                      )}
                      {selectedTeam.registrations
                        .filter(
                          (r) =>
                            manual ||
                            permitted.some((g) => g.registrationId === r.id),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.season} · version {r.version}
                          </option>
                        ))}
                    </select>
                    {manual && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setTeamId(undefined);
                          setRegistrationId(undefined);
                          changed();
                        }}
                      >
                        Assemble different permanent core
                      </button>
                    )}
                  </div>
                )}
                <h3>Regular core and event lineup</h3>
                <p className="muted">
                  All five regular rotating players belong to the core. Leave an
                  absent regular player in the core and clear “At this event”.
                  Add a temporary guest as a substitute.
                </p>
                {!rows.length && (
                  <p className="empty">
                    No players selected. An incomplete entry may be saved as
                    provisional.
                  </p>
                )}
                <ol className="entry-roster">
                  {rows.map((r, i) => (
                    <li key={r.playerId}>
                      <h4>
                        <a
                          href={r.isNew ? undefined : `/players/${r.playerId}`}
                        >
                          {r.name}
                        </a>
                      </h4>
                      <p className="muted">
                        {r.identityStatus === "provisional"
                          ? "Provisional identity · unresolved possible duplicate"
                          : "Identified sport record"}
                        {r.isNew ? " · new record on save" : ""}
                      </p>
                      <div className="form-grid">
                        <div>
                          <label htmlFor={`role-${i}`}>Role: {r.name}</label>
                          <select
                            id={`role-${i}`}
                            value={r.role}
                            disabled={!!teamId && r.role === "core"}
                            onChange={(e) => {
                              setRows(
                                rows.map((x, n) =>
                                  n === i
                                    ? {
                                        ...x,
                                        role: e.target.value as Row["role"],
                                      }
                                    : x,
                                ),
                              );
                              changed();
                            }}
                          >
                            <option value="core">Regular core</option>
                            <option value="alternate">
                              Designated alternate
                            </option>
                            <option value="coach">Coach</option>
                            <option value="substitute">
                              Temporary substitute
                            </option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`position-${i}`}>
                            Position: {r.name}
                          </label>
                          <input
                            id={`position-${i}`}
                            value={r.position}
                            maxLength={40}
                            onChange={(e) => {
                              setRows(
                                rows.map((x, n) =>
                                  n === i
                                    ? { ...x, position: e.target.value }
                                    : x,
                                ),
                              );
                              changed();
                            }}
                          />
                        </div>
                      </div>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={r.present}
                          onChange={(e) => {
                            setRows(
                              rows.map((x, n) =>
                                n === i
                                  ? { ...x, present: e.target.checked }
                                  : x,
                              ),
                            );
                            changed();
                          }}
                        />
                        At this event: {r.name}
                      </label>
                      <label htmlFor={`evidence-${i}`}>
                        Roster evidence: {r.name}
                      </label>
                      <select
                        id={`evidence-${i}`}
                        value={r.participation}
                        onChange={(e) => {
                          setRows(
                            rows.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    participation: e.target
                                      .value as Row["participation"],
                                  }
                                : x,
                            ),
                          );
                          changed();
                        }}
                      >
                        <option value="declared">
                          Declared for this event
                        </option>
                        <option value="defaulted">Defaulted from roster</option>
                      </select>
                      <button
                        type="button"
                        className="secondary"
                        disabled={!!teamId && r.role === "core"}
                        onClick={() => {
                          setRows(rows.filter((_, n) => n !== i));
                          changed();
                        }}
                      >
                        Remove {r.name}
                      </button>
                    </li>
                  ))}
                </ol>
                <label htmlFor="new-role">New player role</label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Row["role"])}
                >
                  <option value="core">Regular core</option>
                  <option value="alternate">Designated alternate</option>
                  <option value="coach">Coach</option>
                  <option value="substitute">Temporary substitute</option>
                </select>
                <label htmlFor="player-search">Search existing players</label>
                <input
                  id="player-search"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                />
                {playerSearch && (
                  <ul className="search-results">
                    {players
                      .filter(
                        (p) =>
                          p.name
                            .toLowerCase()
                            .includes(playerSearch.toLowerCase()) &&
                          !rows.some((r) => r.playerId === p.id),
                      )
                      .slice(0, 12)
                      .map((p) => (
                        <li key={p.id}>
                          <span>
                            {p.name} · {p.identityStatus ?? "identified"} ·{" "}
                            {p.id} · {p.origin ?? "Origin unknown"} · {p.contexts?.join("; ") || "No public event context recorded"}
                          </span>
                          <button
                            type="button"
                            className="secondary"
                            aria-label={`Add ${p.name} (${p.id})`}
                            onClick={() =>
                              addPlayer({
                                playerId: p.id,
                                name: p.name,
                                identityStatus:
                                  p.identityStatus ?? "identified",
                              })
                            }
                          >
                            Add {p.name}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
                {playerSearch &&
                  !players.some(
                    (p) =>
                      p.name
                        .toLowerCase()
                        .includes(playerSearch.toLowerCase()) &&
                      !rows.some((r) => r.playerId === p.id),
                  ) && (
                    <p>
                      No unselected players match. Add a new sport record if
                      needed.
                    </p>
                  )}
                <label htmlFor="new-player">New player name</label>
                <input
                  id="new-player"
                  value={newName}
                  maxLength={160}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={provisional}
                    onChange={(e) => setProvisional(e.target.checked)}
                  />
                  New player is provisional
                </label>
                <p className="muted">
                  Choose provisional when the relationship to an existing person
                  is unresolved. Matching names never merge records
                  automatically.
                </p>
                <button
                  type="button"
                  className="secondary"
                  disabled={!newName.trim()}
                  onClick={() => {
                    addPlayer(
                      {
                        playerId: crypto.randomUUID(),
                        name: newName.trim(),
                        identityStatus: provisional
                          ? "provisional"
                          : "identified",
                      },
                      true,
                    );
                    setNewName("");
                  }}
                >
                  Add new player
                </button>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={coreKnown}
                    disabled={!!teamId}
                    onChange={(e) => {
                      setCoreKnown(e.target.checked);
                      if (!e.target.checked) setRegisterSeason(false);
                      changed();
                    }}
                  />
                  Regular core membership is complete
                </label>
                <p>
                  {rows.filter((r) => r.role === "core").length} regular core ·{" "}
                  {rows.filter((r) => r.present && r.role !== "coach").length}{" "}
                  event players ·{" "}
                  {coreKnown
                    ? "Identity will be created or reused automatically."
                    : "Entry remains provisional; no team identity is asserted."}
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={registerSeason}
                    disabled={!coreKnown || !manual}
                    onChange={(e) => {
                      setRegisterSeason(e.target.checked);
                      changed();
                    }}
                  />
                  Also register this season roster
                </label>
                {registerSeason && (
                  <>
                    <label htmlFor="register-season">Season</label>
                    <input
                      id="register-season"
                      value={season}
                      placeholder="2026-27"
                      onChange={(e) => {
                        setSeason(e.target.value);
                        changed();
                      }}
                    />
                    <p className="notice">
                      This explicitly records regular core, alternates and
                      coaches for the season. Temporary substitutes are
                      excluded. Existing season rosters require staff authority
                      to amend.
                    </p>
                  </>
                )}
                <div className="application-actions">
                  <button
                    disabled={busy || !dirty || stale || !canSave}
                    type="submit"
                  >
                    {busy || recovery.busy ? "Saving…" : "Save entry"}
                  </button>
                  {editing && <a href={`/entries/${id}`}>View public entry</a>}
                </div>
              </fieldset>
            </form>
            <p role="status">
              {busy || recovery.busy
                ? "Saving entry…"
                : saved
                  ? "Saved to the database."
                  : dirty
                    ? "Unsaved changes."
                    : "Loaded recorded entry."}
            </p>
            {stale && editing && (
              <button className="secondary" onClick={() => void openEntry(id)}>
                Reload current version
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
