"use client";

import { useEffect, useMemo, useRef } from "react";

import { createSvgRoot } from "@/lib/chart-utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { COLOR_BY_TYPE, LAYER_STYLES } from "@/lib/utils";
import type { BuildingFeature, EnrichedVenue } from "@/lib/types";
import { format, scaleLinear, zoom } from "d3";

const WIDTH = 500;
const HEIGHT = 500;
const PADDING = 10;

interface Props {
  buildings: BuildingFeature[];
  venues: EnrichedVenue[];
  selectedVenueId: number | null;
  onSelect: (id: number | null) => void;
}

export function BusinessMap({ buildings, venues, selectedVenueId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);
  const circlesRef = useRef<d3.Selection<SVGCircleElement, EnrichedVenue, SVGGElement, unknown> | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const scales = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    buildings.forEach((b) =>
      b.polygon.forEach((ring) =>
        ring.forEach(([x, y]) => {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }),
      ),
    );

    if (!Number.isFinite(minX)) return null;
    return {
      xScale: scaleLinear()
        .domain([minX, maxX])
        .range([PADDING, WIDTH - PADDING]),
      yScale: scaleLinear()
        .domain([minY, maxY])
        .range([HEIGHT - PADDING, PADDING]),
    };
  }, [buildings]);

  // Draw buildings and venue circles once
  useEffect(() => {
    if (!svgRef.current || !scales || buildings.length === 0) return;
    const { xScale, yScale } = scales;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const g = root.append("g");

    root.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 10])
        .on("zoom", (e) => {
          g.attr("transform", e.transform);
          tooltipRef.current?.hide();
        }),
    );

    // Background click to deselect
    root
      .append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .attr("fill", "transparent")
      .on("click", () => onSelectRef.current(null));

    // Buildings (context only — no hover interaction)
    g.append("g")
      .attr("data-layer", "buildings")
      .selectAll("path")
      .data(buildings)
      .join("path")
      .attr("d", (b) => b.polygon.map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${xScale(x)} ${yScale(y)}`).join(" ") + " Z").join(" "))
      .attr("fill", (b) => COLOR_BY_TYPE[b.typeGroup] ?? "#8a8f98")
      .attr("fill-opacity", 0.3)
      .attr("stroke", (b) => COLOR_BY_TYPE[b.typeGroup] ?? "#8a8f98")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 0.5)
      .attr("pointer-events", "none");

    // Venue circles
    const circles = g
      .append("g")
      .attr("data-layer", "venues")
      .selectAll<SVGCircleElement, EnrichedVenue>("circle")
      .data(venues, (d) => d.venueId)
      .join("circle")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", 5)
      .attr("fill", (d) => (d.type === "pub" ? LAYER_STYLES.pubs.color : LAYER_STYLES.restaurants.color))
      .attr("fill-opacity", 0.9)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer");

    circles
      .on("mouseover", (e, d) => {
        tooltipRef.current?.show(
          {
            title: `${d.type === "pub" ? "Pub" : "Restaurant"} #${d.venueId}`,
            details: [
              { label: "Prosperity Index", value: d.prosperity_index.toFixed(3) },
              { label: "Total Revenue", value: format("$,.0f")(d.total_revenue) },
              { label: "Avg Occupancy", value: format(".1%")(d.avg_occupancy) },
              { label: "Trend", value: d.trend_slope > 0 ? "↑ Growing" : "↓ Declining" },
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
  }, [buildings, venues, scales]);

  // Update selection state without redrawing buildings
  useEffect(() => {
    const circles = circlesRef.current;
    if (!circles) return;
    circles
      .attr("r", (d) => (d.venueId === selectedVenueId ? 9 : 5))
      .attr("fill-opacity", (d) => (selectedVenueId === null || d.venueId === selectedVenueId ? 0.9 : 0.15))
      .attr("stroke-width", (d) => (d.venueId === selectedVenueId ? 2.5 : 1.5));
  }, [selectedVenueId]);

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Spatial Overview</p>
          <h2 className="text-xl font-semibold text-slate-900">Venue Locations</h2>
          <p className="mt-0.5 text-xs text-slate-400">Click to select · scroll to zoom · drag to pan</p>
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
