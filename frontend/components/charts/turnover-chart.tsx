"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { select, axisLeft, max, scaleLinear, timeFormat } from "d3";

import { applyChartInteractions } from "@/lib/chart-utils";
import { COLORS } from "@/lib/utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeRangeDropdown } from "@/lib/types";

const HIRE_COLOR = COLORS[0];
const QUIT_COLOR = COLORS[21];

const HEIGHT = 360;
const MARGINS = { top: 20, right: 26, bottom: 68, left: 54 };
const BAR_GAP = 2;

const BAR_WIDTHS: Record<TimeRangeDropdown, number> = {
  day: 18,
  week: 32,
  month: 56,
};

const formatDay = timeFormat("%b %d, %Y");
const formatMonth = timeFormat("%B %Y");
const formatAxisDay = timeFormat("%b %d");
const formatAxisMonth = timeFormat("%b %Y");

const toDate = (value: string) => new Date(value + "T00:00:00Z");

export interface TurnoverData {
  date: string;
  hires: number;
  quits: number;
  headcount: number;
}

type AggregatedBar = {
  periodStart: Date;
  periodEnd: Date;
  hires: number;
  quits: number;
  headcount: number;
  days: number;
};

function startOfUTCWeek(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function aggregate(rows: TurnoverData[], range: TimeRangeDropdown): AggregatedBar[] {
  const parsedRows = rows.map((r) => ({ ...r, dateObj: toDate(r.date) }));

  if (range === "day") {
    return parsedRows.map((row) => ({
      periodStart: row.dateObj,
      periodEnd: new Date(row.dateObj.getTime() + 86400000),
      hires: row.hires,
      quits: row.quits,
      headcount: row.headcount,
      days: 1,
    }));
  }

  const groups = new Map<number, { periodStart: Date; periodEnd: Date; rows: typeof parsedRows }>();

  for (const row of parsedRows) {
    let periodStart: Date;
    let periodEnd: Date;

    if (range === "week") {
      periodStart = startOfUTCWeek(row.dateObj);
      periodEnd = new Date(periodStart.getTime() + 7 * 86400000);
    } else {
      const y = row.dateObj.getUTCFullYear();
      const m = row.dateObj.getUTCMonth();
      periodStart = new Date(Date.UTC(y, m, 1));
      periodEnd = new Date(Date.UTC(y, m + 1, 1));
    }

    const key = periodStart.getTime();
    if (!groups.has(key)) groups.set(key, { periodStart, periodEnd, rows: [] });
    groups.get(key)!.rows.push(row);
  }

  return Array.from(groups.values())
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
    .map(({ periodStart, periodEnd, rows: g }) => ({
      periodStart,
      periodEnd,
      hires: g.reduce((s, r) => s + r.hires, 0),
      quits: g.reduce((s, r) => s + r.quits, 0),
      headcount: g.length > 0 ? Math.round(g.reduce((s, r) => s + r.headcount, 0) / g.length) : 0,
      days: g.length,
    }));
}

export function TurnoverChart({ data }: { data: TurnoverData[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);

  // Direct DOM ref to the panning group — updated without React re-renders during drag
  const panGroupRef = useRef<SVGGElement | null>(null);
  const panXRef = useRef(0);
  const maxPanRef = useRef(0);
  const isDragging = useRef(false);
  const dragStartClientX = useRef(0);
  const dragStartPan = useRef(0);

  const [containerWidth, setContainerWidth] = useState(900);
  const [dataTimeRange, setDataTimeRange] = useState<TimeRangeDropdown>("day");

  const bars = useMemo(() => aggregate(data, dataTimeRange), [data, dataTimeRange]);
  const yMax = useMemo(() => max(bars, (d) => d.hires) ?? 0, [bars]);
  const yMin = useMemo(() => max(bars, (d) => d.quits) ?? 0, [bars]);

  // Measure container and watch for resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setContainerWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setContainerWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Reset pan when bars change (granularity switch or new data)
  useEffect(() => {
    panXRef.current = 0;
    panGroupRef.current?.setAttribute("transform", "translate(0,0)");
  }, [bars]);

  // D3 render — runs when data, granularity, or container width changes
  useEffect(() => {
    if (!svgRef.current || bars.length === 0 || containerWidth <= 0) return;

    const barWidth = BAR_WIDTHS[dataTimeRange];
    const plotWidth = bars.length * barWidth;
    const visibleW = containerWidth - MARGINS.left - MARGINS.right;

    // Update pan limits and clamp current offset after container resize
    maxPanRef.current = Math.max(0, plotWidth - visibleW);
    panXRef.current = Math.min(panXRef.current, maxPanRef.current);

    const svg = select(svgRef.current).attr("width", containerWidth).attr("height", HEIGHT);
    svg.selectAll("*").remove();

    // --- Y scale ---
    const yScale = scaleLinear()
      .domain([-yMin, yMax])
      .nice()
      .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    // --- Clip path: horizontal only (full height so x-axis labels aren't cut) ---
    svg.append("defs").append("clipPath").attr("id", "turnover-clip").append("rect").attr("x", MARGINS.left).attr("y", 0).attr("width", visibleW).attr("height", HEIGHT);

    // --- Gridlines ---
    svg
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .tickSize(-visibleW)
          .tickFormat(() => ""),
      )
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "4 4"))
      .call((g) => g.select("path").remove());

    // --- Zero line ---
    svg
      .append("line")
      .attr("x1", MARGINS.left)
      .attr("x2", MARGINS.left + visibleW)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.5);

    // --- Y axis (fixed, outside pan group) ---
    svg
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(axisLeft(yScale).ticks(6).tickSize(0).tickPadding(8))
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.select(".domain").remove());

    // --- Clip group → pan group (translated during drag without re-rendering) ---
    const clipGroup = svg.append("g").attr("clip-path", "url(#turnover-clip)");
    const panGroup = clipGroup.append("g").attr("transform", `translate(${-panXRef.current},0)`);
    panGroupRef.current = panGroup.node();

    // --- X axis labels (inside pan group, clipped) ---
    // Space labels so they're at least 52px apart (centre-to-centre) after rotation
    const tickEvery = Math.max(1, Math.ceil(52 / barWidth));
    const tickBars = bars.filter((_, i) => i % tickEvery === 0).map((bar, k) => ({ bar, i: k * tickEvery }));

    panGroup
      .append("g")
      .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom + 8})`)
      .selectAll<SVGTextElement, { bar: AggregatedBar; i: number }>("text")
      .data(tickBars)
      .join("text")
      .attr("transform", ({ i }) => `translate(${MARGINS.left + i * barWidth + barWidth / 2},0) rotate(-40)`)
      .attr("fill", "#64748b")
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .text(({ bar }) => (dataTimeRange === "month" ? formatAxisMonth(bar.periodStart) : formatAxisDay(bar.periodStart)));

    // --- Bars (inside pan group, clipped) ---
    const barW = Math.max(1, barWidth - BAR_GAP * 2);

    const barGroups = panGroup
      .append("g")
      .selectAll<SVGGElement, AggregatedBar>(".bar-group")
      .data(bars)
      .join("g")
      .attr("class", "bar-group")
      .attr("transform", (_, i) => `translate(${MARGINS.left + i * barWidth + BAR_GAP},0)`);

    barGroups
      .append("rect")
      .attr("class", "bar-segment")
      .attr("y", (d) => yScale(d.hires))
      .attr("width", barW)
      .attr("height", (d) => Math.max(0, yScale(0) - yScale(d.hires)))
      .attr("fill", HIRE_COLOR)
      .attr("fill-opacity", 0.85);

    barGroups
      .append("rect")
      .attr("class", "bar-segment")
      .attr("y", yScale(0))
      .attr("width", barW)
      .attr("height", (d) => Math.max(0, yScale(-d.quits) - yScale(0)))
      .attr("fill", QUIT_COLOR)
      .attr("fill-opacity", 0.85);

    // Transparent hit area
    barGroups
      .append("rect")
      .attr("y", (d) => yScale(d.hires))
      .attr("width", barW)
      .attr("height", (d) => Math.max(0, yScale(-d.quits) - yScale(d.hires)))
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    // --- Tooltip interactions ---
    const formatTitle = (d: AggregatedBar) => {
      if (dataTimeRange === "month") return formatMonth(d.periodStart);
      if (dataTimeRange === "week") {
        const weekEnd = new Date(d.periodEnd.getTime() - 86400000);
        return `${timeFormat("%b %d")(d.periodStart)} – ${timeFormat("%b %d, %Y")(weekEnd)}`;
      }
      return formatDay(d.periodStart);
    };

    applyChartInteractions(barGroups, null, tooltipRef.current, {
      getCrosshairPos: () => ({ x: 0, y: 0 }),
      getTooltipData: (d) => {
        const turnoverRate = d.headcount > 0 ? ((d.hires + d.quits) / d.headcount) * 100 : 0;
        return {
          title: formatTitle(d),
          details: [
            { label: "Hires", value: d.hires },
            { label: "Quits", value: d.quits },
            { label: "Net Change", value: d.hires - d.quits },
            { label: "Headcount", value: d.headcount },
            { label: "Turnover Rate", value: `${turnoverRate.toFixed(1)}%` },
          ],
        };
      },
      onHoverIn: (el: SVGGElement) => {
        if (isDragging.current) return;
        el.querySelectorAll<SVGRectElement>(".bar-segment").forEach((r) => r.setAttribute("fill-opacity", "1"));
      },
      onHoverOut: (el: SVGGElement) => el.querySelectorAll<SVGRectElement>(".bar-segment").forEach((r) => r.setAttribute("fill-opacity", "0.85")),
    });
  }, [bars, dataTimeRange, containerWidth, yMax, yMin]);

  // --- Drag handlers (direct DOM, no re-render) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (maxPanRef.current === 0 || e.button !== 0) return;
    isDragging.current = true;
    dragStartClientX.current = e.clientX;
    dragStartPan.current = panXRef.current;
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !panGroupRef.current) return;
    const dx = dragStartClientX.current - e.clientX;
    const newPan = Math.max(0, Math.min(maxPanRef.current, dragStartPan.current + dx));
    panXRef.current = newPan;
    panGroupRef.current.setAttribute("transform", `translate(${-newPan},0)`);
  }, []);

  const stopDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
    tooltipRef.current?.hide();
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Employer Analytics</p>
          <h2 className="text-xl font-semibold text-slate-900">Hiring vs. Quits</h2>
          <p className="mt-0.5 text-xs text-slate-400">Turnover volume · drag to pan · hover bars for details</p>
        </div>
        <div className="flex flex-col items-end justify-end h-full gap-3 mt-auto">
          <Select value={dataTimeRange} onValueChange={(v) => setDataTimeRange(v as TimeRangeDropdown)}>
            <SelectTrigger className="w-32 rounded-lg shadow-sm border-slate-200 bg-white/90" aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="day" className="rounded-lg">
                Day
              </SelectItem>
              <SelectItem value="week" className="rounded-lg">
                Week
              </SelectItem>
              <SelectItem value="month" className="rounded-lg">
                Month
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: HIRE_COLOR }} />
              Hires
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: QUIT_COLOR }} />
              Quits
            </span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative border rounded-lg border-slate-100 bg-white/80"
        style={{ overflow: "hidden", cursor: "grab", userSelect: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}>
        <svg ref={svgRef} style={{ display: "block" }} />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
