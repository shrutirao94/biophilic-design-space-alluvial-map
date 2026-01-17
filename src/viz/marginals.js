// src/viz/marginals.js
// Minimal, reusable marginal dot-strip renderer.
// Designed for publication: low visual weight, aligned to existing node centres.

import * as d3 from "d3";

/**
 * Draw a vertical dot strip aligned to category y-centres.
 *
 * @param {Object} args
 * @param {d3.Selection} args.g           - parent group to draw into
 * @param {Array<string>} args.categories - ordered labels
 * @param {Map<string, number>} args.totalsByCategory - label -> count
 * @param {(label:string)=>number|null} args.yOfLabel - label -> y centre (must match plot)
 * @param {number} args.x                - x position of dots
 * @param {number} args.rMin             - minimum dot radius
 * @param {number} args.rMax             - maximum dot radius
 * @param {(label:string)=>string} [args.fill] - optional colour per label
 * @param {number} [args.fillOpacity]    - dot opacity
 * @param {string} [args.stroke]         - dot stroke
 * @param {number} [args.strokeOpacity]  - stroke opacity
 * @param {number} [args.strokeWidth]    - stroke width
 * @param {string} [args.className]      - css class
 */
export function drawDotStrip({
  g,
  categories,
  totalsByCategory,
  yOfLabel,
  x,
  rMin = 2.5,
  rMax = 10,
  fill = () => "#111827",
  fillOpacity = 0.18,
  stroke = "rgba(17,24,39,0.25)",
  strokeOpacity = 0.6,
  strokeWidth = 1,
  className = "marginal-dot",
}) {
  const vals = categories
    .map((lab) => totalsByCategory.get(lab) || 0)
    .filter((v) => Number.isFinite(v));

  const vMax = vals.length ? d3.max(vals) : 1;

  const r = d3
    .scaleSqrt()
    .domain([0, vMax || 1])
    .range([rMin, rMax]);

  const data = categories
    .map((label) => {
      const y = yOfLabel(label);
      if (!Number.isFinite(y)) return null;
      return { label, y, v: totalsByCategory.get(label) || 0 };
    })
    .filter(Boolean);

  const sel = g
    .selectAll(`circle.${className}`)
    .data(data, (d) => d.label);

  sel
    .join("circle")
    .attr("class", className)
    .attr("cx", x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => r(d.v))
    .attr("fill", (d) => fill(d.label))
    .attr("fill-opacity", fillOpacity)
    .attr("stroke", stroke)
    .attr("stroke-opacity", strokeOpacity)
    .attr("stroke-width", strokeWidth);
}

