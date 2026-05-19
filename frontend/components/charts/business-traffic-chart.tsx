"use client";

import { useState, useEffect, useMemo, useRef, type RefObject } from "react";
import { createSvgRoot } from "@/lib/chart-utils";
import { LAYER_STYLES } from "@/lib/utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import type { EnrichedVenue } from "@/lib/types";
import { area, axisBottom, axisLeft, bisector, curveMonotoneX, extent, format, line, max, pointer, scaleLinear, scaleTime, timeFormat, zoom, type ScaleTime, type ScaleLinear, type ZoomBehavior, type Selection } from "d3";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard } from "@/components/ui/chart-card";
import { CircleDollarSign, Footprints } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const WIDTH = 900;
const HEIGHT = 360;
const MARGINS = { top: 20, right: 26, bottom: 46, left: 54 };
const DAYS_PER_MONTH = 30.4375;

const formatAxisDay = timeFormat("%b %d");
const formatTooltipDay = timeFormat("%A, %B %d, %Y");

// ── Types ─────────────────────────────────────────────────────────────────────

type Metric = "revenue" | "checkins";
type SvgRoot = Selection<SVGSVGElement, unknown, null, undefined>;
type XScale = ScaleTime<number, number>;
type YScale = ScaleLinear<number, number>;
type XScaleRef = { current: XScale };

export interface TrafficData {
  date: string;
  pubs: number;
  restaurants: number;
  pubCheckins: number;
  restaurantCheckins: number;
}

interface Props {
  data: TrafficData[];
  selectedVenueDaily?: { date: string; amount: number; checkins: number }[] | null;
  selectedVenue?: EnrichedVenue | null;
}

type VRow = { date: string; amount: number; checkins: number; parsedDate: Date };
type ARow = TrafficData & { parsedDate: Date };

// ── D3 helpers ────────────────────────────────────────────────────────────────

function buildMetricAccessors(metric: Metric) {
  const rev = metric === "revenue";
  return {
    getVenueVal: (d: VRow) => (rev ? d.amount : d.checkins),
    getRestVal: (d: ARow) => (rev ? d.restaurants : d.restaurantCheckins),
    getPubsVal: (d: ARow) => (rev ? d.pubs : d.pubCheckins),
    fmtValue: rev ? format("$,.0f") : format(",.0f"),
    fmtAxis: rev ? (d: number) => format("$.2s")(d) : (d: number) => format(".2s")(d),
  };
}

function buildChartScaffold(root: SvgRoot, xScale: XScale, yScale: YScale, innerWidth: number, innerHeight: number, fmtAxis: (d: number) => string) {
  const { top, bottom, left } = MARGINS;

  root.append("defs").append("clipPath").attr("id", "zoom-clip").append("rect").attr("x", left).attr("y", top).attr("width", innerWidth).attr("height", innerHeight);

  // Grid lines
  root
    .append("g")
    .attr("transform", `translate(${left},0)`)
    .call(
      axisLeft(yScale)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat(() => ""),
    )
    .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "4 4"))
    .call((g) => g.select(".domain").remove());

  // Y-axis labels
  root
    .append("g")
    .attr("transform", `translate(${left},0)`)
    .call(
      axisLeft(yScale)
        .ticks(6)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d) => fmtAxis(+d)),
    )
    .call((a) => a.selectAll("text").attr("fill", "#64748b"))
    .call((a) => a.select(".domain").remove());

  const xAxisGroup = root.append("g").attr("transform", `translate(0,${HEIGHT - bottom})`);
  const chartArea = root.append("g").attr("clip-path", "url(#zoom-clip)");

  const crosshairGroup = root.append("g").style("opacity", 0).style("pointer-events", "none");
  const verticalLine = crosshairGroup
    .append("line")
    .attr("stroke", "#9ca3af")
    .attr("stroke-dasharray", "4 4")
    .attr("y1", top)
    .attr("y2", HEIGHT - bottom);

  const renderXAxis = (xSc: XScale) =>
    xAxisGroup
      .call(
        axisBottom(xSc)
          .tickFormat((d) => formatAxisDay(d as Date))
          .tickSize(0)
          .tickPadding(12),
      )
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.select(".domain").remove());

  renderXAxis(xScale);

  return { chartArea, crosshairGroup, verticalLine, renderXAxis };
}

type ChartScaffold = ReturnType<typeof buildChartScaffold>;

function buildZoomBehavior(): ZoomBehavior<SVGRectElement, unknown> {
  const { left, right } = MARGINS;
  return zoom<SVGRectElement, unknown>()
    .scaleExtent([1, 15])
    .translateExtent([
      [left, 0],
      [WIDTH - right, HEIGHT],
    ])
    .extent([
      [left, 0],
      [WIDTH - right, HEIGHT],
    ]);
}

