import type { CSSProperties } from "react";

/** Types for the vendored React Bits CRTWarp (CRTWarp.jsx), as documented by React Bits. */
export type CRTWarpProps = {
  color?: string;
  backgroundColor?: string;
  lightMode?: boolean;
  mask?: "aperture" | "shadow" | "slot" | "none";
  speed?: number;
  variation?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  levels?: number;
  columns?: number;
  persistence?: number;
  curvature?: number;
  corners?: number;
  scanlineStrength?: number;
  scanlineFrequency?: number;
  maskStrength?: number;
  bloom?: number;
  bloomRadius?: number;
  rgbShift?: number;
  noise?: number;
  flicker?: number;
  interference?: number;
  vignette?: number;
  brightness?: number;
  intro?: boolean;
  mouseReact?: boolean;
  mouseStrength?: number;
  changeOnClick?: boolean;
  dpr?: number;
  fps?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
};

declare function CRTWarp(props: CRTWarpProps): React.JSX.Element;
export default CRTWarp;
