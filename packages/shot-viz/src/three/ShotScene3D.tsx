import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import { cameraPreset, handedCamera, type Camera } from "../core/camera.ts";
import { BALL_RADIUS } from "../core/clubs.ts";
import { describeScene } from "../core/describe.ts";
import { ballAt, computeFlight, type FlightResult } from "../core/flight.ts";
import { BONES, poseGolfer, type Joint, type Pose } from "../core/pose.ts";
import { cameraPresets, type CameraPreset, type ShotScene } from "../core/schema.ts";
import { groundHeight } from "../core/terrain.ts";
import { timelineAt, timelineDuration } from "../core/timeline.ts";
import { DEG, rotate, type Vec3 } from "../core/vec.ts";
import { defaultTheme } from "../2d/shapes.ts";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.ts";

export interface ShotScene3DProps {
  scene: ShotScene;
  /** Starting camera; defaults to the scene's camera. */
  view?: CameraPreset;
  /** Play the swing and flight on mount (ignored when the reader prefers reduced motion). */
  autoPlay?: boolean;
  className?: string;
  style?: CSSProperties;
}

const PRESET_LABELS: Record<CameraPreset, string> = {
  "face-on": "Face-on",
  "down-the-line": "Down the line",
  behind: "Behind",
  overhead: "Overhead",
};

const theme = defaultTheme;
const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Interactive 3D shot view: orbit, camera presets, and an animated swing and ball flight. */
export default function ShotScene3D({
  scene,
  view,
  autoPlay = true,
  className,
  style,
}: ShotScene3DProps) {
  const reducedMotion = usePrefersReducedMotion();
  const flight = useMemo(() => computeFlight(scene), [scene]);
  const [preset, setPreset] = useState<{ name: CameraPreset; n: number }>({
    name: view ?? scene.camera,
    n: 0,
  });
  const [playing, setPlaying] = useState({ on: autoPlay && !reducedMotion, n: 0 });
  const descId = useId();

  useEffect(() => setPreset({ name: view ?? scene.camera, n: 0 }), [scene, view]);
  useEffect(
    () => setPlaying({ on: autoPlay && !reducedMotion, n: 0 }),
    [scene, autoPlay, reducedMotion],
  );

  const initial = handedCamera(scene, cameraPreset(preset.name, flight));
  const mirror = scene.golfer.handedness === "left";

  return (
    <figure className={className} style={{ margin: 0, ...style }} aria-describedby={descId}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: theme.sky }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: initial.fov, position: initial.position, near: 0.05, far: 2000 }}
        >
          <color attach="background" args={[theme.sky]} />
          <fog attach="fog" args={[theme.sky, 120, 600]} />
          <hemisphereLight args={["#ffffff", "#3d5c2a", 1.1]} />
          <directionalLight
            position={[-4, 9, 6]}
            intensity={2}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
          />
          <group scale={[1, 1, mirror ? -1 : 1]}>
            <Ground scene={scene} flight={flight} />
            <Annotations scene={scene} flight={flight} />
            <Shot
              scene={scene}
              flight={flight}
              playing={playing}
              onDone={() => setPlaying((p) => ({ ...p, on: false }))}
            />
          </group>
          <CameraRig scene={scene} flight={flight} preset={preset} reducedMotion={reducedMotion} />
        </Canvas>
        {scene.flight.wind && scene.flight.wind.speed > 0 && (
          <div style={windBadge}>Wind {Math.round(scene.flight.wind.speed * 2.237)} mph</div>
        )}
      </div>
      <div style={toolbar}>
        {cameraPresets.map((name) => (
          <button
            key={name}
            type="button"
            style={button(preset.name === name)}
            aria-pressed={preset.name === name}
            onClick={() => setPreset((p) => ({ name, n: p.n + 1 }))}
          >
            {PRESET_LABELS[name]}
          </button>
        ))}
        <button
          type="button"
          style={button(false)}
          onClick={() => setPlaying((p) => ({ on: true, n: p.n + 1 }))}
        >
          {playing.on ? "Restart" : "Play swing"}
        </button>
      </div>
      <figcaption id={descId} style={visuallyHidden}>
        {describeScene(scene, flight)} Drag to orbit, pinch or scroll to zoom.
      </figcaption>
    </figure>
  );
}

