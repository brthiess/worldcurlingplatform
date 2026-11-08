"use client";
import { useEffect, useState } from "react";
type Mode = "signin" | "register" | "recover" | "verify";
export default function Account() {
  const [mode, setMode] = useState<Mode>("signin"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("error"))
      setError("The verification link could not be used. Request a new link.");
    else if (q.has("verified"))
      setNotice("Email verified. You can now sign in.");
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget),
      email = String(form.get("email"));
    const path = {
      signin: "sign-in/email",
      register: "sign-up/email",
      recover: "request-password-reset",
      verify: "send-verification-email",
    }[mode];
    const body =
      mode === "signin"
        ? { email, password: form.get("password") }
        : mode === "register"
          ? {
              email,
              password: form.get("password"),
              name: form.get("name"),
              callbackURL: location.origin + "/account?verified=1",
            }
          : mode === "recover"
            ? { email, redirectTo: location.origin + "/account/reset" }
            : { email, callbackURL: location.origin + "/account?verified=1" };
    try {
      const response = await fetch("/api/auth/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many attempts. Please wait one minute."
            : mode === "signin"
              ? "Sign-in failed. Check your email, password and email verification."
              : "The request could not be completed. Check the form and try again.",
        );
      if (mode === "signin") {
        location.href = "/account/profile";
        return;
      }
      setNotice(
        mode === "register"
          ? "Account requested. Use the verification email before signing in. No player or team authority has been granted."
          : "If this account needs that email, a link has been sent. Check your inbox.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">Your account</p>
      <h1>
        {
          {
            signin: "Sign in",
            register: "Create an account",
            recover: "Recover your account",
            verify: "Verify your email",
          }[mode]
        }
      </h1>
      <p>
        Accounts and sport records are separate. Player links require World
        Curling approval.
      </p>
      <div className="account-actions" aria-label="Account options">
        {(["signin", "register", "recover", "verify"] as Mode[]).map(
          (value) => (
            <button
              key={value}
              type="button"
              className="secondary"
              aria-pressed={mode === value}
              disabled={busy}
              onClick={() => {
                setMode(value);
                setError("");
                setNotice("");
              }}
            >
              {
                {
                  signin: "Sign in",
                  register: "Register",
                  recover: "Forgot password",
                  verify: "Resend verification",
                }[value]
              }
            </button>
          ),
        )}
      </div>
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
      <form className="form-card" onSubmit={submit} key={mode}>
        {mode === "register" && (
          <>
            <label htmlFor="name">Account display name</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={100}
              required
            />
          </>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
        {(mode === "signin" || mode === "register") && (
          <>
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              minLength={12}
              maxLength={128}
              required
            />
            {mode === "register" && (
              <p className="muted">Use 12–128 characters.</p>
            )}
          </>
        )}
        <button disabled={busy}>
          {busy
            ? "Sending…"
            : {
                signin: "Sign in",
                register: "Create account",
                recover: "Send recovery link",
                verify: "Send verification link",
              }[mode]}
        </button>
      </form>
      <p>
        <a href="/account/profile">Claim status and profile →</a>
      </p>
      <p>
        <a href="/admin">Demo persona sign-in / operations →</a>
      </p>
    </main>
  );
}
