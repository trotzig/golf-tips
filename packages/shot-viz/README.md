# @shotbook/shot-viz

Shot visualisations for Shotbook. A situation can point to a **ShotScene**: a small JSON
description of the lie, the golfer's setup, the swing and the ball flight, plus short
plain-language tips. The renderer draws it as a 2D SVG diagram. (A three.js 3D prototype was
dropped for now; it is in the git history if we come back to it.)

## Entry points

| Import                     | What                                                          | Runs on              |
| -------------------------- | ------------------------------------------------------------- | -------------------- |
| `@shotbook/shot-viz`       | Types, zod schema, maths, example scenes, 2D scene → shapes   | Anywhere (no DOM)    |
| `@shotbook/shot-viz/web`   | `<ShotDiagram>` (React DOM SVG)                               | Web                  |
| `@shotbook/shot-viz/player` | `createShotPlayer`: plays/scrubs a rendered diagram, no React | Browser              |

The core must stay platform-neutral so the native app can import it. React is an optional peer
dependency, only needed for `/web`.

```tsx
import { exampleScenes } from "@shotbook/shot-viz";
import { ShotDiagram } from "@shotbook/shot-viz/web";

const scene = exampleScenes["downhill-lie"];
<ShotDiagram scene={scene} view="face-on" />
<ul>{scene.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
```

`ShotDiagram` is plain SVG: it renders on the server (Astro) and needs no JavaScript or WebGL. It
is one `role="img"` with a `<title>` and a generated plain-language `<desc>` (`describeScene`).

To animate it in the browser without shipping React, hand the same `<svg>` to the player. It
redraws the shapes layer (`<g data-shapes>`) from `shapesMarkup()` on every frame, using the
shared `timelineAt` clock (setup → swing → impact → flight):

```ts
import { createShotPlayer, handedScene } from "@shotbook/shot-viz/player";

const player = createShotPlayer(svg, handedScene(scene, "left"), { width: 360, height: 300 });
player.play((t) => (slider.value = String(t / player.duration)));
player.seek(1.2); // impact
```

The site uses it on situation pages (Play swing + a scrubber; Play is hidden under
`prefers-reduced-motion`). The standalone demo (`pnpm dev`) shows all scenes from every camera.

## Scene format

Scenes are data, not code. Only `id` and `title` are required; everything else has a default or
is derived from the slope. See [`src/core/schema.ts`](src/core/schema.ts) for the full contract and
[`src/scenes/`](src/scenes) for examples.

```json
{
  "id": "ball-above-feet",
  "title": "Ball above your feet",
  "terrain": { "slopeAlong": 0, "slopeAcross": 10, "lie": "fairway", "firmness": "normal" },
  "golfer": { "handedness": "right", "aim": 4 },
  "swing": { "club": "7-iron", "length": "three-quarter", "path": 0, "face": 0 },
  "flight": { "trajectory": "normal", "wind": { "speed": 5, "from": 90 } },
  "annotations": [{ "type": "aim-line", "label": "Aim a little right" }],
  "tips": ["Trust that the ball is going to draw and aim {right} of the target."],
  "camera": "down-the-line"
}
```

Conventions:

- Units: metres, seconds, degrees, m/s (5 m/s ≈ 11 mph).
- `slopeAlong` > 0 is uphill toward the target. `slopeAcross` > 0 is ball above the feet.
- Left and right are written **for a right-handed golfer**. `"handedness": "left"` draws the mirror
  image, so the same numbers work for both. Text (title, description, labels, tips) marks
  directions with `{left}`/`{right}` tokens, the same convention as the content; renderers resolve
  them for the scene's handedness. Use `handedScene(scene, hand)` to render a scene for the
  reader's global setting.
- Wind `from`: 0 = into your face, 90 = from the right, 180 = from behind.
- Golfer fields `weightLead`, `shoulderTilt`, `ballPosition` and `gripDown` are derived from the
  slope and club when omitted (`deriveSetup`). Explicit values always win.
- Cameras: `face-on`, `down-the-line` (frame the golfer), `behind`, `overhead` (frame the flight).
- `tips`: up to four short sentences on what the ball will do and what to do about it, in words,
  not numbers ("Ball tends to carry shorter but have a longer roll-out"). Shown next to the
  diagram and appended to its description. The flight maths stays internal: it shapes the
  drawing but its numbers are not shown to readers.
- Annotations: `target-line`, `aim-line`, `shoulder-line`, `slope-line`, `ball-flight`, `arrow`.

## The maths (pure TypeScript, tested)

World frame: ball at the origin, `x` toward the target, `y` up, `z` to the right. A right-hander
stands at negative `z`.

- **Terrain** (`terrain.ts`): the lie's slope holds for 4 m around the ball, then eases out to
  level ground, like a terrace. So the landing area of an uphill shot sits higher.
- **Setup** (`setup.ts`): mainstream slope adjustments. Shoulders follow the slope, the ball moves
  toward the higher foot, weight favours the lower foot uphill and the lead foot downhill. With the
  ball above the feet the golfer stands taller and grips down; with it below, they flex more.
- **Launch** (`setup.ts`): club defaults (speed, launch, spin) adjusted for trajectory, swing
  length, lie and slope. Uphill adds loft and pulls left, downhill delofts and pushes right, and
  the ball above the feet points the face left.
- **Flight** (`flight.ts`): gravity, drag, spin lift with a tilted spin axis for curve, and wind.
  It then bounces and rolls with simple friction, which depends on landing angle, spin and ground
  firmness. The numbers are plausible (7-iron about 143 m carry, driver about 210 m), not
  launch-monitor accurate.
- **Pose** (`pose.ts`): a stylised 17-joint mannequin. Legs and arms use two-bone IK. The golfer
  stands where the club reaches the ball, and the swing is a hub-and-plane model with keyframes
  from address through top and impact to finish. `timeline.ts` maps time to swing phase and ball
  time with a 3:1 tempo.
- **Cameras** (`camera.ts`): the presets and a pinhole projector.

```
pnpm test        # vitest: schema, geometry, flight, slope adjustments, 2D shapes
pnpm typecheck
pnpm build       # library to dist/
pnpm dev         # standalone demo at http://localhost:5173
pnpm build:demo  # static demo in dist-demo/
```

## Native app (step 7)

- **2D:** `buildShapes2D(scene, options)` returns a flat list of polygons, polylines, circles and
  text in screen coordinates, with no DOM types. `shapesMarkup()` turns them into SVG markup for
  the web. A `@shotbook/shot-viz/native` entry would do the same with `react-native-svg`
  (`Polygon`, `Polyline`, `Circle`, `Text`; arrowheads come from `arrowHead()`, not SVG markers).
- Scene JSON is bundled with the app content; the core maths runs unchanged in Hermes.
