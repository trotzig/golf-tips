import { forHand, splitText, type TextSegment } from "@shotbook/content";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Each variant of a token with the class that global.css shows for the matching setting. */
function variants(segment: Exclude<TextSegment, string>): Array<[string, string]> {
  switch (segment.pref) {
    case "hand":
      return [
        ["hand-r", segment.right],
        ["hand-l", segment.left],
      ];
    case "distance":
      return [
        ["dist-yd", segment.yards],
        ["dist-m", segment.meters],
      ];
    case "wind":
      return [
        ["wind-mph", segment.mph],
        ["wind-ms", segment["m/s"]],
      ];
  }
}

/**
 * Replaces direction and measurement tokens with every variant; CSS shows the one for the
 * reader's settings.
 */
function tokensToHtml(text: string, escape: (s: string) => string): string {
  return splitText(text)
    .map((segment) =>
      typeof segment === "string"
        ? escape(segment)
        : variants(segment)
            .map(([cls, value]) => `<span class="${cls}">${value}</span>`)
            .join(""),
    )
    .join("");
}

/** Plain text with tokens, as HTML that follows the reader's hand and units settings. */
export function handedHtml(text: string): string {
  return tokensToHtml(text, escapeHtml);
}

/** Markdown with tokens; the inline spans pass through the Markdown renderer. */
export function handedMarkdown(markdown: string): string {
  return tokensToHtml(markdown, (s) => s);
}

/** For attributes and metadata, where only one variant fits: right-handed, default units. */
export function defaultHand(text: string): string {
  return forHand(text, "right");
}
