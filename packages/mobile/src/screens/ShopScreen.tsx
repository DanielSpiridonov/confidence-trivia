import React from "react";
import { FlatList, Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
import { PointsIcon } from "../components/PointsIcon";
import { FRAME_COSMETIC_COLORS, NAME_COLOR_COSMETICS } from "@confidence-trivia/shared";
import { equipAvatar, equipFrame, equipNameColor, getPlayerCustomization } from "../network/client";

type ShopTab = "featured" | "avatars" | "frames" | "inventory" | "stars";

type CosmeticItem = { id: string; icon?: string; image?: ImageSourcePropType; name: string; price?: number; tag?: string; color?: string; free?: boolean };

const COSMETICS: Record<Exclude<ShopTab, "stars" | "inventory">, CosmeticItem[]> = {
  featured: NAME_COLOR_COSMETICS.map((item) => ({ id: item.id, icon: "●", name: item.id.replace("name_", ""), color: item.color })),
  avatars: [
    { id: "smart_owl", image: require("../../assets/avatar-thumbnails/smart-owl.png"), name: "Smart Owl", free: true },
    { id: "clever_fox", image: require("../../assets/avatar-thumbnails/fox.png"), name: "Clever Fox", free: true },
    { id: "quiz_bot", image: require("../../assets/avatar-thumbnails/quiz-bot.png"), name: "Quiz Bot", free: true },
    { id: "omniscient_avatar", image: require("../../assets/avatar-thumbnails/omniscient.png"), name: "Omniscient", free: true },
    { id: "trivia_wizard", image: require("../../assets/avatar-thumbnails/trivia-wizard.png"), name: "Trivia Wizard", free: true },
    { id: "detective_avatar", image: require("../../assets/avatar-thumbnails/detective.png"), name: "Detective", free: true },
    { id: "living_globe", image: require("../../assets/avatar-thumbnails/globe.png"), name: "Living Globe", free: true },
  ],
  frames: [
    { id: "water", icon: "◉", name: "Water Frame", price: 450 },
    { id: "leaves", icon: "❧", name: "Leaves Frame", price: 450 },
    { id: "frost", icon: "✣", name: "Frost Frame", price: 500 },
    { id: "lightning", icon: "ϟ", name: "Lightning Frame", price: 550 },
    { id: "flame", icon: "🔥", name: "Flame Frame", price: 450 },
    { id: "ice", icon: "❄️", name: "Frozen Frame", price: 450 },
  ],
};

const STAR_PACKS: Array<{ stars: number; price: string; bonus?: string }> = [
  { stars: 100, price: "€0.99" },
  { stars: 550, price: "€4.49", bonus: "+10%" },
  { stars: 1200, price: "€8.99", bonus: "+20%" },
  { stars: 2600, price: "€17.99", bonus: "+30%" },
  { stars: 7000, price: "€39.99", bonus: "Best value" },
];

const SHOP_AVATAR_IMAGES = COSMETICS.avatars.flatMap((item) => item.image ? [item.image] : []);
const customizationCache = new Map<string, { nameColorId: string; avatarId: string; frameId: string }>();

export function ShopScreen({ deviceId, displayName, requestedTab = "featured", requestId = 0, onBack }: { deviceId: string; displayName: string; requestedTab?: ShopTab; requestId?: number; onBack: () => void }) {
  const { t } = useTranslation();
  const cachedCustomization = customizationCache.get(deviceId);
  const [tab, setTab] = React.useState<ShopTab>("featured");
  const [equippedNameColorId, setEquippedNameColorId] = React.useState(cachedCustomization?.nameColorId ?? "name_white");
  const [equippedAvatarId, setEquippedAvatarId] = React.useState(cachedCustomization?.avatarId ?? "smart_owl");
  const [equippedFrameId, setEquippedFrameId] = React.useState(cachedCustomization?.frameId ?? "");
  const [equippingIds, setEquippingIds] = React.useState<Set<string>>(() => new Set());
  const colorRequest = React.useRef(0);
  const avatarRequest = React.useRef(0);
  const frameRequest = React.useRef(0);
  const tabs: ShopTab[] = ["featured", "avatars", "frames", "stars"];

  React.useLayoutEffect(() => {
    setTab(requestedTab);
  }, [requestId, requestedTab]);

  React.useEffect(() => {
    void getPlayerCustomization(deviceId).then((customization) => {
      if (customization) {
        customizationCache.set(deviceId, customization);
        setEquippedNameColorId(customization.nameColorId);
        setEquippedAvatarId(customization.avatarId);
        setEquippedFrameId(customization.frameId);
      }
    });
  }, [deviceId]);

  function setEquipping(cosmeticId: string, active: boolean) {
    setEquippingIds((current) => {
      const next = new Set(current);
      active ? next.add(cosmeticId) : next.delete(cosmeticId);
      return next;
    });
  }

  function cacheCustomization(nameColorId: string, avatarId: string, frameId: string) {
    customizationCache.set(deviceId, { nameColorId, avatarId, frameId });
  }

  async function equipColor(cosmeticId: string) {
    if (cosmeticId === equippedNameColorId) return;
    const previous = equippedNameColorId;
    const request = ++colorRequest.current;
    setEquippedNameColorId(cosmeticId);
    cacheCustomization(cosmeticId, equippedAvatarId, equippedFrameId);
    setEquipping(cosmeticId, true);
    const customization = await equipNameColor(deviceId, displayName, cosmeticId);
    setEquipping(cosmeticId, false);
    if (request !== colorRequest.current) return;
    if (customization) {
      customizationCache.set(deviceId, customization);
      setEquippedNameColorId(customization.nameColorId);
    } else {
      setEquippedNameColorId(previous);
      cacheCustomization(previous, equippedAvatarId, equippedFrameId);
    }
  }

  async function equipPlayerAvatar(cosmeticId: string) {
    if (cosmeticId === equippedAvatarId) return;
    const previous = equippedAvatarId;
    const request = ++avatarRequest.current;
    setEquippedAvatarId(cosmeticId);
    cacheCustomization(equippedNameColorId, cosmeticId, equippedFrameId);
    setEquipping(cosmeticId, true);
    const customization = await equipAvatar(deviceId, displayName, cosmeticId);
    setEquipping(cosmeticId, false);
    if (request !== avatarRequest.current) return;
    if (customization) {
      customizationCache.set(deviceId, customization);
      setEquippedAvatarId(customization.avatarId);
    } else {
      setEquippedAvatarId(previous);
      cacheCustomization(equippedNameColorId, previous, equippedFrameId);
    }
  }

  async function equipPlayerFrame(cosmeticId: string) {
    if (cosmeticId === equippedFrameId) return;
    const previous = equippedFrameId;
    const request = ++frameRequest.current;
    setEquippedFrameId(cosmeticId);
    cacheCustomization(equippedNameColorId, equippedAvatarId, cosmeticId);
    setEquipping(cosmeticId, true);
    const customization = await equipFrame(deviceId, displayName, cosmeticId);
    setEquipping(cosmeticId, false);
    if (request !== frameRequest.current) return;
    if (customization) {
      customizationCache.set(deviceId, customization);
      setEquippedFrameId(customization.frameId);
    } else {
      setEquippedFrameId(previous);
      cacheCustomization(equippedNameColorId, equippedAvatarId, previous);
    }
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <View pointerEvents="none" style={styles.avatarPreloader}>
        {SHOP_AVATAR_IMAGES.map((source, index) => <Image key={index} source={source} fadeDuration={0} resizeMode="contain" style={styles.preloadedAvatar} />)}
      </View>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <View style={styles.headerRow}>
        <Title>{tab === "inventory" ? t("shop.tabs.inventory") : t("shop.title")}</Title>
      </View>
      <View style={styles.shopBody}>
        {tab !== "inventory" ? <View style={styles.tabRail}>
          {tabs.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabSelected]}>
              <Text style={styles.tabIcon}>{item === "featured" ? "★" : item === "avatars" ? "☺" : item === "frames" ? "▣" : item === "inventory" ? "▤" : "✦"}</Text>
              <Text numberOfLines={1} style={[styles.tabText, tab === item && styles.tabTextSelected]}>{t(`shop.tabs.${item}`)}</Text>
            </Pressable>
          ))}
        </View> : null}

        <View style={styles.catalogue}>
          <View style={styles.catalogueHeader}>
            <Text style={styles.sectionTitle}>{t(`shop.tabs.${tab}`)}</Text>
            <Text style={styles.previewBadge}>{tab === "featured" ? t("shop.nameColorsFree") : tab === "inventory" ? t("shop.ownedItems") : tab === "frames" ? t("shop.playerBordersPreview") : t("shop.previewOnly")}</Text>
          </View>
          <View pointerEvents={tab === "avatars" ? "auto" : "none"} style={[styles.persistentAvatarCatalogue, tab !== "avatars" && styles.persistentCatalogueHidden]}>
            <FlatList data={COSMETICS.avatars} numColumns={3} keyExtractor={(item) => item.id} columnWrapperStyle={styles.cosmeticRow} contentContainerStyle={styles.cosmeticList} showsVerticalScrollIndicator={false} renderItem={({ item }) => (
              <Pressable onPress={() => void equipPlayerAvatar(item.id)} style={[styles.cosmeticCard, item.id === equippedAvatarId && styles.cosmeticCardEquipped]}>
                <Image source={item.image} fadeDuration={0} resizeMode="contain" style={styles.avatarImage} />
                <Text numberOfLines={1} style={styles.cosmeticName}>{t(`shop.avatarNames.${item.id}`)}</Text>
                <Text style={[styles.equipState, item.id === equippedAvatarId && styles.equippedState]}>{item.id === equippedAvatarId ? t("shop.equipped") : equippingIds.has(item.id) ? t("shop.equipping") : t("shop.free")}</Text>
              </Pressable>
            )} />
          </View>
          {tab === "avatars" ? null : tab === "stars" ? (
            <FlatList key="star-packs" horizontal data={STAR_PACKS} keyExtractor={(item) => String(item.stars)} contentContainerStyle={styles.packList} showsHorizontalScrollIndicator={false} renderItem={({ item }) => (
              <View style={[styles.starPack, item.stars === 7000 && styles.starPackBest]}>
                {item.bonus ? <Text style={styles.packBonus}>{item.bonus}</Text> : null}
                <PointsIcon size={34} />
                <Text style={styles.packAmount}>{item.stars}</Text>
                <Text style={styles.packStars}>{t("common.stars")}</Text>
                <Pressable disabled style={styles.buyButton}><Text style={styles.buyText}>{item.price}</Text></Pressable>
              </View>
            )} />
          ) : tab === "inventory" ? (
            <ScrollView style={styles.inventoryScroll} contentContainerStyle={styles.inventoryContent} showsVerticalScrollIndicator={false}>
              <InventoryCategory title={t("shop.inventoryCategories.nameColors")}>
                <View style={styles.inventoryItems}>
                  {NAME_COLOR_COSMETICS.map((item) => (
                    <Pressable key={item.id} onPress={() => void equipColor(item.id)} style={[styles.inventoryColorItem, item.id === equippedNameColorId && styles.inventoryItemEquipped]}>
                      <View style={[styles.colorSwatch, { backgroundColor: item.color }]} />
                      <Text numberOfLines={1} style={[styles.inventoryItemName, { color: item.color }]}>{t(`shop.nameColors.${item.id}`)}</Text>
                      <Text style={[styles.inventoryItemState, item.id === equippedNameColorId && styles.equippedState]}>{item.id === equippedNameColorId ? t("shop.equipped") : t("shop.equip")}</Text>
                    </Pressable>
                  ))}
                </View>
              </InventoryCategory>
              <InventoryCategory title={t("shop.inventoryCategories.avatars")}><Text style={styles.emptyInventory}>{t("shop.noOwnedAvatars")}</Text></InventoryCategory>
              <InventoryCategory title={t("shop.inventoryCategories.frames")}><Text style={styles.emptyInventory}>{t("shop.noOwnedFrames")}</Text></InventoryCategory>
            </ScrollView>
          ) : (
            <FlatList key={`cosmetics-${tab}`} data={COSMETICS[tab]} numColumns={3} keyExtractor={(item) => item.id} columnWrapperStyle={styles.cosmeticRow} contentContainerStyle={styles.cosmeticList} showsVerticalScrollIndicator={false} renderItem={({ item }) => (
              <Pressable onPress={() => item.color ? void equipColor(item.id) : item.image ? void equipPlayerAvatar(item.id) : tab === "frames" ? void equipPlayerFrame(item.id) : undefined} style={[styles.cosmeticCard, (item.id === equippedNameColorId || item.id === equippedAvatarId || item.id === equippedFrameId) && styles.cosmeticCardEquipped, tab === "frames" ? { borderColor: FRAME_COSMETIC_COLORS[item.id as keyof typeof FRAME_COSMETIC_COLORS], borderWidth: item.id === equippedFrameId ? 3 : 2 } : null]}>
                {item.tag ? <Text style={styles.itemTag}>{item.tag}</Text> : null}
                {item.color ? (
                  <Text style={[styles.cosmeticIcon, { color: item.color, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 2 }]}>{item.icon}</Text>
                ) : item.image ? <Image source={item.image} fadeDuration={0} resizeMode="contain" style={styles.avatarImage} /> : <Text style={[styles.cosmeticIcon, tab === "frames" ? { color: FRAME_COSMETIC_COLORS[item.id as keyof typeof FRAME_COSMETIC_COLORS], textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 2 } : null]}>{item.icon}</Text>}
                <Text numberOfLines={1} adjustsFontSizeToFit={Boolean(item.color)} minimumFontScale={0.7} style={[styles.cosmeticName, item.color ? { color: item.color } : null]}>{item.color ? (displayName || t("ranked.player")) : item.image ? t(`shop.avatarNames.${item.id}`) : item.name}</Text>
                {item.color ? <Text style={[styles.equipState, item.id === equippedNameColorId && styles.equippedState]}>{item.id === equippedNameColorId ? t("shop.equipped") : equippingIds.has(item.id) ? t("shop.equipping") : t("shop.free")}</Text> : item.image ? <Text style={[styles.equipState, item.id === equippedAvatarId && styles.equippedState]}>{item.id === equippedAvatarId ? t("shop.equipped") : equippingIds.has(item.id) ? t("shop.equipping") : t("shop.free")}</Text> : tab === "frames" ? <Text style={[styles.equipState, item.id === equippedFrameId && styles.equippedState]}>{item.id === equippedFrameId ? t("shop.equipped") : equippingIds.has(item.id) ? t("shop.equipping") : t("shop.free")}</Text> : item.free ? <Text style={styles.freeItem}>{t("shop.freeItem")}</Text> : <View style={styles.priceRow}><PointsIcon size={14} /><Text style={styles.price}>{item.price}</Text></View>}
              </Pressable>
            )} />
          )}
        </View>
      </View>
    </Screen>
  );
}

function InventoryCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.inventoryCategory}><Text style={styles.inventoryCategoryTitle}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  avatarPreloader: { position: "absolute", left: 0, top: 0, width: 192, height: 192, opacity: 0.001, overflow: "hidden" },
  preloadedAvatar: { position: "absolute", width: 192, height: 192 },
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
  persistentAvatarCatalogue: { ...StyleSheet.absoluteFillObject, top: 43, paddingHorizontal: 11, paddingBottom: 11, opacity: 1 },
  persistentCatalogueHidden: { opacity: 0 },
  catalogueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  previewBadge: { color: theme.textDim, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  cosmeticList: { paddingBottom: 4 },
  cosmeticRow: { gap: 8, marginBottom: 8 },
  cosmeticCard: { flex: 1, minWidth: 0, height: 86, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(15,12,27,0.75)", borderWidth: 1, borderColor: "rgba(185,176,214,0.18)", paddingHorizontal: 7 },
  cosmeticCardEquipped: { borderColor: "#7CFFA0", backgroundColor: "rgba(56,104,68,0.22)" },
  cosmeticIcon: { fontSize: 27 },
  avatarImage: { width: 52, height: 52, marginTop: -2 },
  cosmeticName: { width: "100%", color: theme.text, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 2 },
  itemTag: { position: "absolute", top: 4, right: 5, color: "#F7D85B", fontSize: 7, fontWeight: "900", textTransform: "uppercase" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  price: { color: "#F7D85B", fontSize: 10, fontWeight: "900" },
  equipState: { color: theme.textDim, fontSize: 9, fontWeight: "900", marginTop: 3, textTransform: "uppercase" },
  equippedState: { color: "#7CFFA0" },
  freeItem: { color: "#7CFFA0", fontSize: 9, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  inventoryScroll: { flex: 1, minHeight: 0 },
  inventoryContent: { paddingBottom: 6, gap: 9 },
  inventoryCategory: { borderRadius: 10, backgroundColor: "rgba(15,12,27,0.62)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)", padding: 9 },
  inventoryCategoryTitle: { color: theme.text, fontSize: 12, fontWeight: "900", marginBottom: 7 },
  inventoryItems: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  inventoryColorItem: { width: "31.5%", minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "rgba(31,26,51,0.84)", borderWidth: 1, borderColor: "transparent" },
  inventoryItemEquipped: { borderColor: "#7CFFA0", backgroundColor: "rgba(56,104,68,0.22)" },
  colorSwatch: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)" },
  inventoryItemName: { flex: 1, minWidth: 0, fontSize: 9, fontWeight: "900" },
  inventoryItemState: { color: theme.textDim, fontSize: 7, fontWeight: "900", textTransform: "uppercase" },
  emptyInventory: { color: theme.textDim, fontSize: 10, fontWeight: "700", paddingVertical: 5 },
  packList: { flexGrow: 1, alignItems: "center", gap: 9, paddingVertical: 5 },
  starPack: { width: 105, height: 142, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(15,12,27,0.8)", borderWidth: 1, borderColor: "rgba(247,216,91,0.25)", padding: 8 },
  starPackBest: { borderColor: "#F7D85B", backgroundColor: "rgba(72,58,20,0.45)" },
  packBonus: { position: "absolute", top: 5, color: "#7CFFA0", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  packAmount: { color: "#F7D85B", fontSize: 18, fontWeight: "900", marginTop: 3 },
  packStars: { color: theme.textDim, fontSize: 9, fontWeight: "700" },
  buyButton: { width: "100%", marginTop: 8, paddingVertical: 5, alignItems: "center", borderRadius: 7, backgroundColor: "rgba(124,92,255,0.7)" },
  buyText: { color: theme.text, fontSize: 11, fontWeight: "900" },
});
