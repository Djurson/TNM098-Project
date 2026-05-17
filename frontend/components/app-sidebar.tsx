"use client";

import { BarChart3, Briefcase, Map, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TOP_ITEMS = [{ label: "City Overview", href: "/", icon: Map }];

const ECONOMY_ITEMS = [
  { label: "Overview", href: "/economy", icon: BarChart3 },
  { label: "Business Prosperity", href: "/business", icon: ShoppingBag },
  { label: "Resident Health", href: "/residents", icon: Users },
  { label: "Employer Health", href: "/employers", icon: Briefcase },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 shrink-0 items-center border-b border-slate-100 px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">VAST 2022</p>
          <p className="text-sm font-semibold text-slate-900">City Fabric</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-2 pt-3">
        <div className="space-y-0.5">
          {TOP_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>

        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Economic Health</p>
          <div className="space-y-0.5">
            {ECONOMY_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
