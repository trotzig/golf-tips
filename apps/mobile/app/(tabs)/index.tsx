import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SearchIcon } from "../../src/components/icons";
import {
  Body,
  cardStyle,
  Chip,
  ChipRow,
  PageTitle,
  Screen,
  SectionTitle,
  styles as ui,
} from "../../src/components/ui";
import { categories, commonSituations, situationsIn } from "../../src/data";
import { useHanded } from "../../src/prefs";
import { fonts, radius, useColors } from "../../src/theme";

export default function Home() {
  const c = useColors();
  const handed = useHanded();
  return (
    <Screen>
      <View style={{ paddingTop: 8, gap: 12 }}>
        <PageTitle>How do I play this shot?</PageTitle>
        <Body style={[ui.large, { color: c.inkMuted }]}>
          Short, practical advice for awkward lies, tricky conditions and nervy moments — readable
          between shots.
        </Body>
      </View>

      <Pressable
        onPress={() => router.push("/search")}
        accessibilityRole="search"
        accessibilityLabel="Search situations"
        style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.lineStrong }]}
      >
        <SearchIcon color={c.inkMuted} size={20} />
        <Text style={[styles.searchText, { color: c.inkMuted }]}>Uphill lie, fried egg, wind…</Text>
      </Pressable>

      {commonSituations.length > 0 && (
        <>
          <SectionTitle>Common situations</SectionTitle>
          <ChipRow>
            {commonSituations.map((s) => (
              <Chip key={s.id} label={handed(s.title)} href={`/situations/${s.id}`} />
            ))}
          </ChipRow>
        </>
      )}

      <SectionTitle>Browse by category</SectionTitle>
      <View style={styles.grid}>
        {categories.map((cat) => {
          const count = situationsIn(cat.id).length;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="link"
              onPress={() => router.push(`/category/${cat.id}`)}
              style={({ pressed }) => [
                ui.card,
                cardStyle(c),
                styles.tile,
                pressed && { backgroundColor: c.accentSoft, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.tileTitle, { color: c.inkStrong }]}>{cat.title}</Text>
              <Text style={[styles.tileCount, { color: c.inkMuted }]}>
                {count === 1 ? "1 situation" : `${count} situations`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: 14,
  },
  searchText: { fontFamily: fonts.regular, fontSize: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    minHeight: 80,
    padding: 12,
    justifyContent: "space-between",
  },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 16 },
  tileCount: { fontFamily: fonts.regular, fontSize: 14, marginTop: 6 },
});
