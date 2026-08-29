import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
import { PointsIcon } from "../components/PointsIcon";
import { NAME_COLOR_COSMETICS } from "@confidence-trivia/shared";
import { equipNameColor, getPlayerCustomization } from "../network/client";

type ShopTab = "featured" | "avatars" | "frames" | "stars";

type CosmeticItem = { id: string; icon: string; name: string; price?: number; tag?: string; color?: string };

const COSMETICS: Record<Exclude<ShopTab, "stars">, CosmeticItem[]> = {
  featured: NAME_COLOR_COSMETICS.map((item) => ({ id: item.id, icon: "●", name: item.id.replace("name_", ""), color: item.color })),
  avatars: [
    { id: "owl", icon: "🦉", name: "Wise Owl", price: 200 },
    { id: "fox", icon: "🦊", name: "Clever Fox", price: 200 },
    { id: "robot", icon: "🤖", name: "Quiz Bot", price: 300 },
    { id: "alien", icon: "👽", name: "Omniscient", price: 500 },
    { id: "wizard", icon: "🧙", name: "Trivia Wizard", price: 400 },
    { id: "detective", icon: "🕵️", name: "The Detective", price: 350 },
  ],
  frames: [
    { id: "bronze", icon: "◈", name: "Bronze Edge", price: 150 },
    { id: "silver", icon: "◇", name: "Silver Edge", price: 250 },
    { id: "gold", icon: "◆", name: "Golden Edge", price: 400 },
    { id: "flame", icon: "🔥", name: "Flame Frame", price: 450 },
    { id: "ice", icon: "❄️", name: "Frozen Frame", price: 450 },
    { id: "royal", icon: "♛", name: "Royal Frame", price: 600 },
  ],
};

const STAR_PACKS: Array<{ stars: number; price: string; bonus?: string }> = [
  { stars: 100, price: "€0.99" },
  { stars: 550, price: "€4.49", bonus: "+10%" },
  { stars: 1200, price: "€8.99", bonus: "+20%" },
  { stars: 2600, price: "€17.99", bonus: "+30%" },
  { stars: 7000, price: "€39.99", bonus: "Best value" },
];

