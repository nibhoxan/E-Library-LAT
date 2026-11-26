import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getBaseUrl } from "./api";
import type { Title } from "./types";

// Muted cover colours that match the app. A book without a photo gets one of these, chosen from its category and title.
const palettes: Array<[string, string]> = [
  ["#3f6b4d", "#eef4ea"], ["#7a4e3a", "#f6ece3"], ["#35505f", "#e8f0f4"],
  ["#6b5a2f", "#f5efdb"], ["#5b3f5e", "#f2e9f3"], ["#4a5b3a", "#ecf1de"]
];

function pick(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

/**
 * A book cover. A generated cover is always drawn underneath, so a book without a photo (or a slow connection)
 * still looks finished; the real cover appears on top when it loads. The server redirects to the image.
 */
export function Cover({ title, width = 86 }: { title: Title; width?: number }) {
  const [base, setBase] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [background, ink] = pick(`${title.category}|${title.title}`);
  const height = Math.round(width * 1.5);
  const unit = width / 9.5;

  useEffect(() => {
    let active = true;
    void getBaseUrl().then((value) => { if (active) setBase(value); });
    return () => { active = false; };
  }, []);

  return (
    <View style={[styles.cover, { width, height, backgroundColor: background }]}>
      <View style={[styles.frame, { borderColor: ink }]} />
      <View style={[styles.fallback, { padding: unit * 1.3, paddingLeft: unit * 1.7 }]}>
        <Text style={{ color: ink, fontSize: unit * 0.62, fontWeight: "700", letterSpacing: 1, opacity: 0.75 }} numberOfLines={1}>{title.category.toUpperCase()}</Text>
        <Text style={{ color: ink, fontFamily: "serif", fontSize: unit * 1.25, lineHeight: unit * 1.5 }} numberOfLines={5}>{title.title}</Text>
        <Text style={{ color: ink, fontFamily: "serif", fontSize: unit * 0.8, opacity: 0.85 }} numberOfLines={2}>{title.author}</Text>
      </View>
      {base && !failed ? (
        <Image
          source={{ uri: `${base}/api/titles/${encodeURIComponent(title.id)}/cover` }}
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
          resizeMode="cover"
          accessibilityLabel={`Cover of ${title.title}`}
          onLoad={(event) => {
            // A tiny placeholder image is not a real cover.
            if (event.nativeEvent.source.width < 40) setFailed(true);
            else setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
      <View pointerEvents="none" style={styles.spine} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8, overflow: "hidden", shadowColor: "#23332a", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  frame: { position: "absolute", top: "5%", bottom: "5%", left: "9%", right: "5%", borderWidth: 1, borderRadius: 2, opacity: 0.28 },
  fallback: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  spine: { position: "absolute", top: 0, bottom: 0, left: 0, width: 4, backgroundColor: "rgba(255,255,255,0.14)" }
});
