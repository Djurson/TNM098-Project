import { extent, format, interpolateOrRd, max, scaleLinear, scaleSequential, select, sum, axisBottom, axisLeft, axisTop, type ScaleLinear, type ScaleSequential, type Selection } from "d3";
import { GRAPH_MARGIN_BOTTOM, GRAPH_MARGIN_LEFT, GRAPH_MARGIN_RIGHT, GRAPH_MARGIN_TOP } from "./utils";
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

export function createPositionScales(
  data: Data[],
  size: ChartSize,
  margins: ChartMargins = {
    top: GRAPH_MARGIN_TOP,
    bottom: GRAPH_MARGIN_BOTTOM,
    left: GRAPH_MARGIN_LEFT,
    right: GRAPH_MARGIN_RIGHT,
  },
): PositionScales | undefined {
  const xExtent = extent(data, (d) => d.position.x);
  const yExtent = extent(data, (d) => d.position.y);

  if (xExtent[0] === undefined || xExtent[1] === undefined || yExtent[0] === undefined || yExtent[1] === undefined) return;

  const x = scaleLinear()
    .domain([xExtent[0], xExtent[1] + 100])
    .nice()
    .rangeRound([margins.left, size.width - margins.right]);

  const y = scaleLinear()
    .domain(yExtent)
    .nice()
    .rangeRound(INVERTED_Y_AXIS ? [margins.top, size.height - margins.bottom] : [size.height - margins.bottom, margins.top]);

  return { x, y };
}

// export function createDensityColorScale(bins: HexbinBin<EyeTrackDataPoint>[]): {
//   scale: ScaleSequential<string, never>;
//   domain: [number, number];
// } {
//   const maxDuration = max(bins, (bin) => sum(bin, (d) => d.gazeDuration)) || 1;
//   const domain: [number, number] = [0, maxDuration];
//   const scale = scaleSequential(interpolateOrRd).domain(domain);

//   return { scale, domain };
// }

export function calculateContextSvgWidth(colorDomain: [number, number], legend_text: string) {
  const measureTextWidth = (text: string, font = "600 12px sans-serif") => {
    if (typeof document === "undefined") return text.length * 8;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return text.length * 8;

    context.font = font;
    return Math.ceil(context.measureText(text).width);
  };

  const legendWidth = 28;
  const tickLabelFormat = format("d");
  const tickLabels = scaleLinear()
    .domain(colorDomain)
    .ticks(5)
    .map((tick) => tickLabelFormat(tick));
  const maxTickWidth = Math.max(...tickLabels.map((label) => measureTextWidth(label)), 0);
  const labelWidth = measureTextWidth(legend_text);

  const horizontalPadding = 8;
  const axisBlockWidth = legendWidth + 6 + maxTickWidth;
  const contentWidth = Math.max(axisBlockWidth, labelWidth);

  return horizontalPadding * 2 + contentWidth;
}

/**
 * Creates an opacity scale based on GazeDuration.
 * Maps the minimum duration to minOpacity and the max duration to maxOpacity.
 */
export function createOpacityScale(data: Data[], minOpacity: number = 0.15, maxOpacity: number = 0.85): ScaleLinear<number, number> {
  const maxDuration = max(data, (d) => d.gazeDuration) || 1;
  return scaleLinear().domain([0, maxDuration]).range([minOpacity, maxOpacity]);
}

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

export function initializeBasePlot(config: { svgElement: SVGSVGElement | null; data: Data[]; width: number; height: number; margins?: { top: number; right: number; bottom: number; left: number }; xAxisLabel: string; yAxisLabel: string; clipId: string }) {
  if (!config.margins)
    config.margins = {
      top: GRAPH_MARGIN_TOP,
      bottom: GRAPH_MARGIN_BOTTOM,
      left: GRAPH_MARGIN_LEFT,
      right: GRAPH_MARGIN_RIGHT,
    };

  const { svgElement, data, width, height, margins, xAxisLabel, yAxisLabel, clipId } = config;

  if (!svgElement || !width || !height || data.length === 0) {
    if (svgElement) clearSvg(svgElement);
    return null;
  }

  // Create Scales
  const scales = createPositionScales(data, { width, height });
  if (!scales) {
    clearSvg(svgElement);
    return null;
  }

  // Setup SVG Root
  const root = createSvgRoot(svgElement, width, height);
  root.selectAll("*").remove();

  // Draw standard base elements
  drawAxes(root, scales, { width, height }, margins, xAxisLabel, yAxisLabel);
  createClipPath(root, clipId, { width, height }, margins);

  // Create Crosshair
  const crosshair = createCrosshair(root, { width, height }, margins);

  return { root, scales, crosshair };
}

export function applyChartInteractions<T>(selection: Selection<any, T, any, any>, crosshair: { show: (x: number, y: number) => void; hide: () => void }, tooltip: TooltipRef | null, config: InteractionConfig<T>) {
  selection
    .on("mouseover", function (e, d) {
      config.onHoverIn(this, d);

      const pos = config.getCrosshairPos(d);
      crosshair.show(pos.x, pos.y);

      tooltip?.show(config.getTooltipData(d), e.clientX, e.clientY);
    })
    .on("mousemove", (e) => tooltip?.move(e.clientX, e.clientY))
    .on("mouseout", function (e, d) {
      config.onHoverOut(this, d);

      crosshair.hide();
      tooltip?.hide();
    });
}
