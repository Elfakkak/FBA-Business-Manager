"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  PackageOpen,
  Factory,
  Truck,
  Wallet,
  TrendingUp,
  Settings,
  Users,
  Boxes,
} from "lucide-react";

type Item = { label: string; href: string; section: string; icon: React.ElementType; ready: boolean };

const ITEMS: Item[] = [
  { label: "Dashboard", href: "/", section: "dashboard", icon: LayoutDashboard, ready: true },
  { label: "Orders", href: "/orders", section: "orders", icon: Factory, ready: false },
  { label: "Catalog", href: "/catalog", section: "catalog", icon: Package, ready: true },
  { label: "Inventory", href: "/inventory", section: "catalog", icon: Warehouse, ready: true },
  { label: "Packaging", href: "/packaging", section: "packaging", icon: PackageOpen, ready: true },
  { label: "Suppliers", href: "/suppliers", section: "suppliers", icon: Boxes, ready: false },
  { label: "Partners", href: "/partners", section: "partners", icon: Users, ready: false },
  { label: "Shipments", href: "/shipments", section: "shipments", icon: Truck, ready: false },
  { label: "Finance", href: "/finance", section: "finance", icon: Wallet, ready: false },
  { label: "Performance", href: "/performance", section: "performance", icon: TrendingUp, ready: false },
  { label: "Settings", href: "/settings", section: "settings", icon: Settings, ready: false },
];

export function Sidebar({ isOwner, perms }: { isOwner: boolean; perms: Record<string, boolean> }) {
  const pathname = usePathname();
  const canView = (s: string) => isOwner || perms[s] === true;

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-surface-raised/60 p-4 md:flex md:flex-col">
      <div className="mb-6 px-2">
        <div className="text-lg font-semibold tracking-tight">Vyonix</div>
        <p className="text-xs text-muted-foreground">Business Manager</p>
      </div>
      <nav className="space-y-0.5">
        {ITEMS.map((it) => {
          const allowed = canView(it.section);
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          const base = "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition";

          if (!allowed) {
            return (
              <div key={it.label} className={cn(base, "cursor-not-allowed text-muted-foreground/40")}>
                <Icon className="h-4 w-4" />
                <span>{it.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide">hidden</span>
              </div>
            );
          }
          if (!it.ready) {
            return (
              <div key={it.label} className={cn(base, "cursor-default text-muted-foreground/50")}>
                <Icon className="h-4 w-4" />
                <span>{it.label}</span>
                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide">soon</span>
              </div>
            );
          }
          return (
            <Link
              key={it.label}
              href={it.href}
              className={cn(
                base,
                active ? "bg-primary/12 font-medium text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
