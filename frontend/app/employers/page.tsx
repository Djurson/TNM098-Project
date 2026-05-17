export default function EmployersPage() {
  return (
    <section className="flex h-full flex-col overflow-hidden px-6 pb-4 pt-5">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        {/* Header row */}
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">VAST 2022 Challenge</p>
            <h1 className="text-2xl font-semibold text-slate-900">Employer Health & Turnover</h1>
          </div>
        </div>
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
          <p className="text-lg font-medium text-slate-600">Employer Health & Turnover</p>
          <p className="text-sm">Coming soon — employer stability and turnover patterns.</p>
        </div>
      </div>
    </section>
  );
}
