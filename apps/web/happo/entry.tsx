// The Happo bundle. Registers every example; Happo renders them one at a time and snapshots the
// page. Built by build.ts, which also generates the virtual module with the pages.
import type { AnimateOptions, AnimationDriver, WindowHappoAnimate } from "happo";
import happoStatic from "happo/custom";
import {
  computeFlight,
  exampleScenes,
  FOLLOW_THROUGH,
  handedScene,
  SWING_TO_IMPACT,
  timelineDuration,
  type ShotScene,
} from "@shotbook/shot-viz";
import { createShotPlayer, type ShotPlayer } from "@shotbook/shot-viz/player";
import { ShotDiagram } from "@shotbook/shot-viz/web";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { css, pages } from "virtual:happo-examples";
import {
  ANIMATED_DIAGRAMS,
  animatedVariant,
  DIAGRAM_COMPONENT,
  DIAGRAM_SIZE,
  HANDS,
  femaleVariant,
  handedVariant,
} from "./examples.ts";

const style = document.createElement("style");
style.textContent = css;
document.head.append(style);

let root: Root | undefined;
/** The diagram of the current played example, which the animation driver hands to Happo. */
let played: { svg: SVGSVGElement; player: ShotPlayer } | undefined;

function reset(htmlAttrs: Record<string, string>, bodyAttrs: Record<string, string>) {
  root?.unmount();
  root = undefined;
  played?.player.pause();
  played = undefined;
  for (const [el, attrs] of [
    [document.documentElement, htmlAttrs],
    [document.body, bodyAttrs],
  ] as const) {
    for (const name of el.getAttributeNames()) el.removeAttribute(name);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  }
  document.body.replaceChildren();
}

for (const page of pages) {
  for (const hand of page.hands) {
    happoStatic.registerExample({
      component: page.component,
      variant: handedVariant(page.variant, hand),
      render: () => {
        reset({ ...page.htmlAttrs, "data-hand": hand }, page.bodyAttrs);
        document.body.innerHTML = page.html;
      },
    });
  }
}

function renderDiagram(scene: ShotScene): SVGSVGElement {
  const el = document.createElement("div");
  el.className = "inline-block";
  document.body.append(el);
  root = createRoot(el);
  flushSync(() => {
    root?.render(<ShotDiagram scene={scene} {...DIAGRAM_SIZE} />);
  });
  const svg = el.querySelector("svg");
  if (!svg) throw new Error(`No diagram for ${scene.id}`);
  return svg;
}

for (const scene of Object.values(exampleScenes)) {
  for (const hand of HANDS) {
    happoStatic.registerExample({
      component: DIAGRAM_COMPONENT,
      variant: handedVariant(scene.id, hand),
      render: () => {
        reset({ lang: "en", "data-hand": hand }, { class: "bg-canvas font-sans" });
        renderDiagram(handedScene(scene, hand));
      },
    });
  }
  happoStatic.registerExample({
    component: DIAGRAM_COMPONENT,
    variant: femaleVariant(scene.id),
    render: () => {
      reset({ lang: "en", "data-hand": "right" }, { class: "bg-canvas font-sans" });
      renderDiagram(handedScene(scene, "right", "female"));
    },
  });
}

// Played diagrams: Happo steps the same player "Play swing" uses through fixed times, through an
// animation driver, and encodes the frames as one animated PNG. Nothing runs on a timer.
const shotPlayerDriver: AnimationDriver = {
  name: "shot-player",
  discover: (rootEl) =>
    played && rootEl.contains(played.svg)
      ? [
          {
            target: played.player,
            element: played.svg,
            name: "Play swing",
            startMs: 0,
            durationMs: Math.round(played.player.duration * 1000),
            seek: (ms) => played?.player.seek(ms / 1000),
            pause: () => played?.player.pause(),
          },
        ]
      : [],
};

// The Happo worker sets up `happoAnimate`; outside a Happo run there is nothing to register with.
const driverRegistered = new WeakSet<WindowHappoAnimate>();
function registerShotPlayerDriver() {
  const happoAnimate = (globalThis as { happoAnimate?: WindowHappoAnimate }).happoAnimate;
  if (!happoAnimate || driverRegistered.has(happoAnimate)) return;
  happoAnimate.registerDriver(shotPlayerDriver);
  driverRegistered.add(happoAnimate);
}
registerShotPlayerDriver();

/**
 * Seconds to capture: the key swing positions, then the ball flight to the final hold, closer
 * together early on, while the camera follows the ball, than in the roll-out.
 */
function frameTimes(duration: number): number[] {
  // The backswing takes 75% of the time to impact (see timelineAt), the downswing the rest.
  const swing = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375, 1].map(
    (f) => f * SWING_TO_IMPACT,
  );
  const followThrough = [0.2, 0.4, 0.6, 0.8, 1].map((f) => SWING_TO_IMPACT + f * FOLLOW_THROUGH);
  const finish = SWING_TO_IMPACT + FOLLOW_THROUGH;
  const flight = [0.075, 0.15, 0.225, 0.3, 0.4, 0.5, 0.625, 0.75, 0.875, 1].map(
    (f) => finish + f * (duration - finish),
  );
  return [...swing, ...followThrough, ...flight];
}

for (const id of ANIMATED_DIAGRAMS) {
  const sceneInput = exampleScenes[id];
  if (!sceneInput) throw new Error(`No scene ${id} to animate`);
  const scene = handedScene(sceneInput, "right");
  const duration = timelineDuration(computeFlight(scene));
  const times = frameTimes(duration).map((t) => Math.round(t * 1000));
  const animate: AnimateOptions = {
    mode: "always",
    duration: Math.round(duration * 1000),
    maxDuration: Math.round(duration * 1000),
    sampling: { times },
    maxFrames: times.length,
    drivers: [shotPlayerDriver.name],
    // A capture that didn't find the player shows up as a snapshot naming the failure.
    expect: { drivers: { [shotPlayerDriver.name]: 1 } },
  };
  happoStatic.registerExample({
    component: DIAGRAM_COMPONENT,
    variant: animatedVariant(id),
    animate,
    render: () => {
      reset({ lang: "en", "data-hand": "right" }, { class: "bg-canvas font-sans" });
      registerShotPlayerDriver();
      const svg = renderDiagram(scene);
      played = { svg, player: createShotPlayer(svg, scene, DIAGRAM_SIZE) };
    },
  });
}

happoStatic.init();
