"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { contourDensity, geoPath, interpolateGreens, interpolateReds, max, min, scaleLinear, scaleSequential, schemeTableau10, select, zoom } from "d3";

import BuildingsData from "@/public/buildings.json";
import EmployersData from "@/public/employer_turnover_daily.json";

import { ChartTooltip, type TooltipRef } from "@/components/chart-tooltip";
import type { BuildingFeature, TooltipData } from "@/lib/types";

const WIDTH = 1100;
const HEIGHT = 820;
const PADDING = 40;

interface EmployerPoint {
  employerId: number;
  x: number;
  y: number;
  totalNet: number;
  totalTurnover: number;
  clusterId?: number;
}

function runDBSCAN(points: EmployerPoint[], eps: number, minPts: number) {
  let clusterId = 0;
  const visited = new Set<number>();
  const assigned = new Set<number>();

  const getNeighbors = (p: EmployerPoint) => points.filter((q) => Math.sqrt(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2)) <= eps);

  points.forEach((point, i) => {
    if (visited.has(i)) return;
    visited.add(i);
    const neighbors = getNeighbors(point);
    if (neighbors.length < minPts) return;

    clusterId++;
    point.clusterId = clusterId;
    assigned.add(i);

    const queue = [...neighbors];
    for (let j = 0; j < queue.length; j++) {
      const neighbor = queue[j];
      const neighborIdx = points.findIndex((p) => p.employerId === neighbor.employerId);
      if (!visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        const nextNeighbors = getNeighbors(neighbor);
        if (nextNeighbors.length >= minPts) queue.push(...nextNeighbors);
      }
      if (!assigned.has(neighborIdx)) {
        points[neighborIdx].clusterId = clusterId;
        assigned.add(neighborIdx);
      }
    }
  });
  return points;
}

