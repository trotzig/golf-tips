// Swing-tuning playground: edit the SwingTuning knobs and keyframes, compare with the classic swing,
// and copy the result as JSON to paste into DEFAULT_SWING in src/core/pose.ts.
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildShapes2D,
  CLASSIC_SWING,
  computeFlight,
  DEFAULT_SWING,
  exampleScenes,
  FOLLOW_THROUGH,
  PHASE,
  shapesMarkup,
  SWING_TO_IMPACT,
  timelineAt,
  type CameraPreset,
  type FlightResult,
  type ShotScene,
  type SwingKey,
  type SwingTuning,
} from "../src/index.ts";

const STORE = "shotbook:swing-playground";
const SCENES = ["flat-lie", "high-shot", "low-shot", "pitch-shot", "basic-chip", "uphill-lie"];
const STRIP = [PHASE.top, 0.57, PHASE.impact, 0.7, 0.74, 0.8, 0.86, 0.93, PHASE.finish];
const CHANNELS = ["arm", "hinge", "turn", "hips", "weight", "rise"] as const;
const CHANNEL_HELP: Record<(typeof CHANNELS)[number], string> = {
  arm: "Arms along the plane (1 = top, − = through)",
  hinge: "Wrist hinge (− = club past the arms)",
  turn: "Shoulder turn (× max)",
  hips: "Hip turn (× max shoulder turn)",
  weight: "Weight shift (+ = lead side)",
  rise: "Stand up / head up",
};
const LOCKED = new Set<number>([PHASE.address, PHASE.top, PHASE.impact, PHASE.finish]);

const KNOBS: {
  key: Exclude<keyof SwingTuning, "keys" | "interpolation">;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "spineFollowsHips", label: "Spine turns with hips", min: 0, max: 1, step: 0.05 },
  { key: "kneesFollowHips", label: "Knees point with hips", min: 0, max: 1, step: 0.05 },
  {
    key: "planeFollow",
    label: "Arm plane turns with hips (after impact)",
    min: 0,
    max: 1,
    step: 0.05,
  },
  { key: "hubFollow", label: "Hub travels with chest (after impact)", min: 0, max: 1, step: 0.05 },
  { key: "foldStart", label: "Lead arm starts folding at phase", min: 0.66, max: 0.99, step: 0.01 },
  { key: "foldReach", label: "Lead arm reach at finish", min: 0.5, max: 0.95, step: 0.01 },
  { key: "heelLift", label: "Trail heel lift at the finish (°)", min: 0, max: 80, step: 1 },
  {
    key: "bodyLead",
    label: "Body turns ahead of the arms (phase)",
    min: 0,
    max: 0.15,
    step: 0.005,
  },
];

const clone = (t: SwingTuning): SwingTuning => JSON.parse(JSON.stringify(t));

/** The first proposal: hips lead hard, club held in line to 0.74, full heel lift. */
const FIRST_PROPOSAL: SwingTuning = {
  keys: [
    { p: 0, arm: 0, hinge: 0, turn: 0, hips: 0, weight: 0, rise: 0 },
    { p: 0.15, arm: 0.3, hinge: 0.15, turn: 0.35, hips: 0.15, weight: -0.1, rise: 0 },
    { p: PHASE.top, arm: 1, hinge: 1, turn: 1, hips: 0.5, weight: -0.2, rise: 0 },
    { p: 0.57, arm: 0.45, hinge: 0.9, turn: 0.4, hips: 0, weight: 0.25, rise: 0 },
    { p: PHASE.impact, arm: -0.03, hinge: 0.04, turn: -0.15, hips: -0.4, weight: 0.35, rise: 0.05 },
    { p: 0.74, arm: -0.6, hinge: -0.05, turn: -0.6, hips: -0.7, weight: 0.4, rise: 0.2 },
    { p: 0.86, arm: -0.95, hinge: -0.5, turn: -1, hips: -0.9, weight: 0.43, rise: 0.6 },
    { p: PHASE.finish, arm: -1.15, hinge: -0.95, turn: -1.25, hips: -1, weight: 0.45, rise: 1 },
  ],
  interpolation: "spline",
  spineFollowsHips: 0.6,
  kneesFollowHips: 0.8,
  planeFollow: 0.35,
  hubFollow: 0.6,
  foldStart: 0.82,
  foldReach: 0.7,
  heelLift: 55,
  bodyLead: 0.04,
};

