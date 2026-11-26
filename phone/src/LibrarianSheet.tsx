import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { addToShelf, api } from "./api";
import { colors, corners } from "./theme";
import type { Reader, Title } from "./types";

type Reply = { text: string; records: Title[]; pendingSave: Pick<Title, "id" | "title" | "author"> | null };
export function LibrarianSheet({ visible, onClose, reader }: { visible: boolean; onClose: () => void; reader: Reader | null }) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!message.trim() || busy) return;
    setBusy(true); setNotice("");
    try {
      setReply(await api<Reply>("/librarian", { method: "POST", body: JSON.stringify({ message }) }));
      setMessage("");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The librarian could not answer."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!reply?.pendingSave) return;
    try {
      await addToShelf(reply.pendingSave.id);
      setNotice(`${reply.pendingSave.title} added to your shelf.`);
      setReply({ ...reply, pendingSave: null });
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Could not update your shelf."); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.heading}><View><Text style={styles.eyebrow}>ASK THE COLLECTION</Text><Text style={styles.title}>The librarian</Text></View><Pressable onPress={onClose}><Text style={styles.close}>Close</Text></Pressable></View>
          <Text style={styles.helper}>Ask about the live catalog or compare two records.</Text>
          <ScrollView style={styles.replies} contentContainerStyle={styles.repliesContent}>
            {reply ? <View style={styles.reply}>
              <Text style={styles.replyText}>{reply.text}</Text>
              {reply.records.map((item) => <Text style={styles.record} key={item.id}><Text style={styles.recordTitle}>{item.title}</Text> — {item.author}</Text>)}
              {reply.pendingSave ? <View style={styles.confirmRow}><Text style={styles.helper}>Add {reply.pendingSave.title} to your shelf?</Text><Pressable style={[styles.primary, !reader && styles.disabled]} disabled={!reader} onPress={() => void confirm()}><Text style={styles.primaryText}>Confirm</Text></Pressable>{!reader ? <Text style={styles.helper}>Sign in as a reader to confirm.</Text> : null}</View> : null}
            </View> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput value={message} onChangeText={setMessage} placeholder="Try “compare Walden and Nature”" placeholderTextColor={colors.muted} style={styles.input} maxLength={1000} multiline />
            <Pressable style={styles.primary} disabled={busy || !message.trim()} onPress={() => void ask()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Ask</Text>}</Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,36,28,.32)" },
  sheet: { height: "78%", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.paper },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#c5cdc3", alignSelf: "center", marginBottom: 18 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.green, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "600", marginTop: 4 },
  close: { color: colors.green, fontSize: 12, fontWeight: "700", padding: 8 },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  replies: { flex: 1, marginVertical: 12 },
  repliesContent: { flexGrow: 1, justifyContent: "flex-end", gap: 8 },
  reply: { padding: 14, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  replyText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginBottom: 7 },
  record: { color: colors.muted, fontSize: 11, marginTop: 4 },
  recordTitle: { color: colors.ink, fontWeight: "700" },
  confirmRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 11, paddingTop: 9, alignItems: "flex-start" },
  primary: { minWidth: 68, alignItems: "center", justifyContent: "center", backgroundColor: colors.green, borderRadius: corners.control, paddingVertical: 12, paddingHorizontal: 15 },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  disabled: { opacity: .48 },
  notice: { color: colors.greenDark, fontSize: 12, marginVertical: 7 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, maxHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: corners.control, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, color: colors.ink, fontSize: 12 }
});
