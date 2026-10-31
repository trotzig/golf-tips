import { describe, expect, it } from "vitest";
import {
  buildSearchDocs,
  loadSearchIndex,
  parseSituation,
  processTerm,
  searchSituations,
  stem,
  toSearchIndexJson,
  type Situation,
} from "../src/index.ts";
import { loadSituations } from "../src/node.ts";

const { situations } = loadSituations();
const index = loadSearchIndex(JSON.parse(JSON.stringify(toSearchIndexJson(situations))));
const top = (query: string, hand: "right" | "left" = "right") =>
  searchSituations(index, query, hand)[0]?.id;

const situation = (fm: string): Situation => {
  const raw = `---\ntitle: T\nsummary: S\ncategory: lies\ntags: [slope]\nswing: [Swing.]\nexpect: [Result.]\nupdated: 2026-10-31\n${fm}---\n`;
  const result = parseSituation({ id: "x", raw });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.situation;
};

describe("stem / processTerm", () => {
  it("brings word forms together", () => {
    expect(new Set(["curve", "curves", "curving", "curved"].map(stem))).toEqual(new Set(["curv"]));
    expect(stem("lies")).toBe(stem("lie"));
    expect(stem("putts")).toBe("putt");
  });

  it("drops stop words and lowercases", () => {
    expect(processTerm("The")).toBeNull();
    expect(processTerm("Bunker")).toBe("bunker");
  });
});

describe("buildSearchDocs", () => {
  it("indexes text without direction tokens once", () => {
    expect(buildSearchDocs([situation("")]).map((d) => d.key)).toEqual(["x:both"]);
  });

  it("indexes tokenised text once per hand, resolved", () => {
    const docs = buildSearchDocs([situation('aliases: ["curving it {left}"]\n')]);
    expect(docs.map((d) => [d.key, d.aliases])).toEqual([
      ["x:right", "curving it left"],
      ["x:left", "curving it right"],
    ]);
  });
});

describe("searchSituations", () => {
  it("finds situations by title, alias and symptom", () => {
    expect(top("downhill lie")).toBe("downhill-lie");
    expect(top("ball above my feet")).toBe("ball-above-feet");
    expect(top("first tee")).toBe("first-tee-nerves");
  });

  it("matches prefixes as you type", () => {
    expect(top("bunk")).toMatch(/bunker/);
  });

  it("tolerates typos", () => {
    expect(top("plugged bunkr")).toBe("plugged-bunker-lie");
  });

  it("follows the reader's hand for directions", () => {
    expect(top("curving the ball right", "right")).toBe("intentional-fade");
    expect(top("curving the ball right", "left")).toBe("intentional-draw");
    const hit = searchSituations(index, "draw", "left").find((h) => h.id === "intentional-draw");
    expect(hit?.summary).toContain("from left to right");
  });

  it("returns each situation once", () => {
    const ids = searchSituations(index, "ball", "left").map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to any word when no situation matches every word", () => {
    expect(searchSituations(index, "bunker zzzzqqq", "right").length).toBeGreaterThan(0);
  });
});

describe("measurements in search", () => {
  it("finds text by either unit and shows the reader's", () => {
    const pitch = situation("drill: Pitch to {30 yd} targets.\n");
    pitch.summary = "Pitch from {15–60 yd}.";
    const idx = loadSearchIndex(JSON.parse(JSON.stringify(toSearchIndexJson([pitch]))));
    expect(searchSituations(idx, "yards", "right")[0]?.summary).toBe("Pitch from 15–60 yards.");
    expect(searchSituations(idx, "55 m", { distance: "meters" })[0]?.summary).toBe(
      "Pitch from 14–55 m.",
    );
  });
});
