// Small pure helpers, kept free of React Native so they run in vitest.

/** "ball-position" → "Ball position". Same as the web's tagLabel. */
export function tagLabel(tag: string): string {
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A situation body (short Markdown) as plain paragraphs. Bodies are a few sentences of prose, so
 * only emphasis and links are unwrapped; anything else shows as written.
 */
export function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/\s*\n\s*/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(\*|_)(.+?)\1/g, "$2")
        .trim(),
    )
    .filter(Boolean);
}
