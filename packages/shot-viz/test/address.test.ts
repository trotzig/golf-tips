import { describe, expect, it } from "vitest";
import { addressLayout, addressSummary, exampleScenes, setupInsight } from "../src/index.ts";

const insight = (id: string) => setupInsight(exampleScenes[id]!);

describe("address summary", () => {
  it("names only the ball for a normal setup", () => {
    expect(addressSummary(insight("flat-lie"))).toBe("Ball normal");
  });

  it("adds weight and stance when they differ from normal", () => {
    expect(addressSummary(insight("basic-chip"))).toBe("Ball back · weight lead · narrow stance");
    expect(addressSummary(insight("uphill-lie"))).toBe("Ball forward · weight trail");
  });
});

describe("address layout", () => {
  it("puts the lead foot and the target on the left for a right-hander", () => {
    const l = addressLayout(insight("flat-lie"), false);
    const [lead, trail] = l.feet;
    expect(lead.x).toBeLessThan(trail.x);
    expect(l.target.anchor).toBe("start");
  });

  it("mirrors everything for a left-hander", () => {
    const i = insight("downhill-lie");
    const right = addressLayout(i, false);
    const left = addressLayout(i, true);
    expect(left.feet[0].x).toBeCloseTo(300 - right.feet[0].x, 0);
    expect(left.ball).toBeCloseTo(300 - right.ball, 0);
    expect(left.target.anchor).toBe("end");
  });

  it("moves the ball back toward the trail foot, inside the stance", () => {
    const l = addressLayout(insight("downhill-lie"), false);
    expect(l.ball).toBeGreaterThan(l.normalBall);
    expect(l.ball).toBeLessThan(l.feet[1].x);
  });

  it("shades the foot carrying more weight and points the balance at it", () => {
    const l = addressLayout(insight("basic-chip"), false);
    expect(l.feet[0].shade).toBeGreaterThan(l.feet[1].shade);
    const pointerX = Number(l.balance.pointer.split(" ")[0]!.slice(1));
    expect(pointerX).toBeLessThan(l.balance.centre);
  });

  it("draws a narrow stance inside the normal one", () => {
    const l = addressLayout(insight("basic-chip"), false);
    expect(l.feet[0].x).toBeGreaterThan(l.normalFeet[0]);
    expect(l.feet[1].x).toBeLessThan(l.normalFeet[1]);
  });
});
