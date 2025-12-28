// src/viz/render.js
// White-background variant.
// Implemented:
// 1) Axis titles + descriptors BELOW the plot (compact bottom label band)
// 2) DC labels LEFT of dot; Affective Aim labels RIGHT of axis
// 3) Axis rules shortened + more subtle on white
// 4) OPTION B for node rectangles:
//    - Parallel: NO rect bands; optional micro-ticks as anchors
//    - Alluvial: thin rect bands for non-cluster axes
// 5) Clip plot content so it cannot collide with bottom label band
//
// Keeps your existing line rendering logic + "emerge from DC dots" behaviour.
// No legend.

import * as d3 from "d3";
import {
  AXES,
  FIG,
  COLORS,
  CLUSTER_COLORS,
  RIBBON,
  AXIS_DESCRIPTORS,
  TYPE,
  LABELS,
  RENDER,
  PARALLEL
} from "./config.js";
import { preprocess } from "./preprocess.js";
import { computeLayout } from "./layout.js";

function ribbonPath(d) {
  const x0 = d.x0, x1 = d.x1;
  const y0a = d.y0a, y0b = d.y0b;
  const y1a = d.y1a, y1b = d.y1b;

  const c = (x1 - x0) * 0.5;
  return `
    M ${x0} ${y0a}
    C ${x0 + c} ${y0a}, ${x1 - c} ${y1a}, ${x1} ${y1a}
    L ${x1} ${y1b}
    C ${x1 - c} ${y1b}, ${x0 + c} ${y0b}, ${x0} ${y0b}
    Z
  `;
}

function colorForAffect(affect) {
  return COLORS?.[affect] || "#9aa4b2";
}

function colorForCluster(cluster) {
  return CLUSTER_COLORS?.[cluster] || "#9aa4b2";
}

// Ensure Concept Cluster labels match DC1..DC6 if raw rows contain C0..C5
function normClusterLabel(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const m = s.match(/^C(\d+)$/i);
  if (m) return `DC${Number(m[1]) + 1}`;
  return s;
}

