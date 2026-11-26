import { useEffect, useState } from "react";
import { CatalogCard } from "../shell/CatalogCard";
import { api } from "../api";
import type { Title } from "../types";

export function CatalogScreen() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Title[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      const params = new URLSearchParams({ page: String(page), limit: "60" });
      if (title.trim()) params.set("title", title.trim());
      if (author.trim()) params.set("author", author.trim());
      if (category.trim()) params.set("category", category.trim());
      try {
        const result = await api.titles(params);
        if (!active) return;
        setItems((current) => page === 1 ? result.items : [...current, ...result.items]);
        setTotal(result.total);
        setOffline(false);
        setError("");
        setLoaded(true);
        if (timer) clearInterval(timer);
      } catch {
        if (!active) return;
        setOffline(true);
        setLoaded(true);
        setError("The reading room could not be reached on port 4100.");
        if (!timer) timer = setInterval(() => setRetry((value) => value + 1), 4000);
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [title, author, category, page, retry]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setPage(1);
    setter(value);
  }

  return (
    <div className="page catalog-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">A COLLECTION FOR THE CURIOUS</span>
          <h1>Find your next good read.</h1>
          <p>Public-domain writing across science, history, travel, essays, and fiction.</p>
        </div>
        {total > 0 && <div className="catalog-count"><strong>{total.toLocaleString()}</strong><span>catalog records</span></div>}
      </section>
      <section className="search-panel" aria-label="Catalog filters">
        <label>Title<input value={title} onChange={(event) => updateFilter(setTitle, event.target.value)} placeholder="Search title" /></label>
        <label>Author<input value={author} onChange={(event) => updateFilter(setAuthor, event.target.value)} placeholder="Search author" /></label>
        <label>Category<input value={category} onChange={(event) => updateFilter(setCategory, event.target.value)} placeholder="e.g. History" /></label>
      </section>
      {offline && <div className="alert alert-warning" role="status">{error}</div>}
      {loaded && !offline && items.length === 0 && <div className="empty-state">No titles match.</div>}
      <section className="catalog-grid" aria-live="polite">
        {items.map((item) => <CatalogCard key={item.id} title={item} />)}
      </section>
      {items.length > 0 && items.length < total && !offline && (
        <div className="load-more"><button className="button button-secondary" onClick={() => setPage((value) => value + 1)}>Show more titles</button></div>
      )}
      {!loaded && <p className="muted">Opening the catalog…</p>}
    </div>
  );
}
