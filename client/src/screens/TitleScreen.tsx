import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Title } from "../types";
import { Cover } from "../shell/Cover";

export function TitleScreen() {
  const { id = "" } = useParams();
  const { reader } = useAuth();
  const [title, setTitle] = useState<Title | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void api.title(id).then((record) => { if (active) setTitle(record); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this title."); });
    return () => { active = false; };
  }, [id]);

  async function downloadCard() {
    if (!title) return;
    setBusy(true);
    setNotice("");
    try {
      const blob = await api.downloadCard(title.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-card.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Bibliographic card downloaded.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The card could not be downloaded.");
    } finally {
      setBusy(false);
    }
  }

  async function addShelf(kind: "shelf" | "bookmark") {
    if (!title) return;
    try {
      if (kind === "shelf") await api.addToShelf(title.id);
      else await api.addBookmark(title.id);
      setNotice(kind === "shelf" ? "Added to your shelf." : "Bookmarked.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update your account.");
    }
  }

  if (error) return <div className="page"><div className="alert alert-warning">{error}</div><Link className="text-button" to="/">Return to catalog</Link></div>;
  if (!title) return <div className="page"><p className="muted">Loading record…</p></div>;
  return (
    <div className="page title-page">
      <Link to="/" className="text-button back-link">← Back to catalog</Link>
      <article className="title-record">
        <div className="record-layout">
        <div className="record-cover"><Cover title={title} size="detail" /></div>
        <div className="record-body">
        <div className="eyebrow">{title.category}{title.publishedYear ? ` · FIRST PUBLISHED ${title.publishedYear}` : ""}</div>
        <h1>{title.title}</h1>
        <p className="record-author">{title.author}</p>
        <div className="record-rule" />
        <p className="record-summary">{title.summary}</p>
        {title.gutenbergId && <a className="text-button gutenberg-link" href={`https://www.gutenberg.org/ebooks/${title.gutenbergId}`} target="_blank" rel="noreferrer">Open the public-domain text at Project Gutenberg ↗</a>}
        <div className="record-actions">
          <button className="button button-primary" disabled={busy} onClick={downloadCard}>{busy ? "Preparing…" : "Download bibliographic card"}</button>
          <button className="button button-secondary" disabled={!reader} onClick={() => addShelf("shelf")}>Add to my shelf</button>
          <button className="button button-text" disabled={!reader} onClick={() => addShelf("bookmark")}>Bookmark</button>
        </div>
        {!reader && <p className="muted">Sign in to sync your shelf and bookmarks across devices.</p>}
        {notice && <p className="form-message" role="status">{notice}</p>}
        <p className="card-note">The PDF is an original bibliographic card, not the book text.</p>
        </div>
        </div>
      </article>
    </div>
  );
}
