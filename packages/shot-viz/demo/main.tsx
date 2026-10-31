import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  computeFlight,
  exampleSceneInputs,
  exampleScenes,
  timelineAt,
  timelineDuration,
  type ShotScene,
} from "../src/index.ts";
import { ShotDiagram } from "../src/web/index.ts";

function useHashScene(): [string, (id: string) => void] {
  const first = exampleSceneInputs[0]!.id;
  const read = () => (location.hash.slice(1) in exampleScenes ? location.hash.slice(1) : first);
  const [id, setId] = useState(read);
  useEffect(() => {
    const on = () => setId(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  });
  return [id, (next) => (location.hash = next)];
}

function App() {
  const [id, setId] = useHashScene();
  const [leftHanded, setLeftHanded] = useState(false);
  const base = exampleScenes[id]!;
  const scene: ShotScene = useMemo(
    () => ({ ...base, golfer: { ...base.golfer, handedness: leftHanded ? "left" : "right" } }),
    [base, leftHanded],
  );
  const flight = useMemo(() => computeFlight(scene), [scene]);
  // Curve shows best from above; everything else reads best from behind.
  const flightView = scene.camera === "overhead" ? "overhead" : "behind";
  const [phase, setPhase] = useState(0);
  const [ballTime, setBallTime] = useState(Infinity);
  const raf = useRef(0);

  useEffect(() => {
    setPhase(0);
    setBallTime(Infinity);
  }, [scene]);

  const play = () => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const end = timelineDuration(flight);
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const s = timelineAt(Math.min(t, end));
      setPhase(s.phase);
      setBallTime(t >= end ? Infinity : s.ballTime);
      if (t < end) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div className="layout">
      <nav aria-label="Example scenes">
        <h1>Shotbook · shot-viz</h1>
        {exampleSceneInputs.map((s) => (
          <button key={s.id} aria-current={s.id === id} onClick={() => setId(s.id)}>
            {s.title}
          </button>
        ))}
      </nav>
      <main>
        <h2>{scene.title}</h2>
        <p className="lede">{scene.description}</p>
        <div className="controls">
          <button onClick={play}>▶ Play swing</button>
          <label>
            Swing phase{" "}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={phase}
              onChange={(e) => {
                cancelAnimationFrame(raf.current);
                setPhase(Number(e.target.value));
                setBallTime(Infinity);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={leftHanded}
              onChange={(e) => setLeftHanded(e.target.checked)}
            />{" "}
            Left-handed
          </label>
        </div>
        {scene.tips.length > 0 && (
          <ul className="tips">
            {scene.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
        <div className="diagrams">
          <figure className="card" style={{ margin: 0 }}>
            <h3>Face-on</h3>
            <ShotDiagram
              scene={scene}
              flight={flight}
              view="face-on"
              phase={phase}
              ballTime={ballTime}
            />
          </figure>
          <figure className="card" style={{ margin: 0 }}>
            <h3>Down the line</h3>
            <ShotDiagram
              scene={scene}
              flight={flight}
              view="down-the-line"
              phase={phase}
              ballTime={ballTime}
            />
          </figure>
          <figure className="card wide" style={{ margin: 0 }}>
            <h3>{flightView === "overhead" ? "From above" : "Behind"} (ball flight)</h3>
            <ShotDiagram
              scene={scene}
              flight={flight}
              view={flightView}
              phase={phase}
              ballTime={ballTime}
              width={640}
              height={300}
            />
          </figure>
        </div>
        <details>
          <summary>Scene JSON</summary>
          <pre>
            {JSON.stringify(
              exampleSceneInputs.find((s) => s.id === id),
              null,
              2,
            )}
          </pre>
        </details>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
