// src/viz/ordering.js
// Barycentric crossing-reduction for category axes.
// - Reorders categories on each axis using adjacent-link weights
// - Allows locking an axis (e.g., Concept Cluster)
// - Keeps `missingLabel` (e.g., "Missing") at the end

function splitNodeId(id) {
  const i = id.indexOf("::");
  if (i < 0) return { axis: "", label: id };
  return { axis: id.slice(0, i), label: id.slice(i + 2) };
}

function buildPairLinks(axisInfo, linkAgg) {
  // pairLinks[i]: Map<srcLabel, Map<tgtLabel, weight>> for axis i -> i+1
  const pairLinks = Array.from(
    { length: Math.max(0, axisInfo.length - 1) },
    () => new Map()
  );

  function acc(i, srcLabel, tgtLabel, w) {
    if (!pairLinks[i].has(srcLabel)) pairLinks[i].set(srcLabel, new Map());
    const m = pairLinks[i].get(srcLabel);
    m.set(tgtLabel, (m.get(tgtLabel) || 0) + w);
  }

  // IMPORTANT: use array position, not axisInfo[i].index (more robust)
  const axisPosByName = new Map(axisInfo.map((a, pos) => [a.axis, pos]));

  for (const d of linkAgg.values()) {
    const { axis: a0, label: l0 } = splitNodeId(d.source);
    const { axis: a1, label: l1 } = splitNodeId(d.target);

    const p0 = axisPosByName.get(a0);
    const p1 = axisPosByName.get(a1);
    if (p0 == null || p1 == null) continue;
    if (p1 !== p0 + 1) continue; // only adjacent

    acc(p0, l0, l1, d.value || 0);
  }

  return pairLinks;
}

function reorderBarycentricAxisInfo(axisInfo, pairLinks, { lockAxisName, missingLabel, iterations }) {
  const nAxes = axisInfo.length;
  if (nAxes <= 2) return;

  const lockPos = axisInfo.findIndex(a => a.axis === lockAxisName);

  // position maps: axis position -> Map<label, position>
  const pos = Array.from({ length: nAxes }, () => new Map());

  function refreshPos(i) {
    pos[i].clear();
    axisInfo[i].categories.forEach((lab, idx) => pos[i].set(lab, idx));
  }
  for (let i = 0; i < nAxes; i++) refreshPos(i);

  const isLocked = (i) => i === lockPos;

  function splitMissing(categories, totalsByCategory) {
    const missingCount = missingLabel ? (totalsByCategory.get(missingLabel) || 0) : 0;
    const base = missingLabel ? categories.filter(l => l !== missingLabel) : categories.slice();
    return { base, hasMissing: missingLabel ? (missingCount > 0) : false };
  }

  function applyReorder(i, scores) {
    const a = axisInfo[i];
    const { base, hasMissing } = splitMissing(a.categories, a.totalsByCategory);

    const currentPos = pos[i];

    base.sort((u, v) => {
      const su = scores.get(u);
      const sv = scores.get(v);

      // unlinked categories go to the end (stable)
      if (su == null && sv == null) return (currentPos.get(u) ?? 0) - (currentPos.get(v) ?? 0);
      if (su == null) return 1;
      if (sv == null) return -1;

      if (su !== sv) return su - sv;
      return (currentPos.get(u) ?? 0) - (currentPos.get(v) ?? 0);
    });

    a.categories = hasMissing ? base.concat([missingLabel]) : base;
    refreshPos(i);
  }

  // scores for axis i based on prev axis positions using links (i-1 -> i)
  function scoresFromPrev(i) {
    const scores = new Map();
    if (i <= 0) return scores;

    const prevPos = pos[i - 1];
    const links = pairLinks[i - 1];

    const num = new Map();
    const den = new Map();

    for (const [srcLabel, toMap] of links.entries()) {
      const p = prevPos.get(srcLabel);
      if (p == null) continue;

      for (const [tgtLabel, w] of toMap.entries()) {
        if (w <= 0) continue;
        num.set(tgtLabel, (num.get(tgtLabel) || 0) + w * p);
        den.set(tgtLabel, (den.get(tgtLabel) || 0) + w);
      }
    }

    for (const [tgtLabel, n] of num.entries()) {
      const d = den.get(tgtLabel) || 0;
      if (d > 0) scores.set(tgtLabel, n / d);
    }
    return scores;
  }

  // scores for axis i based on next axis positions using links (i -> i+1)
  function scoresFromNext(i) {
    const scores = new Map();
    if (i >= nAxes - 1) return scores;

    const nextPos = pos[i + 1];
    const links = pairLinks[i];

    for (const [srcLabel, toMap] of links.entries()) {
      let n = 0;
      let d = 0;
      for (const [tgtLabel, w] of toMap.entries()) {
        const p = nextPos.get(tgtLabel);
        if (p == null || w <= 0) continue;
        n += w * p;
        d += w;
      }
      if (d > 0) scores.set(srcLabel, n / d);
    }
    return scores;
  }

  const iters = Number.isFinite(iterations) ? iterations : 6;

  for (let it = 0; it < iters; it++) {
    // forward sweep
    for (let i = 1; i < nAxes; i++) {
      if (isLocked(i)) continue;
      applyReorder(i, scoresFromPrev(i));
    }
    // backward sweep
    for (let i = nAxes - 2; i >= 0; i--) {
      if (isLocked(i)) continue;
      applyReorder(i, scoresFromNext(i));
    }
  }
}

/**
 * Public API:
 * Mutates axisInfo[i].categories (reordered) in-place.
 */
export function reduceCrossings(axisInfo, linkAgg, opts = {}) {
  const {
    lockAxisName = "Design-Concept",
    missingLabel = "Missing",
    iterations = 6,
  } = opts;

  const pairLinks = buildPairLinks(axisInfo, linkAgg);
  reorderBarycentricAxisInfo(axisInfo, pairLinks, { lockAxisName, missingLabel, iterations });
}