function buildTrendLine(chartArea: ChartScaffold["chartArea"], vRows: VRow[], venueColor: string, yScale: YScale, xScaleRef: XScaleRef, getVal: (d: VRow) => number, slope: number): (() => void) | null {
  const byMonth = new Map<string, number>();
  for (const row of vRows) byMonth.set(row.date.slice(0, 7), (byMonth.get(row.date.slice(0, 7)) ?? 0) + getVal(row));

  const months = [...byMonth.keys()].sort();
  if (months.length < 2) return null;

  const totals = months.map((m) => byMonth.get(m)!);
  const mean_y = totals.reduce((a, b) => a + b, 0) / months.length;
  const intercept = mean_y - slope * ((months.length - 1) / 2);
  const t0 = new Date(months[0] + "-01T00:00:00Z").getTime();

  const getTrendY = (d: Date) => {
    const idx = (d.getTime() - t0) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);
    return Math.max(0, (intercept + slope * idx) / DAYS_PER_MONTH);
  };

  const trendGen = line<VRow>()
    .x((d) => xScaleRef.current(d.parsedDate))
    .y((d) => yScale(getTrendY(d.parsedDate)));

  const trendEl = chartArea
    .append("path")
    .datum([vRows[0], vRows[vRows.length - 1]])
    .attr("fill", "none")
    .attr("stroke", venueColor)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6 3")
    .attr("opacity", 0.8)
    .attr("d", trendGen);

  return () => trendEl.attr("d", trendGen);
}

function drawVenueSeries(
  root: SvgRoot,
  scaffold: ChartScaffold,
  zoomBase: ZoomBehavior<SVGRectElement, unknown>,
  xScaleRef: XScaleRef,
  xScale: XScale,
  yScale: YScale,
  vRows: VRow[],
  venueColor: string,
  metric: Metric,
  venue: EnrichedVenue,
  getVenueVal: (d: VRow) => number,
  fmtValue: (v: number) => string,
  tooltipRef: RefObject<TooltipRef | null>,
) {
  const { chartArea, crosshairGroup, verticalLine, renderXAxis } = scaffold;
  const { left, right } = MARGINS;

  const areaGen = area<VRow>()
    .x((d) => xScaleRef.current(d.parsedDate))
    .y0(yScale(0))
    .y1((d) => yScale(getVenueVal(d)))
    .curve(curveMonotoneX);
  const lineGen = line<VRow>()
    .x((d) => xScaleRef.current(d.parsedDate))
    .y((d) => yScale(getVenueVal(d)))
    .curve(curveMonotoneX);

  const pathArea = chartArea.append("path").datum(vRows).attr("fill", venueColor).attr("fill-opacity", 0.15).attr("d", areaGen);
  const pathLine = chartArea.append("path").datum(vRows).attr("fill", "none").attr("stroke", venueColor).attr("stroke-width", 2).attr("d", lineGen);

  const trendSlope = metric === "revenue" ? venue.amount_trend_slope : venue.checkin_trend_slope;
  const updateTrend = buildTrendLine(chartArea, vRows, venueColor, yScale, xScaleRef, getVenueVal, trendSlope);

  const dot = crosshairGroup.append("circle").attr("r", 4).attr("fill", venueColor).attr("stroke", "#fff").attr("stroke-width", 2);
  const bisectDate = bisector((d: VRow) => d.parsedDate).center;

  root
    .append("rect")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .call(
      zoomBase.on("zoom", (event) => {
        xScaleRef.current = event.transform.rescaleX(xScale);
        pathArea.attr("d", areaGen);
        pathLine.attr("d", lineGen);
        updateTrend?.();
        renderXAxis(xScaleRef.current);
        crosshairGroup.style("opacity", 0);
        tooltipRef.current?.hide();
      }) as any,
    )
    .on("mousemove", (ev) => {
      const mouseX = pointer(ev)[0];
      if (mouseX < left || mouseX > WIDTH - right) {
        crosshairGroup.style("opacity", 0);
        tooltipRef.current?.hide();
        return;
      }
      const d = vRows[bisectDate(vRows, xScaleRef.current.invert(mouseX))];
      if (!d) return;
      const cx = xScaleRef.current(d.parsedDate);
      crosshairGroup.style("opacity", 1);
      verticalLine.attr("x1", cx).attr("x2", cx);
      dot.attr("cx", cx).attr("cy", yScale(getVenueVal(d)));
      tooltipRef.current?.show(
        {
          title: formatTooltipDay(d.parsedDate),
          details: [
            { label: `${venue.type === "pub" ? "Pub" : "Restaurant"} #${venue.venueId}`, value: fmtValue(getVenueVal(d)) },
            { label: "Trend", value: trendSlope > 0 ? "↑ Growing" : "↓ Declining" },
          ],
        },
        ev.clientX,
        ev.clientY,
      );
    })
    .on("mouseout", () => {
      crosshairGroup.style("opacity", 0);
      tooltipRef.current?.hide();
    });
}

