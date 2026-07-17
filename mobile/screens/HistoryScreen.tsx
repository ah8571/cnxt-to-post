import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function HistoryScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fafbfc" }} contentContainerStyle={s.container}>
      <View style={s.empty}>
        <Text style={s.emptyIcon}>📝</Text>
        <Text style={s.emptyText}>Your post history will appear here after you start posting.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#8f99a8", textAlign: "center", paddingHorizontal: 40 },
});