// Deterministic pseudo-random in [0,1) from integer i
function hash01(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export async function initViz(containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const { width, height, margin, nodeWidth } = FIG;
  const mode = RENDER?.mode ?? "parallel";
  const colorBy = RENDER?.colorBy ?? "Concept Cluster";

  // Theme
  const INK = "#111827";
  const MUTED = "#6b7280";
  const AXIS_RULE = "rgba(17,24,39,0.05)";        // lighter
  const SEP_RULE = "rgba(17,24,39,0.06)";
  const BAR_FILL = "rgba(17,24,39,0.08)";
  const BAR_STROKE = "rgba(17,24,39,0.14)";
  const DOT_STROKE = "rgba(17,24,39,0.22)";

  // Typography
  const TITLE_SIZE = TYPE?.titleSize ?? 22;
  const SUBTITLE_SIZE = TYPE?.subtitleSize ?? 14;
  const AXIS_TITLE_SIZE = TYPE?.axisTitleSize ?? 20;
  const AXIS_DESC_SIZE = TYPE?.axisDescSize ?? 13;
  const NODE_LABEL_SIZE = TYPE?.nodeLabelSize ?? 13;
  const COUNT_SIZE = TYPE?.countSize ?? 11;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("background", "#ffffff");

  // Title + subtitle
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 34)
    .attr("text-anchor", "middle")
    .attr("fill", INK)
    .attr("font-size", TITLE_SIZE)
    .attr("font-weight", 700)
    .text("Biophilic Design Space Map For Indoor Interactive Experiences");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 58)
    .attr("text-anchor", "middle")
    .attr("fill", MUTED)
    .attr("font-size", SUBTITLE_SIZE)
    .attr("font-weight", 500)
    .text(mode === "parallel"
      ? "Line = one coded instance of data"
      : "Width = coded instances"
    );

  // Load CSV
  const dataPath = "/data/cleaned.csv";
  let rows;
  try {
    rows = await d3.csv(dataPath);
  } catch (err) {
    console.error("Failed to load CSV:", err);
    svg.append("text")
      .attr("x", 16).attr("y", 28)
      .attr("fill", INK)
      .attr("font-size", 12)
      .text(`Could not load ${dataPath}. Put cleaned.csv in public/data/ and restart.`);
    return;
  }

  // Preprocess + layout
  const { nodes, links, axisInfo } = preprocess(rows, { axes: AXES });
  const { axisX, linksSorted } = computeLayout({ nodes, links, axisInfo, mode });

  const gAxes = svg.append("g").attr("class", "axes");
  const gLinks = svg.append("g").attr("class", "links");
  const gNodes = svg.append("g").attr("class", "nodes");

  const CLUSTER_AXIS = "Concept Cluster";
  const AFFECT_AXIS = "Affective Aim";

  // Plot region: everything above plotBottom is data
  const plotTop = margin.top - 6;
  const plotBottom = height - margin.bottom;

  // ---- Clip so links never intrude into bottom label band
  svg.append("defs")
    .append("clipPath")
    .attr("id", "plot-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", plotTop)
    .attr("width", width)
    .attr("height", Math.max(0, plotBottom - plotTop));

  gLinks.attr("clip-path", "url(#plot-clip)");

  // =========================================================
  // AXIS RULES (short + subtle)
  // =========================================================
  const ruleTopPad = 22;
  const ruleBottomPad = 22;

  gAxes.selectAll("line.axis-rule")
    .data(axisInfo.filter(d => d.index !== 0))
    .join("line")
    .attr("class", "axis-rule")
    .attr("x1", d => axisX[d.index])
    .attr("x2", d => axisX[d.index])
    .attr("y1", plotTop + ruleTopPad)
    .attr("y2", plotBottom - ruleBottomPad)
    .attr("stroke", AXIS_RULE)
    .attr("stroke-width", 1);

  // Separator between plot + label band
  gAxes.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", plotBottom + 12)
    .attr("y2", plotBottom + 12)
    .attr("stroke", SEP_RULE)
    .attr("stroke-width", 1);

  // =========================================================
  // AXIS TITLES + DESCRIPTORS BELOW (more compact)
  // =========================================================
  // Pull these up so the label band is smaller visually.
  const axisTitleY = plotBottom + 38;
  const axisDescY  = plotBottom + 56;

  const lastAxis = axisInfo.length - 1;
  const edgePad = 10;

  function axisTextX(d) {
    if (d.index === 0) return axisX[d.index] - nodeWidth / 2 + edgePad;
    if (d.index === lastAxis) return axisX[d.index] + nodeWidth / 2 - edgePad;
    return axisX[d.index];
  }
  function axisAnchor(d) {
    if (d.index === 0) return "start";
    if (d.index === lastAxis) return "end";
    return "middle";
  }

  gAxes.selectAll("text.axis-title")
    .data(axisInfo)
    .join("text")
    .attr("class", "axis-title")
    .attr("x", d => axisTextX(d))
    .attr("y", axisTitleY)
    .attr("text-anchor", d => axisAnchor(d))
    .attr("fill", INK)
    .attr("font-size", AXIS_TITLE_SIZE)
    .attr("font-weight", 700)
    .text(d => d.axis);

  gAxes.selectAll("text.axis-desc")
    .data(axisInfo)
    .join("text")
    .attr("class", "axis-desc")
    .attr("x", d => axisTextX(d))
    .attr("y", axisDescY)
    .attr("text-anchor", d => axisAnchor(d))
    .attr("fill", MUTED)
    .attr("font-size", AXIS_DESC_SIZE)
    .attr("font-weight", 500)
    .text(d => AXIS_DESCRIPTORS?.[d.axis] ?? "");

  // =========================================================
  // NODES
  // =========================================================
  const nodesByAxis = d3.groups(nodes, d => d.index)
    .map(([idx, arr]) => [Number(idx), arr.sort((a, b) => a.order - b.order)]);
  const flatNodes = nodesByAxis.flatMap(([_, arr]) => arr);

  const nodeSel = gNodes.selectAll("g.node")
    .data(flatNodes, d => d.id)
    .join(enter => {
      const g = enter.append("g").attr("class", "node");
      g.append("rect");     // alluvial only
      g.append("line");     // parallel micro-tick (optional)
      g.append("circle");   // cluster axis
      g.append("text");     // labels
      return g;
    });

  // ---- Rect bands: only in alluvial
  if (mode === "parallel") {
    nodeSel.select("rect").attr("display", "none");
  } else {
    const bandW = Math.max(2, Math.min(6, nodeWidth * 0.12));
    nodeSel.select("rect")
      .attr("x", d => axisX[d.index] - bandW / 2)
      .attr("y", d => d.y0)
      .attr("width", bandW)
      .attr("height", d => Math.max(1, d.y1 - d.y0))
      .attr("fill", BAR_FILL)
      .attr("stroke", BAR_STROKE)
      .attr("stroke-width", 1)
      .attr("display", d => {
        if (d.index === 0) return "none";
        if (d.axis === CLUSTER_AXIS) return "none";
        return null;
      });
  }

  // ---- Parallel micro-ticks: tiny horizontal marks at node centres (no chunky columns)
  // This answers your "why rectangles not a line?" concern without reverting to bands.
  const showTicks = (mode === "parallel");
  const tickLen = 10;

  nodeSel.select("line")
    .attr("display", d => {
      if (!showTicks) return "none";
      if (d.axis === CLUSTER_AXIS) return "none"; // cluster is dots
      return null;
    })
    .attr("x1", d => axisX[d.index] - tickLen / 2)
    .attr("x2", d => axisX[d.index] + tickLen / 2)
    .attr("y1", d => (d.y0 + d.y1) / 2)
    .attr("y2", d => (d.y0 + d.y1) / 2)
    .attr("stroke", "rgba(17,24,39,0.18)")
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round");

  // ---- Cluster dots
  const dotR = 8.5;
  nodeSel.select("circle")
    .attr("cx", d => (d.x0 + d.x1) / 2)
    .attr("cy", d => (d.y0 + d.y1) / 2)
    .attr("r", d => (d.axis === CLUSTER_AXIS ? dotR : 0))
    .attr("display", d => (d.axis === CLUSTER_AXIS ? null : "none"))
    .attr("fill", d => colorForCluster(d.label))
    .attr("stroke", DOT_STROKE)
    .attr("stroke-width", 1.2);

  // ---- Labels (halo + custom left/right rules)
  const dx = LABELS?.nodeTextDx ?? 6;

  nodeSel.select("text")
    .attr("x", d => {
      if (d.axis === CLUSTER_AXIS) return d.x0 - dx - 10; // left of dot
      if (d.axis === AFFECT_AXIS) return d.x1 + dx + 10;  // push a bit further right
      return d.x1 + dx;                                   // default right
    })
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", d => (d.axis === CLUSTER_AXIS ? "end" : "start"))
    .each(function(d) {
      const t = d3.select(this);
      t.selectAll("*").remove();

      t.append("tspan")
        .text(d.label)
        .attr("fill", INK)
        .attr("font-size", NODE_LABEL_SIZE)
        .attr("font-weight", 500)
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(255,255,255,0.95)")
        .attr("stroke-width", 3.5)
        .attr("stroke-linejoin", "round");

      t.append("tspan")
        .text(` (${d.value})`)
        .attr("fill", MUTED)
        .attr("font-size", COUNT_SIZE)
        .attr("font-weight", 500)
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(255,255,255,0.95)")
        .attr("stroke-width", 3.0)
        .attr("stroke-linejoin", "round");
    });

  // =========================================================
  // MODE SWITCH (preserve your line look)
  // =========================================================
  if (mode === "parallel") {
    const geo = new Map();
    for (const n of nodes) {
      geo.set(`${n.axis}::${n.label}`, {
        x: (n.x0 + n.x1) / 2,
        y: (n.y0 + n.y1) / 2
      });
    }

    const EMERGE_DX = PARALLEL?.emergeDx ?? 52;
    const JITTER_R  = PARALLEL?.jitterR  ?? 5;

    const rowPaths = rows.map((r, i) => {
      const pts = [];
      const jy = JITTER_R ? (hash01(i) - 0.5) * 2 * JITTER_R : 0;

      for (let ai = 0; ai < AXES.length; ai++) {
        const ax = AXES[ai];
        let v = String(r[ax] ?? "").trim();
        if (!v) {
          pts.push(null);
          continue;
        }
        if (ax === CLUSTER_AXIS) v = normClusterLabel(v);

        const p = geo.get(`${ax}::${v}`);
        if (!p) {
          pts.push(null);
          continue;
        }

        if (ax === CLUSTER_AXIS) {
          pts.push([p.x, p.y + jy]);
          pts.push([p.x + EMERGE_DX, p.y + jy]);
        } else {
          pts.push([p.x, p.y]);
        }
      }

      const cluster = normClusterLabel(r["Concept Cluster"]);
      const affect = String(r["Affective Aim"] ?? "").trim();
      return { i, pts, cluster, affect };
    });

    const curveAlpha = PARALLEL?.curveAlpha ?? 0.65;

    const lineGen = d3.line()
      .defined(d => d != null)
      .curve(d3.curveCatmullRom.alpha(curveAlpha))
      .x(d => d[0])
      .y(d => d[1]);

    const strokeOpacity = PARALLEL?.strokeOpacity ?? 0.25;
    const strokeWidth = PARALLEL?.strokeWidth ?? 1.5;

    if (PARALLEL?.glow) {
      gLinks.selectAll("path.row-glow")
        .data(rowPaths)
        .join("path")
        .attr("class", "row-glow")
        .attr("d", d => lineGen(d.pts))
        .attr("fill", "none")
        .attr("stroke", d => {
          if (colorBy === "Concept Cluster") return colorForCluster(d.cluster);
          return colorForAffect(d.affect);
        })
        .attr("stroke-opacity", PARALLEL?.glowOpacity ?? 0.07)
        .attr("stroke-width", PARALLEL?.glowWidth ?? 3.2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    }

    gLinks.selectAll("path.row")
      .data(rowPaths)
      .join("path")
      .attr("class", "row")
      .attr("d", d => lineGen(d.pts))
      .attr("fill", "none")
      .attr("stroke", d => {
        if (colorBy === "Concept Cluster") return colorForCluster(d.cluster);
        return colorForAffect(d.affect);
      })
      .attr("stroke-opacity", strokeOpacity)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

  } else {
    gLinks.selectAll("path.link")
      .data(linksSorted.filter(d => d.x0 != null), (d, i) => `${d.source}-->${d.target}#${i}`)
      .join("path")
      .attr("class", "link")
      .attr("d", ribbonPath)
      .attr("fill", d => colorForAffect(d.affect))
      .attr("fill-opacity", RIBBON.opacity);
  }
}
