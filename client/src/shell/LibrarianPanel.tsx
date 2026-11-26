import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Title } from "../types";

type Reply = { text: string; records: Title[]; pendingSave: Pick<Title, "id" | "title" | "author"> | null };

export function LibrarianPanel() {
  const { reader } = useAuth();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await api.request<Reply>("/librarian", { method: "POST", body: JSON.stringify({ message }) });
      setReply(result);
      setMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The librarian could not answer.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSave() {
    if (!reply?.pendingSave) return;
    try {
      await api.addToShelf(reply.pendingSave.id);
      setNotice(`${reply.pendingSave.title} was added to your shelf.`);
      setReply({ ...reply, pendingSave: null });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update your shelf.");
    }
  }

  return (
    <section className="librarian-panel" aria-labelledby="librarian-title">
      <div className="librarian-intro">
        <span className="eyebrow">ASK THE COLLECTION</span>
        <h2 id="librarian-title">The librarian</h2>
        <p>Search live records, compare titles, or ask to prepare a shelf addition.</p>
      </div>
      <div className="librarian-chat">
        {reply && (
          <div className="librarian-reply" aria-live="polite">
            <p>{reply.text}</p>
            {reply.records.length > 0 && (
              <ul>{reply.records.map((item) => <li key={item.id}><strong>{item.title}</strong><span> — {item.author}</span></li>)}</ul>
            )}
            {reply.pendingSave && (
              <div className="confirm-row">
                <span>Ready to add <strong>{reply.pendingSave.title}</strong>?</span>
                <button className="button button-primary" disabled={reader?.role !== "reader"} onClick={confirmSave}>Confirm</button>
                {reader?.role !== "reader" && <span className="muted">Sign in as a reader to confirm.</span>}
              </div>
            )}
          </div>
        )}
        {notice && <p className="form-message" role="status">{notice}</p>}
        <form className="librarian-form" onSubmit={ask}>
          <label className="visually-hidden" htmlFor="librarian-question">Ask the librarian</label>
          <input id="librarian-question" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Try “compare Walden and Nature”" maxLength={1000} />
          <button className="button button-primary" disabled={busy || !message.trim()}>{busy ? "Searching…" : "Ask"}</button>
        </form>
      </div>
    </section>
  );
}
