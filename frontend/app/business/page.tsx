"use client";

import { useCallback, useMemo, useState } from "react";

import { MapLayers, EnrichedVenue } from "@/lib/types";
import MapLayersData from "@/public/map_layers.json";
import BusinessesData from "@/public/business/businesses.json";
import BusinessDailyData from "@/public/business/business_daily.json";
import BusinessSummaryData from "@/public/business/business_summary.json";

import { BusinessTrafficChart, type TrafficData } from "@/components/charts/business-traffic-chart";
import { BusinessProsperityChart } from "@/components/charts/business-prosperity-chart";
import { BusinessHealthIndexChart } from "@/components/charts/business-health-index-chart";
import { BusinessMap } from "@/components/business-map";

export default function BusinessPage() {
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);

  const handleSelect = useCallback((id: number | null) => {
    setSelectedVenueId((prev) => (prev === id ? null : id));
  }, []);

  // Aggregate daily venue revenue into per-day pub/restaurant totals for the traffic chart
  const trafficData = useMemo((): TrafficData[] => {
    const typeMap = new Map(BusinessesData.map((b) => [b.venueId, b.type]));
    const byDate = new Map<string, { pubs: number; restaurants: number }>();

    for (const row of BusinessDailyData) {
      const date = row.date.slice(0, 10);
      const type = typeMap.get(row.venueId);
      if (!type) continue;
      if (!byDate.has(date)) byDate.set(date, { pubs: 0, restaurants: 0 });
      const entry = byDate.get(date)!;
      if (type === "pub") entry.pubs += row.daily_amount_spent;
      else entry.restaurants += row.daily_amount_spent;
    }

    return Array.from(byDate.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  // Join venues with their summary stats and compute a normalized prosperity index
  const enrichedVenues = useMemo((): EnrichedVenue[] => {
    const summaryMap = new Map(BusinessSummaryData.map((s) => [s.venueId, s]));

    const joined = BusinessesData.flatMap((b) => {
      const s = summaryMap.get(b.venueId);
      if (!s) return [];
      const avgMonthlyRevenue = s.total_revenue / 15;
      const relativeTrend = avgMonthlyRevenue > 0 ? s.trend_slope / avgMonthlyRevenue : 0;
      return [{ ...b, ...s, relativeTrend, type: b.type as "pub" | "restaurant" }];
    });

    const normalize = (vals: number[]) => {
      const min = Math.min(...vals),
        max = Math.max(...vals);
      return max === min ? vals.map(() => 0.5) : vals.map((v) => (v - min) / (max - min));
    };

    const normOcc = normalize(joined.map((v) => v.avg_occupancy));
    const normTrend = normalize(joined.map((v) => v.relativeTrend));
    const normRevSeat = normalize(joined.map((v) => v.total_revenue / v.maxOccupancy));

    return joined.map((v, i) => ({
      ...v,
      norm_occupancy: normOcc[i],
      norm_trend: normTrend[i],
      norm_revenue_per_seat: normRevSeat[i],
      prosperity_index: 0.35 * normOcc[i] + 0.4 * normTrend[i] + 0.25 * normRevSeat[i],
    }));
  }, []);

  const selectedVenueDaily = useMemo(() => {
    if (selectedVenueId === null) return null;
    return BusinessDailyData.filter((r) => r.venueId === selectedVenueId).map((r) => ({
      date: r.date.slice(0, 10),
      amount: r.daily_amount_spent,
    }));
  }, [selectedVenueId]);

  const selectedVenue = useMemo(
    () => (selectedVenueId === null ? null : (enrichedVenues.find((v) => v.venueId === selectedVenueId) ?? null)),
    [selectedVenueId, enrichedVenues],
  );

  const buildings = (MapLayersData as MapLayers).buildings;

  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-screen gap-4 mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
        <h1 className="text-2xl font-semibold text-slate-900">Business Prosperity</h1>
      </div>

      <BusinessTrafficChart data={trafficData} selectedVenueDaily={selectedVenueDaily} selectedVenue={selectedVenue} />

      <div className="grid grid-cols-2 gap-4">
        <BusinessProsperityChart venues={enrichedVenues} selectedVenueId={selectedVenueId} onSelect={handleSelect} />
        <BusinessMap buildings={buildings} venues={enrichedVenues} selectedVenueId={selectedVenueId} onSelect={handleSelect} />
      </div>

      <BusinessHealthIndexChart venues={enrichedVenues} selectedVenueId={selectedVenueId} onSelect={handleSelect} />
    </div>
  );
}
