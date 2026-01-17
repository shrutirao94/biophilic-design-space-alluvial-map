// src/viz/preprocess.js
import { RENDER } from "./config.js";
import { reduceCrossings } from "./ordering.js";

function nodeId(axis, label) {
  return `${axis}::${label}`;
}

function dominantKey(obj) {
  let best = null;
  let bestV = -Infinity;
  for (const [k, v] of Object.entries(obj || {})) {
    if (v > bestV) {
      best = k;
      bestV = v;
    }
  }
  return best;
}

/**
 * Normalise Concept Cluster labels so nodes/links use DC1..DC6 consistently.
 *
 * Supported inputs:
 * - "DC1".."DC6" -> unchanged
 * - legacy "C0".."C5" -> DC1..DC6  (add 1)
 * - legacy "C1".."C6" -> DC1..DC6  (unchanged index)
 * - anything else -> returned as-is (trimmed)
 */
function normConceptCluster(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  // Already in desired form: DC1..DC6 (or beyond)
  const mDC = s.match(/^DC(\d+)$/i);
  if (mDC) return `DC${Number(mDC[1])}`;

  // Legacy: C0..C5  -> DC1..DC6
  const mC0 = s.match(/^C(\d+)$/i);
  if (mC0) {
    const n = Number(mC0[1]);
    // If it was truly C0-based, map 0.. -> +1
    // If it was 1-based already, we can keep it stable by checking 0 specifically.
    if (n === 0) return "DC1";
    // Heuristic:
    // - if n is between 0 and 5 inclusive, assume 0-based and +1
    // - if n is between 1 and 6 inclusive, assume 1-based and keep
    if (n >= 0 && n <= 5) return `DC${n + 1}`;
    if (n >= 1 && n <= 6) return `DC${n}`;
    // otherwise: still map to DCn for consistency
    return `DC${n}`;
  }

  return s;
}

// Treat blanks as explicit bucket (safe even if you rarely use it)
const MISSING_LABEL = "Missing";

function normLabel(axis, raw) {
  let label = String(raw ?? "").trim();
  if (axis === "Design-Concept") label = normConceptCluster(label);
  return label || MISSING_LABEL;
}

export function preprocess(rows, { axes }) {
  // ----------------------------
  // 1) Node totals per axis/label
  // ----------------------------
  const totals = new Map(); // nodeId -> count

  for (const r of rows) {
    for (const axis of axes) {
      const label = normLabel(axis, r[axis]);
      const id = nodeId(axis, label);
      totals.set(id, (totals.get(id) || 0) + 1);
    }
  }

  // ----------------------------
  // 2) Initial per-axis category order
  //    - Concept Cluster fixed (DC1..DC6)
  //    - others by frequency desc
  //    - Missing last (if present)
  // ----------------------------
  const SEQ_DC = ["DC1", "DC2", "DC3", "DC4", "DC5", "DC6"];

  const axisInfo = axes.map((axis, index) => {
    const totalsByCategory = new Map();

    for (const [id, v] of totals.entries()) {
      const [a, label] = id.split("::");
      if (a !== axis) continue;
      totalsByCategory.set(label, v);
    }

    const missingCount = totalsByCategory.get(MISSING_LABEL) || 0;

    let categories;
    if (axis === "Design-Concept") {
      // Keep DC1..DC6 in canonical order if present
      categories = SEQ_DC.filter(dc => totalsByCategory.has(dc));

      // Any other clusters (e.g., DC7) appear after, sorted
      const extras = [...totalsByCategory.keys()]
        .filter(l => !SEQ_DC.includes(l) && l !== MISSING_LABEL)
        .sort((a, b) => {
          // Sort DC-like labels numerically if possible; otherwise lexicographically
          const ma = String(a).match(/^DC(\d+)$/i);
          const mb = String(b).match(/^DC(\d+)$/i);
          if (ma && mb) return Number(ma[1]) - Number(mb[1]);
          if (ma) return -1;
          if (mb) return 1;
          return String(a).localeCompare(String(b));
        });

      categories = categories.concat(extras);
    } else {
      categories = [...totalsByCategory.entries()]
        .filter(([label]) => label !== MISSING_LABEL)
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);
    }

    if (missingCount > 0 && !categories.includes(MISSING_LABEL)) {
      categories.push(MISSING_LABEL);
    }

    return { axis, index, categories, totalsByCategory };
  });

  // ----------------------------
  // 3) Aggregated links between adjacent axes
  // ----------------------------
  const colorCol = RENDER?.colorBy || "Design-Concept";
  const linkAgg = new Map(); // k -> {source,target,value,byCluster:Map}

  for (const r of rows) {
    let clusterKey = String(r[colorCol] ?? "").trim();
    if (colorCol === "Design-Concept") clusterKey = normConceptCluster(clusterKey);
    clusterKey = clusterKey || MISSING_LABEL;

    for (let i = 0; i < axes.length - 1; i++) {
      const a0 = axes[i];
      const a1 = axes[i + 1];

      const v0 = normLabel(a0, r[a0]);
      const v1 = normLabel(a1, r[a1]);

      const s = nodeId(a0, v0);
      const t = nodeId(a1, v1);
      const k = `${s}-->${t}`;

      if (!linkAgg.has(k)) {
        linkAgg.set(k, { source: s, target: t, value: 0, byCluster: new Map() });
      }
      const obj = linkAgg.get(k);

      obj.value += 1;
      obj.byCluster.set(clusterKey, (obj.byCluster.get(clusterKey) || 0) + 1);
    }
  }

  // ----------------------------
  // 4) Crossing reduction (mutates axisInfo.categories in place)
  //    Concept Cluster remains locked.
  // ----------------------------
  reduceCrossings(axisInfo, linkAgg, {
    lockAxisName: "Design-Concept",
    missingLabel: MISSING_LABEL,
    iterations: 6,
  });

  // ----------------------------
  // 5) Nodes (after reordering)
  // ----------------------------
  const nodes = [];
  for (const a of axisInfo) {
    a.categories.forEach((label, order) => {
      nodes.push({
        id: nodeId(a.axis, label),
        axis: a.axis,
        label,
        index: a.index,
        order,
        value: a.totalsByCategory.get(label) || 0,
      });
    });
  }

  // ----------------------------
  // 6) Links (materialise)
  // ----------------------------
  const links = [...linkAgg.values()].map((d) => {
    const byCluster = Object.fromEntries(d.byCluster.entries());
    return {
      source: d.source,
      target: d.target,
      value: d.value,
      byCluster,
      cluster: dominantKey(byCluster),
    };
  });

  return { nodes, links, axisInfo };
}

