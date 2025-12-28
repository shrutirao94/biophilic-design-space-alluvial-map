// src/viz/layout.js
import { FIG } from "./config.js";

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/**
 * Compute node and link geometry.
 *
 * Key behaviour:
 * - In ALLUVIAL mode: uses one global px-per-count scale (kGlobal) so ribbon thickness is consistent.
 * - In PARALLEL mode: uses per-axis scaling (kAxis) so every axis fills the available height.
 */
export function computeLayout({ nodes, links, axisInfo, mode = "alluvial" }) {
  const { width, height, margin, nodePadding, axisPaddingX, nodeWidth } = FIG;

  const innerW = width - margin.left - margin.right - 2 * axisPaddingX;
  const innerH = height - margin.top - margin.bottom;

  // Total coded instances (rows) = sum of category totals on axis 0.
  const axis0 = axisInfo?.[0];
  const totalRows = axis0
    ? axis0.categories.reduce((s, c) => s + (axis0.totalsByCategory.get(c) || 0), 0)
    : 0;

  const safeTotal = totalRows > 0 ? totalRows : 1;

  // X positions per axis
  const axisGap = innerW / Math.max(1, axisInfo.length - 1);
  const axisX = axisInfo.map(a => margin.left + axisPaddingX + a.index * axisGap);

  // Group nodes
  const nodesByAxis = groupBy(nodes, d => d.index);
  const nodesById = new Map(nodes.map(n => [n.id, n]));

  // --- Compute kGlobal (needed for alluvial ribbon thickness consistency)
  const scaleCandidates = axisInfo.map(a => {
    const n = a.categories.length;
    const available = innerH - nodePadding * Math.max(0, n - 1);
    return available / safeTotal;
  });
  const kGlobal = Math.min(...scaleCandidates);

  // --- Assign node positions
  for (const a of axisInfo) {
    const axisNodes = (nodesByAxis.get(a.index) || [])
      .slice()
      .sort((p, q) => p.order - q.order);

    const n = axisNodes.length;
    const available = innerH - nodePadding * Math.max(0, n - 1);

    // In parallel mode, let each axis fill the full height (kAxis).
    // In alluvial mode, keep global k so ribbons are consistent.
    const kUse = (mode === "parallel") ? (available / safeTotal) : kGlobal;

    // In both modes, top-align rather than centring (prevents “floating”).
    // If you ever want centring back in alluvial, change yStart accordingly.
    const yStart = margin.top;

    let y = yStart;
    for (const node of axisNodes) {
      node.x0 = axisX[a.index] - nodeWidth / 2;
      node.x1 = axisX[a.index] + nodeWidth / 2;

      node.y0 = y;
      node.y1 = y + node.value * kUse;

      y = node.y1 + nodePadding;
    }
  }

  // --- Links (only meaningful for alluvial; harmless to compute regardless)
  const outByNode = new Map();
  const inByNode = new Map();

  const nodeOrder = (id) => nodesById.get(id)?.order ?? 0;
  const nodeAxisIndex = (id) => nodesById.get(id)?.index ?? 0;

  const linksSorted = (links || []).slice().sort((a, b) => {
    const ai = nodeAxisIndex(a.source);
    const bi = nodeAxisIndex(b.source);
    if (ai !== bi) return ai - bi;

    const as = nodeOrder(a.source), bs = nodeOrder(b.source);
    if (as !== bs) return as - bs;

    const at = nodeOrder(a.target), bt = nodeOrder(b.target);
    if (at !== bt) return at - bt;

    return (b.value ?? 0) - (a.value ?? 0);
  });

  for (const l of linksSorted) {
    const s = nodesById.get(l.source);
    const t = nodesById.get(l.target);
    if (!s || !t) continue;

    // IMPORTANT: always use kGlobal for ribbon thickness consistency
    const thickness = (l.value ?? 0) * kGlobal;

    const so = outByNode.get(s.id) || 0;
    const ti = inByNode.get(t.id) || 0;

    l.x0 = s.x1;
    l.x1 = t.x0;

    l.y0a = s.y0 + so;
    l.y0b = l.y0a + thickness;
    l.y1a = t.y0 + ti;
    l.y1b = l.y1a + thickness;

    outByNode.set(s.id, so + thickness);
    inByNode.set(t.id, ti + thickness);
  }

  return { k: kGlobal, axisX, nodesById, linksSorted };
}

