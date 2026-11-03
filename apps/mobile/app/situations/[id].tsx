import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import { HeartIcon } from "../../src/components/icons";
import {
  ClubLadder,
  ClubRollChart,
  FlightComparison,
  SetupGauges,
  SwingClock,
} from "../../src/components/Illustrations";
import { ShotViz } from "../../src/components/ShotViz";
import {
  Body,
  Bullets,
  Card,
  cardStyle,
  Chip,
  ChipRow,
  Eyebrow,
  PageTitle,
  Screen,
  styles as ui,
} from "../../src/components/ui";
import { getSituation, sceneFor } from "../../src/data";
import { bodyParagraphs, tagLabel } from "../../src/lib/text";
import { useHanded, usePrefs } from "../../src/prefs";
import { fonts, radius, useColors } from "../../src/theme";

export default function SituationScreen() {
  const c = useColors();
  const handed = useHanded();
  const { isFavourite, toggleFavourite } = usePrefs();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = getSituation(id);
  if (!s) return <Stack.Screen options={{ title: "Not found" }} />;

  const scene = sceneFor(s);
  const related = s.related.flatMap((r) => getSituation(r) ?? []);
  const favourite = isFavourite(s.id);
  const pairs =
    s.mistakes && s.fixes ? s.mistakes.map((dont, i) => ({ dont, fix: s.fixes![i]! })) : [];

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <PageTitle>{handed(s.title)}</PageTitle>
        <Body style={{ fontSize: 20, lineHeight: 27 }}>{handed(s.summary)}</Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save to favourites"
          accessibilityState={{ selected: favourite }}
          onPress={() => toggleFavourite(s.id)}
          style={({ pressed }) => [
            styles.save,
            { borderColor: favourite ? c.highlight : c.lineStrong },
            pressed && { backgroundColor: c.surface },
          ]}
        >
          <HeartIcon color={favourite ? c.highlight : c.accent} filled={favourite} size={20} />
          <Text style={[styles.saveText, { color: c.ink }]}>
            {favourite ? "Saved to favourites" : "Save to favourites"}
          </Text>
        </Pressable>
      </View>

      {scene && <ShotViz scene={scene} />}

      {s.setup && (
        <Card title="Setup">
          {scene && <SetupGauges scene={scene} />}
          <Bullets items={s.setup} />
        </Card>
      )}
      {s.swing && (
        <Card title="Swing">
          {scene && <SwingClock scene={scene} />}
          <Bullets items={s.swing} />
        </Card>
      )}
      <Card title="What to expect">
        {scene && <FlightComparison scene={scene} />}
        <Bullets items={s.expect} />
      </Card>
      {s.club_choice && (
        <Card title="Club choice">
          {s.club_change !== undefined && <ClubLadder change={s.club_change} />}
          {s.club_roll_chart && <ClubRollChart />}
          <Body style={ui.large}>{handed(s.club_choice)}</Body>
        </Card>
      )}
      {pairs.length > 0 ? (
        <Card title="Do’s and don’ts" tone="warning">
          <View style={{ gap: 10 }}>
            {pairs.map(({ dont, fix }) => (
              <View key={dont} style={[styles.pair, { borderColor: c.line }]}>
                <View style={[styles.pairRow, { backgroundColor: c.highlightSoft }]}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Don’t">
                    <Circle cx={12} cy={12} r={12} fill={c.highlight} />
                    <Path
                      d="M8 8l8 8M16 8l-8 8"
                      stroke={c.canvas}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Body style={ui.large}>{handed(dont)}</Body>
                </View>
                <View style={styles.pairRow}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Do">
                    <Circle cx={12} cy={12} r={12} fill={c.accent} />
                    <Path
                      d="M7 12.5l3.4 3.4L17 9"
                      fill="none"
                      stroke={c.onAccent}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Body style={ui.large}>{handed(fix)}</Body>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        s.mistakes && (
          <Card title="Common mistakes" tone="warning">
            <Bullets items={s.mistakes} tone="warning" />
          </Card>
        )
      )}
      {s.drill && (
        <View style={[styles.drill, { borderColor: c.lineStrong, backgroundColor: c.surface }]}>
          <Svg width={56} height={56} viewBox="0 0 54 54">
            <Rect x={2} y={2} width={50} height={50} rx={12} fill={c.card} />
            <Ellipse cx={27} cy={36} rx={18} ry={7} fill="none" stroke={c.accent} strokeWidth={2} />
            <Ellipse cx={27} cy={36} rx={10} ry={4} fill="none" stroke={c.accent} strokeWidth={2} />
            <Ellipse cx={27} cy={36} rx={3} ry={1.5} fill={c.accent} />
            <Line x1={27} y1={36} x2={27} y2={10} stroke={c.inkStrong} strokeWidth={1.8} />
            <Path d="M27 10 L39 14 L27 18 Z" fill={c.highlight} />
          </Svg>
          <View style={{ flex: 1, gap: 4 }}>
            <Eyebrow>Practice drill</Eyebrow>
            <Body style={ui.large}>{handed(s.drill)}</Body>
          </View>
        </View>
      )}
      {s.advanced && (
        <View style={[ui.card, cardStyle(c), { padding: 0 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={styles.advancedToggle}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.advancedTitle, { color: c.inkStrong }]}>For better players</Text>
              <Text style={[styles.advancedHint, { color: c.inkMuted }]}>
                A refinement once the basics work
              </Text>
            </View>
            <Text style={[styles.advancedSign, { color: c.accent }]}>
              {advancedOpen ? "−" : "+"}
            </Text>
          </Pressable>
          {advancedOpen && (
            <Body style={[ui.large, { paddingHorizontal: 16, paddingBottom: 16 }]}>
              {handed(s.advanced)}
            </Body>
          )}
        </View>
      )}
      {bodyParagraphs(handed(s.body)).map((p) => (
        <Body key={p} style={[ui.large, { paddingHorizontal: 4 }]}>
          {p}
        </Body>
      ))}

      {related.length > 0 && (
        <View style={{ gap: 8 }}>
          <Eyebrow>Related</Eyebrow>
          <ChipRow>
            {related.map((r) => (
              <Chip key={r.id} label={handed(r.title)} href={`/situations/${r.id}`} />
            ))}
          </ChipRow>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Eyebrow>Tags</Eyebrow>
        <ChipRow>
          {s.tags.map((tag) => (
            <Chip key={tag} label={tagLabel(tag)} href={`/tags/${tag}`} variant="surface" />
          ))}
        </ChipRow>
      </View>

      <Text style={[styles.updated, { color: c.inkMuted }]}>Updated {s.updated}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  save: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
  },
  saveText: { fontFamily: fonts.medium, fontSize: 16 },
  updated: { fontFamily: fonts.regular, fontSize: 14 },
  pair: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  pairRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  drill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.card,
    padding: 16,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  advancedTitle: { fontFamily: fonts.semibold, fontSize: 16 },
  advancedHint: { fontFamily: fonts.regular, fontSize: 14 },
  advancedSign: { fontFamily: fonts.regular, fontSize: 26, lineHeight: 28 },
});
