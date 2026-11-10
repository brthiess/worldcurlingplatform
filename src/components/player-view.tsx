"use client";
import { PublicLink, usePublicFilters } from "./public-context";
import { FavoriteButton } from "./favorites";
import { PublicActivity } from "./public-activity";
import { useCallback, useEffect, useState } from "react";
type Player = {
  id: string;
  name: string;
  origin: string;
  identityStatus: string;
  biography: string;
  handedness: string | null;
  photoUrl: string | null;
};
export function PlayerView({ id }: { id?: string }) {
  const { filters, change } = usePublicFilters();
  const [data, setData] = useState<Player[] | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        "/api/v1/public/players" + (id ? "/" + encodeURIComponent(id) : ""),
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Player not found."
            : "Players could not be loaded. Try again.",
        );
      const result = await response.json();
      setData(id ? [result] : result);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">Teams &amp; players</p>
      <h1>{id ? (data?.[0]?.name ?? "Player profile") : "Players"}</h1>
      {!id && (
        <div className="calendar-filters">
          <div>
            <label htmlFor="player-search">Search players</label>
            <input
              id="player-search"
              value={filters.q ?? ""}
              onChange={(e) => change({ q: e.target.value })}
            />
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="error">
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : !data ? (
        <p role="status">Loading players…</p>
      ) : !data.length ? (
        <p className="empty">No public player records are available.</p>
      ) : (
        data
          .filter(
            (p) =>
              id ||
              p.name.toLowerCase().includes((filters.q ?? "").toLowerCase()),
          )
          .map((p) => (
            <article className="form-card" key={p.id}>
              {!id && (
                <h2>
                  <PublicLink href={"/players/" + p.id}>{p.name}</PublicLink>
                </h2>
              )}
              <FavoriteButton kind="player" id={p.id} />
              {p.origin === "fictional_demo" && (
                <p className="notice">Fictional demonstration player.</p>
              )}
              {p.identityStatus === "provisional" && (
                <p className="notice">
                  Provisional player identity. Relationship to possible existing
                  records remains unresolved.
                </p>
              )}
              {id && (
                <>
                  {p.photoUrl ? (
                    <img
                      className="player-photo"
                      src={p.photoUrl}
                      alt={"Approved photo of " + p.name}
                    />
                  ) : (
                    <p className="muted">No approved photo.</p>
                  )}
                  <h2>Biography</h2>
                  <p className="player-biography">
                    {p.biography || "No biography provided."}
                  </p>
                  <h2>Handedness</h2>
                  <p>
                    {p.handedness
                      ? p.handedness === "left"
                        ? "Left"
                        : "Right"
                      : "Not provided"}
                  </p>
                  <p className="muted">
                    Event roster records describe declared or defaulted lineups;
                    they do not verify participation in a game.
                  </p>
                </>
              )}
            </article>
          ))
      )}
      {id && <PublicActivity kind="player" id={id} />}
      {!id &&
        data &&
        !data.some((p) =>
          p.name.toLowerCase().includes((filters.q ?? "").toLowerCase()),
        ) && <p className="empty">No players match this search.</p>}
      <p>
        <PublicLink href="/account/profile">
          Claim a player or manage your profile →
        </PublicLink>
      </p>
      {id && (
        <p>
          <PublicLink href="/players">All players →</PublicLink>
        </p>
      )}
    </main>
  );
}
