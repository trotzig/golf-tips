// Shared by the Node build and the browser bundle, so both name every example the same way.
// Happo identifies a snapshot by component + variant: renaming one starts a new history.

export type Hand = "right" | "left";

export const HANDS: Hand[] = ["right", "left"];

/** A built page, captured as static HTML. Happo never runs the page's scripts. */
export interface PageExample {
  component: string;
  variant: string;
  /** Pages with handed text get a variant for each hand; the rest only a right-handed one. */
  hands: Hand[];
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
  html: string;
}

export interface ManifestEntry {
  component: string;
  variant: string;
  /** Changes whenever anything that affects the example's screenshot changes. */
  fingerprint: string;
}

export interface Manifest {
  version: 1;
  examples: ManifestEntry[];
}

export const DIAGRAM_COMPONENT = "Shot diagram";

/** The size situation pages draw diagrams at (see ShotViz.astro). */
export const DIAGRAM_SIZE = { width: 360, height: 300 };

/**
 * Diagrams also captured playing, as animated (APNG) snapshots: a full swing face-on, a short
 * chip, and the behind view whose camera follows the ball with a tracer.
 */
export const ANIMATED_DIAGRAMS = ["flat-lie", "basic-chip", "high-shot"];

export function animatedVariant(id: string): string {
  return `${id}, played`;
}

/** Diagrams are also captured with a woman golfer, right-handed only (the build is what differs). */
export function femaleVariant(id: string): string {
  return `${id}, woman`;
}

export function handedVariant(name: string, hand: Hand): string {
  return hand === "right" ? name : `${name}, left-handed`;
}
