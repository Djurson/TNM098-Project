"use client";

import { useEffect, useMemo, useRef } from "react";

import { createSvgRoot } from "@/lib/chart-utils";
import { LAYER_STYLES } from "@/lib/utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import type { EnrichedVenue } from "@/lib/types";
import { area, axisBottom, axisLeft, bisector, curveMonotoneX, extent, format, line, max, pointer, scaleLinear, scaleTime, timeFormat, zoom } from "d3";

const WIDTH = 900;
const HEIGHT = 360;
const MARGINS = { top: 20, right: 26, bottom: 46, left: 54 };
const DAYS_PER_MONTH = 30.4375;

const formatAxisDay = timeFormat("%b %d");
const formatTooltipDay = timeFormat("%A, %B %d, %Y");

export interface TrafficData {
  date: string;
  pubs: number;
  restaurants: number;
}

interface Props {
  data: TrafficData[];
  selectedVenueDaily?: { date: string; amount: number }[] | null;
  selectedVenue?: EnrichedVenue | null;
}

export function BusinessTrafficChart({ data, selectedVenueDaily, selectedVenue }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);

  const rows = useMemo(() => [...data].map((d) => ({ ...d, parsedDate: new Date(d.date + "T00:00:00Z") })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()), [data]);

  const venueRows = useMemo(() => {
    if (!selectedVenueDaily) return null;
    return selectedVenueDaily.map((d) => ({ ...d, parsedDate: new Date(d.date + "T00:00:00Z") })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [selectedVenueDaily]);

  useEffect(() => {
    if (!svgRef.current) return;

    const isVenueMode = !!venueRows?.length && !!selectedVenue;
    const sourceRows = isVenueMode ? venueRows! : rows;
    if (!sourceRows.length) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const innerWidth = WIDTH - MARGINS.left - MARGINS.right;
    const innerHeight = HEIGHT - MARGINS.bottom - MARGINS.top;

    const xScale = scaleTime()
      .domain(extent(sourceRows.map((d) => (d as { parsedDate: Date }).parsedDate)) as [Date, Date])
      .range([MARGINS.left, WIDTH - MARGINS.right]);

    const yMax = isVenueMode ? (max(venueRows!, (d) => d.amount) ?? 0) : (max(rows, (d) => Math.max(d.pubs, d.restaurants)) ?? 0);

    const yScale = scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    const clipId = "zoom-clip";
    root.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("x", MARGINS.left).attr("y", MARGINS.top).attr("width", innerWidth).attr("height", innerHeight);

    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "4 4"))
      .call((g) => g.select(".domain").remove());

    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .ticks(6)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((d) => format("$.2s")(+d)),
      )
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.select(".domain").remove());

    const xAxisGroup = root.append("g").attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`);
    const chartArea = root.append("g").attr("clip-path", `url(#${clipId})`);

    let currentXScale = xScale;

    if (isVenueMode) {
      type VRow = { date: string; amount: number; parsedDate: Date };
      const vRows = venueRows as VRow[];
      const venueColor = selectedVenue!.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color;

      const areaGen = area<VRow>()
        .x((d) => currentXScale(d.parsedDate))
        .y0(yScale(0))
        .y1((d) => yScale(d.amount))
        .curve(curveMonotoneX);
      const lineGen = line<VRow>()
        .x((d) => currentXScale(d.parsedDate))
        .y((d) => yScale(d.amount))
        .curve(curveMonotoneX);

      const pathArea = chartArea.append("path").datum(vRows).attr("fill", venueColor).attr("fill-opacity", 0.15).attr("d", areaGen);
      const pathLine = chartArea.append("path").datum(vRows).attr("fill", "none").attr("stroke", venueColor).attr("stroke-width", 2).attr("d", lineGen);

      // Compute intercept from monthly sums so the trend line aligns with the monthly regression
      let updateTrend: (() => void) | null = null;
      const byMonth = new Map<string, number>();
      for (const row of vRows) {
        const ym = row.date.slice(0, 7);
        byMonth.set(ym, (byMonth.get(ym) ?? 0) + row.amount);
      }
      const sortedMonths = [...byMonth.keys()].sort();
      const n = sortedMonths.length;

      if (n > 1) {
        const monthlyAmounts = sortedMonths.map((m) => byMonth.get(m)!);
        const mean_x = (n - 1) / 2;
        const mean_y = monthlyAmounts.reduce((a, b) => a + b, 0) / n;
        const intercept = mean_y - selectedVenue!.trend_slope * mean_x;
        const firstMonthMs = new Date(sortedMonths[0] + "-01T00:00:00Z").getTime();
        // Divide by DAYS_PER_MONTH to project monthly values onto the daily y-axis
        const getTrendY = (d: Date) => {
          const monthIdx = (d.getTime() - firstMonthMs) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);
          return Math.max(0, (intercept + selectedVenue!.trend_slope * monthIdx) / DAYS_PER_MONTH);
        };

        const trendGen = line<VRow>()
          .x((d) => currentXScale(d.parsedDate))
          .y((d) => yScale(getTrendY(d.parsedDate)));

        const trendEl = chartArea
          .append("path")
          .datum([vRows[0], vRows[vRows.length - 1]])
          .attr("fill", "none")
          .attr("stroke", venueColor)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "6 3")
          .attr("opacity", 0.4)
          .attr("d", trendGen);

        // Closure over currentXScale — updated before each call
        updateTrend = () => trendEl.attr("d", trendGen);
      }

      xAxisGroup
        .call(
          axisBottom(xScale)
            .tickFormat((d) => formatAxisDay(d as Date))
            .tickSize(0)
            .tickPadding(12),
        )
        .call((a) => a.selectAll("text").attr("fill", "#64748b"))
        .call((a) => a.select(".domain").remove());

      const crosshairGroup = root.append("g").style("opacity", 0).style("pointer-events", "none");
      const verticalLine = crosshairGroup
        .append("line")
        .attr("stroke", "#9ca3af")
        .attr("stroke-dasharray", "4 4")
        .attr("y1", MARGINS.top)
        .attr("y2", HEIGHT - MARGINS.bottom);
      const dot = crosshairGroup.append("circle").attr("r", 4).attr("fill", venueColor).attr("stroke", "#fff").attr("stroke-width", 2);
      const bisectDate = bisector((d: VRow) => d.parsedDate).center;

      root
        .append("rect")
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .call(
          zoom<SVGRectElement, unknown>()
            .scaleExtent([1, 15])
            .translateExtent([
              [MARGINS.left, 0],
              [WIDTH - MARGINS.right, HEIGHT],
            ])
            .extent([
              [MARGINS.left, 0],
              [WIDTH - MARGINS.right, HEIGHT],
            ])
            .on("zoom", (event) => {
              currentXScale = event.transform.rescaleX(xScale);
              pathArea.attr(
                "d",
                areaGen.x((d) => currentXScale(d.parsedDate)),
              );
              pathLine.attr(
                "d",
                lineGen.x((d) => currentXScale(d.parsedDate)),
              );
              updateTrend?.();
              xAxisGroup
                .call(
                  axisBottom(currentXScale)
                    .tickFormat((d) => formatAxisDay(d as Date))
                    .tickSize(0)
                    .tickPadding(12),
                )
                .call((a) => a.selectAll("text").attr("fill", "#64748b"))
                .call((a) => a.select(".domain").remove());
              crosshairGroup.style("opacity", 0);
              tooltipRef.current?.hide();
            }) as any,
        )
        .on("mousemove", (event) => {
          const mouseX = pointer(event)[0];
          if (mouseX < MARGINS.left || mouseX > WIDTH - MARGINS.right) {
            crosshairGroup.style("opacity", 0);
            tooltipRef.current?.hide();
            return;
          }
          const idx = bisectDate(vRows, currentXScale.invert(mouseX));
          const d = vRows[idx];
          if (!d) return;
          const cx = currentXScale(d.parsedDate);
          crosshairGroup.style("opacity", 1);
          verticalLine.attr("x1", cx).attr("x2", cx);
          dot.attr("cx", cx).attr("cy", yScale(d.amount));
          tooltipRef.current?.show(
            {
              title: formatTooltipDay(d.parsedDate),
              details: [
                { label: `${selectedVenue!.type === "pub" ? "Pub" : "Restaurant"} #${selectedVenue!.venueId}`, value: format("$,.0f")(d.amount) },
                { label: "Trend", value: selectedVenue!.trend_slope > 0 ? "↑ Growing" : "↓ Declining" },
              ],
            },
            event.clientX,
            event.clientY,
          );
        })
        .on("mouseout", () => {
          crosshairGroup.style("opacity", 0);
          tooltipRef.current?.hide();
        });
    } else {
      // Aggregate mode: all pubs vs all restaurants
      type ARow = { date: string; pubs: number; restaurants: number; parsedDate: Date };
      const aRows = rows as ARow[];

      const areaRest = area<ARow>()
        .x((d) => xScale(d.parsedDate))
        .y0(yScale(0))
        .y1((d) => yScale(d.restaurants))
        .curve(curveMonotoneX);
      const lineRest = line<ARow>()
        .x((d) => xScale(d.parsedDate))
        .y((d) => yScale(d.restaurants))
        .curve(curveMonotoneX);
      const areaPubs = area<ARow>()
        .x((d) => xScale(d.parsedDate))
        .y0(yScale(0))
        .y1((d) => yScale(d.pubs))
        .curve(curveMonotoneX);
      const linePubs = line<ARow>()
        .x((d) => xScale(d.parsedDate))
        .y((d) => yScale(d.pubs))
        .curve(curveMonotoneX);

      const pathRestArea = chartArea.append("path").datum(aRows).attr("fill", LAYER_STYLES.restaurants.color).attr("fill-opacity", 0.15).attr("d", areaRest);
      const pathRestLine = chartArea.append("path").datum(aRows).attr("fill", "none").attr("stroke", LAYER_STYLES.restaurants.color).attr("stroke-width", 2).attr("d", lineRest);
      const pathPubsArea = chartArea.append("path").datum(aRows).attr("fill", LAYER_STYLES.pubs.color).attr("fill-opacity", 0.15).attr("d", areaPubs);
      const pathPubsLine = chartArea.append("path").datum(aRows).attr("fill", "none").attr("stroke", LAYER_STYLES.pubs.color).attr("stroke-width", 2).attr("d", linePubs);

      xAxisGroup
        .call(
          axisBottom(xScale)
            .tickFormat((d) => formatAxisDay(d as Date))
            .tickSize(0)
            .tickPadding(12),
        )
        .call((a) => a.selectAll("text").attr("fill", "#64748b"))
        .call((a) => a.select(".domain").remove());

      const crosshairGroup = root.append("g").style("opacity", 0).style("pointer-events", "none");
      const verticalLine = crosshairGroup
        .append("line")
        .attr("stroke", "#9ca3af")
        .attr("stroke-dasharray", "4 4")
        .attr("y1", MARGINS.top)
        .attr("y2", HEIGHT - MARGINS.bottom);
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
          zoom<SVGRectElement, unknown>()
            .scaleExtent([1, 15])
            .translateExtent([
              [MARGINS.left, 0],
              [WIDTH - MARGINS.right, HEIGHT],
            ])
            .extent([
              [MARGINS.left, 0],
              [WIDTH - MARGINS.right, HEIGHT],
            ])
            .on("zoom", (event) => {
              currentXScale = event.transform.rescaleX(xScale);
              pathRestArea.attr(
                "d",
                areaRest.x((d) => currentXScale(d.parsedDate)),
              );
              pathRestLine.attr(
                "d",
                lineRest.x((d) => currentXScale(d.parsedDate)),
              );
              pathPubsArea.attr(
                "d",
                areaPubs.x((d) => currentXScale(d.parsedDate)),
              );
              pathPubsLine.attr(
                "d",
                linePubs.x((d) => currentXScale(d.parsedDate)),
              );
              xAxisGroup
                .call(
                  axisBottom(currentXScale)
                    .tickFormat((d) => formatAxisDay(d as Date))
                    .tickSize(0)
                    .tickPadding(12),
                )
                .call((a) => a.selectAll("text").attr("fill", "#64748b"))
                .call((a) => a.select(".domain").remove());
              crosshairGroup.style("opacity", 0);
              tooltipRef.current?.hide();
            }) as any,
        )
        .on("mousemove", (event) => {
          const mouseX = pointer(event)[0];
          if (mouseX < MARGINS.left || mouseX > WIDTH - MARGINS.right) {
            crosshairGroup.style("opacity", 0);
            tooltipRef.current?.hide();
            return;
          }
          const idx = bisectDate(aRows, currentXScale.invert(mouseX));
          const d = aRows[idx];
          if (!d) return;
          const cx = currentXScale(d.parsedDate);
          crosshairGroup.style("opacity", 1);
          verticalLine.attr("x1", cx).attr("x2", cx);
          restDot.attr("cx", cx).attr("cy", yScale(d.restaurants));
          pubsDot.attr("cx", cx).attr("cy", yScale(d.pubs));
          tooltipRef.current?.show(
            {
              title: formatTooltipDay(d.parsedDate),
              details: [
                { label: "Restaurants", value: format("$,.0f")(d.restaurants) },
                { label: "Pubs", value: format("$,.0f")(d.pubs) },
                { label: "Total Daily Revenue", value: format("$,.0f")(d.restaurants + d.pubs) },
              ],
            },
            event.clientX,
            event.clientY,
          );
        })
        .on("mouseout", () => {
          crosshairGroup.style("opacity", 0);
          tooltipRef.current?.hide();
        });
    }
  }, [rows, venueRows, selectedVenue]);

  const isVenueMode = !!venueRows?.length && !!selectedVenue;
  const venueColor = selectedVenue?.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color;

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Activity Analytics</p>
          <h2 className="text-xl font-semibold text-slate-900">Daily Revenue</h2>
          <p className="mt-0.5 text-xs text-slate-400">Scroll to zoom · drag to pan · hover for details</p>
        </div>
        <div className="flex flex-col items-end justify-end h-full gap-3 mt-auto">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {isVenueMode ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: venueColor }} />
                  {selectedVenue!.type === "pub" ? "Pub" : "Restaurant"} #{selectedVenue!.venueId}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="20" height="8">
                    <line x1="0" y1="4" x2="20" y2="4" strokeWidth="1.5" strokeDasharray="4 2" stroke={venueColor} strokeOpacity="0.5" />
                  </svg>
                  Trend
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.restaurants.color }} />
                  Restaurants
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.pubs.color }} />
                  Pubs
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden border rounded-lg border-slate-100 bg-white/80">
        <svg ref={svgRef} className="block w-full h-auto" />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