function drawAggregateSeries(
  root: SvgRoot,
  scaffold: ChartScaffold,
  zoomBase: ZoomBehavior<SVGRectElement, unknown>,
  xScaleRef: XScaleRef,
  xScale: XScale,
  yScale: YScale,
  aRows: ARow[],
  metric: Metric,
  getRestVal: (d: ARow) => number,
  getPubsVal: (d: ARow) => number,
  fmtValue: (v: number) => string,
  tooltipRef: RefObject<TooltipRef | null>,
) {
  const { chartArea, crosshairGroup, verticalLine, renderXAxis } = scaffold;
  const { left, right } = MARGINS;

  // Generators close over xScaleRef.current — reassigning before re-calling is enough for zoom
  const mkArea = (fn: (d: ARow) => number) =>
    area<ARow>()
      .x((d) => xScaleRef.current(d.parsedDate))
      .y0(yScale(0))
      .y1((d) => yScale(fn(d)))
      .curve(curveMonotoneX);
  const mkLine = (fn: (d: ARow) => number) =>
    line<ARow>()
      .x((d) => xScaleRef.current(d.parsedDate))
      .y((d) => yScale(fn(d)))
      .curve(curveMonotoneX);

  const areaRest = mkArea(getRestVal),
    lineRest = mkLine(getRestVal);
  const areaPubs = mkArea(getPubsVal),
    linePubs = mkLine(getPubsVal);

  const pathRestArea = chartArea.append("path").datum(aRows).attr("fill", LAYER_STYLES.restaurants.color).attr("fill-opacity", 0.15).attr("d", areaRest);
  const pathRestLine = chartArea.append("path").datum(aRows).attr("fill", "none").attr("stroke", LAYER_STYLES.restaurants.color).attr("stroke-width", 2).attr("d", lineRest);
  const pathPubsArea = chartArea.append("path").datum(aRows).attr("fill", LAYER_STYLES.pubs.color).attr("fill-opacity", 0.15).attr("d", areaPubs);
  const pathPubsLine = chartArea.append("path").datum(aRows).attr("fill", "none").attr("stroke", LAYER_STYLES.pubs.color).attr("stroke-width", 2).attr("d", linePubs);

  const restDot = crosshairGroup.append("circle").attr("r", 4).attr("fill", LAYER_STYLES.restaurants.color).attr("stroke", "#fff").attr("stroke-width", 2);
  const pubsDot = crosshairGroup.append("circle").attr("r", 4).attr("fill", LAYER_STYLES.pubs.color).attr("stroke", "#fff").attr("stroke-width", 2);
  const bisectDate = bisector((d: ARow) => d.parsedDate).center;

  root
    .append("rect")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .call(
      zoomBase.on("zoom", (event) => {
        xScaleRef.current = event.transform.rescaleX(xScale);
        pathRestArea.attr("d", areaRest);
        pathRestLine.attr("d", lineRest);
        pathPubsArea.attr("d", areaPubs);
        pathPubsLine.attr("d", linePubs);
        renderXAxis(xScaleRef.current);
        crosshairGroup.style("opacity", 0);
        tooltipRef.current?.hide();
      }) as any,
    )
    .on("mousemove", (ev) => {
      const mouseX = pointer(ev)[0];
      if (mouseX < left || mouseX > WIDTH - right) {
        crosshairGroup.style("opacity", 0);
        tooltipRef.current?.hide();
        return;
      }
      const d = aRows[bisectDate(aRows, xScaleRef.current.invert(mouseX))];
      if (!d) return;
      const cx = xScaleRef.current(d.parsedDate);
      crosshairGroup.style("opacity", 1);
      verticalLine.attr("x1", cx).attr("x2", cx);
      restDot.attr("cx", cx).attr("cy", yScale(getRestVal(d)));
      pubsDot.attr("cx", cx).attr("cy", yScale(getPubsVal(d)));
      tooltipRef.current?.show(
        {
          title: formatTooltipDay(d.parsedDate),
          details: [
            { label: "Restaurants", value: fmtValue(getRestVal(d)) },
            { label: "Pubs", value: fmtValue(getPubsVal(d)) },
            { label: metric === "revenue" ? "Total Daily Revenue" : "Total Check-ins", value: fmtValue(getRestVal(d) + getPubsVal(d)) },
          ],
        },
        ev.clientX,
        ev.clientY,
      );
    })
    .on("mouseout", () => {
      crosshairGroup.style("opacity", 0);
      tooltipRef.current?.hide();
    });
}

