// Web (React DOM) entry: the SVG diagram, plus a lazy wrapper so the 3D bundle (three.js) only
// loads when a 3D view is actually shown.
import { lazy } from "react";

export { ShotDiagram, type ShotDiagramProps } from "./ShotDiagram.tsx";
export const LazyShotScene3D = lazy(() => import("../three/ShotScene3D.tsx"));
export type { ShotScene3DProps } from "../three/ShotScene3D.tsx";
