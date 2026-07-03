import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { theme } from "@/src/theme";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "ما فضل قراءة سورة الكهف يوم الجمعة؟",
  "كيف أُصلي صلاة الاستخارة؟",
  "ما آداب الدعاء المستجاب؟",
  "ما شروط صحة الصلاة؟",
];

export default function AssistantTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const listRef = useRef<FlatList<Msg>>(null);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    (async () => {
      let sid = await storage.getItem<string>("ithaq_chat_session", "");
      if (!sid) {
        sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await storage.setItem("ithaq_chat_session", sid);
      }
      setSessionId(sid);
      // Load history
      try {
        const r = await fetch(`${backendUrl}/api/chat/history/${sid}`);
        const j = await r.json();
        if (j.messages) {
          setMessages(
            j.messages.map((m: any, i: number) => ({
              id: `${i}_${m.role}`,
              role: m.role,
              content: m.content,
            })),
          );
        }
      } catch {}
    })();
  }, [backendUrl]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending || !sessionId) return;
    const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: msg };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const r = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      const j = await r.json();
      const aMsg: Msg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: j.reply || "عذراً، لم أتمكن من الإجابة الآن. حاول لاحقاً.",
      };
      setMessages((m) => [...m, aMsg]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `err_${Date.now()}`, role: "assistant", content: "حدث خطأ في الاتصال. حاول مرة أخرى." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const clearChat = async () => {
    // Start a new session locally
    const sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await storage.setItem("ithaq_chat_session", sid);
    setSessionId(sid);
    setMessages([]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="assistant-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>إيثاق AI</Text>
          <Text style={styles.subtitle}>مساعدك الإسلامي الذكي</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.headerBtn} testID="chat-clear-btn">
          <Ionicons name="refresh" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeBadge}>
              <Ionicons name="sparkles" size={28} color={theme.colors.gold} />
            </View>
            <Text style={styles.welcomeTitle}>السلام عليكم</Text>
            <Text style={styles.welcomeDesc}>
              اسألني عن أي أمر شرعي أو فقهي، وسأجيبك بحسب الكتاب والسنة.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestion}
                  onPress={() => send(s)}
                  testID={`suggestion-${i}`}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                  <Ionicons name="arrow-back" size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                <Text style={item.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>
                  {item.content}
                </Text>
              </View>
            )}
            ListFooterComponent={
              sending ? (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                </View>
              ) : null
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            testID="chat-send-btn"
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="اكتب سؤالك..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            multiline
            testID="chat-input"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "right",
  },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  welcomeBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  welcomeDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  suggestions: { width: "100%", marginTop: 24, gap: 8 },
  suggestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, textAlign: "right" },
  list: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: "82%",
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderTopRightRadius: 4,
  },
  bubbleUserText: { color: "#fff", fontSize: 14, lineHeight: 24, textAlign: "right" },
  bubbleAssistantText: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 24, textAlign: "right" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: theme.colors.textMuted },
});
