"use client";
import { useEffect, useRef, useState } from "react";
export default function Reset() {
  const [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const query = new URLSearchParams(location.search);
    setToken(query.get("token") ?? "");
    if (query.has("error") || !query.get("token"))
      setError("This recovery link is invalid or expired. Request a new link.");
    history.replaceState(null, "", "/account/reset");
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) {
      setError("Passwords must match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: form.get("password") }),
      });
      if (!response.ok)
        throw new Error(
          "The password could not be reset. Request a new recovery link.",
        );
      setToken("");
      setNotice("Password updated. Previous sessions have been signed out.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="workspace">
      <h1>Set a new password</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {token && (
        <form className="form-card" onSubmit={save}>
          <label htmlFor="password">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
          <label htmlFor="confirmation">Repeat new password</label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
          <button disabled={busy}>{busy ? "Saving…" : "Reset password"}</button>
        </form>
      )}
      <p>
        <a href="/account">Sign in or request a new link →</a>
      </p>
    </main>
  );
}