export function ShopScreen({ deviceId, displayName, onBack }: { deviceId: string; displayName: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<ShopTab>("featured");
  const [equippedNameColorId, setEquippedNameColorId] = React.useState("name_white");
  const [equippingId, setEquippingId] = React.useState<string | null>(null);
  const tabs: ShopTab[] = ["featured", "avatars", "frames", "stars"];

  React.useEffect(() => {
    void getPlayerCustomization(deviceId).then((customization) => {
      if (customization) setEquippedNameColorId(customization.nameColorId);
    });
  }, [deviceId]);

  async function equipColor(cosmeticId: string) {
    if (equippingId || cosmeticId === equippedNameColorId) return;
    setEquippingId(cosmeticId);
    const customization = await equipNameColor(deviceId, displayName, cosmeticId);
    if (customization) setEquippedNameColorId(customization.nameColorId);
    setEquippingId(null);
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <View style={styles.headerRow}>
        <Title>{t("shop.title")}</Title>
      </View>
      <View style={styles.shopBody}>
        <View style={styles.tabRail}>
          {tabs.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabSelected]}>
              <Text style={styles.tabIcon}>{item === "featured" ? "★" : item === "avatars" ? "☺" : item === "frames" ? "▣" : "✦"}</Text>
              <Text numberOfLines={1} style={[styles.tabText, tab === item && styles.tabTextSelected]}>{t(`shop.tabs.${item}`)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.catalogue}>
          <View style={styles.catalogueHeader}>
            <Text style={styles.sectionTitle}>{t(`shop.tabs.${tab}`)}</Text>
            <Text style={styles.previewBadge}>{tab === "featured" ? t("shop.nameColorsFree") : t("shop.previewOnly")}</Text>
          </View>
          {tab === "stars" ? (
            <FlatList key="star-packs" horizontal data={STAR_PACKS} keyExtractor={(item) => String(item.stars)} contentContainerStyle={styles.packList} showsHorizontalScrollIndicator={false} renderItem={({ item }) => (
              <View style={[styles.starPack, item.stars === 7000 && styles.starPackBest]}>
                {item.bonus ? <Text style={styles.packBonus}>{item.bonus}</Text> : null}
                <PointsIcon size={34} />
                <Text style={styles.packAmount}>{item.stars}</Text>
                <Text style={styles.packStars}>{t("common.stars")}</Text>
                <Pressable disabled style={styles.buyButton}><Text style={styles.buyText}>{item.price}</Text></Pressable>
              </View>
            )} />
          ) : (
            <FlatList key={`cosmetics-${tab}`} data={COSMETICS[tab]} numColumns={3} keyExtractor={(item) => item.id} columnWrapperStyle={styles.cosmeticRow} contentContainerStyle={styles.cosmeticList} showsVerticalScrollIndicator={false} renderItem={({ item }) => (
              <Pressable disabled={!item.color || Boolean(equippingId)} onPress={() => item.color ? void equipColor(item.id) : undefined} style={[styles.cosmeticCard, item.id === equippedNameColorId && styles.cosmeticCardEquipped]}>
                {item.tag ? <Text style={styles.itemTag}>{item.tag}</Text> : null}
                <Text style={[styles.cosmeticIcon, item.color ? { color: item.color, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 2 } : null]}>{item.icon}</Text>
                <Text numberOfLines={1} style={[styles.cosmeticName, item.color ? { color: item.color, textTransform: "capitalize" } : null]}>{item.color ? t(`shop.nameColors.${item.id}`) : item.name}</Text>
                {item.color ? <Text style={[styles.equipState, item.id === equippedNameColorId && styles.equippedState]}>{item.id === equippedNameColorId ? t("shop.equipped") : equippingId === item.id ? t("shop.equipping") : t("shop.free")}</Text> : <View style={styles.priceRow}><PointsIcon size={14} /><Text style={styles.price}>{item.price}</Text></View>}
              </Pressable>
            )} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 },
  headerRow: { width: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  shopBody: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 12, marginTop: 4 },
  tabRail: { width: 112, gap: 7, justifyContent: "center" },
  tab: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(31,26,51,0.84)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" },
  tabSelected: { backgroundColor: "rgba(124,92,255,0.25)", borderColor: theme.primary },
  tabIcon: { width: 18, color: "#F7D85B", fontSize: 16, fontWeight: "900", textAlign: "center" },
  tabText: { flex: 1, color: theme.textDim, fontSize: 10, fontWeight: "800" },
  tabTextSelected: { color: theme.text },
  catalogue: { flex: 1, minWidth: 0, borderRadius: 14, backgroundColor: "rgba(31,26,51,0.88)", padding: 11 },
  catalogueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  previewBadge: { color: theme.textDim, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  cosmeticList: { paddingBottom: 4 },
  cosmeticRow: { gap: 8, marginBottom: 8 },
  cosmeticCard: { flex: 1, minWidth: 0, height: 86, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(15,12,27,0.75)", borderWidth: 1, borderColor: "rgba(185,176,214,0.18)", paddingHorizontal: 7 },
  cosmeticCardEquipped: { borderColor: "#7CFFA0", backgroundColor: "rgba(56,104,68,0.22)" },
  cosmeticIcon: { fontSize: 27 },
  cosmeticName: { width: "100%", color: theme.text, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 2 },
  itemTag: { position: "absolute", top: 4, right: 5, color: "#F7D85B", fontSize: 7, fontWeight: "900", textTransform: "uppercase" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  price: { color: "#F7D85B", fontSize: 10, fontWeight: "900" },
  equipState: { color: theme.textDim, fontSize: 9, fontWeight: "900", marginTop: 3, textTransform: "uppercase" },
  equippedState: { color: "#7CFFA0" },
  packList: { flexGrow: 1, alignItems: "center", gap: 9, paddingVertical: 5 },
  starPack: { width: 105, height: 142, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(15,12,27,0.8)", borderWidth: 1, borderColor: "rgba(247,216,91,0.25)", padding: 8 },
  starPackBest: { borderColor: "#F7D85B", backgroundColor: "rgba(72,58,20,0.45)" },
  packBonus: { position: "absolute", top: 5, color: "#7CFFA0", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  packAmount: { color: "#F7D85B", fontSize: 18, fontWeight: "900", marginTop: 3 },
  packStars: { color: theme.textDim, fontSize: 9, fontWeight: "700" },
  buyButton: { width: "100%", marginTop: 8, paddingVertical: 5, alignItems: "center", borderRadius: 7, backgroundColor: "rgba(124,92,255,0.7)" },
  buyText: { color: theme.text, fontSize: 11, fontWeight: "900" },
});
