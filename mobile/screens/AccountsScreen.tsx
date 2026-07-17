import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { supabase } from "../lib/supabase";

const PLATFORMS = [
  { key: "bluesky", name: "Bluesky", icon: "🦋", note: "App Password — no registration needed" },
  { key: "x", name: "X (Twitter)", icon: "𝕏", note: "BYOK or credits required" },
  { key: "linkedin", name: "LinkedIn", icon: "💼" },
  { key: "facebook", name: "Facebook", icon: "📘" },
  { key: "instagram", name: "Instagram", icon: "📸" },
  { key: "threads", name: "Threads", icon: "🧵" },
  { key: "tiktok", name: "TikTok", icon: "🎵", note: "Content Posting API approval required" },
];

export default function AccountsScreen() {
  function handleConnect(platform: string) {
    Alert.alert("Connect", `OAuth flow for ${platform} will be available soon.\n\nFor now, test with Bluesky using an App Password.`);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fafbfc" }} contentContainerStyle={s.container}>
      <Text style={s.heading}>Connect your social profiles to start cross-posting.</Text>
      {PLATFORMS.map((p) => (
        <View key={p.key} style={s.row}>
          <Text style={s.icon}>{p.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{p.name}</Text>
            <Text style={s.status}>{p.note || "Not connected"}</Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={() => handleConnect(p.key)}>
            <Text style={s.btnText}>Connect</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 14, color: "#8f99a8", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "#eef1f5" },
  icon: { fontSize: 22, marginRight: 14 },
  name: { fontSize: 16, fontWeight: "600", color: "#1a1d23" },
  status: { fontSize: 13, color: "#8f99a8", marginTop: 2 },
  btn: { borderWidth: 1, borderColor: "#e2e6ed", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#4f46e5" },
});
