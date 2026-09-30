import React from "react";
import { Pressable } from "../components/menuHaptics";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "../components/ui";
import { getChallenges, getNews, NewsPost, PlayerChallenge, respondChallenge } from "../network/client";

type InboxCategory = "challenges" | "news";
const DISMISSED_NEWS_STORAGE_PREFIX = "confidence-trivia:dismissed-news";
const READ_NEWS_STORAGE_PREFIX = "confidence-trivia:read-news";

export function InboxScreen({
  playerId,
  initialCategory,
  onPostsViewed,
  onChallengeCountChange,
  onAcceptChallenge,
  onBack,
}: {
  playerId: string | null;
  initialCategory: InboxCategory;
  onPostsViewed: (posts: NewsPost[]) => void;
  onChallengeCountChange: (count: number) => void;
  onAcceptChallenge: (challenge: PlayerChallenge) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = React.useState<InboxCategory>(initialCategory);
  const [posts, setPosts] = React.useState<NewsPost[]>([]);
  const [challenges, setChallenges] = React.useState<PlayerChallenge[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadErrors, setLoadErrors] = React.useState<Record<InboxCategory, string | null>>({ challenges: null, news: null });
  const [respondingId, setRespondingId] = React.useState<string | null>(null);
  const [deletingNewsId, setDeletingNewsId] = React.useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = React.useState<string | null>(null);
  const [readNewsIds, setReadNewsIds] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const refreshInFlight = React.useRef(false);

  const load = React.useCallback(async (showLoading = true) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const dismissedNewsKey = `${DISMISSED_NEWS_STORAGE_PREFIX}:${playerId ?? "local"}:${i18n.language}`;
      const readNewsKey = `${READ_NEWS_STORAGE_PREFIX}:${playerId ?? "local"}:${i18n.language}`;
      const [newsResult, challengeResult, savedDismissedIds, savedReadIds] = await Promise.all([
        getNews(i18n.language === "bg" ? "bg" : "en").then((value) => ({ value, error: null }), (loadError: unknown) => ({ value: null, error: loadError instanceof Error ? loadError.message : t("feedback.tryAgain") })),
        (playerId ? getChallenges(playerId) : Promise.resolve([])).then((value) => ({ value, error: null }), (loadError: unknown) => ({ value: null, error: loadError instanceof Error ? loadError.message : t("feedback.tryAgain") })),
        AsyncStorage.getItem(dismissedNewsKey).catch(() => null),
        AsyncStorage.getItem(readNewsKey).catch(() => null),
      ]);
      let dismissedIds = new Set<string>();
      try {
        const parsed = savedDismissedIds ? JSON.parse(savedDismissedIds) : [];
        if (Array.isArray(parsed)) dismissedIds = new Set(parsed.filter((id): id is string => typeof id === "string"));
      } catch {
        // Ignore invalid local dismissal history.
      }
      let readIds = new Set<string>();
      try {
        const parsed = savedReadIds ? JSON.parse(savedReadIds) : [];
        if (Array.isArray(parsed)) readIds = new Set(parsed.filter((id): id is string => typeof id === "string"));
      } catch {
        // Ignore invalid local read history.
      }
      if (newsResult.value) {
        setPosts(newsResult.value.filter((post) => !dismissedIds.has(post.id)));
        setReadNewsIds(readIds);
      }
      if (challengeResult.value) {
        const pending = challengeResult.value.filter((challenge) => challenge.status === "pending" && challenge.challengedId === playerId);
        setChallenges(pending);
        onChallengeCountChange(pending.length);
      }
      setLoadErrors({ news: newsResult.error, challenges: challengeResult.error });
      setError(null);
    } catch (loadError) {
      if (showLoading) setError(loadError instanceof Error ? loadError.message : t("feedback.tryAgain"));
    } finally {
      refreshInFlight.current = false;
      if (showLoading) setLoading(false);
    }
  }, [i18n.language, onChallengeCountChange, playerId, t]);

  React.useEffect(() => {
    void load();
    const interval = setInterval(() => void load(false), 3_000);
    return () => clearInterval(interval);
  }, [load]);

  function markNewsRead(post: NewsPost) {
    if (readNewsIds.has(post.id)) return;
    setReadNewsIds((ids) => new Set(ids).add(post.id));
    onPostsViewed([post]);
  }

  async function answerChallenge(challenge: PlayerChallenge, action: "accept" | "decline") {
    if (!playerId || respondingId) return;
    setRespondingId(challenge.id);
    setError(null);
    try {
      await respondChallenge(playerId, challenge.id, action);
      const remaining = challenges.filter((item) => item.id !== challenge.id);
      setChallenges(remaining);
      onChallengeCountChange(remaining.length);
      if (action === "accept") onAcceptChallenge({ ...challenge, status: "accepted" });
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : t("friends.challengeFailed"));
    } finally {
      setRespondingId(null);
    }
  }

  async function deleteNewsPost(postId: string) {
    if (deletingNewsId) return;
    setDeletingNewsId(postId);
    const remainingPosts = posts.filter((post) => post.id !== postId);
    const deletedPost = posts.find((post) => post.id === postId);
    setPosts(remainingPosts);
    setSelectedNewsId((selectedId) => selectedId === postId ? null : selectedId);
    if (deletedPost) markNewsRead(deletedPost);
    try {
      const key = `${DISMISSED_NEWS_STORAGE_PREFIX}:${playerId ?? "local"}:${i18n.language}`;
      const saved = await AsyncStorage.getItem(key).catch(() => null);
      let dismissedIds: string[] = [];
      try {
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) dismissedIds = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        // Replace invalid local dismissal history.
      }
      await AsyncStorage.setItem(key, JSON.stringify([...new Set([...dismissedIds, postId])]));
    } catch {
      setPosts(posts);
      setError(t("inbox.deleteFailed"));
    } finally {
      setDeletingNewsId(null);
    }
  }

  async function deleteAllNews() {
    if (bulkBusy || posts.length === 0) return;
    setBulkBusy(true);
    const currentPosts = posts;
    setPosts([]);
    currentPosts.forEach(markNewsRead);
    try {
      const key = `${DISMISSED_NEWS_STORAGE_PREFIX}:${playerId ?? "local"}:${i18n.language}`;
      const saved = await AsyncStorage.getItem(key).catch(() => null);
      let dismissedIds: string[] = [];
      try {
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) dismissedIds = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        // Replace invalid local dismissal history.
      }
      await AsyncStorage.setItem(key, JSON.stringify([...new Set([...dismissedIds, ...currentPosts.map((post) => post.id)])]));
    } catch {
      setPosts(currentPosts);
      setError(t("inbox.deleteFailed"));
    } finally {
      setBulkBusy(false);
    }
  }

  function readAllNews() {
    const unreadPosts = posts.filter((post) => !readNewsIds.has(post.id));
    if (unreadPosts.length === 0) return;
    setReadNewsIds((ids) => new Set([...ids, ...unreadPosts.map((post) => post.id)]));
    onPostsViewed(unreadPosts);
  }

  async function deleteAllChallenges() {
    if (!playerId || bulkBusy || challenges.length === 0) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(challenges.map((challenge) => respondChallenge(playerId, challenge.id, "decline")));
    const remaining = challenges.filter((_, index) => results[index].status === "rejected");
    setChallenges(remaining);
    onChallengeCountChange(remaining.length);
    if (remaining.length > 0) setError(t("inbox.deleteSomeFailed"));
    setBulkBusy(false);
  }

  const activeError = error ?? loadErrors[category];

  return <View style={styles.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onBack} style={StyleSheet.absoluteFillObject} />
    <View style={styles.panel}>
      <View style={styles.header}><Text style={styles.title}>{t("inbox.title")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onBack} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Text style={styles.closeText}>×</Text></Pressable></View>
      <View style={styles.body}>
        <View style={styles.tabs}>
          {(["news", "challenges"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={t(`inbox.${tab}`)} accessibilityState={{ selected: category === tab }} onPress={() => { setCategory(tab); setError(null); }} style={({ pressed }) => [styles.tab, category === tab && styles.activeTab, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.tabText, category === tab && styles.activeTabText]}>{t(`inbox.${tab}`)}</Text>{tab === "challenges" && challenges.length > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{challenges.length}</Text></View> : null}</Pressable>)}
        </View>
        <View style={styles.contentColumn}>
          <View style={styles.content}>
          {loading ? <ActivityIndicator color={theme.primary} /> : null}
          {!loading && activeError ? <View style={styles.center}><Text style={styles.error}>{activeError}</Text><Pressable onPress={() => void load()} style={styles.reload}><Text style={styles.reloadText}>{t("inbox.retry")}</Text></Pressable></View> : null}
          {!loading && !activeError && category === "challenges" && challenges.length === 0 ? <Text style={styles.empty}>{t("inbox.emptyChallenges")}</Text> : null}
          {!loading && !activeError && category === "challenges" && challenges.length > 0 ? <ScrollView style={styles.list} contentContainerStyle={styles.items}>{challenges.map((challenge) => <View key={challenge.id} style={[styles.item, styles.challengeItem]}><Text numberOfLines={1} style={[styles.itemTitle, styles.challengeTitle]}>{t("friends.challengeIncoming", { player: challenge.challengerName })}</Text><Text numberOfLines={1} style={[styles.itemBody, styles.challengeBody]}>{t("friends.challengeMode", { wager: challenge.damageWager })}</Text><View style={[styles.actions, styles.challengeActions]}><Pressable disabled={respondingId === challenge.id} onPress={() => void answerChallenge(challenge, "decline")} style={[styles.actionButton, styles.compactChallengeButton, styles.deleteButton]}><Text style={styles.actionText}>{t("inbox.delete")}</Text></Pressable><Pressable disabled={respondingId === challenge.id} onPress={() => void answerChallenge(challenge, "accept")} style={[styles.actionButton, styles.compactChallengeButton]}><Text style={styles.actionText}>{respondingId === challenge.id ? t("startup.loading") : t("friends.accept")}</Text></Pressable></View></View>)}</ScrollView> : null}
          {!loading && !activeError && category === "news" && posts.length === 0 ? <Text style={styles.empty}>{t("inbox.emptyNews")}</Text> : null}
          {!loading && !activeError && category === "news" && posts.length > 0 ? <ScrollView style={styles.list} contentContainerStyle={styles.items}>{posts.map((post) => <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={readNewsIds.has(post.id) ? post.title : t("inbox.markRead", { title: post.title })} onPress={() => { setSelectedNewsId((selectedId) => selectedId === post.id ? null : post.id); markNewsRead(post); }} style={({ pressed }) => [styles.item, styles.newsItem, !readNewsIds.has(post.id) && styles.unreadItem, pressed && styles.pressed]}><View style={styles.postHeader}><View style={styles.newsTitleRow}>{!readNewsIds.has(post.id) ? <View style={styles.unreadDot} /> : null}<Text numberOfLines={1} style={[styles.itemTitle, styles.newsTitle]}>{post.title}</Text></View><Text style={styles.date}>{new Date(post.publishedAt).toLocaleDateString(i18n.language)}</Text></View><Text numberOfLines={selectedNewsId === post.id ? 4 : 2} style={[styles.itemBody, styles.newsBody]}>{post.body}</Text>{selectedNewsId === post.id ? <View style={styles.newsActions}><Pressable disabled={deletingNewsId === post.id} onPress={(event) => { event.stopPropagation(); void deleteNewsPost(post.id); }} style={[styles.actionButton, styles.deleteButton, styles.compactDeleteButton]}><Text style={styles.actionText}>{t("inbox.delete")}</Text></Pressable></View> : null}</Pressable>)}</ScrollView> : null}
          </View>
          {!loading && !activeError ? <View style={styles.bulkActions}>{category === "news" ? <Pressable disabled={bulkBusy || posts.every((post) => readNewsIds.has(post.id))} onPress={readAllNews} style={[styles.bulkButton, (bulkBusy || posts.every((post) => readNewsIds.has(post.id))) && styles.disabled]}><Text style={styles.bulkButtonText}>{t("inbox.readAll")}</Text></Pressable> : null}<Pressable disabled={bulkBusy || (category === "news" ? posts.length === 0 : challenges.length === 0)} onPress={() => void (category === "news" ? deleteAllNews() : deleteAllChallenges())} style={[styles.bulkButton, styles.deleteAllButton, (bulkBusy || (category === "news" ? posts.length === 0 : challenges.length === 0)) && styles.disabled]}><Text style={styles.bulkButtonText}>{t("inbox.deleteAll")}</Text></Pressable></View> : null}
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,3,12,0.7)" },
  panel: { width: "72%", maxWidth: 720, height: "76%", minHeight: 250, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderRadius: 18, backgroundColor: "rgba(31,26,51,0.98)", borderWidth: 2, borderColor: "rgba(185,176,214,0.38)" },
  header: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: theme.text, fontSize: 22, fontWeight: "900" },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,92,255,0.24)" },
  closeText: { color: "#FFF", fontSize: 26, lineHeight: 28, fontWeight: "700" },
  body: { flex: 1, minHeight: 0, flexDirection: "row", gap: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: "rgba(185,176,214,0.3)" },
  tabs: { width: 158, gap: 8, paddingRight: 12, borderRightWidth: 1, borderRightColor: "rgba(185,176,214,0.3)" },
  tab: { width: "100%", minHeight: 42, paddingHorizontal: 12, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, backgroundColor: "rgba(12,9,23,0.54)" },
  activeTab: { backgroundColor: theme.primary },
  tabText: { color: theme.textDim, fontSize: 12, fontWeight: "900" }, activeTabText: { color: "#FFF" },
  badge: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FF5C7A" }, badgeText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
  contentColumn: { flex: 1, minWidth: 0, minHeight: 0 }, content: { flex: 1, minWidth: 0, minHeight: 0, justifyContent: "center" }, list: { flex: 1, minHeight: 0 }, items: { gap: 10, paddingBottom: 8 },
  item: { padding: 14, borderRadius: 12, backgroundColor: "rgba(12,9,23,0.72)", borderLeftWidth: 3, borderLeftColor: theme.primary },
  challengeItem: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, challengeTitle: { fontSize: 14 }, challengeBody: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  newsItem: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  unreadItem: { backgroundColor: "rgba(71,45,130,0.55)", borderLeftColor: "#B9AAFF" },
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  newsTitleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B9AAFF" },
  itemTitle: { flex: 1, color: theme.text, fontSize: 16, fontWeight: "900" }, newsTitle: { fontSize: 14 }, itemBody: { color: "#D8D1EA", fontSize: 12, lineHeight: 18, marginTop: 6 }, newsBody: { fontSize: 11, lineHeight: 15, marginTop: 4 }, date: { color: theme.textDim, fontSize: 10, fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 }, actionButton: { minWidth: 86, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: theme.primary }, deleteButton: { backgroundColor: "rgba(112,103,135,0.8)" }, actionText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  challengeActions: { marginTop: 7 }, compactChallengeButton: { minWidth: 72, paddingVertical: 6 },
  newsActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 7 }, compactDeleteButton: { minWidth: 72, paddingVertical: 6 },
  bulkActions: { minHeight: 44, paddingTop: 8, flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end", gap: 8, borderTopWidth: 1, borderTopColor: "rgba(185,176,214,0.2)" }, bulkButton: { minWidth: 96, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, alignItems: "center", backgroundColor: theme.primary }, deleteAllButton: { backgroundColor: "rgba(201,62,85,0.82)" }, bulkButtonText: { color: "#FFF", fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.4 },
  center: { alignItems: "center", gap: 12 }, error: { color: "#FF9AA8", fontSize: 12, textAlign: "center" }, reload: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9, backgroundColor: theme.primary }, reloadText: { color: "#FFF", fontWeight: "900" },
  empty: { color: theme.textDim, textAlign: "center", fontSize: 13, fontWeight: "700" }, pressed: { opacity: 0.7 },
});
