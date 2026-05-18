import { select, axisBottom, axisLeft, axisTop, ScaleLinear, Selection } from "d3";
import { TooltipRef } from "@/components/chart-tooltip";
import { TooltipData } from "./types";

const INVERTED_Y_AXIS = false;

export type ChartSize = { width: number; height: number };

export type ChartMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PositionScales = {
  x: ScaleLinear<number, number>;
  y: ScaleLinear<number, number>;
};

interface InteractionConfig<T> {
  getCrosshairPos: (d: T) => { x: number; y: number };
  getTooltipData: (d: T) => TooltipData;
  onHoverIn: (element: any, d: T) => void;
  onHoverOut: (element: any, d: T) => void;
}

type Data = any;

export const clearSvg = (svgElement: SVGSVGElement) => select(svgElement).selectAll("*").remove();

export const createSvgRoot = (svgElement: SVGSVGElement, width: number, height: number) => select(svgElement).attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

/**
 * Reusable function to draw standard X and Y axes.
 */
export function drawAxes(root: Selection<SVGSVGElement, unknown, null, undefined>, scales: PositionScales, size: ChartSize, margins: ChartMargins, xLabel: string, yLabel: string) {
  const { x, y } = scales;
  const { width, height } = size;

  const xAxisTransform = INVERTED_Y_AXIS ? `translate(0,${margins.top})` : `translate(0,${height - margins.bottom})`;

  const xAxisGenerator = INVERTED_Y_AXIS ? axisTop(x) : axisBottom(x);

  // 2. Draw the X Axis
  root
    .append("g")
    .attr("transform", xAxisTransform)
    .call(
      xAxisGenerator
        .ticks(Math.max(2, Math.floor(width / 120)), "d")
        .tickSize(0)
        .tickPadding(8),
    )
    .call((g) => g.select(".domain").attr("stroke", "#111827").attr("stroke-width", 1.2))
    .call((g) =>
      g
        .append("text")
        .attr("x", width - margins.right)
        .attr("y", INVERTED_Y_AXIS ? 16 : -4)
        .attr("fill", "currentColor")
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .text(xLabel),
    );

  // Y Axis
  root
    .append("g")
    .attr("transform", `translate(${margins.left},0)`)
    .call(axisLeft(y).ticks(6, "d").tickSize(0).tickPadding(8))
    .call((g) => g.select(".domain").attr("stroke", "#111827").attr("stroke-width", 1.2))
    .call((g) =>
      g
        .append("text")
        .attr("x", 8)
        .attr("y", INVERTED_Y_AXIS ? height - margins.bottom : margins.top)
        .attr("dy", INVERTED_Y_AXIS ? "-0.5em" : ".71em")
        .attr("fill", "currentColor")
        .attr("font-weight", "bold")
        .attr("text-anchor", "start")
        .text(yLabel),
    );
}

export function createClipPath(root: Selection<SVGSVGElement, unknown, null, undefined>, clipId: string, dimensions: { width: number; height: number }, margins: { top: number; right: number; bottom: number; left: number }) {
  const defs = root.select("defs").empty() ? root.append("defs") : root.select("defs");

  defs
    .append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("x", margins.left)
    .attr("y", margins.top)
    .attr("width", dimensions.width - margins.left - margins.right)
    .attr("height", dimensions.height - margins.top - margins.bottom);
}

export function createCrosshair(root: Selection<SVGSVGElement, unknown, null, undefined>, dimensions: { width: number; height: number }, margins: { top: number; right: number; bottom: number; left: number }) {
  const crosshairGroup = root.append("g").attr("class", "crosshair").style("opacity", 0).style("pointer-events", "none");

  const vLine = crosshairGroup.append("line").attr("stroke", "#9ca3af").attr("stroke-dasharray", "3 3").attr("stroke-width", 1);
  const hLine = crosshairGroup.append("line").attr("stroke", "#9ca3af").attr("stroke-dasharray", "3 3").attr("stroke-width", 1);

  return {
    show: (cx: number, cy: number) => {
      crosshairGroup.style("opacity", 1);

      vLine
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", margins.top)
        .attr("y2", dimensions.height - margins.bottom);
      hLine
        .attr("x1", margins.left)
        .attr("x2", dimensions.width - margins.right)
        .attr("y1", cy)
        .attr("y2", cy);
    },
    hide: () => crosshairGroup.style("opacity", 0),
  };
}

export function applyChartInteractions<T>(selection: Selection<any, T, any, any>, crosshair: { show: (x: number, y: number) => void; hide: () => void } | null, tooltip: TooltipRef | null, config: InteractionConfig<T>) {
  selection
    .on("mouseover", function (e, d) {
      config.onHoverIn(this, d);

      const pos = config.getCrosshairPos(d);
      crosshair?.show(pos.x, pos.y);

      tooltip?.show(config.getTooltipData(d), e.clientX, e.clientY);
    })
    .on("mousemove", function (e) {
      tooltip?.move(e.clientX, e.clientY);
    })
    .on("mouseout", function (e, d) {
      config.onHoverOut(this, d);

      // 3. Add the question mark here
      crosshair?.hide();

      tooltip?.hide();
    });
}
