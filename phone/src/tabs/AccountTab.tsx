import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_BASE_URL, getBaseUrl, saveBaseUrl, signIn, signUp } from "../api";
import { colors, corners } from "../theme";
import type { Reader } from "../types";

type Props = { reader: Reader | null; onReader: (reader: Reader | null) => void; onSignOut: () => void };
export function AccountTab({ reader, onReader, onSignOut }: Props) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void getBaseUrl().then(setBaseUrl); }, []);

  async function saveAddress() {
    try { await saveBaseUrl(baseUrl); setNotice(`API address saved: ${baseUrl.trim().replace(/\/+$/, "")}`); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this address."); }
  }

  async function submit() {
    setError(""); setNotice("");
    try {
      const account = mode === "login" ? await signIn(email, password) : await signUp(name, email, password);
      onReader(account);
      setNotice(`Signed in as ${account.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>YOUR READING ROOM</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.description}>A saved shelf follows you between devices.</Text>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>API address</Text>
        <Text style={styles.helper}>Android emulator default: {DEFAULT_BASE_URL}</Text>
        <TextInput value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" keyboardType="url" style={styles.input} placeholder="http://10.0.2.2:4100" />
        <Pressable style={styles.secondaryButton} onPress={() => void saveAddress()}><Text style={styles.secondaryText}>Save address</Text></Pressable>
      </View>
      {reader ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Signed in</Text>
          <Text style={styles.helper}>{reader.name} · {reader.email}</Text>
          <Pressable style={styles.secondaryButton} onPress={onSignOut}><Text style={styles.secondaryText}>Sign out</Text></Pressable>
        </View>
      ) : (
        <View style={styles.panel}>
          <View style={styles.modeRow}>
            <Pressable onPress={() => setMode("login")}><Text style={[styles.mode, mode === "login" && styles.selectedMode]}>Sign in</Text></Pressable>
            <Pressable onPress={() => setMode("register")}><Text style={[styles.mode, mode === "register" && styles.selectedMode]}>Create account</Text></Pressable>
          </View>
          {mode === "register" && <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} />}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
          <Pressable style={styles.primaryButton} onPress={() => void submit()}><Text style={styles.primaryText}>{mode === "login" ? "Sign in" : "Create account"}</Text></Pressable>
          <Text style={styles.helper}>Reader demo: reader@readingroom.local / Reader123!</Text>
        </View>
      )}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 20 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: "700", letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "500", marginTop: 8, fontFamily: "serif" },
  description: { color: colors.muted, fontSize: 13, marginTop: 5, marginBottom: 18 },
  panel: { padding: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: corners.card, marginBottom: 14, gap: 10, shadowColor: "#23332a", shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  sectionTitle: { color: colors.ink, fontFamily: "serif", fontSize: 19 },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", borderRadius: corners.control, padding: 11, color: colors.ink },
  primaryButton: { backgroundColor: colors.green, borderRadius: corners.control, padding: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  secondaryButton: { borderWidth: 1, borderColor: "#b7c3b6", borderRadius: corners.control, padding: 11, alignItems: "center" },
  secondaryText: { color: colors.greenDark, fontSize: 12, fontWeight: "700" },
  modeRow: { flexDirection: "row", gap: 18, marginBottom: 3 },
  mode: { color: colors.muted, fontSize: 12, paddingVertical: 5 },
  selectedMode: { color: colors.greenDark, fontWeight: "700" },
  notice: { color: colors.greenDark, fontSize: 12 },
  error: { color: colors.warning, fontSize: 12 }
});
