import { CityMap } from "@/components/citymap";
import type { MapLayers } from "@/lib/types";
import { COLOR_BY_TYPE } from "@/lib/utils";
import MapLayersData from "@/public/map_layers.json";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-0 gap-4 mx-auto">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
          <h1 className="text-2xl font-semibold text-slate-900">City Overview</h1>
        </div>
        {/* Base building-type legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Base</span>
          {Object.entries(COLOR_BY_TYPE).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.75 }} />
              <span className="capitalize">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <CityMap mapLayers={MapLayersData as MapLayers} />
    </div>
  );
}
