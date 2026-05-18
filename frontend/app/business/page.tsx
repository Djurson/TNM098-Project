import BusinessTrafficData from "@/public/business_traffic.json";

import type { BusinessTrafficDataset } from "@/lib/types";
import { BusinessTrafficChart, TrafficData } from "@/components/charts/business-traffic-chart";

export default function BusinessPage() {
  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-screen gap-4 mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
        <h1 className="text-2xl font-semibold text-slate-900">Business Prosperity</h1>
      </div>
      <BusinessTrafficChart data={BusinessTrafficData.summary as TrafficData[]} />
    </div>
  );
}
