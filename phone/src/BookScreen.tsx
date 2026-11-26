import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { addToShelf, api, getBaseUrl, getToken } from "./api";
import { colors, corners } from "./theme";
import type { Reader, Title } from "./types";

export function BookScreen({ title, reader, onClose }: { title: Title; reader: Reader | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function downloadCard() {
    setBusy(true);
    setNotice("");
    try {
      const base = await getBaseUrl();
      const token = await getToken();
      const filename = title.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const result = await FileSystem.downloadAsync(`${base}/api/downloads/${encodeURIComponent(title.id)}/card.pdf`, `${FileSystem.cacheDirectory}${filename}-card.pdf`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      if (result.status < 200 || result.status >= 300) throw new Error("The card could not be downloaded.");
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "Bibliographic card" });
      setNotice("Bibliographic card ready.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The card could not be downloaded.");
    } finally { setBusy(false); }
  }

  async function save(kind: "shelf" | "bookmark") {
    try {
      if (kind === "shelf") await addToShelf(title.id);
      else await api(`/shelves/bookmarks`, { method: "POST", body: JSON.stringify({ titleId: title.id }) });
      setNotice(kind === "shelf" ? "Added to your shelf." : "Bookmarked.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Sign in to save this title."); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={onClose}><Text style={styles.back}>← Back to catalog</Text></Pressable>
      <View style={styles.record}>
        <Text style={styles.eyebrow}>{title.category}{title.publishedYear ? ` · FIRST PUBLISHED ${title.publishedYear}` : ""}</Text>
        <Text style={styles.title}>{title.title}</Text>
        <Text style={styles.author}>{title.author}</Text>
        <View style={styles.rule} />
        <Text style={styles.summary}>{title.summary}</Text>
        {title.gutenbergId ? <Pressable onPress={() => void Linking.openURL(`https://www.gutenberg.org/ebooks/${title.gutenbergId}`)}><Text style={styles.link}>Open public-domain text at Project Gutenberg ↗</Text></Pressable> : null}
        <Pressable style={styles.primary} disabled={busy} onPress={() => void downloadCard()}><Text style={styles.primaryText}>{busy ? "Preparing…" : "Download bibliographic card"}</Text></Pressable>
        <Pressable style={styles.secondary} disabled={!reader} onPress={() => void save("shelf")}><Text style={styles.secondaryText}>Add to my shelf</Text></Pressable>
        <Pressable style={styles.textButton} disabled={!reader} onPress={() => void save("bookmark")}><Text style={styles.link}>Bookmark</Text></Pressable>
        {!reader ? <Text style={styles.muted}>Sign in to sync your shelf and bookmarks.</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Text style={styles.note}>This PDF is an original bibliographic card, not the book text.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 18, paddingBottom: 30 },
  back: { color: colors.green, fontWeight: "700", fontSize: 12, paddingVertical: 10 },
  record: { marginTop: 12, padding: 22, borderWidth: 1, borderColor: colors.line, borderRadius: corners.card, backgroundColor: colors.card, shadowColor: "#23332a", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  eyebrow: { color: colors.green, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.ink, fontFamily: "serif", fontSize: 32, lineHeight: 39, marginTop: 13 },
  author: { color: colors.muted, fontSize: 15, marginTop: 9 },
  rule: { width: 52, height: 2, backgroundColor: "#8da78f", marginVertical: 22 },
  summary: { color: "#59675e", fontSize: 14, lineHeight: 22, marginBottom: 18 },
  link: { color: colors.green, fontWeight: "700", fontSize: 12, marginVertical: 8 },
  primary: { backgroundColor: colors.green, borderRadius: corners.control, padding: 13, alignItems: "center", marginTop: 18 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  secondary: { borderWidth: 1, borderColor: "#b7c3b6", borderRadius: corners.control, padding: 12, alignItems: "center", marginTop: 9 },
  secondaryText: { color: colors.greenDark, fontWeight: "700", fontSize: 12 },
  textButton: { alignItems: "center", padding: 9 },
  muted: { color: colors.muted, fontSize: 11, marginTop: 7 },
  notice: { color: colors.greenDark, fontSize: 12, marginTop: 11 },
  note: { color: colors.muted, fontSize: 10, marginTop: 18 }
});
