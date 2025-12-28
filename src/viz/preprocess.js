// src/viz/preprocess.js
import { RENDER } from "./config.js";

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

// Normalise Concept Cluster labels so nodes/links use DC1..DC6 consistently
function normConceptCluster(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const m = s.match(/^C(\d+)$/i);
  if (m) return `DC${Number(m[1]) + 1}`;
  return s; // already DC*
}

// Treat blanks as an explicit bucket so every axis sums to total rows.
// This prevents "wasted space" (vertical slack) in layout.
const MISSING_LABEL = "Missing";

function normLabel(axis, raw) {
  let label = String(raw ?? "").trim();
  if (axis === "Concept Cluster") label = normConceptCluster(label);
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
  // 2) Per-axis category order
  //    - default: frequency desc
  //    - Concept Cluster: DC1..DC6 sequential
  //    - Missing goes LAST
  // ----------------------------
  const SEQ_DC = ["DC1", "DC2", "DC3", "DC4", "DC5", "DC6"];

  const axisInfo = axes.map((axis, index) => {
    const totalsByCategory = new Map();

    for (const [id, v] of totals.entries()) {
      const [a, label] = id.split("::");
      if (a !== axis) continue;
      totalsByCategory.set(label, v);
    }

    // Pull Missing out so we can append at end
    const missingCount = totalsByCategory.get(MISSING_LABEL) || 0;

    let categories;
    if (axis === "Concept Cluster") {
      // Sequential, but only include ones present in data
      categories = SEQ_DC.filter(dc => totalsByCategory.has(dc));

      // Append any unexpected labels (except Missing) alphabetically
      const extras = [...totalsByCategory.keys()]
        .filter(l => !SEQ_DC.includes(l) && l !== MISSING_LABEL)
        .sort();

      categories = categories.concat(extras);
    } else {
      categories = [...totalsByCategory.entries()]
        .filter(([label]) => label !== MISSING_LABEL)
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);
    }

    // Always append Missing at the end (if present)
    if (missingCount > 0 && !categories.includes(MISSING_LABEL)) {
      categories.push(MISSING_LABEL);
    }

    return { axis, index, categories, totalsByCategory };
  });

  // ----------------------------
  // 3) Nodes
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
  // 4) Aggregated links between adjacent axes
  //    Track byCluster (for alluvial colouring if desired)
  // ----------------------------
  const colorCol = RENDER?.colorBy || "Concept Cluster";

  const linkAgg = new Map(); // k -> {source,target,value,byCluster:Map}
  for (const r of rows) {
    let clusterKey = String(r[colorCol] ?? "").trim();
    if (colorCol === "Concept Cluster") clusterKey = normConceptCluster(clusterKey);
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

