import { DISTANCE_UNITS, HANDEDNESS, WIND_UNITS, type Reader } from "@shotbook/content";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { fonts, radius, useColors } from "../theme";

const OPTIONS: {
  [K in keyof Reader]: {
    values: readonly Reader[K][];
    labels: Record<Reader[K], string>;
    label: string;
  };
} = {
  hand: {
    values: HANDEDNESS,
    labels: { right: "Right-handed", left: "Left-handed" },
    label: "Which way do you swing?",
  },
  distance: {
    values: DISTANCE_UNITS,
    labels: { yards: "Yards", meters: "Meters" },
    label: "Distance units",
  },
  wind: { values: WIND_UNITS, labels: { mph: "mph", "m/s": "m/s" }, label: "Wind speed units" },
};

/** Segmented switch for one reader setting; every text in the app follows it. */
export function PrefToggle({ pref }: { pref: keyof Reader }) {
  const c = useColors();
  const prefs = usePrefs();
  const { values, labels, label } = OPTIONS[pref] as {
    values: readonly string[];
    labels: Record<string, string>;
    label: string;
  };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, { backgroundColor: c.surface }]}
    >
      {values.map((value) => {
        const selected = value === prefs[pref];
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => prefs.setPref(pref, value as Reader[typeof pref])}
            style={[styles.option, selected && { backgroundColor: c.raised, ...styles.raised }]}
          >
            <Text style={[styles.label, { color: selected ? c.accent : c.ink }]}>
              {labels[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", borderRadius: radius.tray, padding: 4 },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.card,
  },
  raised: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontFamily: fonts.medium, fontSize: 16 },
});
