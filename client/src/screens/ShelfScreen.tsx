import { useEffect, useState } from "react";
import { CatalogCard } from "../shell/CatalogCard";
import { api } from "../api";
import { useAuth } from "../auth";
import type { ShelfResponse } from "../types";

export function ShelfScreen() {
  const { reader } = useAuth();
  const [data, setData] = useState<ShelfResponse>({ shelf: [], bookmarks: [] });
  const [tab, setTab] = useState<"shelf" | "bookmarks">("shelf");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!reader) return;
    let active = true;
    void api.shelves().then((result) => { if (active) { setData(result); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load your shelf."); });
    return () => { active = false; };
  }, [reader, revision]);

  async function remove(id: string) {
    try {
      if (tab === "shelf") await api.removeFromShelf(id);
      else await api.removeBookmark(id);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this record.");
    }
  }

  const items = data[tab];
  return (
    <div className="page">
      <section className="page-heading"><div><span className="eyebrow">YOUR READING ROOM</span><h1>My shelf</h1><p>Your reading list and bookmarks sync across the website and phone app.</p></div></section>
      {!reader && <div className="empty-state">Sign in to see your saved titles and bookmarks.</div>}
      {error && <div className="alert alert-warning">{error}</div>}
      {reader && (
        <>
          <div className="tab-row" role="tablist">
            <button className={`tab-button ${tab === "shelf" ? "active" : ""}`} onClick={() => setTab("shelf")}>Reading list ({data.shelf.length})</button>
            <button className={`tab-button ${tab === "bookmarks" ? "active" : ""}`} onClick={() => setTab("bookmarks")}>Bookmarks ({data.bookmarks.length})</button>
          </div>
          {items.length ? <div className="catalog-grid">{items.map((item) => <div className="saved-card" key={item.id}><CatalogCard title={item} /><button className="text-button remove-button" onClick={() => remove(item.id)}>Remove from {tab}</button></div>)}</div> : <div className="empty-state">Nothing here yet. Browse the catalog to save a title.</div>}
        </>
      )}
    </div>
  );
}
