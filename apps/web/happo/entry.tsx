// The Happo bundle. Registers every example; Happo renders them one at a time and snapshots the
// page. Built by build.ts, which also generates the virtual module with the pages.
import happoStatic from "happo/custom";
import { exampleScenes, handedScene } from "@shotbook/shot-viz";
import { ShotDiagram } from "@shotbook/shot-viz/web";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { css, pages } from "virtual:happo-examples";
import { DIAGRAM_COMPONENT, DIAGRAM_SIZE, HANDS, handedVariant } from "./examples.ts";

const style = document.createElement("style");
style.textContent = css;
document.head.append(style);

let root: Root | undefined;

function reset(htmlAttrs: Record<string, string>, bodyAttrs: Record<string, string>) {
  root?.unmount();
  root = undefined;
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

for (const scene of Object.values(exampleScenes)) {
  for (const hand of HANDS) {
    happoStatic.registerExample({
      component: DIAGRAM_COMPONENT,
      variant: handedVariant(scene.id, hand),
      render: () => {
        reset({ lang: "en", "data-hand": hand }, { class: "bg-white font-sans" });
        const el = document.createElement("div");
        el.className = "inline-block";
        document.body.append(el);
        root = createRoot(el);
        flushSync(() => {
          root?.render(<ShotDiagram scene={handedScene(scene, hand)} {...DIAGRAM_SIZE} />);
        });
      },
    });
  }
}

happoStatic.init();
