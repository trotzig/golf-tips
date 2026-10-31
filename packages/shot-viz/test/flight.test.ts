import { describe, expect, it } from "vitest";
import {
  computeFlight,
  deriveLaunch,
  deriveSetup,
  exampleScenes,
  parseScene,
  simulateFlight,
  windVector,
  type ShotSceneInput,
} from "../src/index.ts";

const scene = (input: Partial<ShotSceneInput>) => parseScene({ id: "t", title: "t", ...input });
const flight = (input: Partial<ShotSceneInput>) => computeFlight(scene(input));

describe("ball flight", () => {
  it("gives plausible stock distances that shrink through the bag", () => {
    const carry = (club: "driver" | "7-iron" | "sand-wedge") => flight({ swing: { club } }).carry;
    expect(carry("driver")).toBeGreaterThan(180);
    expect(carry("driver")).toBeLessThan(260);
    expect(carry("7-iron")).toBeGreaterThan(120);
    expect(carry("7-iron")).toBeLessThan(165);
    expect(carry("sand-wedge")).toBeLessThan(carry("7-iron"));
  });

  it("has a single apex between launch and landing, and lands descending more steeply than it launched", () => {
    const f = flight({});
    expect(f.apex[0]).toBeGreaterThan(f.carry * 0.45);
    expect(f.apex[0]).toBeLessThan(f.carry * 0.8);
    expect(f.descentAngle).toBeGreaterThan(f.launch.launchAngle);
    expect(f.total).toBeGreaterThan(f.carry);
    expect(f.duration).toBeGreaterThan(f.flightTime);
  });

  it("flies straight with a square face and path", () => {
    expect(Math.abs(flight({}).rest[2])).toBeLessThan(0.01);
  });

  it("curves right with an open face (fade) and left with a closed one (draw)", () => {
    expect(flight({ swing: { face: 3, path: -2 } }).rest[2]).toBeGreaterThan(5);
    expect(flight({ swing: { face: -3, path: 2 } }).rest[2]).toBeLessThan(-5);
  });

  it("goes shorter and higher into the wind, longer and lower downwind", () => {
    const calm = flight({});
    const into = flight({ flight: { wind: { speed: 8, from: 0 } } });
    const down = flight({ flight: { wind: { speed: 8, from: 180 } } });
    expect(into.carry).toBeLessThan(calm.carry - 10);
    expect(down.carry).toBeGreaterThan(calm.carry + 3);
    expect(into.descentAngle).toBeGreaterThan(calm.descentAngle);
    expect(down.total - down.carry).toBeGreaterThan(calm.total - calm.carry);
  });

  it("drifts with a crosswind from the right toward the left", () => {
    expect(windVector({ speed: 5, from: 90 })[2]).toBeCloseTo(-5);
    expect(flight({ flight: { wind: { speed: 8, from: 90 } } }).rest[2]).toBeLessThan(-5);
  });

  it("makes a high shot peak higher and land steeper than a low one", () => {
    const high = computeFlight(exampleScenes["high-shot"]!);
    const low = computeFlight(exampleScenes["low-shot"]!);
    expect(high.apex[1]).toBeGreaterThan(low.apex[1] * 2);
    expect(high.descentAngle).toBeGreaterThan(low.descentAngle + 10);
    expect(low.total - low.carry).toBeGreaterThan(high.total - high.carry);
  });

  it("rolls further on firm ground than soft", () => {
    const roll = (firmness: "soft" | "firm") => {
      const f = flight({ terrain: { firmness } });
      return f.total - f.carry;
    };
    expect(roll("firm")).toBeGreaterThan(roll("soft") * 2);
  });

  it("rolls a putt along the ground", () => {
    const putt = flight({ swing: { club: "putter" }, terrain: { lie: "green" } });
    expect(putt.carry).toBe(0);
    expect(putt.apex[1]).toBeLessThan(0.05);
    expect(putt.total).toBeGreaterThan(2);
    expect(putt.total).toBeLessThan(15);
  });

  it("lands on raised ground when the terrain rises toward the target", () => {
    const f = flight({ terrain: { slopeAlong: 10 } });
    expect(f.landing[1]).toBeGreaterThan(0.5);
  });

  it("is deterministic", () => {
    const s = scene({ swing: { face: 2 }, flight: { wind: { speed: 4, from: 45 } } });
    expect(simulateFlight(deriveLaunch(s), s.terrain, s.flight.wind)).toEqual(computeFlight(s));
  });
});