const PRESETS: Record<string, SwingTuning> = {
  "Your pick (default)": DEFAULT_SWING,
  "First proposal": FIRST_PROPOSAL,
  Classic: CLASSIC_SWING,
};

function loadTuning(): SwingTuning {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      // Older saves carry a `heel` key channel, now derived from the hips: drop it.
      const saved = { ...clone(DEFAULT_SWING), ...JSON.parse(raw) } as SwingTuning;
      saved.keys = saved.keys.map((k) => {
        const rest: Partial<SwingKey & { heel: number }> = { ...k };
        delete rest.heel;
        return rest as SwingKey;
      });
      return saved;
    }
  } catch {
    // Fall through to the default.
  }
  return clone(DEFAULT_SWING);
}

function Diagram(props: {
  scene: ShotScene;
  flight: FlightResult;
  view: CameraPreset;
  phase: number;
  swing: SwingTuning;
  ghost?: SwingTuning;
  width?: number;
  height?: number;
}) {
  const { scene, flight, view, phase, swing, ghost, width = 480, height = 360 } = props;
  const html = useMemo(() => {
    const opts = { view, phase, ballTime: Infinity, flight, width, height };
    const main = shapesMarkup(buildShapes2D(scene, { ...opts, swing }).shapes);
    if (!ghost) return main;
    // The ghost is a whole second diagram at low opacity: the identical ground disappears into
    // the first one, leaving a faint golfer.
    const g = shapesMarkup(buildShapes2D(scene, { ...opts, swing: ghost }).shapes);
    return `${main}<g opacity="0.3" style="mix-blend-mode:multiply">${g}</g>`;
  }, [scene, flight, view, phase, swing, ghost, width, height]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", width: "100%", height: "auto" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function App() {
  const [sceneId, setSceneId] = useState("flat-lie");
  const scene = exampleScenes[sceneId]!;
  const flight = useMemo(() => computeFlight(scene), [scene]);
  const [tuning, setTuning] = useState(loadTuning);
  const [phase, setPhase] = useState<number>(PHASE.impact);
  const [speed, setSpeed] = useState(0.35);
  const [ghost, setGhost] = useState(true);
  const [stripView, setStripView] = useState<CameraPreset>("face-on");
  const [copied, setCopied] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(tuning));
    } catch {
      // Private mode: nothing to keep.
    }
  }, [tuning]);

  const play = () => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const end = SWING_TO_IMPACT + FOLLOW_THROUGH + 0.3;
    const tick = (now: number) => {
      const t = ((now - start) / 1000) * speed;
      setPhase(timelineAt(Math.min(t, end)).phase);
      if (t < end) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const setKnob = (k: (typeof KNOBS)[number]["key"], v: number) =>
    setTuning((t) => ({ ...t, [k]: v }));
  const setKey = (i: number, ch: keyof SwingKey, v: number) =>
    setTuning((t) => {
      const keys = t.keys.map((k, j) => (j === i ? { ...k, [ch]: v } : k));
      return { ...t, keys: [...keys].sort((a, b) => a.p - b.p) };
    });
  const addKey = (i: number) =>
    setTuning((t) => {
      const a = t.keys[i]!;
      const b = t.keys[i + 1]!;
      const mid = Object.fromEntries(
        Object.keys(a).map((k) => [k, (a[k as keyof SwingKey] + b[k as keyof SwingKey]) / 2]),
      ) as unknown as SwingKey;
      mid.p = Math.round(mid.p * 100) / 100;
      const keys = [...t.keys];
      keys.splice(i + 1, 0, mid);
      return { ...t, keys };
    });
  const removeKey = (i: number) =>
    setTuning((t) => ({ ...t, keys: t.keys.filter((_, j) => j !== i) }));

  const json = JSON.stringify(tuning, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pg">
      <header className="pg-head">
        <h1>Swing playground</h1>
        <p className="lede">
          Tweak the swing and watch the follow-through. The faint golfer is the classic swing (what
          the site shows today). Values are kept in this browser; “Copy JSON” gives Claude the
          numbers.
        </p>
        <div className="controls">
          <select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
            {SCENES.map((id) => (
              <option key={id} value={id}>
                {exampleScenes[id]?.title ?? id}
              </option>
            ))}
          </select>
          <button onClick={play}>▶ Play</button>
          <label>
            Speed {speed.toFixed(2)}×
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>
          <label className="grow">
            Phase {phase.toFixed(2)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={phase}
              onChange={(e) => {
                cancelAnimationFrame(raf.current);
                setPhase(Number(e.target.value));
              }}
            />
          </label>
          <label>
            <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} />{" "}
            Ghost classic
          </label>
        </div>
      </header>

      <div className="pg-body">
        <section className="pg-views">
          <div className="diagrams">
            <figure className="card">
              <h3>Face-on</h3>
              <Diagram
                scene={scene}
                flight={flight}
                view="face-on"
                phase={phase}
                swing={tuning}
                ghost={ghost ? CLASSIC_SWING : undefined}
              />
            </figure>
            <figure className="card">
              <h3>Down the line</h3>
              <Diagram
                scene={scene}
                flight={flight}
                view="down-the-line"
                phase={phase}
                swing={tuning}
                ghost={ghost ? CLASSIC_SWING : undefined}
              />
            </figure>
          </div>

          <div className="strip-head">
            <h2>Through the ball</h2>
            <select
              value={stripView}
              onChange={(e) => setStripView(e.target.value as CameraPreset)}
            >
              <option value="face-on">Face-on</option>
              <option value="down-the-line">Down the line</option>
            </select>
          </div>
          {(
            [
              ["Tuned", tuning],
              ["Classic", CLASSIC_SWING],
            ] as const
          ).map(([name, swing]) => (
            <div key={name} className="strip">
              <span className="strip-label">{name}</span>
              {STRIP.map((p) => (
                <button
                  key={p}
                  className="frame"
                  aria-label={`Show phase ${p}`}
                  onClick={() => setPhase(p)}
                >
                  <Diagram
                    scene={scene}
                    flight={flight}
                    view={stripView}
                    phase={p}
                    swing={swing}
                    width={300}
                    height={300}
                  />
                  <span>{p.toFixed(2)}</span>
                </button>
              ))}
            </div>
          ))}
        </section>

        <aside className="pg-tune">
          <div className="row">
            <select
              aria-label="Load a preset"
              value=""
              onChange={(e) => {
                const preset = PRESETS[e.target.value];
                if (preset) setTuning(clone(preset));
              }}
            >
              <option value="">Load preset…</option>
              {Object.keys(PRESETS).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <button onClick={copy}>{copied ? "Copied ✓" : "Copy JSON"}</button>
          </div>

          <h2>Body</h2>
          {KNOBS.map((k) => (
            <label key={k.key} className="knob">
              <span>
                {k.label} <b>{tuning[k.key]}</b>
              </span>
              <input
                type="range"
                min={k.min}
                max={k.max}
                step={k.step}
                value={tuning[k.key]}
                onChange={(e) => setKnob(k.key, Number(e.target.value))}
              />
            </label>
          ))}
          <label className="knob">
            <span>Interpolation</span>
            <select
              value={tuning.interpolation}
              onChange={(e) =>
                setTuning((t) => ({ ...t, interpolation: e.target.value as "spline" }))
              }
            >
              <option value="spline">Spline (eases through keys)</option>
              <option value="smoothstep">Smoothstep (stops at each key)</option>
            </select>
          </label>

          <h2>Keyframes</h2>
          <p className="hint">
            {CHANNELS.map((c) => (
              <span key={c}>
                <b>{c}</b>: {CHANNEL_HELP[c]}
                <br />
              </span>
            ))}
          </p>
          <div className="keys">
            <table>
              <thead>
                <tr>
                  <th>p</th>
                  {CHANNELS.map((c) => (
                    <th key={c} title={CHANNEL_HELP[c]}>
                      {c}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {tuning.keys.map((k, i) => (
                  <tr key={i} className={Math.abs(k.p - phase) < 0.01 ? "near" : undefined}>
                    <td>
                      <input
                        type="number"
                        step={0.01}
                        min={0}
                        max={1}
                        value={k.p}
                        disabled={LOCKED.has(k.p)}
                        onChange={(e) => setKey(i, "p", Number(e.target.value))}
                        onFocus={() => setPhase(k.p)}
                      />
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c}>
                        <input
                          type="number"
                          step={0.05}
                          value={k[c]}
                          onChange={(e) => setKey(i, c, Number(e.target.value))}
                          onFocus={() => setPhase(k.p)}
                        />
                      </td>
                    ))}
                    <td className="ops">
                      {i < tuning.keys.length - 1 && (
                        <button title="Add a key after this one" onClick={() => addKey(i)}>
                          +
                        </button>
                      )}
                      {!LOCKED.has(k.p) && (
                        <button title="Remove this key" onClick={() => removeKey(i)}>
                          −
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Tuning JSON</summary>
            <pre>{json}</pre>
          </details>
        </aside>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
