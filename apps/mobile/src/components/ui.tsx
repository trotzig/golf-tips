import { getCategory, type Situation } from "@shotbook/content";
import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from "react-native";
import { useHanded } from "../prefs";
import { fonts, radius, useColors, type Colors } from "../theme";

/** Scrolling page with the canvas background and the site's side gutter. */
export function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Body text in Jost. */
export function Body({ style, ...props }: TextProps) {
  const c = useColors();
  return <Text style={[styles.body, { color: c.ink }, style]} {...props} />;
}

export function PageTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.pageTitle, { color: c.inkStrong }]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.inkStrong }]}>
      {children}
    </Text>
  );
}

/** Small uppercase label, as above "Related" and "Tags" on the site. */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.eyebrow, { color: color ?? c.inkMuted }]}>
      {children}
    </Text>
  );
}

export type Tone = "default" | "warning" | "muted";

const toneColor = (c: Colors, tone: Tone) =>
  ({ default: c.accent, warning: c.highlight, muted: c.lineStrong })[tone];

export function Card({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={[styles.card, cardStyle(c)]}>
      <Eyebrow color={tone === "muted" ? c.inkMuted : toneColor(c, tone)}>{title}</Eyebrow>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

/** Bulleted list with directions resolved for the reader's hand; markers take the card's tone. */
export function Bullets({ items, tone = "default" }: { items: string[]; tone?: Tone }) {
  const c = useColors();
  const handed = useHanded();
  return (
    <View style={{ gap: 8 }}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <Text style={[styles.bulletMarker, { color: toneColor(c, tone) }]}>•</Text>
          <Body style={styles.large}>{handed(item)}</Body>
        </View>
      ))}
    </View>
  );
}

export function Chip({
  label,
  href,
  variant = "accent",
}: {
  label: string;
  href: Href;
  variant?: "accent" | "surface";
}) {
  const c = useColors();
  const accent = variant === "accent";
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: accent ? c.accentSoft : c.surface },
        pressed && { backgroundColor: c.accent },
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.chipText,
            { color: pressed ? c.onAccent : accent ? c.accentStrong : c.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function SituationList({
  situations,
  showCategory = true,
}: {
  situations: Situation[];
  showCategory?: boolean;
}) {
  const c = useColors();
  const handed = useHanded();
  return (
    <View style={{ gap: 12 }}>
      {situations.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="link"
          onPress={() => router.push(`/situations/${s.id}`)}
          style={({ pressed }) => [
            styles.card,
            cardStyle(c),
            pressed && { backgroundColor: c.accentSoft, borderColor: c.accent },
          ]}
        >
          <View style={styles.rowHeader}>
            <Text style={[styles.rowTitle, { color: c.inkStrong }]}>{handed(s.title)}</Text>
            {showCategory && (
              <Text style={[styles.rowCategory, { color: c.inkMuted }]}>
                {getCategory(s.category).title}
              </Text>
            )}
          </View>
          <Body style={{ color: c.inkMuted, marginTop: 4 }}>{handed(s.summary)}</Body>
        </Pressable>
      ))}
    </View>
  );
}

export function cardStyle(c: Colors) {
  return {
    backgroundColor: c.card,
    borderColor: c.line,
    shadowColor: "#000",
  };
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, gap: 16 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  large: { fontSize: 18, lineHeight: 24, flexShrink: 1 },
  pageTitle: { fontFamily: fonts.serif, fontWeight: "700", fontSize: 30, lineHeight: 36 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 20, marginTop: 8 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  bullet: { flexDirection: "row", gap: 10, paddingLeft: 4 },
  bulletMarker: { fontSize: 18, lineHeight: 24 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 18, flexShrink: 1 },
  rowCategory: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
