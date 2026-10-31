import Slider from "@react-native-community/slider";
import { handedScene, type ShotScene } from "@shotbook/shot-viz";
import { ShotDiagram, useShotPlayer } from "@shotbook/shot-viz/native";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { fonts, radius, useColors } from "../theme";
import { Bullets, cardStyle, styles as ui } from "./ui";

// A smaller canvas than the default keeps the labels readable at a phone's width (as on the site).
const SIZE = { width: 360, height: 300 };

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Shot diagram for the reader's hand, with Play swing, a step-through slider and the tips. */
export function ShotViz({ scene: input }: { scene: ShotScene }) {
  const c = useColors();
  const { hand } = usePrefs();
  const scene = useMemo(() => handedScene(input, hand), [input, hand]);
  const player = useShotPlayer(scene);
  const reduceMotion = useReduceMotion();

  return (
    <View style={[ui.card, cardStyle(c), styles.figure]}>
      <ShotDiagram scene={scene} {...SIZE} {...player.frame} />
      <View style={[styles.controls, { backgroundColor: c.surface, borderColor: c.line }]}>
        {!reduceMotion && (
          <Pressable
            accessibilityRole="button"
            onPress={player.play}
            style={({ pressed }) => [
              styles.play,
              { backgroundColor: pressed ? c.accentStrong : c.accent },
            ]}
          >
            <Text style={[styles.playText, { color: c.onAccent }]}>
              {"\u25B6\uFE0E"} Play swing
            </Text>
          </Pressable>
        )}
        <Slider
          accessibilityLabel="Step through the swing"
          style={styles.slider}
          minimumValue={0}
          maximumValue={player.duration}
          value={player.t}
          onValueChange={player.seek}
          minimumTrackTintColor={c.accent}
          maximumTrackTintColor={c.lineStrong}
          thumbTintColor={c.accent}
        />
      </View>
      {scene.tips.length > 0 && (
        <View style={styles.tips}>
          <Bullets items={scene.tips} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { padding: 0, overflow: "hidden" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  play: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
  },
  playText: { fontFamily: fonts.semibold, fontSize: 16 },
  slider: { flex: 1, height: 44 },
  tips: { padding: 16 },
});
