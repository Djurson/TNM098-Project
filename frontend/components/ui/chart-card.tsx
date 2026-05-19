import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  eyebrow: string;
  title: ReactNode;
  hint?: string;
  /** Right side of the header row — legends, tabs, buttons, etc. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ eyebrow, title, hint, actions, children, className }: ChartCardProps) {
  return (
    <div className={cn("flex flex-col gap-3 p-4 border shadow-sm rounded-xl border-slate-200 bg-slate-50", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{eyebrow}</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="relative overflow-hidden border rounded-lg border-slate-100 bg-white/80">
        {children}
      </div>
    </div>
  );
}
