import { describe, expect, it } from "vitest";
import {
  buildShapes2D,
  cameraPresets,
  defaultTheme,
  computeFlight,
  describeScene,
  exampleScenes,
  followCamera,
  handedScene,
  parseScene,
  projector,
} from "../src/index.ts";

describe("2D shapes", () => {
  it("draws a woman with the same outfit colours, plus a ponytail", () => {
    const scene = exampleScenes["flat-lie"]!;
    const colours = (gender: "male" | "female") =>
      new Set(
        buildShapes2D(handedScene(scene, "right", gender), { phase: 1 }).shapes.flatMap((s) =>
          s.kind === "text" ? [] : [("fill" in s && s.fill) || s.stroke],
        ),
      );
    expect(colours("female")).toEqual(colours("male"));
    const count = (gender: "male" | "female") =>
      buildShapes2D(handedScene(scene, "right", gender), { phase: 1 }).shapes.length;
    expect(count("female")).toBe(count("male") + 1);
  });

  it("builds finite shapes for every example scene and view", () => {
    for (const input of Object.values(exampleScenes)) {
      for (const view of cameraPresets) {
        for (const gender of ["male", "female"] as const) {
          const scene = handedScene(input, "right", gender);
          const out = buildShapes2D(scene, { view });
          expect(out.shapes.length).toBeGreaterThan(20);
          // Size budget: diagrams are inlined in every situation page, four times (both hands, both
          // golfers).
          expect(out.shapes.length).toBeLessThan(400);
          for (const s of out.shapes) {
            const pts = s.kind === "circle" ? [s.c] : s.kind === "text" ? [s.at] : s.points;
            for (const p of pts) {
              expect(Number.isFinite(p.x)).toBe(true);
              expect(Number.isFinite(p.y)).toBe(true);
            }
          }
        }
      }
    }
  });

  it("draws labels last so they sit on top", () => {
    const out = buildShapes2D(exampleScenes["uphill-lie"]!, { view: "face-on" });
    const firstText = out.shapes.findIndex((s) => s.kind === "text");
    expect(firstText).toBeGreaterThan(0);
    expect(out.shapes.slice(firstText).every((s) => s.kind === "text")).toBe(true);
    expect(out.shapes.some((s) => s.kind === "text" && s.text === "Slope")).toBe(true);
  });

  it("mirrors the drawing for a left-handed golfer", () => {
    const right = parseScene({ id: "r", title: "r" });
    const left = parseScene({ id: "l", title: "l", golfer: { handedness: "left" } });
    // The head is the skin-coloured outline with the most points.
    const head = (s: typeof right) => {
      const skin = buildShapes2D(s, { view: "down-the-line", width: 400 }).shapes.filter(
        (x) => x.kind === "polygon" && x.fill === defaultTheme.skin,
      );
      const outline = skin.reduce((a, b) =>
        b.kind === "polygon" && a.kind === "polygon" && b.points.length > a.points.length ? b : a,
      );
      if (outline.kind !== "polygon") throw new Error("no head");
      return outline.points.reduce((sum, p) => sum + p.x, 0) / outline.points.length;
    };
    expect(head(right)).toBeCloseTo(400 - head(left), 3);
  });

  it("hides the ball flight before impact when animating", () => {
    const scene = exampleScenes["flat-lie"]!;
    const before = buildShapes2D(scene, { view: "behind", ballTime: -0.5 });
    const after = buildShapes2D(scene, { view: "behind", ballTime: 2 });
    const flightLines = (o: typeof before) =>
      o.shapes.filter((s) => s.kind === "polyline" && s.stroke === defaultTheme.flight);
    expect(flightLines(before)).toHaveLength(0);
    expect(flightLines(after)).toHaveLength(1);
  });

  it("draws the tracer all the way to the ball in the golfer views", () => {
    const scene = exampleScenes["ball-below-feet"]!;
    const flight = computeFlight(scene);
    for (const view of ["face-on", "down-the-line"] as const) {
      const out = buildShapes2D(scene, { view, flight, ballTime: flight.flightTime - 0.2 });
      const tracer = out.shapes.find(
        (s) => s.kind === "polyline" && s.stroke === defaultTheme.flight,
      );
      const ball = out.shapes.find((s) => s.kind === "circle" && s.fill === "#ffffff");
      expect(tracer?.kind).toBe("polyline");
      expect(ball?.kind).toBe("circle");
      if (tracer?.kind !== "polyline" || ball?.kind !== "circle") return;
      const end = tracer.points[tracer.points.length - 1]!;
      expect(Math.hypot(end.x - ball.c.x, end.y - ball.c.y)).toBeLessThan(1);
    }
  });

  it("pulls the golfer views back so the whole flight fits once the ball is away", () => {
    for (const id of ["ball-below-feet", "downhill-lie", "greenside-bunker"]) {
      const scene = exampleScenes[id]!;
      const flight = computeFlight(scene);
      for (const view of ["face-on", "down-the-line"] as const) {
        const p = projector(followCamera(view, flight, 360 / 300));
        for (const at of [[0, 0, 0] as const, flight.apex, flight.landing, flight.rest]) {
          const s = p.project(at)!;
          expect(Math.abs(s.y)).toBeLessThan(1);
          expect(Math.abs(s.x)).toBeLessThan(360 / 300);
        }
      }
    }
  });

  it("shows aim, start line and the curve back to the target on slopes along the line", () => {
    for (const [id, side] of [
      ["uphill-lie", 1],
      ["downhill-lie", -1],
    ] as const) {
      const scene = exampleScenes[id]!;
      const flight = computeFlight(scene);
      // Aim off the target, start between aim and target, finish near the target line.
      expect(Math.sign(scene.golfer.aim)).toBe(side);
      expect(Math.sign(flight.launch.direction)).toBe(side);
      expect(Math.abs(flight.launch.direction)).toBeLessThan(Math.abs(scene.golfer.aim));
      expect(Math.abs(flight.rest[2])).toBeLessThan(3);

      const end = buildShapes2D(scene, { flight, ballTime: flight.duration, width: 360 });
      const texts = end.shapes.flatMap((s) => (s.kind === "text" ? [s] : []));
      const at = (t: string) => texts.find((s) => s.text.startsWith(t))!.at;
      for (const t of ["Target", "Aim", "Start line", "Curves back"]) expect(at(t)).toBeDefined();
      // From behind the ball the lines fan out: aim and start line lie on the aim side.
      expect((at("Aim").x - at("Target").x) * side).toBeGreaterThan(20);
    }
  });

  it("describes the scene in plain language for screen readers", () => {
    const scene = exampleScenes["uphill-lie"]!;
    const text = describeScene(scene, "face-on");
    expect(text).toMatch(
      /^Face-on view: a right-handed golfer with a 7-iron on an uphill lie \(10° up toward the target\)/,
    );
    expect(text).not.toMatch(/\d+ m\b/);
    expect(text).toContain(scene.tips[0]);
    const wind = describeScene(exampleScenes["into-the-wind"]!);
    expect(wind).toMatch(/Wind 20 mph into the golfer's face/);
    expect(describeScene(exampleScenes["into-the-wind"]!, undefined, "m/s")).toMatch(
      /Wind 9 m\/s into the golfer's face/,
    );
  });

  it("labels the wind speed in both units", () => {
    const { shapes } = buildShapes2D(exampleScenes["into-the-wind"]!);
    const label = shapes.find((s) => s.kind === "text" && s.wind);
    expect(label).toMatchObject({
      text: "Wind 20 mph",
      wind: { mph: "Wind 20 mph", "m/s": "Wind 9 m/s" },
    });
  });
});
