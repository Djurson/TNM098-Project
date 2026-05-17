"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useState } from "react";

import type { BuildingDataset, BuildingFeature } from "@/lib/types";

const WIDTH = 1100;
const HEIGHT = 820;
const PADDING = 28;

const COLOR_BY_TYPE: Record<BuildingFeature["typeGroup"], string> = {
  residential: "#2f8f83",
  commercial: "#d9822b",
  school: "#4c7bd9",
  other: "#8a8f98",
};

export default function CityMap() {
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/buildings.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load buildings.json (${response.status})`);
        }
        return response.json() as Promise<BuildingDataset>;
      })
      .then((payload) => {
        if (active) {
          setBuildings(payload.buildings ?? []);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    buildings.forEach((building) => {
      building.polygon.forEach((ring) => {
        ring.forEach(([xVal, yVal]) => {
          minX = Math.min(minX, xVal);
          minY = Math.min(minY, yVal);
          maxX = Math.max(maxX, xVal);
          maxY = Math.max(maxY, yVal);
        });
      });
    });

    if (!Number.isFinite(minX)) return null;

    return { minX, minY, maxX, maxY };
  }, [buildings]);

  const pathForBuilding = useMemo(() => {
    if (!bounds) {
      return () => "";
    }
    const xScale = d3
      .scaleLinear()
      .domain([bounds.minX, bounds.maxX])
      .range([PADDING, WIDTH - PADDING]);
    const yScale = d3
      .scaleLinear()
      .domain([bounds.minY, bounds.maxY])
      .range([HEIGHT - PADDING, PADDING]);

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
  }, [bounds]);

  return (
    <section className="w-full px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">City Fabric</p>
            <h1 className="text-2xl font-semibold text-slate-900">Engagement Building Atlas</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            {Object.entries(COLOR_BY_TYPE).map(([label, color]) => (
              <span key={label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]"
          style={{
            backgroundImage: "radial-gradient(circle at top, rgba(226,232,240,0.6), transparent 45%), radial-gradient(circle at bottom, rgba(226,232,240,0.4), transparent 55%)",
          }}>
          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : (
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img">
              <title>Engagement buildings overview</title>
              <rect width={WIDTH} height={HEIGHT} fill="transparent" />
              <g stroke="#0f172a" strokeOpacity={0.2} strokeWidth={0.7} fillRule="evenodd">
                {buildings.map((building) => (
                  <path key={building.buildingId} d={pathForBuilding(building)} fill={COLOR_BY_TYPE[building.typeGroup]} fillOpacity={0.55} />
                ))}
              </g>
            </svg>
          )}
        </div>
      </div>
    </section>
  );
}
