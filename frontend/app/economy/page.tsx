export default function EconomyPage() {
  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl min-h-screen gap-4 mx-auto">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 - Mini Challenge 3</p>
          <h1 className="text-2xl font-semibold text-slate-900">Economic Overview</h1>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <p className="text-lg font-medium text-slate-600">Economic Overview</p>
        <p className="text-sm">Coming soon — general economic health over time.</p>
      </div>
    </div>
  );
}
