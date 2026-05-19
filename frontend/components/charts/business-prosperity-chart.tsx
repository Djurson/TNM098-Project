"use client";

import { useEffect, useRef } from "react";

import { createSvgRoot } from "@/lib/chart-utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { LAYER_STYLES } from "@/lib/utils";
import type { EnrichedVenue } from "@/lib/types";
import { axisBottom, axisLeft, format, max, scaleLinear } from "d3";

const WIDTH = 500;
const HEIGHT = 380;
const MARGINS = { top: 24, right: 24, bottom: 56, left: 80 };

interface Props {
  venues: EnrichedVenue[];
  selectedVenueId: number | null;
  onSelect: (id: number | null) => void;
}

export function BusinessProsperityChart({ venues, selectedVenueId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);
  const circlesRef = useRef<d3.Selection<SVGCircleElement, EnrichedVenue, SVGGElement, unknown> | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!svgRef.current || venues.length === 0) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const innerW = WIDTH - MARGINS.left - MARGINS.right;
    const innerH = HEIGHT - MARGINS.top - MARGINS.bottom;

    const xScale = scaleLinear()
      .domain([0, (max(venues, (d) => d.avg_occupancy) ?? 0) * 1.1])
      .range([MARGINS.left, WIDTH - MARGINS.right]);

    const yScale = scaleLinear()
      .domain([0, (max(venues, (d) => d.total_revenue) ?? 0) * 1.05])
      .nice()
      .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    // Gridlines
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => ""),
      )
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "3 3"))
      .call((g) => g.select(".domain").remove());

    // X axis
    root
      .append("g")
      .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
      .call(
        axisBottom(xScale)
          .ticks(6)
          .tickFormat((d) => format(".0%")(+d))
          .tickSize(0)
          .tickPadding(8),
      )
      .call((g) => g.selectAll("text").attr("fill", "#64748b"))
      .call((g) => g.select(".domain").remove());

    // Y axis
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => format("$.3s")(+d))
          .tickSize(0)
          .tickPadding(8),
      )
      .call((g) => g.selectAll("text").attr("fill", "#64748b"))
      .call((g) => g.select(".domain").remove());

    // Axis labels
    root
      .append("text")
      .attr("x", MARGINS.left + innerW / 2)
      .attr("y", HEIGHT - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#94a3b8")
      .text("Avg. Occupancy Rate");

    root
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(MARGINS.top + innerH / 2))
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#94a3b8")
      .text("Total Revenue");

    // Background click to deselect
    root
      .append("rect")
      .attr("x", MARGINS.left)
      .attr("y", MARGINS.top)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .on("click", () => onSelectRef.current(null));

    // Circles
    const circles = root
      .append("g")
      .selectAll<SVGCircleElement, EnrichedVenue>("circle")
      .data(venues, (d) => d.venueId)
      .join("circle")
      .attr("cx", (d) => xScale(d.avg_occupancy))
      .attr("cy", (d) => yScale(d.total_revenue))
      .attr("r", 6)
      .attr("fill", (d) => (d.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer");

    circles
      .on("mouseover", (e, d) => {
        tooltipRef.current?.show(
          {
            title: `${d.type === "pub" ? "Pub" : "Restaurant"} #${d.venueId}`,
            details: [
              { label: "Total Revenue", value: format("$,.0f")(d.total_revenue) },
              { label: "Avg Occupancy", value: format(".1%")(d.avg_occupancy) },
              { label: "Prosperity Index", value: d.prosperity_index.toFixed(3) },
              { label: "Trend", value: d.amount_trend_slope > 0 ? "↑ Growing" : "↓ Declining" },
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

    circlesRef.current = circles;
  }, [venues]);

  useEffect(() => {
    const circles = circlesRef.current;
    if (!circles) return;
    circles
      .attr("r", (d) => (d.venueId === selectedVenueId ? 9 : 6))
      .attr("fill-opacity", (d) => (selectedVenueId === null || d.venueId === selectedVenueId ? 0.9 : 0.2))
      .attr("stroke-width", (d) => (d.venueId === selectedVenueId ? 2.5 : 1.5));
  }, [selectedVenueId]);

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Venue Analytics</p>
          <h2 className="text-xl font-semibold text-slate-900">Performance Overview</h2>
          <p className="mt-0.5 text-xs text-slate-400">Click to select · hover for details</p>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.pubs.color }} />
            Pubs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_STYLES.restaurants.color }} />
            Restaurants
          </span>
        </div>
      </div>
      <div className="relative overflow-hidden border rounded-lg border-slate-100 bg-white/80">
        <svg ref={svgRef} className="block w-full h-auto" />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
