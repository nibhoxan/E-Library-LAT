import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function AccountScreen() {
  const { reader, login, register, verifyEmail, resendCode, forgotPassword, resetPassword, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function go(next: typeof mode, message = "") {
    setMode(next);
    setError("");
    setNotice(message);
    setCode("");
    if (next === "login" || next === "register") setPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "register") {
        const result = await register(name, email, password);
        go("verify", result.emailSent
          ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
          : "Your account was created, but the email could not be sent. Tap Send a new code to try again.");
        setCooldown(60);
        return;
      }
      if (mode === "verify") {
        await verifyEmail(email, code);
        navigate("/");
        return;
      }
      if (mode === "forgot") {
        await forgotPassword(email);
        go("reset", "If an account exists for that email, a 6-digit code is on its way.");
        setCooldown(60);
        return;
      }
      if (mode === "reset") {
        await resetPassword(email, code, password);
        go("login", "Your password was updated. Sign in with the new password.");
        return;
      }
      await login(email, password);
      navigate("/");
    } catch (cause) {
      if ((cause as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        go("verify", "Verify your email first. We sent a 6-digit code to your inbox.");
        setCooldown(60);
      } else {
        setError(cause instanceof Error ? cause.message : "We could not complete that request.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    setError("");
    setBusy(true);
    try {
      if (mode === "reset") await forgotPassword(email);
      else await resendCode(email);
      setNotice("If that account can use a code, a new one is on its way.");
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not send a new code.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    navigate("/");
  }

  return (
    <div className="page account-page">
      <section className="page-heading"><div><span className="eyebrow">YOUR READING ROOM</span><h1>Account</h1><p>Keep a reading list and bookmarks in sync on web and phone.</p></div></section>
      {reader ? (
        <div className="account-card">
          <p className="eyebrow">SIGNED IN AS {reader.role.toUpperCase()}</p>
          <h2>{reader.name}</h2><p>{reader.email}</p>
          <button className="button button-secondary" onClick={() => void signOut()}>Sign out</button>
        </div>
      ) : (
        <div className="account-card">
          {(mode === "login" || mode === "register") ? (
            <div className="tab-row">
              <button className={`tab-button ${mode === "login" ? "active" : ""}`} onClick={() => go("login")}>Sign in</button>
              <button className={`tab-button ${mode === "register" ? "active" : ""}`} onClick={() => go("register")}>Create account</button>
            </div>
          ) : (
            <div className="tab-row"><button className="tab-button active" type="button">{mode === "verify" ? "Verify your email" : mode === "forgot" ? "Forgot password" : "Reset password"}</button></div>
          )}
          <form className="stack-form" onSubmit={submit}>
            {mode === "register" && <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} /></label>}
            <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" readOnly={mode === "verify" || mode === "reset"} /></label>
            {(mode === "verify" || mode === "reset") && (
              <label>6-digit code<input required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="000000" /></label>
            )}
            {(mode === "login" || mode === "register" || mode === "reset") && (
              <label>{mode === "reset" ? "New password" : "Password"}<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} /></label>
            )}
            {notice && <p className="form-message" role="status">{notice}</p>}
            {error && <p className="form-message error" role="alert">{error}</p>}
            <button className="button button-primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Send reset code" : "Set new password"}
            </button>
            {(mode === "verify" || mode === "reset") && (
              <button type="button" className="button button-secondary" disabled={busy || cooldown > 0} onClick={() => void sendAgain()}>
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
              </button>
            )}
            {mode === "login" && <button type="button" className="tab-button" onClick={() => go("forgot")}>Forgot your password?</button>}
            {mode !== "login" && mode !== "register" && <button type="button" className="tab-button" onClick={() => go("login")}>Back to sign in</button>}
          </form>
          {import.meta.env.DEV && (
            <div className="seed-account">
              <p><strong>Reader demo</strong><br />reader@readingroom.local · Reader123!</p>
              <p><strong>Desk demo</strong><br />desk@readingroom.local · Desk123!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
