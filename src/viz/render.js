// src/viz/render.js
// White-background variant (print/PDF-safe).
// Key fixes:
// - Axis rules drawn ABOVE strands (group order fixed)
// - Axis rule colors are PDF-safe (stroke + stroke-opacity; no rgba strings)
// - Clip applies ONLY to links (so top labels like "Taste" never get cut)
// - No axis-rule for last axis (Affective Aim) to avoid "weird final line"
// - Hide first axis title ("Design-Concept") only (DC1..DC6 is self-explanatory)
// - Affective Aim axis title aligned with the point where the strands end

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
  PARALLEL,
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

/**
 * Normalise cluster label for rendering.
 * Supports DC1.., legacy C0.., C1.. etc.
 */
function normClusterLabel(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  const mDC = s.match(/^DC(\d+)$/i);
  if (mDC) return `DC${Number(mDC[1])}`;

  const mC = s.match(/^C(\d+)$/i);
  if (mC) {
    const n = Number(mC[1]);
    // legacy C0..C5 -> DC1..DC6
    if (n >= 0 && n <= 5) return `DC${n + 1}`;
    // legacy C1..C6 -> DC1..DC6
    if (n >= 1 && n <= 6) return `DC${n}`;
    return `DC${n}`;
  }

  return s;
}

function hash01(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function splitSlashLabel(label) {
  const s = String(label ?? "").trim();
  if (!s) return [""];
  if (!s.includes("/")) return [s];
  return s.split("/").map(p => p.trim()).filter(Boolean);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export async function initViz(containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const { width, height, margin, nodeWidth } = FIG;
  const mode = RENDER?.mode ?? "parallel";
  const colorBy = RENDER?.colorBy ?? "Design-Concept";

  // -----------------------------
  // Theme (PDF-safe)
  // -----------------------------
  const INK = "#111827";
  const MUTED = "#6b7280";

  // PDF-safe lines: use stroke + stroke-opacity (NOT rgba)
  const AXIS_RULE_COLOR = "#111827";
  const AXIS_RULE_OPACITY = 0.20; // make visible in print/PDF
  const SEP_RULE_COLOR = "#111827";
  const SEP_RULE_OPACITY = 0.22;

  const BAR_FILL = "#111827";
  const BAR_FILL_OPACITY = 0.08;
  const BAR_STROKE = "#111827";
  const BAR_STROKE_OPACITY = 0.14;

  const DOT_STROKE = "#111827";
  const DOT_STROKE_OPACITY = 0.22;

  // -----------------------------
  // Typography
  // -----------------------------
  const TITLE_SIZE      = TYPE?.titleSize      ?? 38;
  const SUBTITLE_SIZE   = TYPE?.subtitleSize   ?? 24;
  const AXIS_TITLE_SIZE = TYPE?.axisTitleSize  ?? 28;
  const AXIS_DESC_SIZE  = TYPE?.axisDescSize   ?? 20;
  const NODE_LABEL_SIZE = TYPE?.nodeLabelSize  ?? 24;
  const COUNT_SIZE      = TYPE?.countSize      ?? 18;

  // Title placement (top-safe)
  const titleTop = 18;
  const subtitleTop = titleTop + TITLE_SIZE + 6;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("background", "#ffffff");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", titleTop)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "hanging")
    .attr("fill", INK)
    .attr("font-size", TITLE_SIZE)
    .attr("font-weight", 700)
    .text("Biophilic Design Space Map For Indoor Interactive Experiences");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", subtitleTop)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "hanging")
    .attr("fill", MUTED)
    .attr("font-size", SUBTITLE_SIZE)
    .attr("font-weight", 500)
    .text(mode === "parallel" ? "Line = one coded instance of data" : "Width = coded instances");

  // -----------------------------
  // Load CSV
  // -----------------------------
  const dataPath = "/data/cleaned.csv";
  let rows;
  try {
    rows = await d3.csv(dataPath);
  } catch (err) {
    console.error("Failed to load CSV:", err);
    svg.append("text")
      .attr("x", 16)
      .attr("y", 28)
      .attr("fill", INK)
      .attr("font-size", 12)
      .text(`Could not load ${dataPath}. Put cleaned.csv in public/data/ and restart.`);
    return;
  }

  const { nodes, links, axisInfo } = preprocess(rows, { axes: AXES });
  const { axisX, linksSorted } = computeLayout({ nodes, links, axisInfo });

  // -----------------------------
  // Layer order (IMPORTANT for PDF)
  // -----------------------------
  // Links (bottom)
  const gLinks = svg.append("g").attr("class", "links");
  // Nodes + labels (middle)
  const gNodes = svg.append("g").attr("class", "nodes");
  // Axes (top)
  const gAxes = svg.append("g").attr("class", "axes");
  const gRules = gAxes.append("g").attr("class", "axis-rules");
  const gAxisText = gAxes.append("g").attr("class", "axis-text");

  const CLUSTER_AXIS = "Design-Concept";
  const AFFECT_AXIS = "Affective Aim";

  // Plot area
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;

  // Clip ONLY the links so node text is never cut (fixes "Taste" etc.)
  svg.append("defs")
    .append("clipPath")
    .attr("id", "plot-clip-links")
    .append("rect")
    .attr("x", 0)
    .attr("y", plotTop)
    .attr("width", width)
    .attr("height", Math.max(0, plotBottom - plotTop));

  gLinks.attr("clip-path", "url(#plot-clip-links)");

  // -----------------------------
  // Axis rules (no last axis rule)
  // -----------------------------
  const ruleTopPad = 22;
  const ruleBottomPad = 22;

  const lastAxisIndex = axisInfo.length - 1;

  // draw vertical rules for interior axes only
  gRules.selectAll("line.axis-rule")
    .data(axisInfo.filter(d => d.index > 0 && d.index < lastAxisIndex))
    .join("line")
    .attr("class", "axis-rule")
    .attr("x1", d => axisX[d.index])
    .attr("x2", d => axisX[d.index])
    .attr("y1", plotTop + ruleTopPad)
    .attr("y2", plotBottom - ruleBottomPad)
    .attr("stroke", AXIS_RULE_COLOR)
    .attr("stroke-opacity", AXIS_RULE_OPACITY)
    .attr("stroke-width", 2);

  // bottom separator line
  //gRules.append("line")
    //.attr("x1", margin.left)
    //.attr("x2", width - margin.right)
    //.attr("y1", plotBottom + 12)
    //.attr("y2", plotBottom + 12)
    //.attr("stroke", SEP_RULE_COLOR)
    //.attr("stroke-opacity", SEP_RULE_OPACITY)
    //.attr("stroke-width", 2.5);

  // -----------------------------
  // Axis titles + descriptors
  // -----------------------------
  const axisTitleY = plotBottom + 38;
  const axisDescY  = plotBottom + 56;

  const dxLabel = LABELS?.nodeTextDx ?? 6;
  const aimLabelPad = 12;
  const edgePad = 10;

  function axisTitleX(d) {
    // First axis: keep left aligned but you will hide the text anyway.
    if (d.index === 0) return axisX[d.index] - nodeWidth / 2 + edgePad;

    // Last axis: align with where Affective Aim labels start
    if (d.index === lastAxisIndex) {
      return axisX[d.index] + nodeWidth / 2 + dxLabel + aimLabelPad;
    }

    // Middle axes: centered
    return axisX[d.index];
  }

  function axisTitleAnchor(d) {
    if (d.index === 0) return "start";
    if (d.index === lastAxisIndex) return "middle";
    return "middle";
  }

  gAxisText.selectAll("text.axis-title")
    .data(axisInfo)
    .join("text")
    .attr("class", "axis-title")
    .attr("x", d => axisTitleX(d))
    .attr("y", axisTitleY)
    .attr("text-anchor", d => axisTitleAnchor(d))
    .attr("fill", INK)
    .attr("font-size", AXIS_TITLE_SIZE)
    .attr("font-weight", 700)
    .text(d => (d.axis === CLUSTER_AXIS ? "" : d.axis));

  gAxisText.selectAll("text.axis-desc")
    .data(axisInfo)
    .join("text")
    .attr("class", "axis-desc")
    .attr("x", d => axisTitleX(d))
    .attr("y", axisDescY)
    .attr("text-anchor", d => axisTitleAnchor(d))
    .attr("fill", MUTED)
    .attr("font-size", AXIS_DESC_SIZE)
    .attr("font-weight", 500)
    .text(d => {
      // Optional: also hide the descriptor under Design-Concept if you want
      if (d.axis === CLUSTER_AXIS) return "";
      return AXIS_DESCRIPTORS?.[d.axis] ?? "";
    });

  // -----------------------------
  // Nodes (layout order)
  // -----------------------------
  const nodesByAxis = d3.groups(nodes, d => d.index)
    .map(([idx, arr]) => [Number(idx), arr.sort((a, b) => a.order - b.order)]);
  const flatNodes = nodesByAxis.flatMap(([_, arr]) => arr);

  // Dot scaling for clusters
  const clusterVals = nodes.filter(n => n.axis === CLUSTER_AXIS).map(n => n.value);
  const clusterMin = Math.min(...clusterVals, 1);
  const clusterMax = Math.max(...clusterVals, 1);

  const clusterR = d3.scaleSqrt()
    .domain([clusterMin, clusterMax])
    .range([6.2, 11.5]);

  const nodeSel = gNodes.selectAll("g.node")
    .data(flatNodes, d => d.id)
    .join(enter => {
      const g = enter.append("g").attr("class", "node");
      g.append("rect");
      g.append("line");
      g.append("circle"); // cluster dot only
      g.append("text");
      return g;
    });

  // Rect bands: only in alluvial mode
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
      .attr("fill-opacity", BAR_FILL_OPACITY)
      .attr("stroke", BAR_STROKE)
      .attr("stroke-opacity", BAR_STROKE_OPACITY)
      .attr("stroke-width", 1)
      .attr("display", d => {
        if (d.index === 0) return "none";
        if (d.axis === CLUSTER_AXIS) return "none";
        return null;
      });
  }

  // Parallel micro-ticks
  const showTicks = mode === "parallel";
  const tickLen = 10;

  nodeSel.select("line")
    .attr("display", d => {
      if (!showTicks) return "none";
      if (d.axis === CLUSTER_AXIS) return "none";
      return null;
    })
    .attr("x1", d => axisX[d.index] - tickLen / 2)
    .attr("x2", d => axisX[d.index] + tickLen / 2)
    .attr("y1", d => (d.y0 + d.y1) / 2)
    .attr("y2", d => (d.y0 + d.y1) / 2)
    .attr("stroke", AXIS_RULE_COLOR)
    .attr("stroke-opacity", 0.18)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round");

  // Cluster dots only
  nodeSel.select("circle")
    .attr("cx", d => (d.x0 + d.x1) / 2)
    .attr("cy", d => (d.y0 + d.y1) / 2)
    .attr("r", d => (d.axis === CLUSTER_AXIS ? clusterR(d.value || 1) : 0))
    .attr("display", d => (d.axis === CLUSTER_AXIS ? null : "none"))
    .attr("fill", d => colorForCluster(d.label))
    .attr("stroke", DOT_STROKE)
    .attr("stroke-opacity", DOT_STROKE_OPACITY)
    .attr("stroke-width", 1.2);

  // Labels
  nodeSel.select("text")
    .attr("x", d => {
      if (d.axis === CLUSTER_AXIS) return d.x0 - dxLabel - 10;
      if (d.axis === AFFECT_AXIS) return d.x1 + dxLabel + aimLabelPad;
      return d.x1 + dxLabel;
    })
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("text-anchor", d => (d.axis === CLUSTER_AXIS ? "end" : "start"))
    .each(function (d) {
      const t = d3.select(this);
      t.selectAll("*").remove();

      const x =
        d.axis === CLUSTER_AXIS ? d.x0 - dxLabel - 10 :
        d.axis === AFFECT_AXIS ? d.x1 + dxLabel + aimLabelPad :
        d.x1 + dxLabel;

      const lines = splitSlashLabel(d.label);

      // Halo stroke widths scale with font sizes
      const labelHalo = Math.max(2.0, NODE_LABEL_SIZE * 0.14);
      const countHalo = Math.max(1.8, COUNT_SIZE * 0.12);

      lines.forEach((line, i) => {
        t.append("tspan")
          .attr("x", x)
          .attr("dy", i === 0 ? "0em" : "1.10em")
          .text(line)
          .attr("fill", INK)
          .attr("font-size", NODE_LABEL_SIZE)
          .attr("font-weight", 550)
          .attr("paint-order", "stroke")
          .attr("stroke", "#ffffff")
          .attr("stroke-opacity", 0.95)
          .attr("stroke-width", labelHalo)
          .attr("stroke-linejoin", "round");
      });

      t.append("tspan")
        .attr("x", x)
        .attr("dy", "1.15em")
        .text(`(${d.value})`)
        .attr("fill", MUTED)
        .attr("font-size", COUNT_SIZE)
        .attr("font-weight", 500)
        .attr("paint-order", "stroke")
        .attr("stroke", "#ffffff")
        .attr("stroke-opacity", 0.95)
        .attr("stroke-width", countHalo)
        .attr("stroke-linejoin", "round");
    });

  // =========================================================
  // MODE SWITCH
  // =========================================================
  if (mode === "parallel") {
    // Map node centres
    const geo = new Map();
    for (const n of nodes) {
      geo.set(`${n.axis}::${n.label}`, {
        x: (n.x0 + n.x1) / 2,
        y: (n.y0 + n.y1) / 2,
      });
    }

    // cluster totals -> width multiplier
    const clusterTotals = new Map(
      nodes.filter(n => n.axis === CLUSTER_AXIS).map(n => [n.label, n.value])
    );
    const maxCluster = Math.max(1, ...clusterTotals.values());

    const useClusterWidth = PARALLEL?.clusterWidth ?? true;
    const gamma = PARALLEL?.clusterWidthGamma ?? 0.65;
    const wMin = PARALLEL?.clusterWidthMin ?? 0.85;
    const wMax = PARALLEL?.clusterWidthMax ?? 2.2;

    function clusterWidthMult(clusterLabel) {
      if (!useClusterWidth) return 1;
      const v = clusterTotals.get(clusterLabel) ?? 1;
      const t = Math.pow(v / maxCluster, gamma);
      return clamp(wMin + (wMax - wMin) * t, wMin, wMax);
    }

    const EMERGE_DX = PARALLEL?.emergeDx ?? 52;
    const JITTER_R  = PARALLEL?.jitterR ?? 5;

    // Endpoint lanes into Affective Aim
    const LANES_ON  = PARALLEL?.aimLanes ?? true;
    const LANE_DX   = PARALLEL?.aimLaneDx ?? 90;
    const LANE_JIT  = PARALLEL?.aimLaneJitter ?? 8;

    const rowPathsRaw = rows.map((r, i) => {
      const pts = [];
      const jy = JITTER_R ? (hash01(i) - 0.5) * 2 * JITTER_R : 0;

      let affectLabel = String(r[AFFECT_AXIS] ?? "").trim();
      let affectPt = null;

      for (let ai = 0; ai < AXES.length; ai++) {
        const ax = AXES[ai];
        let v = String(r[ax] ?? "").trim();
        if (!v) { pts.push(null); continue; }

        if (ax === CLUSTER_AXIS) v = normClusterLabel(v);

        const p = geo.get(`${ax}::${v}`);
        if (!p) { pts.push(null); continue; }

        if (ax === CLUSTER_AXIS) {
          pts.push([p.x, p.y + jy]);
          pts.push([p.x + EMERGE_DX, p.y + jy]);
        } else {
          pts.push([p.x, p.y]);
        }

        if (ax === AFFECT_AXIS) {
          affectLabel = String(v ?? "").trim();
          affectPt = [p.x, p.y];
        }
      }

      // Endpoint lanes into Affective Aim (reduces last-axis knotting)
      if (LANES_ON && affectPt) {
        let lastIdx = -1;
        for (let j = pts.length - 1; j >= 0; j--) {
          if (pts[j] != null) { lastIdx = j; break; }
        }
        if (lastIdx >= 0) {
          const end = pts[lastIdx];
          const xLane = end[0] - LANE_DX;
          const jy2 = (hash01(i * 97.13) - 0.5) * 2 * LANE_JIT;
          const yLane = end[1] + jy2;
          pts.splice(lastIdx, 0, [xLane, yLane]);
        }
      }

      const cluster = normClusterLabel(r[CLUSTER_AXIS]);
      const affect = affectLabel;

      return { i, pts, cluster, affect, wMult: clusterWidthMult(cluster) };
    });

    // draw order: thin first, thick last
    const rowPaths = rowPathsRaw.slice().sort((a, b) => (a.wMult ?? 1) - (b.wMult ?? 1));

    const curveAlpha = PARALLEL?.curveAlpha ?? 0.65;
    const lineGen = d3.line()
      .defined(d => d != null)
      .curve(d3.curveCatmullRom.alpha(curveAlpha))
      .x(d => d[0])
      .y(d => d[1]);

    const strokeOpacity = PARALLEL?.strokeOpacity ?? 0.22;
    const strokeWidth   = PARALLEL?.strokeWidth ?? 1.2;

    // Neutral underlay (structure first) - PDF-safe
    const UNDERLAY_ON = PARALLEL?.underlay ?? true;
    const underlayOpacity = PARALLEL?.underlayOpacity ?? 0.012;
    const underlayWidth   = PARALLEL?.underlayWidth ?? 2.6;
    const underlayStroke  = PARALLEL?.underlayStroke ?? "#111827";
    const underlayStrokeOpacity = PARALLEL?.underlayStrokeOpacity ?? 0.35;

    if (UNDERLAY_ON) {
      gLinks.append("g")
        .attr("class", "underlay")
        .style("mix-blend-mode", "normal")
        .selectAll("path.under")
        .data(rowPaths)
        .join("path")
        .attr("class", "under")
        .attr("d", d => lineGen(d.pts))
        .attr("fill", "none")
        .attr("stroke", underlayStroke)
        .attr("stroke-opacity", underlayOpacity * underlayStrokeOpacity)
        .attr("stroke-width", strokeWidth * underlayWidth)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    }

    // Coloured strands (print-friendly)
    const COLOUR_BLEND = PARALLEL?.blendMode ?? "normal";

    if (PARALLEL?.glow) {
      gLinks.append("g")
        .attr("class", "glow")
        .style("mix-blend-mode", COLOUR_BLEND)
        .selectAll("path.row-glow")
        .data(rowPaths)
        .join("path")
        .attr("class", "row-glow")
        .attr("d", d => lineGen(d.pts))
        .attr("fill", "none")
        .attr("stroke", d => (colorBy === CLUSTER_AXIS ? colorForCluster(d.cluster) : colorForAffect(d.affect)))
        .attr("stroke-opacity", PARALLEL?.glowOpacity ?? 0.04)
        .attr("stroke-width", d => (PARALLEL?.glowWidth ?? 2.4) * (d.wMult ?? 1))
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    }

    gLinks.append("g")
      .attr("class", "strands")
      .style("mix-blend-mode", COLOUR_BLEND)
      .selectAll("path.row")
      .data(rowPaths)
      .join("path")
      .attr("class", "row")
      .attr("d", d => lineGen(d.pts))
      .attr("fill", "none")
      .attr("stroke", d => (colorBy === CLUSTER_AXIS ? colorForCluster(d.cluster) : colorForAffect(d.affect)))
      .attr("stroke-opacity", strokeOpacity)
      .attr("stroke-width", d => strokeWidth * (d.wMult ?? 1))
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

  } else {
    // Alluvial
    gLinks.selectAll("path.link")
      .data(linksSorted.filter(d => d.x0 != null), (d, i) => `${d.source}-->${d.target}#${i}`)
      .join("path")
      .attr("class", "link")
      .attr("d", ribbonPath)
      .attr("fill", d => colorForAffect(d.affect))
      .attr("fill-opacity", RIBBON.opacity);
  }
}

