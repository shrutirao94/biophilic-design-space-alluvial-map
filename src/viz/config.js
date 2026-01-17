// src/viz/config.js

export const AXES = [
  "Design-Concept",
  "Level of Mediation",
  "Interaction Type",
  "Spatial Context",
  "Sensory Modality",
  "Temporal Behaviour",
  "Natural Reference",
  "Affective Aim",
];

export const AXIS_DESCRIPTORS = {
  "Design-Concept": "",
  "Sensory Modality": "sensed through",
  "Interaction Type": "how engaged",
  "Affective Aim": "felt goal",
  "Natural Reference": "what in nature",
  "Temporal Behaviour": "how it changes",
  "Level of Mediation": "how produced",
  "Spatial Context": "where situated",
};

export const FIG = {
  // Print-first canvas for sidewaysfigure placement
  width: 2800,
  height: 1460,

  // Margins tuned for larger typography:
  // - bottom: provides a true label band for axis title + descriptor
  // - right/left: keeps edge labels from clipping
  margin: { top: 150, right: 220, bottom: 80, left: 120 },

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
  DC1: "#1b9e77", // blue
  DC2: "#d95f02", // red
  DC3: "#7570b3", // green
  DC4: "#e7298a", // yellow
  DC5: "#66a61e", // purple
  DC6: "#e6ab02", // orange
};

export const RIBBON = {
  opacity: 0.35,
  opacityHover: 0.85,
  opacityDim: 0.08,
};

// Typography (paper-first; tuned for sidewaysfigure)
export const TYPE = {
  // Figure header
  titleSize: 48,
  subtitleSize: 34,

  // Axis band (bottom)
  axisTitleSize: 30,
  axisDescSize: 20,

  // Node labels
  nodeLabelSize: 28,
  countSize: 18,
};

export const LABELS = {
  nodeTextDx: 1,
  rightLabelPad: 18,
};

// Render settings (flip these without touching render.js)
export const RENDER = {
  mode: "parallel",          // "parallel" | "alluvial"
  colorBy: "Design-Concept" // "Concept Cluster" | "Affective Aim"
};
// Parallel styling
export const PARALLEL = {
  blendMode: "normal",
  strokeOpacity: 0.35,
  strokeWidth: 1.1,
  curveAlpha: 0.9,

  glow: false,
  glowWidth: 3.2,
  glowOpacity: 0.07,

  aimLanes: true,
  aimLaneDx: 90,       // how early the lane starts before the final axis
  aimLaneJitter: 8,    // small deterministic vertical separation to avoid perfect overlap


  // Optional (render.js will use if present)
  emergeDx: 52,
  jitterR: 5,
};
//export const LABELS = {
  //nodeTextDx: 6,
  //rightLabelPad: 38,
//};
