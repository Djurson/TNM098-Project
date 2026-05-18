"use client";

import { useEffect, useRef } from "react";
import { Info } from "lucide-react";

import { createSvgRoot } from "@/lib/chart-utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { LAYER_STYLES } from "@/lib/utils";
import type { EnrichedVenue } from "@/lib/types";
import { axisBottom, axisLeft, axisTop, format, scaleBand, scaleLinear } from "d3";

const WIDTH = 900;
const MARGINS = { top: 16, right: 24, bottom: 36, left: 110 };
const BAR_SIZE = 20; // px per band (bar + gap)

interface Props {
  venues: EnrichedVenue[];
  selectedVenueId: number | null;
  onSelect: (id: number | null) => void;
}

export function BusinessHealthIndexChart({ venues, selectedVenueId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);
  const barsRef = useRef<d3.Selection<SVGRectElement, EnrichedVenue, SVGGElement, unknown> | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const sorted = [...venues].sort((a, b) => b.prosperity_index - a.prosperity_index);
  const HEIGHT = MARGINS.top + sorted.length * BAR_SIZE + MARGINS.bottom;

  useEffect(() => {
    if (!svgRef.current || sorted.length === 0) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const innerW = WIDTH - MARGINS.left - MARGINS.right;

    const xScale = scaleLinear().domain([0, 1]).range([0, innerW]);

    const yScale = scaleBand<string>()
      .domain(sorted.map((d) => String(d.venueId)))
      .range([MARGINS.top, HEIGHT - MARGINS.bottom])
      .padding(0.25);

    // X gridlines
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisTop(xScale)
          .ticks(5)
          .tickSize(-(HEIGHT - MARGINS.top - MARGINS.bottom))
          .tickFormat(() => ""),
      )
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "3 3"))
      .call((g) => g.select(".domain").remove());

    // X axis (bottom)
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},${HEIGHT - MARGINS.bottom})`)
      .call(axisBottom(xScale).ticks(5).tickFormat(format(".1f")).tickSize(0).tickPadding(8))
      .call((g) => g.selectAll("text").attr("fill", "#64748b"))
      .call((g) => g.select(".domain").remove());

    // Y axis labels
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((id) => {
            const v = sorted.find((d) => String(d.venueId) === id);
            return v ? `${v.type === "pub" ? "Pub" : "Rest."} #${id}` : (id as string);
          }),
      )
      .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"))
      .call((g) => g.select(".domain").remove());

    // Background click to deselect
    root
      .append("rect")
      .attr("x", MARGINS.left)
      .attr("y", MARGINS.top)
      .attr("width", innerW)
      .attr("height", HEIGHT - MARGINS.top - MARGINS.bottom)
      .attr("fill", "transparent")
      .on("click", () => onSelectRef.current(null));

    // Bars
    const bars = root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .selectAll<SVGRectElement, EnrichedVenue>("rect")
      .data(sorted, (d) => d.venueId)
      .join("rect")
      .attr("y", (d) => yScale(String(d.venueId))!)
      .attr("height", yScale.bandwidth())
      .attr("x", 0)
      .attr("width", (d) => xScale(d.prosperity_index))
      .attr("rx", 3)
      .attr("fill", (d) => (d.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color))
      .attr("fill-opacity", 0.8)
      .style("cursor", "pointer");

    // Index value labels on bars
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .selectAll<SVGTextElement, EnrichedVenue>("text")
      .data(sorted, (d) => d.venueId)
      .join("text")
      .attr("x", (d) => xScale(d.prosperity_index) + 5)
      .attr("y", (d) => (yScale(String(d.venueId)) ?? 0) + yScale.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("pointer-events", "none")
      .text((d) => d.prosperity_index.toFixed(3));

    bars
      .on("mouseover", (e, d) => {
        tooltipRef.current?.show(
          {
            title: `${d.type === "pub" ? "Pub" : "Restaurant"} #${d.venueId}`,
            details: [
              { label: "Prosperity Index", value: d.prosperity_index.toFixed(3) },
              { label: "Occupancy   (×0.35)", value: `${d.norm_occupancy.toFixed(3)} → ${(0.35 * d.norm_occupancy).toFixed(3)}` },
              { label: "Trend       (×0.40)", value: `${d.norm_trend.toFixed(3)} → ${(0.4 * d.norm_trend).toFixed(3)}` },
              { label: "Rev./Seat   (×0.25)", value: `${d.norm_revenue_per_seat.toFixed(3)} → ${(0.25 * d.norm_revenue_per_seat).toFixed(3)}` },
            ],
          },
          e.clientX,
          e.clientY,
        );
      })
      .on("mousemove", (e) => tooltipRef.current?.move(e.clientX, e.clientY))
      .on("mouseout", () => tooltipRef.current?.hide())
      .on("click", (e, d) => {
        e.stopPropagation();
        onSelectRef.current(d.venueId);
      });

    barsRef.current = bars;
  }, [sorted, HEIGHT]);

  // Update selection without redrawing
  useEffect(() => {
    const bars = barsRef.current;
    if (!bars) return;
    bars
      .attr("fill-opacity", (d) => (selectedVenueId === null || d.venueId === selectedVenueId ? 0.85 : 0.15))
      .attr("stroke", (d) => (d.venueId === selectedVenueId ? (d.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color) : "none"))
      .attr("stroke-width", (d) => (d.venueId === selectedVenueId ? 1.5 : 0));
  }, [selectedVenueId]);

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Ranking</p>
          <h2 className="text-xl font-semibold text-slate-900">Business Health Index</h2>
          <p className="mt-0.5 text-xs text-slate-400">Sorted by index score · click to select · hover for breakdown</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: LAYER_STYLES.pubs.color, opacity: 0.8 }} />
              Pubs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: LAYER_STYLES.restaurants.color, opacity: 0.8 }} />
              Restaurants
            </span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 bg-white/90 shadow-sm">
                <Info className="h-3.5 w-3.5" />
                How it&apos;s calculated
              </Button>
            </PopoverTrigger>
            <PopoverContent side="left" align="start" sideOffset={8} className="w-80 p-4 text-sm">
              <p className="font-semibold text-slate-800 mb-2">Prosperity Index Formula</p>
              <code className="block text-xs bg-slate-100 rounded p-2 mb-3 leading-relaxed">
                index = 0.35 × occupancy
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.40 × trend
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 × rev_per_seat
              </code>
              <div className="flex flex-col gap-2 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">Occupancy (35%)</span>
                  <p className="mt-0.5">Average daily peak visitors ÷ max capacity. Measures how busy the venue is relative to its size.</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Relative Trend (40%)</span>
                  <p className="mt-0.5">Monthly revenue slope ÷ average monthly revenue. Captures whether the business is growing or declining — weighted highest as the most forward-looking signal.</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Revenue per Seat (25%)</span>
                  <p className="mt-0.5">Total revenue ÷ max occupancy. Normalises financial performance for venue size, making a small high-earning restaurant comparable to a large pub.</p>
                </div>
                <p className="mt-1 text-slate-400">All three metrics are min-max normalised to [0, 1] before combining, so a score of 1.0 is the best-performing venue on that metric.</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="relative overflow-hidden border rounded-lg border-slate-100 bg-white/80">
        <svg ref={svgRef} className="block w-full h-auto" />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
