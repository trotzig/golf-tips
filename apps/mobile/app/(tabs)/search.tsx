import { searchSituations } from "@shotbook/content/search";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Body, Screen, SituationList } from "../../src/components/ui";
import { getSituation, searchIndex } from "../../src/data";
import { usePrefs } from "../../src/prefs";
import { fonts, radius, useColors } from "../../src/theme";

export default function Search() {
  const c = useColors();
  const { hand } = usePrefs();
  // `/search?q=…` (e.g. a shotbook:// deep link) starts with a query.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? "");
  useEffect(() => {
    if (q !== undefined) setQuery(q);
  }, [q]);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return searchSituations(searchIndex(), q, hand).flatMap((hit) => getSituation(hit.id) ?? []);
  }, [query, hand]);

  return (
    <Screen>
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        placeholder="Uphill lie, fried egg, wind…"
        placeholderTextColor={c.inkMuted}
        accessibilityLabel="Search situations"
        style={[
          styles.input,
          { backgroundColor: c.card, borderColor: c.lineStrong, color: c.inkStrong },
        ]}
      />
      {query.trim() !== "" && (
        <Body accessibilityLiveRegion="polite" style={{ color: c.inkMuted }}>
          {results.length === 0
            ? "No matches. Try other words, like “slope” or “bunker”."
            : results.length === 1
              ? "1 situation"
              : `${results.length} situations`}
        </Body>
      )}
      <SituationList situations={results} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 18,
  },
});