function Ground({ scene, flight }: { scene: ShotScene; flight: FlightResult }) {
  const geometry = useMemo(() => {
    const reach = Math.max(30, Math.hypot(flight.rest[0], flight.rest[2]));
    const xs = axis(-40, reach + 60, 0.4);
    const zs = axis(-Math.max(40, reach * 0.5), Math.max(40, reach * 0.5), 0.4);
    const positions: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    for (const z of zs) {
      for (const x of xs) {
        positions.push(x, groundHeight(scene.terrain, x, z), z);
        const near = Math.hypot(x, z) < 2.2;
        const lie = scene.terrain.lie;
        c.set(
          near && lie === "bunker"
            ? theme.sand
            : near && lie === "rough"
              ? theme.rough
              : near && (lie === "green" || lie === "fringe")
                ? theme.green
                : Math.abs(z) > 15
                  ? theme.rough
                  : theme.fairway,
        );
        // Mowing stripes for a sense of scale and direction.
        const stripe = Math.floor(x / 6) % 2 === 0 ? 1 : 0.93;
        colors.push(c.r * stripe, c.g * stripe, c.b * stripe);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < zs.length - 1; j++) {
      for (let i = 0; i < xs.length - 1; i++) {
        const a = j * xs.length + i;
        const b = a + 1;
        const d = a + xs.length;
        const e = d + 1;
        index.push(a, d, b, b, d, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [scene, flight]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

/** Fine spacing within ±8 m of the ball, then steps growing with distance. */
function axis(min: number, max: number, fine: number): number[] {
  const out: number[] = [];
  let v = min;
  while (v < max) {
    out.push(v);
    const d = Math.abs(v);
    v += d < 8 ? fine : Math.min(12, fine + (d - 8) * 0.15);
  }
  out.push(max);
  return out;
}

function Annotations({ scene, flight }: { scene: ShotScene; flight: FlightResult }) {
  const reach = Math.max(25, Math.hypot(flight.rest[0], flight.rest[2]));
  const along = (dir: Vec3, len: number): Vec3[] =>
    Array.from({ length: 41 }, (_, i) => {
      const x = (dir[0] * len * i) / 40;
      const z = (dir[2] * len * i) / 40;
      return [x, groundHeight(scene.terrain, x, z) + 0.02, z];
    });
  return (
    <>
      {scene.annotations.map((a, i) => {
        if (a.type === "target-line") {
          const pts = along([1, 0, 0], reach);
          return (
            <Line
              key={i}
              points={pts}
              color={theme.annotation}
              lineWidth={2}
              dashed
              dashSize={1}
              gapSize={0.6}
            />
          );
        }
        if (a.type === "aim-line") {
          const pts = along(rotate([1, 0, 0], [0, 1, 0], -scene.golfer.aim * DEG), reach);
          return (
            <group key={i}>
              <Line
                points={pts}
                color={theme.aim}
                lineWidth={2.5}
                dashed
                dashSize={1}
                gapSize={0.6}
              />
              <Html position={pts[6]} center style={labelStyle}>
                {a.label ?? "Aim"}
              </Html>
            </group>
          );
        }
        if (a.type === "arrow") {
          return <Line key={i} points={[a.from, a.to]} color={theme.aim} lineWidth={3} />;
        }
        return null;
      })}
    </>
  );
}

function Shot({
  scene,
  flight,
  playing,
  onDone,
}: {
  scene: ShotScene;
  flight: FlightResult;
  playing: { on: boolean; n: number };
  onDone: () => void;
}) {
  const clock = useRef(0);
  const golfer = useRef<Mannequin>(null);
  const ball = useRef<THREE.Mesh>(null);
  const trail = useRef<ComponentRef<typeof Line>>(null);
  const path = useMemo(() => [...flight.air, ...flight.roll.slice(1)], [flight]);
  const duration = timelineDuration(flight);
  const showShoulders = scene.annotations.some((a) => a.type === "shoulder-line");

  // Idle state: address pose with the whole flight drawn (also the reduced-motion view).
  useEffect(() => {
    clock.current = playing.on ? 0 : -1;
  }, [playing]);

  useFrame((_, dt) => {
    let phase = 0;
    let ballTime = Infinity;
    if (clock.current >= 0) {
      clock.current += Math.min(dt, 0.05);
      const state = timelineAt(clock.current);
      phase = state.phase;
      ballTime = state.ballTime;
      if (clock.current > duration) {
        clock.current = -1;
        onDone();
      }
    }
    const pose = poseGolfer(scene, phase);
    golfer.current?.update(pose);
    const p = ballTime < 0 ? flight.air[0]!.p : ballAt(flight, ballTime);
    ball.current?.position.set(p[0], p[1], p[2]);
    if (trail.current) {
      const count =
        ballTime === Infinity ? path.length : path.filter((pt) => pt.t <= ballTime).length;
      (trail.current.geometry as THREE.InstancedBufferGeometry).instanceCount = Math.max(
        0,
        count - 1,
      );
    }
  });

  return (
    <>
      <MannequinMesh ref={golfer} showShoulders={showShoulders} />
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_RADIUS * 1.6, 16, 12]} />
        <meshStandardMaterial color={theme.ball} roughness={0.4} />
      </mesh>
      <Line
        ref={trail}
        points={path.map((pt) => pt.p as [number, number, number])}
        color={theme.flight}
        lineWidth={3}
      />
    </>
  );
}

interface Mannequin {
  update(pose: Pose): void;
}

const LIMB_RADIUS: Partial<Record<Joint, number>> = {
  neck: 0.13,
  leadKnee: 0.065,
  trailKnee: 0.065,
  leadAnkle: 0.05,
  trailAnkle: 0.05,
  leadElbow: 0.045,
  trailElbow: 0.045,
  leadHand: 0.038,
  trailHand: 0.038,
  leadToe: 0.04,
  trailToe: 0.04,
};

function limbColour(b: Joint): string {
  if (b.includes("Toe")) return theme.shoes;
  if (b.includes("Hand")) return theme.skin;
  if (b.includes("Elbow") || b === "neck" || b.includes("Shoulder")) return theme.shirt;
  return theme.trousers;
}

const cylinder = new THREE.CylinderGeometry(1, 1, 1, 14);
const sphere = new THREE.SphereGeometry(1, 16, 12);

/** A stylised mannequin: capsules between joints, posed imperatively each frame. */
function MannequinMesh({
  ref,
  showShoulders,
}: {
  ref: React.Ref<Mannequin>;
  showShoulders: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (c: string) => {
      if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
      return mats.get(c)!;
    };
    const limbs = BONES.map(([a, b]) => {
      const r = LIMB_RADIUS[b] ?? (b.includes("Shoulder") ? 0.06 : b.includes("Hip") ? 0.09 : 0.06);
      const m = new THREE.Mesh(cylinder, mat(limbColour(b)));
      const cap = new THREE.Mesh(sphere, mat(limbColour(b)));
      cap.scale.setScalar(r);
      m.castShadow = cap.castShadow = true;
      return { a, b, r, m, cap };
    });
    const head = new THREE.Mesh(sphere, mat(theme.skin));
    head.castShadow = true;
    const shaft = new THREE.Mesh(cylinder, mat(theme.shaft));
    const clubhead = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(theme.clubhead));
    shaft.castShadow = clubhead.castShadow = true;
    const shoulderLine = new THREE.Mesh(
      cylinder,
      new THREE.MeshBasicMaterial({ color: theme.aim }),
    );
    shoulderLine.visible = showShoulders;
    return { limbs, head, shaft, clubhead, shoulderLine, mats };
  }, [showShoulders]);

  useEffect(() => {
    const g = group.current!;
    for (const l of parts.limbs) g.add(l.m, l.cap);
    g.add(parts.head, parts.shaft, parts.clubhead, parts.shoulderLine);
    return () => {
      g.clear();
      parts.mats.forEach((m) => m.dispose());
    };
  }, [parts]);

  const api = useMemo<Mannequin>(
    () => ({
      update(pose) {
        for (const l of parts.limbs) {
          placeCylinder(l.m, pose.joints[l.a], pose.joints[l.b], l.r);
          l.cap.position.set(...pose.joints[l.b]);
        }
        parts.head.position.set(...pose.joints.head);
        parts.head.scale.setScalar(pose.headRadius);
        placeCylinder(parts.shaft, pose.club.grip, pose.club.hosel, 0.007);
        // Clubhead: a small box from hosel to toe.
        placeCylinder(parts.clubhead, pose.club.hosel, pose.club.toe, 1);
        parts.clubhead.scale.set(0.035, parts.clubhead.scale.y, 0.05);
        const ls = pose.joints.leadShoulder;
        const ts = pose.joints.trailShoulder;
        const ext = (p: Vec3, q: Vec3, k: number): Vec3 => [
          p[0] + (p[0] - q[0]) * k,
          p[1] + (p[1] - q[1]) * k,
          p[2] + (p[2] - q[2]) * k,
        ];
        placeCylinder(parts.shoulderLine, ext(ts, ls, 1), ext(ls, ts, 1), 0.008);
      },
    }),
    [parts],
  );
  useEffect(() => {
    if (typeof ref === "function") ref(api);
    else if (ref) (ref as React.RefObject<Mannequin | null>).current = api;
  }, [api, ref]);
  return <group ref={group} />;
}

function placeCylinder(mesh: THREE.Object3D, a: Vec3, b: Vec3, radius: number) {
  tmpA.set(...a);
  tmpB.set(...b);
  const len = tmpA.distanceTo(tmpB);
  mesh.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
  tmpB.sub(tmpA).normalize();
  mesh.quaternion.setFromUnitVectors(UP, tmpB);
  mesh.scale.set(radius, Math.max(len, 1e-4), radius);
}

function CameraRig({
  scene,
  flight,
  preset,
  reducedMotion,
}: {
  scene: ShotScene;
  flight: FlightResult;
  preset: { name: CameraPreset; n: number };
  reducedMotion: boolean;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const anim = useRef<{ from: Camera; to: Camera; t: number } | null>(null);

  useEffect(() => {
    const to = handedCamera(scene, cameraPreset(preset.name, flight));
    const c = controls.current;
    if (!c) return;
    const persp = camera as THREE.PerspectiveCamera;
    const from: Camera = {
      position: camera.position.toArray() as unknown as Vec3,
      target: c.target.toArray() as unknown as Vec3,
      up: camera.up.toArray() as unknown as Vec3,
      fov: persp.fov,
    };
    if (reducedMotion || preset.n === 0) {
      apply(to);
      anim.current = null;
    } else {
      anim.current = { from, to, t: 0 };
    }
    function apply(cam: Camera) {
      camera.position.set(...cam.position);
      camera.up.set(...cam.up);
      persp.fov = cam.fov;
      persp.updateProjectionMatrix();
      c!.target.set(...cam.target);
      c!.update();
    }
  }, [preset, scene, flight, camera, reducedMotion]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 0.8);
    const k = a.t * a.t * (3 - 2 * a.t);
    const mixv = (p: Vec3, q: Vec3) =>
      [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k] as const;
    camera.position.set(...mixv(a.from.position, a.to.position));
    camera.up.set(...mixv(a.from.up, a.to.up)).normalize();
    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = a.from.fov + (a.to.fov - a.from.fov) * k;
    persp.updateProjectionMatrix();
    c.target.set(...mixv(a.from.target, a.to.target));
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reducedMotion}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
}

const toolbar: CSSProperties = {
  padding: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const button = (active: boolean): CSSProperties => ({
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #1f2933",
  background: active ? "#1f2933" : "rgba(255,255,255,0.92)",
  color: active ? "#fff" : "#1f2933",
  font: "600 14px system-ui, sans-serif",
  cursor: "pointer",
});

const windBadge: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.92)",
  font: "600 14px system-ui, sans-serif",
};

const labelStyle: CSSProperties = {
  font: "600 12px system-ui, sans-serif",
  background: "rgba(255,255,255,0.9)",
  padding: "2px 6px",
  borderRadius: 6,
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};
