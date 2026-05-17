import BusinessTrafficData from "@/public/business_traffic.json";

import type { BusinessTrafficDataset } from "@/lib/types";
import { BusinessTrafficChart } from "@/components/business-traffic-chart";

export default function BusinessPage() {
  return (
    <section className="h-full overflow-y-auto px-6 pb-8 pt-5">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 Challenge</p>
          <h1 className="text-2xl font-semibold text-slate-900">Business Prosperity</h1>
        </div>
        <BusinessTrafficChart data={BusinessTrafficData as BusinessTrafficDataset} />
      </div>
    </section>
  );
}
