import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_BASE_URL, forgotPassword, getBaseUrl, resendCode, resetPassword, saveBaseUrl, signIn, signUp, verifyEmail } from "../api";
import { colors, corners } from "../theme";
import type { Reader } from "../types";

type Props = { reader: Reader | null; onReader: (reader: Reader | null) => void; onSignOut: () => void };
export function AccountTab({ reader, onReader, onSignOut }: Props) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function go(next: typeof mode, message = "") {
    setMode(next); setError(""); setNotice(message); setCode("");
    if (next === "login" || next === "register") setPassword("");
  }

  useEffect(() => { void getBaseUrl().then(setBaseUrl); }, []);

  async function saveAddress() {
    try { await saveBaseUrl(baseUrl); setNotice(`API address saved: ${baseUrl.trim().replace(/\/+$/, "")}`); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this address."); }
  }

  async function submit() {
    setError(""); setNotice("");
    try {
      if (mode === "register") {
        const result = await signUp(name, email, password);
        go("verify", result.emailSent ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.` : "Account created, but the email could not be sent. Tap Send a new code.");
        setCooldown(60);
      } else if (mode === "verify") {
        const account = await verifyEmail(email, code);
        onReader(account);
        go("login", `Signed in as ${account.name}.`);
      } else if (mode === "forgot") {
        await forgotPassword(email);
        go("reset", "If an account exists for that email, a 6-digit code is on its way.");
        setCooldown(60);
      } else if (mode === "reset") {
        await resetPassword(email, code, password);
        go("login", "Your password was updated. Sign in with the new password.");
      } else {
        const account = await signIn(email, password);
        onReader(account);
        setNotice(`Signed in as ${account.name}.`);
      }
    } catch (cause) {
      if ((cause as { code?: string }).code === "EMAIL_NOT_VERIFIED") { go("verify", "Verify your email first. We sent a 6-digit code to your inbox."); setCooldown(60); }
      else setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  async function sendAgain() {
    setError("");
    try {
      if (mode === "reset") await forgotPassword(email); else await resendCode(email);
      setNotice("If that account can use a code, a new one is on its way.");
      setCooldown(60);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send a new code."); }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>YOUR READING ROOM</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.description}>A saved shelf follows you between devices.</Text>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>API address</Text>
        <Text style={styles.helper}>Android emulator default: {DEFAULT_BASE_URL}</Text>
        <TextInput value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" keyboardType="url" style={styles.input} placeholder="https://reading-room-lat.wasmer.app" />
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
          {(mode === "login" || mode === "register") ? (
            <View style={styles.modeRow}>
              <Pressable onPress={() => go("login")}><Text style={[styles.mode, mode === "login" && styles.selectedMode]}>Sign in</Text></Pressable>
              <Pressable onPress={() => go("register")}><Text style={[styles.mode, mode === "register" && styles.selectedMode]}>Create account</Text></Pressable>
            </View>
          ) : (
            <Text style={styles.sectionTitle}>{mode === "verify" ? "Verify your email" : mode === "forgot" ? "Forgot password" : "Reset password"}</Text>
          )}
          {mode === "register" && <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} />}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" editable={mode !== "verify" && mode !== "reset"} style={styles.input} />
          {(mode === "verify" || mode === "reset") && (
            <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" maxLength={6} style={styles.input} />
          )}
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <TextInput value={password} onChangeText={setPassword} placeholder={mode === "reset" ? "New password (8+ characters)" : "Password"} secureTextEntry style={styles.input} />
          )}
          <Pressable style={styles.primaryButton} onPress={() => void submit()}>
            <Text style={styles.primaryText}>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Send reset code" : "Set new password"}</Text>
          </Pressable>
          {(mode === "verify" || mode === "reset") && (
            <Pressable style={[styles.secondaryButton, cooldown > 0 && { opacity: 0.5 }]} disabled={cooldown > 0} onPress={() => void sendAgain()}>
              <Text style={styles.secondaryText}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}</Text>
            </Pressable>
          )}
          {mode === "login" && <Pressable onPress={() => go("forgot")}><Text style={styles.mode}>Forgot your password?</Text></Pressable>}
          {mode !== "login" && mode !== "register" && <Pressable onPress={() => go("login")}><Text style={styles.mode}>Back to sign in</Text></Pressable>}
          {mode === "login" && <Text style={styles.helper}>Demo accounts only exist on a local server.</Text>}
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
