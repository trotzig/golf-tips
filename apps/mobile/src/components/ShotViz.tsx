import { handedScene, type ShotScene } from "@shotbook/shot-viz";
import { ShotDiagram, useShotPlayer } from "@shotbook/shot-viz/native";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { fonts, radius, useColors } from "../theme";
import { Bullets, cardStyle, styles as ui } from "./ui";

// A smaller canvas than the default keeps the labels readable at a phone's width (as on the site).
const SIZE = { width: 360, height: 300 };

/** Whether the system asks for reduced motion; `null` until known. */
function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/**
 * Shot diagram for the reader's hand and golfer, with the tips. It plays the swing once when it
 * opens (and after a hand or golfer switch); one button pauses, resumes and plays it again.
 */
export function ShotViz({ scene: input }: { scene: ShotScene }) {
  const c = useColors();
  const { hand, wind, golfer } = usePrefs();
  const scene = useMemo(() => handedScene(input, hand, golfer), [input, hand, golfer]);
  const player = useShotPlayer(scene);
  const reduceMotion = useReduceMotion();
  const { play } = player;

  useEffect(() => {
    if (reduceMotion === false) play();
  }, [reduceMotion, play, scene]);

  const [icon, label] = player.playing
    ? ["\u2759\u200A\u2759", "Pause"]
    : player.ended
      ? ["\u21BB", "Play again"]
      : player.t > 0
        ? ["\u25B6\uFE0E", "Play"]
        : ["\u25B6\uFE0E", "Play swing"];

  return (
    <View style={[ui.card, cardStyle(c), styles.figure]}>
      <ShotDiagram scene={scene} wind={wind} {...SIZE} {...player.frame} />
      {reduceMotion === false && (
        <View style={[styles.controls, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={player.playing ? player.pause : player.play}
            style={({ pressed }) => [
              styles.play,
              { backgroundColor: pressed ? c.accentStrong : c.accent },
            ]}
          >
            <Text style={[styles.playText, { color: c.onAccent }]}>
              {icon} {label}
            </Text>
          </Pressable>
        </View>
      )}
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
  tips: { padding: 16 },
});
