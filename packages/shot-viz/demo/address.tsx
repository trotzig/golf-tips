// Address playground: ball position, weight and stance in one top-down figure, compared with a
// normal shot with the same club (dashed). Try every scene, both hands, light and dark, and
// override the golfer's values to see how the figure reads at the extremes. The geometry and the
// heading come from src/core/address.ts, shared with the site and the app.
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ADDRESS_H,
  ADDRESS_W,
  addressLayout,
  addressSummary,
  exampleScenes,
  footPath,
  parseScene,
  setupInsight,
  stanceWidths,
  type ShotScene,
} from "../src/index.ts";

type WeightStyle = "shade" | "marker" | "both";

/**
 * The figure from `addressLayout`, as the site and the app draw it, with the weight shown as
 * shaded feet, the balance marker or both.
 */
function AddressFigure({
  scene,
  mirror,
  weightStyle,
}: {
  scene: ShotScene;
  mirror: boolean;
  weightStyle: WeightStyle;
}) {
  const i = setupInsight(scene);
  const l = addressLayout(i, mirror);
  const { y, h } = l.foot;

  return (
    <svg
      className="addr"
      viewBox={`0 0 ${ADDRESS_W} ${ADDRESS_H}`}
      role="img"
      aria-label={addressSummary(i)}
    >
      <line
        x1={l.line.x1}
        y1={l.ballY}
        x2={l.line.x2}
        y2={l.ballY}
        className="s-line"
        strokeWidth={1.4}
        strokeDasharray="2 4"
      />
      <text
        x={l.target.x}
        y={l.ballY - 9}
        textAnchor={l.target.anchor}
        fontSize={11}
        fontWeight={600}
        className="f-accent"
      >
        {l.target.text}
      </text>
      {l.normalFeet.map((x) => (
        <path
          key={x}
          d={footPath(x, y, h)}
          fill="none"
          className="s-line"
          strokeWidth={1.4}
          strokeDasharray="3 2"
        />
      ))}
      {l.feet.map((f) => (
        <g key={f.label}>
          <path d={footPath(f.x, y, h)} className="f-card s-ink" strokeWidth={1.8} />
          {weightStyle !== "marker" && (
            <path d={footPath(f.x, y, h)} className="f-accent" fillOpacity={f.shade} />
          )}
          <text x={f.x} y={l.labelY} textAnchor="middle" fontSize={11} className="f-muted">
            {f.label}
          </text>
        </g>
      ))}
      <line
        x1={l.ball}
        y1={l.guide.y1}
        x2={l.ball}
        y2={l.guide.y2}
        className="s-ink"
        strokeWidth={1}
        strokeDasharray="1 3"
      />
      <circle
        cx={l.normalBall}
        cy={l.ballY}
        r={8}
        fill="none"
        className="s-line"
        strokeWidth={1.6}
        strokeDasharray="3 2"
      />
      <circle cx={l.ball} cy={l.ballY} r={8} className="f-card s-ink" strokeWidth={2} />
      {weightStyle !== "shade" && (
        <>
          <line
            x1={l.balance.x1}
            y1={l.balance.y}
            x2={l.balance.x2}
            y2={l.balance.y}
            className="s-line"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line
            x1={l.balance.centre}
            y1={l.balance.y - 4}
            x2={l.balance.centre}
            y2={l.balance.y + 4}
            className="s-line"
            strokeWidth={1.4}
          />
          <path d={l.balance.pointer} className="f-accent" />
        </>
      )}
    </svg>
  );
}

/** Card as it would sit on a situation page: heading, one-line summary, figure. */
function Card(props: { scene: ShotScene; mirror: boolean; weightStyle: WeightStyle }) {
  const i = setupInsight(props.scene);
  return (
    <div className="card">
      <h3>Address</h3>
      <p className="value">{addressSummary(i)}</p>
      <AddressFigure {...props} />
    </div>
  );
}

const SCENE_IDS = Object.keys(exampleScenes).sort();

function App() {
  const [id, setId] = useState("downhill-lie");
  const [mirror, setMirror] = useState(false);
  const [dark, setDark] = useState(false);
  const [weightStyle, setWeightStyle] = useState<WeightStyle>("both");
  const [ball, setBall] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [stance, setStance] = useState<(typeof stanceWidths)[number] | null>(null);

  const base = exampleScenes[id]!;
  const scene = useMemo(
    () =>
      parseScene({
        ...base,
        golfer: {
          ...base.golfer,
          ...(ball !== null && { ballPosition: ball }),
          ...(weight !== null && { weightLead: weight }),
          ...(stance !== null && { stanceWidth: stance }),
        },
      }),
    [base, ball, weight, stance],
  );
  const { setup } = setupInsight(scene);
  const reset = () => {
    setBall(null);
    setWeight(null);
    setStance(null);
  };

  return (
    <div className={`ad ${dark ? "dark" : ""}`}>
      <header className="ad-head">
        <h1>Address playground</h1>
        <p>
          Ball position, weight and stance in one figure. Dashed: a normal shot with the same club.
        </p>
        <div className="controls">
          <label>
            Scene{" "}
            <select
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                reset();
              }}
            >
              {SCENE_IDS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Weight shown as{" "}
            <select
              value={weightStyle}
              onChange={(e) => setWeightStyle(e.target.value as WeightStyle)}
            >
              <option value="both">Shaded feet + balance marker</option>
              <option value="shade">Shaded feet</option>
              <option value="marker">Balance marker</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />{" "}
            Left-handed
          </label>
          <label>
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{" "}
            Dark
          </label>
        </div>
      </header>

      <section className="ad-main">
        <div className="phone">
          <Card scene={scene} mirror={mirror} weightStyle={weightStyle} />
        </div>
        <div className="knobs">
          <h2>Override the golfer</h2>
          <label>
            Ball position <code>{setup.ballPosition.toFixed(2)}</code>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={setup.ballPosition}
              onChange={(e) => setBall(+e.target.value)}
            />
            <small>−1 trail foot · 0 centre · 1 lead foot</small>
          </label>
          <label>
            Weight on lead foot <code>{Math.round(setup.weightLead * 100)}%</code>
            <input
              type="range"
              min={0.2}
              max={0.8}
              step={0.01}
              value={setup.weightLead}
              onChange={(e) => setWeight(+e.target.value)}
            />
          </label>
          <label>
            Stance{" "}
            <select
              value={stance ?? scene.golfer.stanceWidth}
              onChange={(e) => setStance(e.target.value as (typeof stanceWidths)[number])}
            >
              {stanceWidths.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={reset}>
            Reset to scene
          </button>
        </div>
      </section>

      <h2>Every scene</h2>
      <div className="all">
        {SCENE_IDS.map((s) => (
          <div key={s}>
            <p className="id">{s}</p>
            <Card scene={exampleScenes[s]!} mirror={mirror} weightStyle={weightStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
