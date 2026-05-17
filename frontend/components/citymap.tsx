"use client";

import * as d3 from "d3";
import { Check, Layers } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createSvgRoot, applyChartInteractions } from "@/lib/chart-utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BuildingFeature, BuildingType, EmployerPoint, MapLayers, PubPoint, RestaurantPoint, SchoolPoint } from "@/lib/types";
import { COLOR_BY_TYPE, LAYER_STYLES, LayerKey } from "@/lib/utils";

const WIDTH = 750;
const HEIGHT = 750;
const PADDING = 10;

export function CityMap({ mapLayers }: { mapLayers: MapLayers }) {
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerKey, boolean>>({
    pubs: true,
    restaurants: true,
    schools: true,
    employers: true,
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);

  const buildings = mapLayers.buildings;
  const pubs = mapLayers.pubs;
  const restaurants = mapLayers?.restaurants;
  const schools = mapLayers.schools;
  const employers = mapLayers.employers;

  const layerCounts = useMemo(
    () => ({
      pubs: pubs.length,
      restaurants: restaurants.length,
      schools: schools.length,
      employers: employers.length,
    }),
    [pubs.length, restaurants.length, schools.length, employers.length],
  );

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const updateBounds = (xVal: number, yVal: number) => {
      minX = Math.min(minX, xVal);
      minY = Math.min(minY, yVal);
      maxX = Math.max(maxX, xVal);
      maxY = Math.max(maxY, yVal);
    };

    buildings.forEach((building) => {
      building.polygon.forEach((ring) => ring.forEach(([xVal, yVal]) => updateBounds(xVal, yVal)));
    });

    const pointLayers = [pubs, restaurants, schools, employers];
    pointLayers.forEach((layer) => {
      layer.forEach((point) => {
        if (Number.isFinite(point.location?.x) && Number.isFinite(point.location?.y)) updateBounds(point.location.x, point.location.y);
      });
    });

    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }, [buildings, employers, pubs, restaurants, schools]);

  const scales = useMemo(() => {
    if (!bounds) return null;
    const xScale = d3
      .scaleLinear()
      .domain([bounds.minX, bounds.maxX])
      .range([PADDING, WIDTH - PADDING]);
    const yScale = d3
      .scaleLinear()
      .domain([bounds.minY, bounds.maxY])
      .range([HEIGHT - PADDING, PADDING]);

    return { xScale, yScale };
  }, [bounds]);

  const pathForBuilding = useMemo(() => {
    if (!scales) return () => "";
    const { xScale, yScale } = scales;

    return (building: BuildingFeature) =>
      building.polygon
        .map((ring) => {
          const parts = ring
            .map(([xVal, yVal], index) => {
              const prefix = index === 0 ? "M" : "L";
              return `${prefix}${xScale(xVal)} ${yScale(yVal)}`;
            })
            .join(" ");
          return `${parts} Z`;
        })
        .join(" ");
  }, [scales]);

  useEffect(() => {
    if (!svgRef.current || !scales) return;

    const { xScale, yScale } = scales;
    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const g = root.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .on("zoom", (e) => {
        g.attr("transform", e.transform);
        // Fade labels in between zoom level 3 → 5, hidden below 3
        const labelOpacity = Math.max(0, Math.min(1, (e.transform.k - 3) / 2));
        g.select('[data-layer="building-labels"]').attr("opacity", labelOpacity);
      });
    root.call(zoom);

    const buildingPaths = g
      .append("g")
      .attr("data-layer", "buildings")
      .selectAll(".building")
      .data(buildings)
      .join("path")
      .attr("class", "building")
      .attr("d", (d) => pathForBuilding(d))
      .attr("fill", (d) => COLOR_BY_TYPE[d.typeGroup] || "#8a8f98")
      .attr("fill-opacity", 0.65)
      .attr("stroke", (d) => COLOR_BY_TYPE[d.typeGroup] || "#8a8f98")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 0.8)
      .style("cursor", "pointer");

    applyChartInteractions(buildingPaths, null, tooltipRef.current, {
      getCrosshairPos: () => ({ x: 0, y: 0 }),
      getTooltipData: (d: BuildingFeature) => ({
        title: "Building Details",
        details: [
          { label: "buildingId", value: d.buildingId },
          { label: "buildingType", value: d.buildingType },
          { label: "maxOccupancy", value: d.maxOccupancy ?? "N/A" },
        ],
      }),
      onHoverIn: (element) => d3.select(element).attr("fill-opacity", 0.95).attr("stroke-opacity", 1).attr("stroke-width", 2),
      onHoverOut: (element) => d3.select(element).attr("fill-opacity", 0.65).attr("stroke-opacity", 0.5).attr("stroke-width", 0.8),
    });

    // Building ID labels — start hidden, fade in as the user zooms (see zoom handler above)
    g.append("g")
      .attr("data-layer", "building-labels")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(buildings.filter((b) => b.centroid !== null))
      .join("text")
      .attr("x", (d) => xScale(d.centroid![0]))
      .attr("y", (d) => yScale(d.centroid![1]))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "3.5px")
      .attr("font-family", "ui-monospace, monospace")
      .attr("fill", "#0f172a")
      .attr("stroke", "rgba(255,255,255,0.85)")
      .attr("stroke-width", "1.5px")
      .style("paint-order", "stroke")
      .text((d) => d.buildingId);

    const drawPointLayer = <T extends { location: { x: number; y: number } }>(key: LayerKey, data: T[], radius: number, color: string, tooltipBuilder: (datum: T) => { title: string; details: { label: string; value: string | number }[] }) => {
      if (!layerVisibility[key] || data.length === 0) return;

      const points = data.filter((d) => Number.isFinite(d.location?.x) && Number.isFinite(d.location?.y));
      const selection = g
        .append("g")
        .attr("data-layer", key)
        .selectAll("circle")
        .data(points)
        .join("circle")
        .attr("cx", (d) => xScale(d.location.x))
        .attr("cy", (d) => yScale(d.location.y))
        .attr("r", radius)
        .attr("fill", color)
        .attr("fill-opacity", 0.9)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.8)
        .style("cursor", "pointer");

      applyChartInteractions(selection, null, tooltipRef.current, {
        getCrosshairPos: () => ({ x: 0, y: 0 }),
        getTooltipData: tooltipBuilder,
        onHoverIn: (element) =>
          d3
            .select(element)
            .attr("r", radius + 2.5)
            .attr("stroke-width", 2)
            .attr("fill-opacity", 1),
        onHoverOut: (element) => d3.select(element).attr("r", radius).attr("stroke-width", 1.5).attr("fill-opacity", 0.9),
      });
    };

    drawPointLayer<PubPoint>("pubs", pubs, LAYER_STYLES.pubs.radius, LAYER_STYLES.pubs.color, (d) => ({
      title: "Pub",
      details: [
        { label: "pubId", value: d.pubId },
        { label: "hourlyCost", value: d.hourlyCost ?? "N/A" },
        { label: "maxOccupancy", value: d.maxOccupancy ?? "N/A" },
        { label: "buildingId", value: d.buildingId ?? "N/A" },
      ],
    }));

    drawPointLayer<RestaurantPoint>("restaurants", restaurants, LAYER_STYLES.restaurants.radius, LAYER_STYLES.restaurants.color, (d) => ({
      title: "Restaurant",
      details: [
        { label: "restaurantId", value: d.restaurantId },
        { label: "foodCost", value: d.foodCost ?? "N/A" },
        { label: "maxOccupancy", value: d.maxOccupancy ?? "N/A" },
        { label: "buildingId", value: d.buildingId ?? "N/A" },
      ],
    }));

    drawPointLayer<SchoolPoint>("schools", schools, LAYER_STYLES.schools.radius, LAYER_STYLES.schools.color, (d) => ({
      title: "School",
      details: [
        { label: "schoolId", value: d.schoolId },
        { label: "monthlyCost", value: d.monthlyCost ?? "N/A" },
        { label: "maxEnrollment", value: d.maxEnrollment ?? "N/A" },
        { label: "buildingId", value: d.buildingId ?? "N/A" },
      ],
    }));

    drawPointLayer<EmployerPoint>("employers", employers, LAYER_STYLES.employers.radius, LAYER_STYLES.employers.color, (d) => ({
      title: "Employer",
      details: [
        { label: "employerId", value: d.employerId },
        { label: "buildingId", value: d.buildingId ?? "N/A" },
      ],
    }));
  }, [buildings, employers, layerVisibility, pathForBuilding, pubs, restaurants, scales, schools]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
      <svg ref={svgRef} className="block h-full w-full" />
      <ChartTooltip ref={tooltipRef} />

      {/* Google Maps-style layer control — bottom-left of the map */}
      <div className="absolute bottom-3 right-3 z-10">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 bg-white/90 shadow-md backdrop-blur-sm hover:bg-white">
              <Layers className="h-3.5 w-3.5" />
              Layers
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={8} className="w-52 p-2">
            <p className="px-1 pb-2 text-base font-semibold uppercase tracking-widest text-muted-foreground">Point Layers</p>
            <div className="flex flex-col">
              {Object.entries(LAYER_STYLES).map(([key, config]) => {
                const layerKey = key as LayerKey;
                const isActive = layerVisibility[layerKey];
                return (
                  <label key={key} className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                    <input type="checkbox" className="sr-only" checked={isActive} onChange={() => setLayerVisibility((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }))} />
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors" style={isActive ? { backgroundColor: config.color, borderColor: config.color } : { borderColor: "#d1d5db" }}>
                      {isActive && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: config.color, opacity: isActive ? 1 : 0.35 }} />
                    <span className={`flex-1 text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{config.label}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{layerCounts[layerKey]}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-100 bg-white/80 px-3 py-1 text-[11px] text-slate-400 shadow-sm backdrop-blur-sm">Scroll to zoom · drag to pan · click buildings & markers for details</div>
    </div>
  );
}
