import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { api, getBaseUrl, getToken, setToken, startGuest } from "./src/api";
import { AccountTab } from "./src/tabs/AccountTab";
import { LibraryTab } from "./src/tabs/LibraryTab";
import { ShelfTab } from "./src/tabs/ShelfTab";
import { BookScreen } from "./src/BookScreen";
import { LibrarianSheet } from "./src/LibrarianSheet";
import { colors } from "./src/theme";
import type { Reader, Title } from "./src/types";

type Tab = "catalog" | "shelf" | "account";
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "catalog", label: "Catalog" },
  { key: "shelf", label: "My shelf" },
  { key: "account", label: "Account" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [selected, setSelected] = useState<Title | null>(null);
  const [librarianOpen, setLibrarianOpen] = useState(false);
  const [reader, setReader] = useState<Reader | null>(null);
  const [ready, setReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setBaseUrl(await getBaseUrl());
        const token = await getToken();
        if (token) {
          try { if (active) setReader(await api<Reader>("/session/me")); }
          catch { await setToken(null); }
        }
        if (!await getToken()) await startGuest();
      } catch {
        // Anonymous catalog browsing can retry after the reader saves a reachable API address.
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  async function signOut() {
    try { await api("/session/logout", { method: "POST" }); }
    finally {
      setReader(null);
      await setToken(null);
      try { await startGuest(); } catch { /* The phone can still browse without a session token. */ }
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><View style={styles.markLine} /><View style={styles.markLine} /><View style={styles.markLine} /></View>
          <View><Text style={styles.brand}>Reading Room</Text><Text style={styles.tagline}>A LIBRARY FOR THE CURIOUS</Text></View>
        </View>
      </View>
      <View style={styles.content}>
        {selected ? <BookScreen title={selected} reader={reader} onClose={() => setSelected(null)} /> :
          tab === "catalog" ? <LibraryTab onSelect={setSelected} /> :
          tab === "shelf" ? <ShelfTab reader={reader} onSelect={setSelected} /> :
          <AccountTab key={baseUrl} reader={reader} onReader={setReader} onSignOut={() => void signOut()} />}
      </View>
      {!selected && (
        <View style={styles.bottomBar}>
          {tabs.map((item) => (
            <Pressable key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}>
              <View style={[styles.navIndicator, tab === item.key && styles.navIndicatorActive]} />
              <Text style={[styles.navLabel, tab === item.key && styles.navActive]}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.askButton} onPress={() => setLibrarianOpen(true)}><Text style={styles.askLabel}>Ask</Text></Pressable>
        </View>
      )}
      {!ready ? <View style={styles.loading}><Text style={styles.loadingText}>Opening the reading room…</Text></View> : null}
      <LibrarianSheet visible={librarianOpen} onClose={() => setLibrarianOpen(false)} reader={reader} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 34, height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 9, backgroundColor: colors.softGreen },
  markLine: { width: 3, height: 19, borderRadius: 2, backgroundColor: colors.green },
  brand: { color: colors.greenDark, fontFamily: "serif", fontSize: 23 },
  tagline: { color: colors.muted, fontSize: 8, fontWeight: "700", letterSpacing: 1.35, marginTop: 3 },
  content: { flex: 1 },
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", minHeight: 68, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 8, paddingBottom: 4 },
  navItem: { alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 72, paddingHorizontal: 8 },
  navIndicator: { width: 16, height: 3, borderRadius: 2, backgroundColor: "transparent", marginBottom: 6 },
  navIndicatorActive: { width: 25, backgroundColor: colors.green },
  navLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  navActive: { color: colors.greenDark, fontWeight: "700" },
  askButton: { backgroundColor: colors.green, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 17, shadowColor: colors.greenDark, shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  askLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  loading: { position: "absolute", bottom: 76, alignSelf: "center", backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  loadingText: { color: colors.muted, fontSize: 11 }
});
