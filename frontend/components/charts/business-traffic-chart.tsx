"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

import { createSvgRoot } from "@/lib/chart-utils";
import { LAYER_STYLES } from "@/lib/utils";
import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";

// Constants
const WIDTH = 900;
const HEIGHT = 360;
const MARGINS = { top: 20, right: 26, bottom: 46, left: 54 };

// Formatters
const formatAxisDay = d3.timeFormat("%b %d");
const formatTooltipDay = d3.timeFormat("%b %d, %Y");

// Types
export interface TrafficData {
  date: string;
  pubs: number;
  restaurants: number;
}

interface Props {
  data: TrafficData[];
}

export function BusinessTrafficChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<TooltipRef>(null);

  // Parse dates and sort chronologically
  const rows = useMemo(() => {
    return [...data]
      .map((d) => ({
        ...d,
        parsedDate: new Date(d.date + "T00:00:00Z"),
      }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const root = createSvgRoot(svgRef.current, WIDTH, HEIGHT);
    root.selectAll("*").remove();

    const innerWidth = WIDTH - MARGINS.left - MARGINS.right;
    const innerHeight = HEIGHT - MARGINS.bottom - MARGINS.top;

    // --- Scales ---
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(rows, (d) => d.parsedDate) as [Date, Date])
      .range([MARGINS.left, WIDTH - MARGINS.right]);

    const yMax = d3.max(rows, (d) => Math.max(d.pubs, d.restaurants)) ?? 0;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

    // --- Clip Path ---
    // Prevents the zoomed lines from bleeding over the axes
    const clipId = "zoom-clip";
    root.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("x", MARGINS.left).attr("y", MARGINS.top).attr("width", innerWidth).attr("height", innerHeight);

    // --- Gridlines ---
    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .call((g) => g.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "4 4"))
      .call((g) => g.select(".domain").remove());

    // --- Axes ---
    const xAxisGroup = root.append("g").attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`);

    root
      .append("g")
      .attr("transform", `translate(${MARGINS.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(0).tickPadding(8))
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.select(".domain").remove());

    // --- Generators ---
    const areaRest = d3
      .area<(typeof rows)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0(yScale(0))
      .y1((d) => yScale(d.restaurants))
      .curve(d3.curveMonotoneX);

    const lineRest = d3
      .line<(typeof rows)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y((d) => yScale(d.restaurants))
      .curve(d3.curveMonotoneX);

    const areaPubs = d3
      .area<(typeof rows)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0(yScale(0))
      .y1((d) => yScale(d.pubs))
      .curve(d3.curveMonotoneX);

    const linePubs = d3
      .line<(typeof rows)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y((d) => yScale(d.pubs))
      .curve(d3.curveMonotoneX);

    // --- Drawing the Chart ---
    // Apply the clip path so the area doesn't overflow when zoomed
    const chartArea = root.append("g").attr("clip-path", `url(#${clipId})`);

    const pathRestArea = chartArea.append("path").datum(rows).attr("fill", LAYER_STYLES.restaurants.color).attr("fill-opacity", 0.15).attr("d", areaRest);

    const pathRestLine = chartArea.append("path").datum(rows).attr("fill", "none").attr("stroke", LAYER_STYLES.restaurants.color).attr("stroke-width", 2).attr("d", lineRest);

    const pathPubsArea = chartArea.append("path").datum(rows).attr("fill", LAYER_STYLES.pubs.color).attr("fill-opacity", 0.15).attr("d", areaPubs);

    const pathPubsLine = chartArea.append("path").datum(rows).attr("fill", "none").attr("stroke", LAYER_STYLES.pubs.color).attr("stroke-width", 2).attr("d", linePubs);

    // Initial X Axis render
    xAxisGroup
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => formatAxisDay(d as Date))
          .tickSize(0)
          .tickPadding(12),
      )
      .call((a) => a.selectAll("text").attr("fill", "#64748b"))
      .call((a) => a.select(".domain").remove());

    // --- Hover Elements (Crosshair & Intersections) ---
    const crosshairGroup = root.append("g").style("opacity", 0).style("pointer-events", "none");

    const verticalLine = crosshairGroup
      .append("line")
      .attr("stroke", "#9ca3af")
      .attr("stroke-dasharray", "4 4")
      .attr("y1", MARGINS.top)
      .attr("y2", HEIGHT - MARGINS.bottom);

    const restDot = crosshairGroup.append("circle").attr("r", 4).attr("fill", LAYER_STYLES.restaurants.color).attr("stroke", "#fff").attr("stroke-width", 2);

    const pubsDot = crosshairGroup.append("circle").attr("r", 4).attr("fill", LAYER_STYLES.pubs.color).attr("stroke", "#fff").attr("stroke-width", 2);

    const bisectDate = d3.bisector((d: (typeof rows)[0]) => d.parsedDate).center;

    // --- Zoom & Interaction State ---
    let currentXScale = xScale; // Maintain a reference to the active zoom scale

    const zoomBehavior = d3
      .zoom<SVGRectElement, unknown>()
      .scaleExtent([1, 15]) // Min/Max zoom limits
      .translateExtent([
        [MARGINS.left, 0],
        [WIDTH - MARGINS.right, HEIGHT],
      ])
      .extent([
        [MARGINS.left, 0],
        [WIDTH - MARGINS.right, HEIGHT],
      ])
      .on("zoom", (event) => {
        // Create a new scale based on the transform
        currentXScale = event.transform.rescaleX(xScale);

        // Redraw with the new active scale
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
            d3
              .axisBottom(currentXScale)
              .tickFormat((d) => formatAxisDay(d as Date))
              .tickSize(0)
              .tickPadding(12),
          )
          .call((a) => a.selectAll("text").attr("fill", "#64748b"))
          .call((a) => a.select(".domain").remove());

        // Hide crosshair during zoom to prevent janky visual jumping
        crosshairGroup.style("opacity", 0);
        tooltipRef.current?.hide();
      });

    // The invisible overlay block captures both zoom and hover events simultaneously
    root
      .append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .call(zoomBehavior as any)
      .on("mousemove", (event) => {
        const mouseX = d3.pointer(event)[0];

        // Break out early if hovering outside the chart boundaries
        if (mouseX < MARGINS.left || mouseX > WIDTH - MARGINS.right) {
          crosshairGroup.style("opacity", 0);
          tooltipRef.current?.hide();
          return;
        }

        // Use the ACTIVE (currentXScale) to correctly map the zoomed pixels back to a Date object
        const xDate = currentXScale.invert(mouseX);
        const index = bisectDate(rows, xDate);
        const d = rows[index];

        if (!d) return;

        const cx = currentXScale(d.parsedDate);

        // Position elements
        crosshairGroup.style("opacity", 1);
        verticalLine.attr("x1", cx).attr("x2", cx);
        restDot.attr("cx", cx).attr("cy", yScale(d.restaurants));
        pubsDot.attr("cx", cx).attr("cy", yScale(d.pubs));

        // Aggregate total inside tooltip
        tooltipRef.current?.show(
          {
            title: formatTooltipDay(d.parsedDate),
            details: [
              { label: "Restaurants", value: d.restaurants },
              { label: "Pubs", value: d.pubs },
              { label: "Total Check-ins", value: d.restaurants + d.pubs },
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
  }, [rows]);

  return (
    <div className="flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Activity Analytics</p>
          <h2 className="text-xl font-semibold text-slate-900">Pub & Restaurant Traffic</h2>
          <p className="mt-0.5 text-xs text-slate-400">Scroll to zoom · drag to pan · hover for details</p>
        </div>
        <div className="flex flex-col items-end justify-end h-full gap-3 mt-auto">
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
        </div>
      </div>

      <div className="relative overflow-hidden border rounded-lg border-slate-100 bg-white/80">
        <svg ref={svgRef} className="block w-full h-auto" />
        <ChartTooltip ref={tooltipRef} />
      </div>
    </div>
  );
}
