import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { colors, corners } from "../theme";
import type { Title } from "../types";

export function LibraryTab({ onSelect }: { onSelect: (title: Title) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Title[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: "1", limit: "60" });
      if (query.trim()) params.set("q", query.trim());
      setBusy(true);
      void api<{ items: Title[]; total: number }>(`/titles?${params}`)
        .then((result) => { if (active) { setItems(result.items); setTotal(result.total); setError(""); } })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "The catalog could not be loaded."); })
        .finally(() => { if (active) setBusy(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>A COLLECTION FOR THE CURIOUS</Text>
        <Text style={styles.title}>Find a good read.</Text>
        <Text style={styles.subheading}>{total ? `${total} public-domain records` : "Science, history, travel, essays, and fiction."}</Text>
      </View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search title, author, or category" placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && items.length === 0 ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null}
      {!busy && !error && items.length === 0 ? <Text style={styles.empty}>No titles match.</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelect(item)}>
            <Text style={styles.category}>{item.category}{item.publishedYear ? ` · ${item.publishedYear}` : ""}</Text>
            <Text style={styles.bookTitle}>{item.title}</Text>
            <Text style={styles.author}>{item.author}</Text>
            <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
            <View style={styles.actionRow}><Text style={styles.link}>View record</Text><Text style={styles.arrow}>→</Text></View>
          </Pressable>
        )}
        ListFooterComponent={busy && items.length > 0 ? <ActivityIndicator color={colors.green} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: "700", letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "500", marginTop: 8, fontFamily: "serif" },
  subheading: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  search: { marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: corners.control, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 12, color: colors.ink, shadowColor: "#23332a", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 18, gap: 12 },
  card: { padding: 17, borderWidth: 1, borderColor: colors.line, borderRadius: corners.card, backgroundColor: colors.card, shadowColor: "#23332a", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  category: { color: colors.green, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  bookTitle: { color: colors.ink, fontFamily: "serif", fontSize: 23, lineHeight: 28, marginTop: 10 },
  author: { color: colors.muted, fontSize: 12, marginTop: 4 },
  summary: { color: "#667269", fontSize: 12, lineHeight: 18, marginTop: 9 },
  actionRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  link: { color: colors.green, fontWeight: "700", fontSize: 12 },
  arrow: { color: colors.greenDark, fontSize: 14, marginLeft: 6 },
  error: { marginHorizontal: 20, color: colors.warning, fontSize: 12 },
  empty: { padding: 24, textAlign: "center", color: colors.muted },
  loader: { paddingVertical: 20 }
});
