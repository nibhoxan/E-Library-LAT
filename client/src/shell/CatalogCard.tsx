import { Link } from "react-router-dom";
import type { Title } from "../types";

export function CatalogCard({ title }: { title: Title }) {
  return (
    <article className="catalog-card">
      <div className="card-kicker">{title.category}{title.publishedYear ? ` · ${title.publishedYear}` : ""}</div>
      <h2><Link to={`/titles/${title.id}`}>{title.title}</Link></h2>
      <p className="card-author">{title.author}</p>
      <p className="card-summary">{title.summary}</p>
      <Link className="text-button card-link" to={`/titles/${title.id}`}>View record <span aria-hidden="true">→</span></Link>
    </article>
  );
}
