import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export function MenuPageHeading({ title, icon, accent }: { title: string; icon: React.ComponentProps<typeof FontAwesome5>["name"]; accent: string }) {
  return <View style={styles.heading}>
    <View style={styles.titleLine}><FontAwesome5 name={icon} size={19} color={accent} /><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>{title}</Text></View>
    <View style={[styles.stroke, { backgroundColor: accent }]} />
  </View>;
}

const styles = StyleSheet.create({
  heading: { alignSelf: "center", alignItems: "center", maxWidth: "75%", marginBottom: 8, paddingTop: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flexShrink: 1, color: "#F5EBDC", fontSize: 27, fontWeight: "900" },
  stroke: { width: 46, height: 3, borderRadius: 2, marginTop: 6, transform: [{ rotate: "-3deg" }] },
});
