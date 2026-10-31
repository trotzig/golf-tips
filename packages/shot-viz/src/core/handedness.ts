import type { ShotScene } from "./schema.ts";

export type Handedness = ShotScene["golfer"]["handedness"];

// Same token convention as `@shotbook/content` (see its handedness.ts): text is written for a
// right-hander, with `{left}`/`{right}` (or `{Left}`/`{Right}`) marking directions that flip.
const DIRECTIONS: Record<string, Record<Handedness, string>> = {
  left: { right: "left", left: "right" },
  right: { right: "right", left: "left" },
  Left: { right: "Left", left: "Right" },
  Right: { right: "Right", left: "Left" },
};

/** Resolves direction tokens for one handedness; unknown tokens are left as written. */
export function forHand(text: string, hand: Handedness): string {
  return text.replace(
    /\{([A-Za-z]+)\}/g,
    (token, word: string) => DIRECTIONS[word]?.[hand] ?? token,
  );
}

/**
 * The scene for a golfer of the given handedness (default: the scene's own), with every
 * direction token in its text resolved. Idempotent, so renderers can call it freely.
 */
export function handedScene(
  scene: ShotScene,
  hand: Handedness = scene.golfer.handedness,
): ShotScene {
  return {
    ...scene,
    title: forHand(scene.title, hand),
    description: scene.description && forHand(scene.description, hand),
    golfer: { ...scene.golfer, handedness: hand },
    annotations: scene.annotations.map((a) =>
      a.label ? { ...a, label: forHand(a.label, hand) } : a,
    ),
    tips: scene.tips.map((tip) => forHand(tip, hand)),
  };
}
