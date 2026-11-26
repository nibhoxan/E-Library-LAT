import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, loadShelf } from "../api";
import { colors, corners } from "../theme";
import type { ShelfResponse, Title } from "../types";

export function ShelfTab({ reader, onSelect }: { reader: { id: string } | null; onSelect: (title: Title) => void }) {
  const [tab, setTab] = useState<"shelf" | "bookmarks">("shelf");
  const [saved, setSaved] = useState<ShelfResponse>({ shelf: [], bookmarks: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!reader) return;
    setBusy(true);
    try { setSaved(await loadShelf()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your shelf."); }
    finally { setBusy(false); }
  }, [reader]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function remove(title: Title) {
    try {
      const route = tab === "shelf" ? `/shelves/${title.id}` : `/shelves/bookmarks/${title.id}`;
      await api<void>(route, { method: "DELETE" });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this record."); }
  }

  const list = saved[tab];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>YOUR READING ROOM</Text>
      <Text style={styles.title}>My shelf</Text>
      <Text style={styles.description}>Saved titles sync with your website account.</Text>
      {!reader ? <Text style={styles.empty}>Sign in on the Account tab to access your shelf.</Text> : <>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === "shelf" && styles.activeTab]} onPress={() => setTab("shelf")}><Text style={[styles.tabText, tab === "shelf" && styles.activeTabText]}>Reading list</Text></Pressable>
          <Pressable style={[styles.tab, tab === "bookmarks" && styles.activeTab]} onPress={() => setTab("bookmarks")}><Text style={[styles.tabText, tab === "bookmarks" && styles.activeTabText]}>Bookmarks</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={colors.green} /> : list.length === 0 ? <Text style={styles.empty}>Nothing saved here yet.</Text> : list.map((item) => (
          <View style={styles.card} key={item.id}>
            <Pressable onPress={() => onSelect(item)}><Text style={styles.bookTitle}>{item.title}</Text><Text style={styles.author}>{item.author} · {item.category}</Text></Pressable>
            <Pressable onPress={() => void remove(item)}><Text style={styles.remove}>Remove</Text></Pressable>
          </View>
        ))}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 20, paddingBottom: 35 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: "700", letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "500", marginTop: 8, fontFamily: "serif" },
  description: { color: colors.muted, fontSize: 13, marginTop: 5, marginBottom: 20 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 16 },
  tab: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.green },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  activeTabText: { color: colors.greenDark },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: corners.card, padding: 16, marginBottom: 11, shadowColor: "#23332a", shadowOpacity: 0.02, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  bookTitle: { color: colors.ink, fontFamily: "serif", fontSize: 21, lineHeight: 26 },
  author: { color: colors.muted, fontSize: 12, marginTop: 5 },
  remove: { color: colors.green, fontWeight: "700", fontSize: 12, marginTop: 13 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
  error: { color: colors.warning, fontSize: 12, marginBottom: 12 }
});
