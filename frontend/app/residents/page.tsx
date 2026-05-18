export default function ResidentsPage() {
  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-screen gap-4 mx-auto">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
          <h1 className="text-2xl font-semibold text-slate-900">Employer Health & Turnover</h1>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <p className="text-lg font-medium text-slate-600">Resident Financial Health</p>
        <p className="text-sm">Coming soon — wages vs cost of living over time.</p>
      </div>
    </div>
  );
}