// ── UI sub-components ─────────────────────────────────────────────────────────

interface LegendProps {
  isVenueMode: boolean;
  selectedVenue: EnrichedVenue | null | undefined;
  venueColor: string;
}

function ChartLegend({ isVenueMode, selectedVenue, venueColor }: LegendProps) {
  if (isVenueMode && selectedVenue) {
    return (
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: venueColor }} />
          {selectedVenue.type === "pub" ? "Pub" : "Restaurant"} #{selectedVenue.venueId}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8">
            <line x1="0" y1="4" x2="20" y2="4" strokeWidth="1.5" strokeDasharray="4 2" stroke={venueColor} strokeOpacity="0.5" />
          </svg>
          Trend
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.restaurants.color }} />
        Restaurants
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.pubs.color }} />
        Pubs
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BusinessTrafficChart({ data, selectedVenueDaily, selectedVenue }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);
  const [metric, setMetric] = useState<Metric>("revenue");

  const rows = useMemo(() => [...data].map((d) => ({ ...d, parsedDate: new Date(d.date + "T00:00:00Z") })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()), [data]);

  const venueRows = useMemo(() => {
    if (!selectedVenueDaily) return null;
    return selectedVenueDaily.map((d) => ({ ...d, parsedDate: new Date(d.date + "T00:00:00Z") })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [selectedVenueDaily]);

  useEffect(() => {
    if (!svgRef.current) return;

    const isVenueMode = !!venueRows?.length && !!selectedVenue;
    if (!(isVenueMode ? venueRows!.length : rows.length)) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const innerWidth = WIDTH - MARGINS.left - MARGINS.right;
    const innerHeight = HEIGHT - MARGINS.top - MARGINS.bottom;

    const { getVenueVal, getRestVal, getPubsVal, fmtValue, fmtAxis } = buildMetricAccessors(metric);

    const sourceRows = isVenueMode ? (venueRows as VRow[]) : (rows as ARow[]);
    const xScale = scaleTime()
      .domain(extent(sourceRows.map((d) => d.parsedDate)) as [Date, Date])
      .range([MARGINS.left, WIDTH - MARGINS.right]);

    const yMax = isVenueMode ? (max(venueRows as VRow[], getVenueVal) ?? 0) : (max(rows as ARow[], (d) => Math.max(getPubsVal(d), getRestVal(d))) ?? 0);
    const yScale = scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    const xScaleRef: XScaleRef = { current: xScale };
    const scaffold = buildChartScaffold(root, xScale, yScale, innerWidth, innerHeight, fmtAxis);
    const zoomBase = buildZoomBehavior();

    if (isVenueMode) {
      const vRows = venueRows as VRow[];
      const venueColor = selectedVenue!.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color;
      drawVenueSeries(root, scaffold, zoomBase, xScaleRef, xScale, yScale, vRows, venueColor, metric, selectedVenue!, getVenueVal, fmtValue, tooltipRef);
    } else {
      drawAggregateSeries(root, scaffold, zoomBase, xScaleRef, xScale, yScale, rows as ARow[], metric, getRestVal, getPubsVal, fmtValue, tooltipRef);
    }
  }, [rows, venueRows, selectedVenue, metric]);

  const isVenueMode = !!venueRows?.length && !!selectedVenue;
  const venueColor = selectedVenue?.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color;

  return (
    <ChartCard
      eyebrow="Activity Analytics"
      title={metric === "revenue" ? "Daily Revenue" : "Daily Check-ins"}
      hint="Scroll to zoom · drag to pan · hover for details"
      actions={
        <div className="flex flex-col items-end gap-3">
          <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <TabsList>
              <TabsTrigger value="revenue">
                <CircleDollarSign />
                Daily Revenue
              </TabsTrigger>
              <TabsTrigger value="checkins">
                <Footprints />
                Check-ins
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ChartLegend isVenueMode={isVenueMode} selectedVenue={selectedVenue} venueColor={venueColor} />
        </div>
      }>
      <svg ref={svgRef} className="block w-full h-auto" />
      <ChartTooltip ref={tooltipRef} />
    </ChartCard>
  );
}
