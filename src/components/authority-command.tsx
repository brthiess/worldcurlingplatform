"use client";
import { useEffect, useRef, useState } from "react";
export type RetainedAuthorityCommand = {
  actorId: string;
  path: string;
  body: string;
  message: string;
  acknowledged: boolean;
};
class CommandRejection extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function send(command: RetainedAuthorityCommand) {
  const response = await fetch(command.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WCP-Actor": command.actorId,
    },
    body: command.body,
  });
  const result = await response.json();
  if (!response.ok)
    throw new CommandRejection(
      response.status,
      result.error ?? "The command was rejected.",
    );
}
function valid(value: unknown): value is RetainedAuthorityCommand {
  const c = value as RetainedAuthorityCommand;
  if (
    !c ||
    typeof c.path !== "string" ||
    typeof c.actorId !== "string" ||
    !(
      /^\/api\/v1\/(approval-delegations|role-grants|team-representation|entries|division-finalizations|registration|entry-charges)$/.test(
        c.path,
      ) ||
      /^\/api\/v1\/entries\/[-\w]{1,80}$/.test(c.path) ||
      /^\/api\/v1\/applications\/[-\w]{1,80}$/.test(c.path)
    ) ||
    typeof c.body !== "string" ||
    typeof c.message !== "string" ||
    typeof c.acknowledged !== "boolean"
  )
    return false;
  const body = JSON.parse(c.body);
  return (
    !!body &&
    typeof body === "object" &&
    (typeof body.id === "string" || typeof body.requestId === "string")
  );
}
/** A tab-local, actor-bound receipt journal. Retries send the original serialized bytes. */
export function useAuthorityCommand(
  key: string | null,
  actorId: string | undefined,
  onAccepted: (saved: RetainedAuthorityCommand) => Promise<void>,
  onReconcile: (pending: RetainedAuthorityCommand) => Promise<boolean>,
  onRejected?: (status: number, message: string) => void,
) {
  const [pending, setPending] = useState<RetainedAuthorityCommand | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loadedKey, setLoadedKey] = useState<string | null>(null),
    [storageFailed, setStorageFailed] = useState(false);
  const current = useRef<RetainedAuthorityCommand | null>(null),
    running = useRef(false);
  useEffect(() => {
    current.current = null;
    setPending(null);
    setLoadedKey(null);
    setError("");
    setNotice("");
    setStorageFailed(false);
    if (!key) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (!valid(saved) || saved.actorId !== actorId) throw new Error();
        current.current = saved;
        setPending(saved);
      }
      setLoadedKey(key);
    } catch {
      setStorageFailed(true);
      setError(
        "Recovery storage could not be read. Review this tab’s retained authority data before sending another command.",
      );
    }
  }, [key, actorId]);
  const ready = !!key && key === loadedKey && !storageFailed;
  function retain(next: RetainedAuthorityCommand | null) {
    if (!key) throw new Error("Sign in before sending authority commands.");
    if (next) sessionStorage.setItem(key, JSON.stringify(next));
    else sessionStorage.removeItem(key);
    current.current = next;
    setPending(next);
  }
  async function run(saved: RetainedAuthorityCommand, retry: boolean) {
    if (running.current || !ready) return;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!saved.acknowledged) {
        await send(saved);
        saved = { ...saved, acknowledged: true };
        retain(saved);
      }
      await onAccepted(saved);
      retain(null);
      setNotice(saved.message);
    } catch (e) {
      if (
        e instanceof CommandRejection &&
        e.status < 500 &&
        !retry &&
        !saved.acknowledged
      ) {
        retain(null);
        setError(e.message);
        onRejected?.(e.status, e.message);
      } else
        setError(
          saved.acknowledged
            ? "The command was saved, but the current view could not be refreshed. Editing stays locked until recovery."
            : `The command result is not confirmed. Editing stays locked; retry the retained command or reconcile recorded history.${e instanceof CommandRejection ? " " + e.message : ""}`,
        );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function submit(path: string, body: unknown, message: string) {
    if (!ready || running.current || current.current) return;
    if (!actorId) return;
    const saved = {
      actorId,
      path,
      body: JSON.stringify(body),
      message,
      acknowledged: false,
    };
    try {
      retain(saved);
    } catch {
      setStorageFailed(true);
      setError("Recovery storage is unavailable. No command was sent.");
      return;
    }
    await run(saved, false);
  }
  async function reconcile() {
    const saved = current.current;
    if (!saved || running.current || !ready) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      if (!(await onReconcile(saved))) throw new Error();
      retain(null);
      setNotice(
        "The original command was reconciled with recorded history. Review its current status below.",
      );
    } catch {
      setError(
        "Recorded state could not confirm the original command. Editing remains locked; retry the retained command when authority is available.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    pending,
    busy,
    error,
    notice,
    locked: !ready || busy || !!pending,
    submit,
    retry: () => current.current && run(current.current, true),
    reconcile,
  };
}
export function AuthorityRecovery({
  state,
  label = "authority",
  retryLabel,
}: {
  state: ReturnType<typeof useAuthorityCommand>;
  label?: string;
  retryLabel?: string;
}) {
  const body = state.pending ? JSON.parse(state.pending.body) : null;
  return (
    <>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="notice" role="status">
          {state.notice}
        </p>
      )}
      {state.pending && (
        <div className="notice" role="status">
          <p>
            {state.pending.acknowledged
              ? "Saved command retained until its current view is refreshed."
              : "Unconfirmed command retained for this signed-in account in this browser tab. Editing is locked; reloading retains the original command."}
          </p>
          <details>
            <summary>Review retained command</summary>
            <dl style={{ overflowWrap: "anywhere" }}>
              <dt>Action</dt>
              <dd>
                {body.action ??
                  (state.pending.path.includes("/entries")
                    ? "Save entry"
                    : body.divisionId
                      ? "Finalize division results"
                      : "Assign scoring access")}
              </dd>
              {body.entry && (
                <>
                  <dt>Entry</dt>
                  <dd>
                    {body.entry.name} · {body.entry.divisionId}
                  </dd>
                </>
              )}
              {body.registrationId && (
                <>
                  <dt>Team-season registration</dt>
                  <dd>{body.registrationId}</dd>
                </>
              )}
              {body.season && (
                <>
                  <dt>Season</dt>
                  <dd>{body.season}</dd>
                </>
              )}
              {body.actions && (
                <>
                  <dt>Granted actions</dt>
                  <dd>{body.actions.join(", ")}</dd>
                </>
              )}
              {body.authorityName && (
                <>
                  <dt>Authority</dt>
                  <dd>{body.authorityName}</dd>
                </>
              )}
              {(body.reviewerId || body.delegationId) && (
                <>
                  <dt>Reviewer / delegation identifier</dt>
                  <dd style={{ overflowWrap: "anywhere" }}>
                    {body.delegationId ?? body.reviewerId}
                  </dd>
                </>
              )}
              {body.recipientEmail && (
                <>
                  <dt>Account</dt>
                  <dd>{body.recipientEmail}</dd>
                </>
              )}
              {body.eventId && (
                <>
                  <dt>Event / game</dt>
                  <dd>
                    {body.eventId} · {body.gameId}
                  </dd>
                </>
              )}
              {body.scope && (
                <>
                  <dt>Approval scope</dt>
                  <dd>
                    {Object.entries(body.scope).map(([dimension, values]) => (
                      <p key={dimension}>
                        {(
                          {
                            countries: "Countries",
                            organizationIds: "Organizations",
                            disciplines: "Disciplines",
                            categories: "Categories",
                            includeEventIds: "Named inclusions",
                            excludeEventIds: "Named exclusions",
                          } as Record<string, string>
                        )[dimension] ?? dimension}
                        :{" "}
                        {(values as string[]).join(", ") ||
                          (dimension === "includeEventIds" ||
                          dimension === "excludeEventIds"
                            ? "None"
                            : "All")}
                      </p>
                    ))}
                  </dd>
                </>
              )}
              <dt>Reason</dt>
              <dd>{body.reason ?? body.note}</dd>
              {body.amountMinor !== undefined && (
                <>
                  <dt>Amount (currency minor units)</dt>
                  <dd>
                    {body.amountMinor} {body.currency}
                  </dd>
                </>
              )}
              {body.externalReference && (
                <>
                  <dt>External receipt reference</dt>
                  <dd>{body.externalReference}</dd>
                </>
              )}
              {body.divisionId && (
                <>
                  <dt>Division</dt>
                  <dd>{body.divisionId}</dd>
                </>
              )}
              <dt>Original command identifier</dt>
              <dd style={{ overflowWrap: "anywhere" }}>
                {body.requestId ?? body.id}
              </dd>
            </dl>
          </details>
          <div className="application-actions">
            <button disabled={state.busy} onClick={() => void state.retry()}>
              {retryLabel ?? `Retry exact ${label} command`}
            </button>
            <button
              className="secondary"
              disabled={state.busy}
              onClick={() => void state.reconcile()}
            >
              Reconcile recorded {label} command
            </button>
          </div>
        </div>
      )}
    </>
  );
}
