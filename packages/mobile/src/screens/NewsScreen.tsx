import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
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

  return <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE * 0.9}>
    <BackIconButton label={t("common.back")} onPress={onBack} />
    <Title>{t("news.title")}</Title>
    <View style={styles.panel}>
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {!loading && error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()} style={styles.reload}><Text style={styles.reloadText}>{t("news.retry")}</Text></Pressable></View> : null}
      {!loading && !error && posts.length === 0 ? <Text style={styles.empty}>{t("news.empty")}</Text> : null}
      {!loading && !error && posts.length > 0 ? <ScrollView contentContainerStyle={styles.posts}>{posts.map((post) => <View key={post.id} style={styles.post}><View style={styles.postHeader}><Text style={styles.postTitle}>{post.title}</Text><Text style={styles.date}>{new Date(post.publishedAt).toLocaleDateString(i18n.language)}</Text></View><Text style={styles.body}>{post.body}</Text></View>)}</ScrollView> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12 },
  panel: { flex: 1, minHeight: 0, width: "88%", maxWidth: 900, marginTop: 8, padding: 14, borderRadius: 16, justifyContent: "center", backgroundColor: "rgba(31,26,51,0.94)", borderWidth: 1, borderColor: "rgba(185,176,214,0.2)" },
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
