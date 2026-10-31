import { HANDEDNESS, type Handedness } from "@shotbook/content";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { fonts, radius, useColors } from "../theme";

const LABELS: Record<Handedness, string> = { right: "Right-handed", left: "Left-handed" };

/** Global right/left-handed switch: every direction in the advice follows it. */
export function HandToggle() {
  const c = useColors();
  const { hand, setHand } = usePrefs();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Which way do you swing?"
      style={[styles.group, { backgroundColor: c.surface }]}
    >
      {HANDEDNESS.map((value) => {
        const selected = value === hand;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setHand(value)}
            style={[styles.option, selected && { backgroundColor: c.raised, ...styles.raised }]}
          >
            <Text style={[styles.label, { color: selected ? c.accent : c.ink }]}>
              {LABELS[value]}
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
