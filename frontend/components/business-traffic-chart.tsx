"use client";

import * as d3 from "d3";
import { Check, Layers } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { applyChartInteractions, createSvgRoot } from "@/lib/chart-utils";
import { COLORS } from "@/lib/utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BusinessTrafficDataset } from "@/lib/types";

const WIDTH = 900;
const HEIGHT = 360;
const MARGINS = { top: 28, right: 26, bottom: 46, left: 54 };

const TOTAL_LINE = { label: "All businesses", color: "#0f172a" };
const PUB_TOTAL_LINE = { label: "Pubs total", color: COLORS[5] };
const RESTAURANT_TOTAL_LINE = { label: "Restaurants total", color: COLORS[6] };

const MAX_DEFAULT_VENUES = 5;

const formatDate = d3.timeFormat("%b %d, %Y");
const formatAxisDate = d3.timeFormat("%b %Y");

const toDate = (value: string) => new Date(value + "T00:00:00Z");

type ChartPoint = {
  date: Date;
  dateLabel: string;
  value: number;
  seriesId: string;
  label: string;
  color: string;
  strokeWidth: number;
};

export function BusinessTrafficChart({ data }: { data: BusinessTrafficDataset }) {
  const [selectedVenueIds, setSelectedVenueIds] = useState<number[]>([]);
  const [showTotal, setShowTotal] = useState(true);
  const [showTypeTotals, setShowTypeTotals] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);
  // Persists zoom level across series toggle re-renders
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const venuesById = useMemo(() => new Map(data.venues.map((venue) => [venue.venueId, venue])), [data.venues]);

  const sortedVenues = useMemo(
    () => [...data.venues].sort((a, b) => b.totalCheckins - a.totalCheckins),
    [data.venues],
  );

  useEffect(() => {
    if (selectedVenueIds.length > 0 || sortedVenues.length === 0) return;
    setSelectedVenueIds(sortedVenues.slice(0, MAX_DEFAULT_VENUES).map((venue) => venue.venueId));
  }, [selectedVenueIds.length, sortedVenues]);

  const summarySeries = useMemo(() => {
    const points = data.summary.map((row) => ({
      date: toDate(row.date),
      dateLabel: row.date,
      value: row.total,
    }));
    return { id: "total", label: TOTAL_LINE.label, color: TOTAL_LINE.color, points, strokeWidth: 2.4 };
  }, [data.summary]);

  const typeSeries = useMemo(() => {
    if (!showTypeTotals) return [];
    const pubs = data.summary.map((row) => ({ date: toDate(row.date), dateLabel: row.date, value: row.pubs }));
    const restaurants = data.summary.map((row) => ({ date: toDate(row.date), dateLabel: row.date, value: row.restaurants }));
    return [
      { id: "pubs-total", label: PUB_TOTAL_LINE.label, color: PUB_TOTAL_LINE.color, points: pubs, strokeWidth: 2 },
      { id: "restaurants-total", label: RESTAURANT_TOTAL_LINE.label, color: RESTAURANT_TOTAL_LINE.color, points: restaurants, strokeWidth: 2 },
    ];
  }, [data.summary, showTypeTotals]);

  const venueColors = useMemo(() => {
    const palette = COLORS.filter((c) => ![TOTAL_LINE.color, PUB_TOTAL_LINE.color, RESTAURANT_TOTAL_LINE.color].includes(c));
    const mapping = new Map<number, string>();
    sortedVenues.forEach((venue, i) => mapping.set(venue.venueId, palette[i % palette.length]));
    return mapping;
  }, [sortedVenues]);

  const selectedSeries = useMemo(
    () =>
      selectedVenueIds
        .map((venueId, i) => {
          const venue = venuesById.get(venueId);
          if (!venue) return null;
          const color = venueColors.get(venueId) ?? COLORS[(i + 2) % COLORS.length];
          const points = venue.history.map((entry) => ({ date: toDate(entry.date), dateLabel: entry.date, value: entry.checkins }));
          return { id: `venue-${venue.venueType}-${venue.venueId}`, label: `${venue.venueType} ${venue.venueId}`, color, points, strokeWidth: 1.6 };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [selectedVenueIds, venueColors, venuesById],
  );

  const visibleSeries = useMemo(() => {
    const series = [] as typeof summarySeries[];
    if (showTotal) series.push(summarySeries);
    series.push(...typeSeries);
    series.push(...selectedSeries);
    return series;
  }, [selectedSeries, showTotal, summarySeries, typeSeries]);

  const visiblePoints = useMemo(
    () =>
      visibleSeries.flatMap((series) =>
        series.points.map((point) => ({ ...point, seriesId: series.id, label: series.label, color: series.color, strokeWidth: series.strokeWidth })),
      ),
    [visibleSeries],
  );

  const dateExtent = useMemo(() => {
    if (data.summary.length === 0) return null;
    return d3.extent(data.summary.map((row) => toDate(row.date))) as [Date, Date];
  }, [data.summary]);

  const yMax = useMemo(() => d3.max(visiblePoints, (p) => p.value) ?? 0, [visiblePoints]);

  useEffect(() => {
    if (!svgRef.current || !dateExtent || visibleSeries.length === 0) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const baseXScale = d3.scaleTime().domain(dateExtent).range([MARGINS.left, WIDTH - MARGINS.right]);
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    // Clip path so lines don't draw outside chart bounds during pan/zoom
    root.append("defs").append("clipPath").attr("id", "series-clip")
      .append("rect")
      .attr("x", MARGINS.left).attr("y", MARGINS.top)
      .attr("width", WIDTH - MARGINS.left - MARGINS.right)
      .attr("height", HEIGHT - MARGINS.top - MARGINS.bottom);

    // X axis — tagged so zoom can update it
    const xAxisGroup = root.append("g")
      .attr("data-axis", "x")
      .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`);

    const drawXAxis = (scale: d3.ScaleTime<number, number>) =>
      xAxisGroup
        .call(d3.axisBottom(scale).ticks(7).tickFormat(formatAxisDate as (d: Date | d3.NumberValue) => string).tickSize(0).tickPadding(8))
        .call((a) => a.selectAll("text").attr("fill", "#64748b"))
        .call((a) => a.selectAll("path, line").attr("stroke", "#cbd5f5"));

    // Y axis + grid
    root.append("g").attr("transform", `translate(${MARGINS.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(0).tickPadding(8))
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.selectAll("path, line").attr("stroke", "#cbd5f5"));

    root.append("g").attr("transform", `translate(${MARGINS.left},0)`)
      .call(d3.axisLeft(yScale).tickSize(-(WIDTH - MARGINS.left - MARGINS.right)).tickFormat(() => ""))
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "4 4"))
      .call((g) => g.select("path").remove());

    // Series lines + dots
    const makeLine = (xScale: d3.ScaleTime<number, number>) =>
      d3.line<(typeof visibleSeries)[number]["points"][number]>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value));

    const seriesGroup = root.append("g").attr("data-layer", "series").attr("clip-path", "url(#series-clip)");

    visibleSeries.forEach((series) => {
      seriesGroup.append("path")
        .datum(series.points)
        .attr("fill", "none")
        .attr("stroke", series.color)
        .attr("stroke-width", series.strokeWidth)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", series.id === "total" ? 0.95 : 0.75)
        .attr("d", makeLine(baseXScale));
    });

    const pointsSelection = seriesGroup.append("g").attr("data-layer", "points")
      .selectAll("circle")
      .data(visiblePoints as ChartPoint[])
      .join("circle")
      .attr("cx", (d) => baseXScale(d.date))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", (d) => (d.seriesId === "total" ? 3 : 2.5))
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .style("cursor", "crosshair");

    applyChartInteractions(pointsSelection, null, tooltipRef.current, {
      getCrosshairPos: () => ({ x: 0, y: 0 }),
      getTooltipData: (d) => ({
        title: d.label,
        details: [
          { label: "Date", value: formatDate(d.date) },
          { label: "Checkins", value: d.value },
        ],
      }),
      onHoverIn: (el) => d3.select(el).attr("r", 4.2).attr("fill-opacity", 1).style("cursor", "pointer"),
      onHoverOut: (el) => d3.select(el).attr("r", 2.5).attr("fill-opacity", 0.85).style("cursor", "crosshair"),
    });

    // Zoom — x-axis only, scroll wheel + drag
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 30])
      .translateExtent([[MARGINS.left, 0], [WIDTH - MARGINS.right, HEIGHT]])
      .on("zoom", (e) => {
        zoomTransformRef.current = e.transform;
        const newX = e.transform.rescaleX(baseXScale);

        drawXAxis(newX);

        const newLine = makeLine(newX);
        root.selectAll<SVGPathElement, (typeof visibleSeries)[number]["points"]>('[data-layer="series"] path')
          .attr("d", newLine);

        root.selectAll<SVGCircleElement, ChartPoint>('[data-layer="points"] circle')
          .attr("cx", (d) => newX(d.date));
      });

    root.call(zoom);
    // Restore zoom level if user toggled a series (effect re-ran)
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      root.call(zoom.transform, zoomTransformRef.current);
    } else {
      drawXAxis(baseXScale);
    }
  }, [dateExtent, visiblePoints, visibleSeries, yMax]);

  const toggleVenue = (venueId: number) =>
    setSelectedVenueIds((prev) => (prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId]));

  const toggleAllVenues = (nextState: boolean) =>
    setSelectedVenueIds(nextState ? sortedVenues.map((v) => v.venueId) : []);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Foot Traffic</p>
          <h2 className="text-xl font-semibold text-slate-900">Business Check-ins</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Daily check-in volume · hover points for details · scroll to zoom, drag to pan
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 bg-white/90 shadow-md backdrop-blur-sm hover:bg-white">
              <Layers className="h-3.5 w-3.5" />
              Lines
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={8} className="w-72 p-2">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Overview</p>
            <div className="flex flex-col gap-1">
              {[
                { checked: showTotal, onToggle: () => setShowTotal((p) => !p), color: TOTAL_LINE.color, label: TOTAL_LINE.label },
                { checked: showTypeTotals, onToggle: () => setShowTypeTotals((p) => !p), color: "#111827", label: "Show pubs & restaurants" },
              ].map(({ checked, onToggle, color, label }) => (
                <label key={label} className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                  <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={checked ? { backgroundColor: color, borderColor: color } : { borderColor: "#d1d5db" }}>
                    {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: checked ? 1 : 0.3 }} />
                  <span className={`flex-1 text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-2">
              <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <span>Specific venues</span>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition hover:bg-muted"
                  onClick={() => toggleAllVenues(selectedVenueIds.length === 0)}
                >
                  {selectedVenueIds.length === 0 ? "Enable all" : "Clear"}
                </button>
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                {sortedVenues.map((venue) => {
                  const isActive = selectedVenueIds.includes(venue.venueId);
                  const color = venueColors.get(venue.venueId) ?? COLORS[0];
                  return (
                    <label key={`${venue.venueType}-${venue.venueId}`} className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                      <input type="checkbox" className="sr-only" checked={isActive} onChange={() => toggleVenue(venue.venueId)} />
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={isActive ? { backgroundColor: color, borderColor: color } : { borderColor: "#d1d5db" }}>
                        {isActive && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} />
                      <span className={`flex-1 text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {venue.venueType} {venue.venueId}
                      </span>
                      <span className="text-xs text-muted-foreground">{venue.totalCheckins}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chart */}
      <div className="relative overflow-hidden rounded-lg border border-slate-100 bg-white/80">
        <svg ref={svgRef} className="block h-auto w-full" />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
