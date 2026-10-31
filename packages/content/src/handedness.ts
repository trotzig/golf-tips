/**
 * Content is written for a right-handed golfer, with every direction that flips for a
 * left-hander marked as a token: `{left}`, `{right}`, `{Left}`, `{Right}`. Readers pick their
 * handedness once and every direction is resolved for them — no "left-handers: mirror this".
 */
export const HANDEDNESS = ["right", "left"] as const;
export type Handedness = (typeof HANDEDNESS)[number];

/** Matches any `{word}` token so unknown ones can be reported by the validator. */
export const TOKEN_PATTERN = /\{([A-Za-z-]+)\}/g;

const DIRECTIONS: Record<string, { right: string; left: string }> = {
  left: { right: "left", left: "right" },
  right: { right: "right", left: "left" },
  Left: { right: "Left", left: "Right" },
  Right: { right: "Right", left: "Left" },
};

export const DIRECTION_TOKENS = Object.keys(DIRECTIONS);

/** A run of text that reads the same for both hands, or a direction that differs. */
export type HandedSegment = string | { right: string; left: string };

/** Splits text into plain runs and direction tokens, for renderers that show both variants. */
export function splitHanded(text: string): HandedSegment[] {
  const segments: HandedSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const direction = DIRECTIONS[match[1]!];
    if (!direction) continue;
    if (match.index > last) segments.push(text.slice(last, match.index));
    segments.push(direction);
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

/** Resolves direction tokens for one handedness. */
export function forHand(text: string, hand: Handedness): string {
  return splitHanded(text)
    .map((segment) => (typeof segment === "string" ? segment : segment[hand]))
    .join("");
}

/** Phrases that mean a direction was written for one hand only instead of using a token. */
const ONE_HANDED_PHRASES = /mirror this|(left|right)-hand(ed|ers?)\b|for (left|right)ies/i;

/** Problems with how a piece of text handles handedness, as human-readable messages. */
export function handednessIssues(text: string): string[] {
  const issues: string[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (!DIRECTIONS[match[1]!]) {
      issues.push(`unknown token ${match[0]} (use ${DIRECTION_TOKENS.map((t) => `{${t}}`).join(", ")})`);
    }
  }
  const phrase = ONE_HANDED_PHRASES.exec(text);
  if (phrase) {
    issues.push(
      `"${phrase[0]}": write for a right-hander with {left}/{right} tokens instead; the site flips them for left-handers`,
    );
  }
  return issues;
}
