import { CityMap } from "@/components/citymap";
import type { MapLayers } from "@/lib/types";
import { COLOR_BY_TYPE } from "@/lib/utils";
import MapLayersData from "@/public/map_layers.json";

export default function Page() {
  return (
    <section className="flex h-full flex-col overflow-hidden px-6 pb-4 pt-5">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6">
        {/* Header row */}
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 Challenge</p>
            <h1 className="text-2xl font-semibold text-slate-900">City Overview</h1>
          </div>
          {/* Base building-type legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Base</span>
            {Object.entries(COLOR_BY_TYPE).map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.75 }} />
                <span className="capitalize">{label}</span>
              </span>
            ))}
          </div>
        </div>
        <CityMap mapLayers={MapLayersData as MapLayers} />
      </div>
    </section>
  );
}