export default function EmployerTurnoverMap() {
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [employers, setEmployers] = useState<EmployerPoint[]>([]);
  const tooltipRef = useRef<TooltipRef>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    setBuildings(BuildingsData.buildings as BuildingFeature[]);
    const parsedEmployers: EmployerPoint[] = EmployersData.employers.map((emp) => {
      const coords = emp.location.match(/POINT \(([-\d.]+) ([-\d.]+)\)/);
      return {
        employerId: emp.employerId,
        x: coords ? parseFloat(coords[1]) : 0,
        y: coords ? parseFloat(coords[2]) : 0,
        totalNet: emp.history.reduce((sum, h) => sum + h.netChange, 0),
        totalTurnover: emp.history.reduce((sum, h) => sum + h.turnover, 0),
      };
    });
    setEmployers(runDBSCAN(parsedEmployers, 150, 3));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = select(svgRef.current);
    const g = select(gRef.current);
    svg.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 10])
        .on("zoom", (e) => g.attr("transform", e.transform)),
    );
  }, [buildings]);

  const bounds = useMemo(() => {
    const allX = buildings.flatMap((b) => b.polygon.flat().map((p) => p[0]));
    const allY = buildings.flatMap((b) => b.polygon.flat().map((p) => p[1]));
    return { minX: min(allX) || 0, maxX: max(allX) || 0, minY: min(allY) || 0, maxY: max(allY) || 0 };
  }, [buildings]);

  const { xScale, yScale, pathGenerator } = useMemo(() => {
    const x = scaleLinear()
      .domain([bounds.minX, bounds.maxX])
      .range([PADDING, WIDTH - PADDING]);
    const y = scaleLinear()
      .domain([bounds.minY, bounds.maxY])
      .range([HEIGHT - PADDING, PADDING]);
    const gen = (b: BuildingFeature) => b.polygon.map((r) => "M" + r.map((p) => `${x(p[0])},${y(p[1])}`).join("L") + "Z").join(" ");
    return { xScale: x, yScale: y, pathGenerator: gen };
  }, [bounds]);

  const { gainContours, lossContours, maxDensity } = useMemo(() => {
    if (employers.length === 0) return { gainContours: [], lossContours: [], maxDensity: 0 };

    const densityGenerator = contourDensity<EmployerPoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .size([WIDTH, HEIGHT])
      .bandwidth(30)
      .thresholds(12);

    const gains = densityGenerator.weight((d) => (d.totalNet > 0 ? d.totalNet : 0))(employers);
    const losses = densityGenerator.weight((d) => (d.totalNet < 0 ? Math.abs(d.totalNet) : 0))(employers);

    const maxVal = max([...gains, ...losses], (d) => d.value) || 1;
    return { gainContours: gains, lossContours: losses, maxDensity: maxVal };
  }, [employers, xScale, yScale]);

  const gainColor = scaleSequential(interpolateGreens).domain([0, maxDensity]);
  const lossColor = scaleSequential(interpolateReds).domain([0, maxDensity]);

  return (
    <div className="flex flex-col w-full gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Turnover Heatmap</p>
          <h2 className="text-xl font-semibold text-slate-900">Employer Turnover Heatmap</h2>
          <p className="mt-0.5 text-xs text-slate-400">Clustered by proximity (DBSCAN) • Heatmap weighted by Net Change • Hover dots for details • Scroll to zoom • Drag to pan </p>
        </div>
        <div className="grid flex-1 grid-cols-2 grid-rows-3 text-xs gap-x-4 gap-y-2 text-slate-500">
          <p className="font-medium text-slate-500">Employers</p>
          <p className="font-medium text-slate-500">Net Staff Change</p>
          <div className="flex items-center col-start-1 gap-2">
            <span className="w-3 h-3 border border-white rounded-full shadow-sm bg-slate-400" />
            <span>Individual Employer</span>
          </div>
          <div className="flex items-center justify-center w-full gap-2">
            <div className="flex-1 h-3 rounded bg-linear-to-r from-white to-red-600" />
            <span className="whitespace-nowrap text-[10px]">Net Loss (Quits &gt; Hires)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-indigo-500 border-2 border-white rounded-full shadow-md" />
            <span>DBSCAN Cluster Member</span>
          </div>
          <div className="flex items-center justify-center w-full gap-2">
            <div className="flex-1 h-3 rounded bg-linear-to-r from-white to-green-600" />
            <span className="whitespace-nowrap text-[10px]">Net Gain (Hires &gt; Quits)</span>
          </div>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto bg-white cursor-move">
        <g ref={gRef}>
          {/* Context Buildings */}
          <g fill="#f1f5f9" stroke="#e2e8f0" strokeWidth={0.5}>
            {buildings.map((b) => (
              <path key={b.buildingId} d={pathGenerator(b)} />
            ))}
          </g>

          {/* Heatmap Layers (Overlayed) */}
          <g opacity={0.65} style={{ mixBlendMode: "multiply" }}>
            {lossContours.map((c, i) => (
              <path key={`l-${i}`} d={geoPath()(c) || ""} fill={lossColor(c.value)} />
            ))}
            {gainContours.map((c, i) => (
              <path key={`g-${i}`} d={geoPath()(c) || ""} fill={gainColor(c.value)} />
            ))}
          </g>

          {/* Employers */}
          <g>
            {employers.map((emp) => (
              <circle
                key={emp.employerId}
                cx={xScale(emp.x)}
                cy={yScale(emp.y)}
                r={emp.clusterId ? 5 : 2}
                fill={emp.clusterId ? schemeTableau10[emp.clusterId % 10] : "#94a3b8"}
                stroke="white"
                strokeWidth={emp.clusterId ? 1.5 : 0.5}
                className="transition-transform cursor-pointer hover:scale-150"
                onMouseEnter={(e) => {
                  tooltipRef.current?.show(
                    {
                      title: `Employer #${emp.employerId}`,
                      details: [
                        { label: "Status", value: emp.totalNet >= 0 ? "Staffing Growth" : "Staffing Loss" },
                        { label: "Net Change", value: (emp.totalNet > 0 ? "+" : "") + emp.totalNet },
                        { label: "Activity (Turnover)", value: emp.totalTurnover },
                        { label: "Cluster Group", value: emp.clusterId ? `Group ${emp.clusterId}` : "Individual" },
                      ],
                    },
                    e.clientX,
                    e.clientY,
                  );
                }}
                onMouseLeave={() => tooltipRef.current?.hide()}
              />
            ))}
          </g>
        </g>
      </svg>
      <ChartTooltip ref={tooltipRef} />
    </div>
  );
}