describe("slope adjustments", () => {
  it("follows mainstream advice on uphill and downhill lies", () => {
    const flat = scene({});
    const up = scene({ terrain: { slopeAlong: 10 } });
    const down = scene({ terrain: { slopeAlong: -10 } });
    // Uphill adds loft and flies higher; downhill delofts and flies lower with more roll.
    expect(deriveLaunch(up).launchAngle).toBeGreaterThan(deriveLaunch(flat).launchAngle);
    expect(deriveLaunch(down).launchAngle).toBeLessThan(deriveLaunch(flat).launchAngle);
    const downFlight = computeFlight(down);
    const flatFlight = computeFlight(flat);
    expect(downFlight.total - downFlight.carry).toBeGreaterThan(
      flatFlight.total - flatFlight.carry,
    );
    // Ball toward the higher foot; weight toward the lower foot uphill, lead foot downhill.
    expect(deriveSetup(up).ballPosition).toBeGreaterThan(deriveSetup(flat).ballPosition);
    expect(deriveSetup(down).ballPosition).toBeLessThan(deriveSetup(flat).ballPosition);
    expect(deriveSetup(up).weightLead).toBeLessThan(0.5);
    expect(deriveSetup(down).weightLead).toBeGreaterThan(0.5);
    // Tendencies: uphill left, downhill right.
    expect(computeFlight(up).rest[2]).toBeLessThan(0);
    expect(downFlight.rest[2]).toBeGreaterThan(0);
  });

  it("sends the ball left with it above the feet and right with it below", () => {
    expect(flight({ terrain: { slopeAcross: 10 } }).rest[2]).toBeLessThan(-3);
    expect(flight({ terrain: { slopeAcross: -10 } }).rest[2]).toBeGreaterThan(3);
  });

  it("grips down with the ball above the feet", () => {
    expect(deriveSetup(scene({ terrain: { slopeAcross: 10 } })).gripDown).toBeGreaterThan(0.03);
  });

  it("lets explicit golfer values override derived ones", () => {
    const s = scene({
      terrain: { slopeAlong: 10 },
      golfer: { weightLead: 0.7, ballPosition: -0.5, shoulderTilt: 0 },
    });
    expect(deriveSetup(s)).toMatchObject({ weightLead: 0.7, ballPosition: -0.5, shoulderTilt: 0 });
  });

  it("compensating aim brings the side-slope examples back near the target", () => {
    for (const id of ["ball-above-feet", "ball-below-feet"]) {
      expect(Math.abs(computeFlight(exampleScenes[id]!).rest[2])).toBeLessThan(5);
    }
  });
});

describe("example scenes", () => {
  it("each have plain-language tips without numbers", () => {
    for (const s of Object.values(exampleScenes)) {
      expect(s.tips.length, s.id).toBeGreaterThan(0);
      for (const tip of s.tips) expect(tip, s.id).not.toMatch(/\d/);
    }
  });

  it("match the downhill tip: shorter carry, longer roll-out than a flat lie", () => {
    const flat = computeFlight(exampleScenes["flat-lie"]!);
    const downhill = computeFlight(exampleScenes["downhill-lie"]!);
    expect(downhill.carry).toBeLessThan(flat.carry);
    expect(downhill.total - downhill.carry).toBeGreaterThan(flat.total - flat.carry);
  });

  it("start a fade left and a draw right, and curve both back to the target", () => {
    for (const [id, side] of [
      ["intentional-fade", -1],
      ["intentional-draw", 1],
    ] as const) {
      const s = exampleScenes[id]!;
      expect(Math.sign(deriveLaunch(s).direction), id).toBe(side);
      expect(Math.abs(computeFlight(s).rest[2]), id).toBeLessThan(2);
    }
  });
});
