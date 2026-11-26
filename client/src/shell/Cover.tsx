import { useState } from "react";
import type { Title } from "../types";

// Muted cover colours that match the site. A book without a photo gets one of these, chosen from its category and title.
const palettes: Array<[string, string]> = [
  ["#3f6b4d", "#eef4ea"], ["#7a4e3a", "#f6ece3"], ["#35505f", "#e8f0f4"],
  ["#6b5a2f", "#f5efdb"], ["#5b3f5e", "#f2e9f3"], ["#4a5b3a", "#ecf1de"]
];

function pick(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length];
}

/**
 * A book cover. The generated cover is always drawn underneath, so the layout never jumps and a book without a
 * photo (or a slow connection) still looks finished. The real cover fades in over it when it loads.
 */
export function Cover({ title, size = "card" }: { title: Title; size?: "card" | "detail" }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [background, ink] = pick(`${title.category}|${title.title}`);
  return (
    <div className={`cover cover-${size}`} style={{ background, color: ink }}>
      <div className="cover-fallback" aria-hidden="true">
        <span className="cover-category">{title.category}</span>
        <span className="cover-title">{title.title}</span>
        <span className="cover-author">{title.author}</span>
      </div>
      {!failed && (
        <img
          className={loaded ? "is-loaded" : ""}
          src={`/api/titles/${encodeURIComponent(title.id)}/cover`}
          alt={`Cover of ${title.title}`}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            // A tiny placeholder image is not a real cover.
            if (event.currentTarget.naturalWidth < 40) setFailed(true);
            else setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
