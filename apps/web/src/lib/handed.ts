import { forHand, splitHanded } from "@shotbook/content";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Replaces direction tokens with both variants; CSS shows the one for the reader's hand. */
function tokensToHtml(text: string, escape: (s: string) => string): string {
  return splitHanded(text)
    .map((segment) =>
      typeof segment === "string"
        ? escape(segment)
        : `<span class="hand-r">${segment.right}</span><span class="hand-l">${segment.left}</span>`,
    )
    .join("");
}

/** Plain text with direction tokens, as HTML that follows the global handedness setting. */
export function handedHtml(text: string): string {
  return tokensToHtml(text, escapeHtml);
}

/** Markdown with direction tokens; the inline spans pass through the Markdown renderer. */
export function handedMarkdown(markdown: string): string {
  return tokensToHtml(markdown, (s) => s);
}

/** For attributes and metadata, where only one variant fits: the right-handed default. */
export function defaultHand(text: string): string {
  return forHand(text, "right");
}
