"use client";

import { TooltipData } from "@/lib/types";
import { Ref, useImperativeHandle, useRef, useState } from "react";

export interface TooltipRef {
  show: (data: TooltipData, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

export function ChartTooltip({ ref }: { ref?: Ref<TooltipRef> }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TooltipData | null>(null);

  useImperativeHandle(ref, () => ({
    show: (d, x, y) => {
      setData(d);
      if (divRef.current) {
        divRef.current.style.opacity = "1";
        divRef.current.style.transform = `translate(${x + 15}px, ${y + 15}px)`;
      }
    },
    move: (x, y) => (divRef.current ? (divRef.current.style.transform = `translate(${x + 15}px, ${y + 15}px)`) : undefined),
    hide: () => (divRef.current ? (divRef.current.style.opacity = "0") : undefined),
  }));

  return (
    <div ref={divRef} className="fixed z-50 p-3 text-sm border rounded-lg shadow-lg opacity-0 pointer-events-none transition-opacity duration-150 bg-white/95 backdrop-blur-sm border-slate-200 text-slate-800" style={{ left: 0, top: 0, willChange: "transform" }}>
      {data && (
        <>
          {data.title && <div className="pb-1 mb-1 text-xs font-bold border-b border-slate-200">{data.title}</div>}
          <div className="flex flex-col mt-1 gap-1">
            {data.details.map((detail, idx) => (
              <DataDetails key={idx} detail={detail} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DataDetails({ detail }: { detail: { label: string; value: string | number } }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{detail.label}:</span>
      <span className="font-medium text-slate-900">{detail.value}</span>
    </div>
  );
}

ChartTooltip.displayName = "ChartTooltip";
