import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Title } from "../types";

type Summary = {
  books: number;
  accounts: number;
  downloads: number;
  recent: Array<{ id: string; createdAt: string; title: Pick<Title, "id" | "title" | "author">; reader: { email: string } | null }>;
};
type Draft = { title: string; author: string; category: string; summary: string; publishedYear: string; gutenbergId: string };
const emptyDraft: Draft = { title: "", author: "", category: "", summary: "", publishedYear: "", gutenbergId: "" };

export function DeskScreen() {
  const { reader } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [titles, setTitles] = useState<Title[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const load = useCallback(async () => {
    try {
      const [metrics, records] = await Promise.all([
        api.request<Summary>("/desk/summary"),
        api.titles(new URLSearchParams({ page: "1", limit: "60" }))
      ]);
      setSummary(metrics);
      setTitles(records.items);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the desk.");
    }
  }, []);
  useEffect(() => { if (reader?.role === "desk") void load(); }, [reader, load, revision]);

  if (reader?.role !== "desk") return <div className="page"><div className="alert alert-warning">The desk screen is available to desk accounts only. Sign in with the desk account from Account.</div></div>;

  function edit(item: Title) {
    setEditing(item.id);
    setDraft({ title: item.title, author: item.author, category: item.category, summary: item.summary, publishedYear: item.publishedYear?.toString() ?? "", gutenbergId: item.gutenbergId?.toString() ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const body = {
      ...draft,
      publishedYear: draft.publishedYear ? Number(draft.publishedYear) : undefined,
      gutenbergId: draft.gutenbergId ? Number(draft.gutenbergId) : undefined
    };
    try {
      await api.request(editing ? `/desk/titles/${editing}` : "/desk/titles", {
        method: editing ? "PUT" : "POST", body: JSON.stringify(body)
      });
      setDraft(emptyDraft);
      setEditing(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this title.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this catalog record? Referenced download and shelf history will be preserved and may prevent deletion.")) return;
    try {
      await api.request(`/desk/titles/${id}`, { method: "DELETE" });
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this title.");
    }
  }

  return (
    <div className="page desk-page">
      <section className="page-heading"><div><span className="eyebrow">LIBRARIAN WORKSPACE</span><h1>Desk</h1><p>Manage catalog records and review reading-room activity.</p></div></section>
      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {summary && <section className="stats-grid" aria-label="Reading room statistics">
        <div className="stat-card"><strong>{summary.books}</strong><span>Books</span></div>
        <div className="stat-card"><strong>{summary.accounts}</strong><span>Accounts</span></div>
        <div className="stat-card"><strong>{summary.downloads}</strong><span>Downloads</span></div>
      </section>}
      <section className="desk-section">
        <div className="section-title"><div><span className="eyebrow">CATALOG</span><h2>{editing ? "Edit record" : "Add a title"}</h2></div></div>
        <form className="desk-form" onSubmit={save}>
          <label>Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Author<input required value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} /></label>
          <label>Category<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
          <label>First published<input type="number" value={draft.publishedYear} onChange={(event) => setDraft({ ...draft, publishedYear: event.target.value })} /></label>
          <label>Project Gutenberg ID (optional)<input type="number" min="1" value={draft.gutenbergId} onChange={(event) => setDraft({ ...draft, gutenbergId: event.target.value })} /></label>
          <label className="wide-field">Summary<textarea required rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary">{editing ? "Save changes" : "Add title"}</button>{editing && <button type="button" className="button button-secondary" onClick={() => { setEditing(null); setDraft(emptyDraft); }}>Cancel</button>}</div>
        </form>
      </section>
      <section className="desk-section">
        <div className="section-title"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Recent downloads</h2></div></div>
        <div className="activity-list">{summary?.recent.map((download) => <div className="activity-row" key={download.id}><div><strong>{download.title.title}</strong><span>{download.title.author} · {download.reader?.email ?? "Guest"}</span></div><time>{new Date(download.createdAt).toLocaleString()}</time></div>)}</div>
      </section>
      <section className="desk-section">
        <div className="section-title"><div><span className="eyebrow">EDIT RECORDS</span><h2>Catalog titles</h2></div></div>
        <div className="desk-title-list">{titles.map((item) => <div className="desk-title-row" key={item.id}><div><strong>{item.title}</strong><span>{item.author} · {item.category}</span></div><div className="row-actions"><button className="button button-secondary" onClick={() => edit(item)}>Edit</button><button className="button button-text" onClick={() => void remove(item.id)}>Delete</button></div></div>)}</div>
      </section>
    </div>
  );
}
