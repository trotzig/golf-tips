import { getCategory } from "@shotbook/content";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HeartIcon } from "../../src/components/icons";
import { ShotViz } from "../../src/components/ShotViz";
import {
  Body,
  Bullets,
  Card,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = getSituation(id);
  if (!s) return <Stack.Screen options={{ title: "Not found" }} />;

  const category = getCategory(s.category);
  const scene = sceneFor(s);
  const related = s.related.flatMap((r) => getSituation(r) ?? []);
  const favourite = isFavourite(s.id);

  return (
    <Screen>
      <Pressable
        onPress={() => router.push(`/category/${category.id}`)}
        accessibilityRole="link"
        style={styles.breadcrumb}
      >
        <Text style={[styles.breadcrumbText, { color: c.accent }]}>← {category.title}</Text>
      </Pressable>

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
          <Bullets items={s.setup} />
        </Card>
      )}
      {s.swing && (
        <Card title="Swing">
          <Bullets items={s.swing} />
        </Card>
      )}
      <Card title="What to expect">
        <Bullets items={s.expect} />
      </Card>
      {s.club_choice && (
        <Card title="Club choice">
          <Body style={ui.large}>{handed(s.club_choice)}</Body>
        </Card>
      )}
      {s.mistakes && (
        <Card title="Common mistakes" tone="warning">
          <Bullets items={s.mistakes} tone="warning" />
        </Card>
      )}
      {s.drill && (
        <Card title="Practice drill" tone="muted">
          <Body style={ui.large}>{handed(s.drill)}</Body>
        </Card>
      )}
      {s.advanced && (
        <Card title="For better players" tone="muted">
          <Body style={ui.large}>{handed(s.advanced)}</Body>
        </Card>
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
  breadcrumb: { alignSelf: "flex-start", paddingVertical: 4 },
  breadcrumbText: { fontFamily: fonts.medium, fontSize: 16, textDecorationLine: "underline" },
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
});
