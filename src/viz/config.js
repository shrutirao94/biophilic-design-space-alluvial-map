// src/viz/config.js

export const AXES = [
  "Concept Cluster",
  "Level of Mediation",
  "Interaction Type",
  "Spatial Context",
  "Sensory Modality",
  "Temporal Behaviour",
  "Natural Reference",
  "Affective Aim",
];

export const AXIS_DESCRIPTORS = {
  "Concept Cluster": "design concept",
  "Sensory Modality": "sensed through",
  "Interaction Type": "how engaged",
  "Affective Aim": "felt goal",
  "Natural Reference": "what in nature",
  "Temporal Behaviour": "how it changes",
  "Level of Mediation": "how produced",
  "Spatial Context": "where situated",
};

export const FIG = {
  width: 2400,
  height: 1050,
  // Increased right + bottom margins:
  // - right: prevents truncation of Affective Aim labels (on the right side)
  // - bottom: creates a true bottom “label band” so axis titles/descriptors don’t compete with dense lines
  margin: { top: 60, right: 80, bottom: 60, left: 80 },
  axisPaddingX: 36,
  nodeWidth: 14,
  nodePadding: 6,
};

// Keep affect colours available (for optional colorBy="Affective Aim")
export const COLORS = {
  "Aliveness": "#5E8C61",
  "Curiosity / Gentle Fascination": "#9DA44E",
  "Playfulness / Light Delight": "#D1A24C",
  "Calm": "#6C8FA3",
  "Mental Reset": "#5E9EA0",
  "Comfort / Safety": "#8A9BA8",
  "Empathy": "#C07A5A",
  "Authenticity / Groundedness": "#8B6F47",
  "Socialness": "#8C6A8D",
};

// Bright, distinct cluster colours (DC1–DC6)
// NOTE: preprocess normalises C0..C5 -> DC1..DC6
export const CLUSTER_COLORS = {
  DC1: "#007AFF", // blue
  DC2: "#FF3B30", // red
  DC3: "#34C759", // green
  DC4: "#FFCC00", // yellow
  DC5: "#AF52DE", // purple
  DC6: "#FF9500", // orange
};

export const RIBBON = {
  opacity: 0.35,
  opacityHover: 0.85,
  opacityDim: 0.08,
};

export const TYPE = {
  titleSize: 22,
  subtitleSize: 14,

  // Your bottom axis band is now “quiet”; render.js can override fill/opacity,
  // but keeping sizes sensible helps avoid crowding.
  axisTitleSize: 15,
  axisDescSize: 11,

  nodeLabelSize: 14,
  countSize: 11,
};

export const LABELS = {
  nodeTextDx: 6,
};

// Render settings (flip these without touching render.js)
export const RENDER = {
  mode: "parallel",               // "parallel" | "alluvial"
  colorBy: "Concept Cluster",      // "Concept Cluster" | "Affective Aim"
};

// Parallel styling
export const PARALLEL = {
  strokeOpacity: 0.25,
  strokeWidth: 1.5,
  curveAlpha: 0.65,

  glow: true,
  glowWidth: 3.2,
  glowOpacity: 0.07,

  // Optional (render.js will use if present)
  emergeDx: 52,
  jitterR: 5,
};

