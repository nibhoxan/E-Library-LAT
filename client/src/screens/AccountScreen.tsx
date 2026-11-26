import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function AccountScreen() {
  const { reader, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await register(name, email, password);
      else await login(email, password);
      navigate("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete that request.");
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
          <div className="tab-row">
            <button className={`tab-button ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Sign in</button>
            <button className={`tab-button ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>Create account</button>
          </div>
          <form className="stack-form" onSubmit={submit}>
            {mode === "register" && <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} /></label>}
            <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
            <label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} /></label>
            {error && <p className="form-message error" role="alert">{error}</p>}
            <button className="button button-primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <div className="seed-account">
            <p><strong>Reader demo</strong><br />reader@readingroom.local · Reader123!</p>
            <p><strong>Desk demo</strong><br />desk@readingroom.local · Desk123!</p>
          </div>
        </div>
      )}
    </div>
  );
}
