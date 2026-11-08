"use client";
import { useCallback, useEffect, useState } from "react";
type Submission = {
  id: string;
  playerId: string;
  name: string;
  assetId: string;
  digest: string;
  width: number;
  height: number;
  status: string;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  currentAssetId: string | null;
};
function PhotoReview({
  photo,
  refresh,
}: {
  photo: Submission;
  refresh: () => Promise<void>;
}) {
  const [loaded, setLoaded] = useState(false),
    [beforeLoaded, setBeforeLoaded] = useState(!photo.currentAssetId),
    [beforeFailed, setBeforeFailed] = useState(false),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <li className="photo-card">
      <h3>{photo.name}</h3>
      <p className="status-label">
        {photo.status[0].toUpperCase() + photo.status.slice(1)}
      </p>
      <div className="photo-comparison">
        <figure>
          <figcaption>Current public photo</figcaption>
          {photo.currentAssetId ? (
            <img
              className="player-photo"
              src={"/api/v1/public/photos/" + photo.currentAssetId}
              alt="Current approved player photo"
              onLoad={() => {
                setBeforeLoaded(true);
                setBeforeFailed(false);
              }}
              onError={() => {
                setBeforeLoaded(false);
                setBeforeFailed(true);
              }}
            />
          ) : (
            <p className="empty">No approved photo</p>
          )}
          {beforeFailed && (
            <p role="alert">
              Current photo unavailable. Refresh the comparison before
              reviewing.
            </p>
          )}
        </figure>
        <figure>
          <figcaption>
            Submitted photo · {photo.width} × {photo.height}
          </figcaption>
          <img
            className="player-photo"
            src={"/api/v1/photos/" + photo.id + "/preview"}
            alt="Submitted player photo for review"
            onLoad={() => {
              setLoaded(true);
              setFailed(false);
            }}
            onError={() => {
              setLoaded(false);
              setFailed(true);
            }}
          />
          {failed && (
            <p role="alert">
              Preview unavailable. Refresh the comparison before reviewing.
            </p>
          )}
        </figure>
      </div>
      <p className="muted photo-digest">Content fingerprint: {photo.digest}</p>
      {photo.status === "pending" ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              const response = await fetch(
                "/api/v1/photos/" + photo.id + "/review",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    decision: form.get("decision"),
                    reason: form.get("reason"),
                    digest: photo.digest,
                    currentAssetId: photo.currentAssetId,
                  }),
                },
              );
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              await refresh();
            } catch (e) {
              setError(
                e instanceof TypeError
                  ? "Review could not be confirmed. Refresh current status."
                  : (e as Error).message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={"photo-reason-" + photo.id}>
            Photo review reason
          </label>
          <textarea
            id={"photo-reason-" + photo.id}
            name="reason"
            required
            minLength={5}
            maxLength={1000}
          />
          <label htmlFor={"photo-decision-" + photo.id}>Photo decision</label>
          <select id={"photo-decision-" + photo.id} name="decision">
            <option value="approved">Approve photo</option>
            <option value="rejected">Reject photo</option>
          </select>
          <button disabled={!loaded || !beforeLoaded || busy}>
            {busy ? "Recording review…" : "Record photo decision"}
          </button>
          {(!loaded || !beforeLoaded) && !failed && !beforeFailed && (
            <p role="status">Loading reviewed comparison…</p>
          )}
        </form>
      ) : (
        <p>
          {photo.reason}
          <br />
          <span className="muted">
            Reviewed by {photo.reviewedBy} ·{" "}
            {new Date(photo.reviewedAt!).toLocaleString()}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </li>
  );
}
export function PhotoManager({
  owned,
  canReview,
}: {
  owned: { id: string; name: string }[];
  canReview: boolean;
}) {
  const [photos, setPhotos] = useState<Submission[] | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [selection, setSelection] = useState<{
      file: File;
      url: string;
      id: string;
    } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/v1/photos", { cache: "no-store" });
    if (!r.ok)
      throw new Error(
        "Photo status could not be loaded. Refresh to try again.",
      );
    setPhotos((await r.json()).submissions);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(
    () => () => {
      if (selection) URL.revokeObjectURL(selection.url);
    },
    [selection],
  );
  if (!owned.length && !canReview) return null;
  return (
    <section aria-label="Player photos" className="photo-manager">
      <h2>{canReview ? "Photo review" : "Your player photo"}</h2>
      <p>
        Replacements stay private until World Curling approval. The current
        approved photo remains public during review.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          setError("");
          void load().catch((e) => setError(e.message));
        }}
      >
        Refresh photo status
      </button>
      {photos === null ? (
        <p role="status">Loading photo status…</p>
      ) : (
        <>
          {owned.map((player) => (
            <form
              className="form-card"
              key={player.id}
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selection) return;
                setBusy(true);
                setError("");
                setNotice("");
                setProgress("Uploading: 0%");
                try {
                  await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(
                      "POST",
                      "/api/v1/players/" + player.id + "/photos",
                    );
                    xhr.setRequestHeader("Content-Type", selection.file.type);
                    xhr.setRequestHeader("X-Request-Id", selection.id);
                    xhr.upload.onprogress = (e) =>
                      setProgress(
                        e.lengthComputable
                          ? "Uploading: " +
                              Math.round((e.loaded / e.total) * 100) +
                              "%"
                          : "Uploading image…",
                      );
                    xhr.upload.onload = () =>
                      setProgress(
                        "Upload received. Validating and processing image…",
                      );
                    xhr.onerror = () =>
                      reject(
                        new Error(
                          "Upload could not be confirmed. Refresh photo status before retrying.",
                        ),
                      );
                    xhr.onload = () => {
                      let result;
                      try {
                        result = JSON.parse(xhr.responseText);
                      } catch {
                        reject(
                          new Error(
                            "Upload response unavailable. Refresh photo status.",
                          ),
                        );
                        return;
                      }
                      if (xhr.status === 201) resolve();
                      else reject(new Error(result.error ?? "Upload failed."));
                    };
                    xhr.send(selection.file);
                  });
                  setNotice("Photo submitted privately. Awaiting review.");
                  setSelection(null);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  setProgress("");
                }
              }}
            >
              <h3>Submit a replacement for {player.name}</h3>
              <label htmlFor={"upload-" + player.id}>Replacement photo</label>
              <input
                id={"upload-" + player.id}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={
                  busy ||
                  photos.some(
                    (p) => p.playerId === player.id && p.status === "pending",
                  )
                }
                onChange={(e) => {
                  setError("");
                  const file = e.target.files?.[0];
                  if (!file) {
                    setSelection(null);
                    return;
                  }
                  if (
                    file.size > 5 * 1024 * 1024 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    setError("Choose a PNG, JPEG or WebP image up to 5 MiB.");
                    setSelection(null);
                    return;
                  }
                  setSelection({
                    file,
                    url: URL.createObjectURL(file),
                    id: crypto.randomUUID(),
                  });
                }}
              />
              <p className="muted">
                PNG, JPEG or WebP · up to 5 MiB · minimum 64px · maximum 16
                megapixels. Images are processed to PNG up to 1200px.
              </p>
              {selection && (
                <figure>
                  <figcaption>Selected image preview</figcaption>
                  <img
                    className="player-photo"
                    src={selection.url}
                    alt="Selected replacement photo"
                  />
                </figure>
              )}
              <button
                disabled={
                  !selection ||
                  busy ||
                  photos.some(
                    (p) => p.playerId === player.id && p.status === "pending",
                  )
                }
              >
                {busy ? "Submitting…" : "Submit photo for review"}
              </button>
              {progress && <p role="status">{progress}</p>}
              {photos.some(
                (p) => p.playerId === player.id && p.status === "pending",
              ) && (
                <p>
                  One photo is awaiting review. You can submit again after a
                  decision.
                </p>
              )}
            </form>
          ))}
          <h3>
            {canReview
              ? "Submission history and comparisons"
              : "Your submissions"}
          </h3>
          {!photos.length ? (
            <p className="empty">No photo submissions yet.</p>
          ) : (
            <ul className="photo-list">
              {photos.map((photo) =>
                canReview ? (
                  <PhotoReview
                    key={
                      photo.id +
                      "-" +
                      photo.status +
                      "-" +
                      photo.currentAssetId +
                      "-" +
                      revision
                    }
                    photo={photo}
                    refresh={load}
                  />
                ) : (
                  <li className="photo-card" key={photo.id}>
                    <p className="status-label">
                      {photo.status[0].toUpperCase() + photo.status.slice(1)}
                    </p>
                    <img
                      className="player-photo"
                      src={"/api/v1/photos/" + photo.id + "/preview"}
                      alt="Your submitted player photo"
                    />
                    {photo.reason && (
                      <p>
                        {photo.reason}
                        <br />
                        <span className="muted">
                          {photo.reviewedBy} ·{" "}
                          {new Date(photo.reviewedAt!).toLocaleString()}
                        </span>
                      </p>
                    )}
                    <p className="muted">
                      Submitted {new Date(photo.createdAt).toLocaleString()}
                    </p>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
