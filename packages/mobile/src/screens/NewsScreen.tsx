import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "../components/ui";
import { getNews, NewsPost } from "../network/client";

export function NewsScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = React.useState<NewsPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setPosts(await getNews(i18n.language === "bg" ? "bg" : "en")); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : t("feedback.tryAgain")); }
    finally { setLoading(false); }
  }, [i18n.language, t]);

  React.useEffect(() => { void load(); }, [load]);

  return <View style={styles.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onBack} style={StyleSheet.absoluteFillObject} />
    <View style={styles.panel}>
      <View style={styles.header}><Text style={styles.title}>{t("news.title")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onBack} style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}><Text style={styles.closeText}>×</Text></Pressable></View>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {!loading && error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()} style={styles.reload}><Text style={styles.reloadText}>{t("news.retry")}</Text></Pressable></View> : null}
        {!loading && !error && posts.length === 0 ? <Text style={styles.empty}>{t("news.empty")}</Text> : null}
        {!loading && !error && posts.length > 0 ? <ScrollView style={styles.postList} contentContainerStyle={styles.posts}>{posts.map((post) => <View key={post.id} style={styles.post}><View style={styles.postHeader}><Text style={styles.postTitle}>{post.title}</Text><Text style={styles.date}>{new Date(post.publishedAt).toLocaleDateString(i18n.language)}</Text></View><Text style={styles.body}>{post.body}</Text></View>)}</ScrollView> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,3,12,0.7)" },
  panel: { width: "72%", maxWidth: 720, height: "72%", minHeight: 230, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderRadius: 18, backgroundColor: "rgba(31,26,51,0.98)", borderWidth: 2, borderColor: "rgba(185,176,214,0.38)" },
  header: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(185,176,214,0.3)" },
  title: { color: theme.text, fontSize: 22, fontWeight: "900" },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,92,255,0.24)" },
  closePressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  closeText: { color: "#FFF", fontSize: 26, lineHeight: 28, fontWeight: "700" },
  content: { flex: 1, minHeight: 0, justifyContent: "center", paddingTop: 10 },
  postList: { flex: 1, minHeight: 0 },
  posts: { gap: 10, paddingBottom: 8 },
  post: { padding: 14, borderRadius: 12, backgroundColor: "rgba(12,9,23,0.72)", borderLeftWidth: 3, borderLeftColor: theme.primary },
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  postTitle: { flex: 1, color: theme.text, fontSize: 17, fontWeight: "900" },
  date: { color: theme.textDim, fontSize: 10, fontWeight: "700" },
  body: { color: "#D8D1EA", fontSize: 12, lineHeight: 18, marginTop: 7 },
  center: { alignItems: "center", gap: 12 }, error: { color: "#FF9AA8", fontSize: 12, textAlign: "center" },
  reload: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9, backgroundColor: theme.primary }, reloadText: { color: "#FFF", fontWeight: "900" },
  empty: { color: theme.textDim, textAlign: "center", fontSize: 13, fontWeight: "700" },
});
