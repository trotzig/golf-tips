import { handedScene, type ShotScene } from "@shotbook/shot-viz";
import { ShotDiagram, useShotPlayer } from "@shotbook/shot-viz/native";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { fonts, radius, useColors } from "../theme";
import { Bullets, cardStyle, styles as ui } from "./ui";

// A smaller canvas than the default keeps the labels readable at a phone's width (as on the site).
const SIZE = { width: 360, height: 300 };

/**
 * Shot diagram for the reader's hand and golfer, with the tips. A Play button over the diagram
 * plays the swing at half speed; tapping the diagram while it plays pauses it. At the end it goes
 * back to the still diagram with the Play button showing.
 */
export function ShotViz({ scene: input }: { scene: ShotScene }) {
  const c = useColors();
  const { hand, wind, golfer } = usePrefs();
  const scene = useMemo(() => handedScene(input, hand, golfer), [input, hand, golfer]);
  const player = useShotPlayer(scene, { speed: 0.5 });
  const { ended, reset } = player;

  useEffect(() => {
    if (ended) reset();
  }, [ended, reset]);

  const label = player.playing ? "Pause" : player.t > 0 ? "Play" : "Play swing";

  return (
    <View style={[ui.card, cardStyle(c), styles.figure]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={player.playing ? player.pause : player.play}
      >
        {({ pressed }) => (
          <>
            <ShotDiagram scene={scene} wind={wind} {...SIZE} {...player.frame} />
            {!player.playing && (
              <View style={styles.overlay} pointerEvents="none">
                <View
                  style={[styles.play, { backgroundColor: pressed ? c.accentStrong : c.accent }]}
                >
                  <Text style={[styles.playText, { color: c.onAccent }]}>{"\u25B6\uFE0E"}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </Pressable>
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
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingLeft: 4,
  },
  playText: { fontFamily: fonts.semibold, fontSize: 24 },
  tips: { padding: 16 },
});
