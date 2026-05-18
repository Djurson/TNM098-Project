import { TurnoverChart, TurnoverData } from "@/components/charts/turnover-chart";
import EmployerTurnoverMap from "@/components/EmployerTurnoverMap";
import TurnoverJSON from "@/public/employer_turnover_daily.json";

function aggregateTurnoverData(jsonData: any): TurnoverData[] {
  const aggregated: Record<string, { hires: number; quits: number; headcount: number }> = {};

  jsonData.employers.forEach((employer: any) => {
    employer.history.forEach((record: any) => {
      if (!aggregated[record.date]) {
        aggregated[record.date] = { hires: 0, quits: 0, headcount: 0 };
      }
      aggregated[record.date].hires += record.hires;
      aggregated[record.date].quits += record.quits;
      aggregated[record.date].headcount += record.headcount ?? 0;
    });
  });

  return Object.entries(aggregated).map(([date, counts]) => ({
    date,
    hires: counts.hires,
    quits: counts.quits,
    headcount: counts.headcount,
  }));
}

export default function EmployersPage() {
  const chartData = aggregateTurnoverData(TurnoverJSON);

  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-screen gap-4 mx-auto">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
          <h1 className="text-2xl font-semibold text-slate-900">Employer Health & Turnover</h1>
        </div>
      </div>
      <TurnoverChart data={chartData} />
      <EmployerTurnoverMap />
      {/* <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
          <p className="text-lg font-medium text-slate-600">Employer Health & Turnover</p>
          <p className="text-sm">Coming soon — employer stability and turnover patterns.</p>
        </div> */}
    </div>
  );
}
