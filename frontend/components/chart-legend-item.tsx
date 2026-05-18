"use client";

import { Check } from "lucide-react";

type Props = {
  checked: boolean;
  onChange: () => void;
  color: string;
  label: React.ReactNode;
  count?: number | string;
};

export function LegendCheckboxItem({ checked, onChange, color, label, count }: Props) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span
        className="flex items-center justify-center w-4 h-4 border rounded shrink-0 transition-colors"
        style={checked ? { backgroundColor: color, borderColor: color } : { borderColor: "#d1d5db" }}
      >
        {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </span>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, opacity: checked ? 1 : 0.35 }} />
      <span className={`flex-1 text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </label>
  );
}
