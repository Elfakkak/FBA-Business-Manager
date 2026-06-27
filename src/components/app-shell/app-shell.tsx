"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Boxes, Factory, Receipt, Truck, Ship, Package, Warehouse,
  TrendingUp, PackageOpen, Calculator, Wallet, DollarSign, Users, Shield, Tags,
  FileText, Settings, Plus, Search, Bell, Sun, Moon, Menu, X,
  ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight,
} from "lucide-react";

type Leaf = { label: string; href: string; section: string; icon: React.ElementType; ready?: boolean };
type Group = { title: string; icon: React.ElementType; href?: string; section?: string; items?: Leaf[]; defaultOpen?: boolean };

const NAV: Group[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/", section: "dashboard" },
  {
    title: "Operations", icon: Boxes, defaultOpen: true, items: [
      { label: "Orders", href: "/orders", section: "orders", icon: Package, ready: true },
      { label: "Invoices", href: "/invoices", section: "finance", icon: Receipt, ready: true },
      { label: "Shipments", href: "/shipments", section: "shipments", icon: Ship, ready: true },
      { label: "FBA Shipments", href: "/fba-shipments", section: "shipments", icon: Truck, ready: true },
    ],
  },
  {
    title: "Catalog", icon: PackageOpen, defaultOpen: true, items: [
      { label: "Products", href: "/catalog", section: "catalog", icon: Package, ready: true },
      { label: "Inventory", href: "/inventory", section: "catalog", icon: Warehouse, ready: true },
      { label: "Performance", href: "/performance", section: "performance", icon: TrendingUp },
      { label: "Packaging", href: "/packaging", section: "packaging", icon: Boxes, ready: true },
      { label: "Service charges", href: "/charge-types", section: "catalog", icon: Tags, ready: true },
      { label: "FBA calculator", href: "/fba-calculator", section: "catalog", icon: Calculator, ready: true },
    ],
  },
  {
    title: "Finance", icon: Wallet, items: [
      { label: "Business", href: "/finance", section: "finance", icon: LayoutDashboard },
      { label: "P&L", href: "/finance/pnl", section: "finance", icon: DollarSign },
      { label: "Partnership", href: "/finance/partnership", section: "finance", icon: Users },
      { label: "Tax", href: "/finance/tax", section: "finance", icon: Shield },
      { label: "Transactions", href: "/finance/transactions", section: "finance", icon: FileText },
    ],
  },
  {
    title: "Partners", icon: Factory, defaultOpen: true, items: [
      { label: "Suppliers", href: "/suppliers", section: "suppliers", icon: Factory, ready: true },
      { label: "Trading partners", href: "/partners", section: "partners", icon: Users, ready: true },
    ],
  },
];

const QUICK_CREATE = [
  { label: "New order", href: "/orders?new=1", icon: Package },
  { label: "New shipment", href: "/shipments?new=1", icon: Ship },
  { label: "Add product", href: "/catalog?new=1", icon: PackageOpen },
  { label: "Log finance entry", href: "/invoices?new=1", icon: DollarSign },
];

export function AppShell({
  isOwner, perms, name, role, children,
}: {
  isOwner: boolean;
  perms: Record<string, boolean>;
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const canView = (s?: string) => !s || isOwner || perms[s] === true;
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

  return (
    <div className="vy-app">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} pathname={pathname} canView={canView} />

      <div className="vy-app-main">
        <Header
          name={name} role={role} initials={initials}
          dark={dark} onToggleTheme={() => setDark((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <div className="vy-content">
          <div className="vy-content-inner">{children}</div>
        </div>
      </div>

      {/* mobile nav */}
      <div className={cn("vy-mobile-nav", mobileOpen && "is-open")} aria-hidden={!mobileOpen}>
        <div className="vy-mobile-nav-scrim" onClick={() => setMobileOpen(false)} />
        <div className="vy-mobile-nav-panel" role="dialog" aria-label="Navigation">
          <div className="vy-mobile-nav-head">
            <span className="vy-brand">
              <span className="vy-brand-mark">V</span>
              <span className="vy-brand-text">
                <span className="vy-brand-name">Vyonix</span>
                <span className="vy-brand-sub">Business Manager</span>
              </span>
            </span>
            <button className="vy-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <Sidebar collapsed={false} mobile pathname={pathname} canView={canView} />
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  collapsed, onToggle, mobile, pathname, canView,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  mobile?: boolean;
  pathname: string;
  canView: (s?: string) => boolean;
}) {
  const initialOpen = useMemo(() => {
    const o: Record<string, boolean> = {};
    for (const g of NAV) {
      if (g.items) o[g.title] = g.defaultOpen || g.items.some((i) => isActive(pathname, i.href));
    }
    return o;
  }, [pathname]);
  const [open, setOpen] = useState(initialOpen);
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);

  // Close the Quick-create menu on any outside click or Escape (a fixed scrim gets
  // trapped in the sidebar's stacking context, so clicks on the main area miss it).
  useEffect(() => {
    if (!quickOpen) return;
    const onDown = (e: MouseEvent) => { if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQuickOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [quickOpen]);

  return (
    <nav className={cn("vy-sidebar", collapsed && "vy-sidebar--collapsed", mobile && "vy-sidebar--mobile")} aria-label="Primary">
      {!mobile && (
        <div className="vy-sidebar-head">
          <Link className="vy-brand" href="/">
            <span className="vy-brand-mark">V</span>
            {!collapsed && (
              <span className="vy-brand-text">
                <span className="vy-brand-name">Vyonix</span>
                <span className="vy-brand-sub">Business Manager</span>
              </span>
            )}
          </Link>
          <button className="vy-collapse-btn" onClick={onToggle} aria-label="Toggle sidebar">
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {!collapsed && (
        <div ref={quickRef} style={{ position: "relative" }}>
          <button className="vy-quick-create" onClick={() => setQuickOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            <span>Quick create</span>
            <kbd>⌘N</kbd>
          </button>
          {quickOpen && (
            <>
              <div className="vy-card" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 2px)", zIndex: 41, padding: 4 }}>
                {QUICK_CREATE.map((q) => {
                  const Icon = q.icon;
                  return (
                    <Link key={q.label} href={q.href} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent" onClick={() => setQuickOpen(false)}>
                      <Icon className="h-4 w-4 text-primary" /> {q.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="vy-sidebar-scroll">
        {!collapsed && <div className="vy-sidebar-label"><span className="vy-kicker">Sections</span></div>}

        {NAV.map((group) => {
          const Icon = group.icon;
          // leaf group (single link)
          if (group.href) {
            if (!canView(group.section)) return null;
            const active = isActive(pathname, group.href);
            if (collapsed) {
              return (
                <div key={group.title} className="vy-grp-rail" title={group.title}>
                  <Link href={group.href} className={cn("vy-grp-rail-btn", active && "is-active")} aria-label={group.title}><Icon className="h-4 w-4" /></Link>
                </div>
              );
            }
            return (
              <div key={group.title} className="vy-grp">
                <Link href={group.href} className={cn("vy-grp-head", active && "is-active")}>
                  <Icon className="h-[15px] w-[15px]" />
                  <span className="vy-grp-title">{group.title}</span>
                </Link>
              </div>
            );
          }

          const visibleItems = (group.items ?? []).filter((i) => canView(i.section));
          if (visibleItems.length === 0) return null;
          const groupActive = visibleItems.some((i) => isActive(pathname, i.href));

          if (collapsed) {
            return (
              <div key={group.title} className="vy-grp-rail" title={group.title}>
                <div className={cn("vy-grp-rail-btn", groupActive && "is-active")}><Icon className="h-4 w-4" /></div>
              </div>
            );
          }
          const isOpen = open[group.title];
          return (
            <div key={group.title} className="vy-grp">
              <button className={cn("vy-grp-head", groupActive && "is-active", isOpen && "is-open")} onClick={() => setOpen((p) => ({ ...p, [group.title]: !p[group.title] }))} aria-expanded={isOpen}>
                <Icon className="h-[15px] w-[15px]" />
                <span className="vy-grp-title">{group.title}</span>
                {isOpen ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />}
              </button>
              {isOpen && (
                <div className="vy-grp-items">
                  {visibleItems.map((it) => {
                    const ItIcon = it.icon;
                    const active = isActive(pathname, it.href);
                    if (!it.ready) {
                      return (
                        <span key={it.label} className="vy-nav-row is-soon" aria-disabled>
                          <ItIcon className="h-3.5 w-3.5" />
                          <span className="vy-nav-row-label">{it.label}</span>
                          <span className="vy-soon-badge">Soon</span>
                        </span>
                      );
                    }
                    return (
                      <Link key={it.label} href={it.href} className={cn("vy-nav-row", active && "is-active")}>
                        <ItIcon className="h-3.5 w-3.5" />
                        <span className="vy-nav-row-label">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="vy-sidebar-foot">
        <Link href="/settings" className={cn("vy-nav-row vy-foot-row", isActive(pathname, "/settings") && "is-active")} title="Settings">
          <Settings className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {!collapsed && <span className="vy-nav-row-label">Settings</span>}
        </Link>
      </div>
    </nav>
  );
}

function Header({
  name, role, initials, dark, onToggleTheme, onOpenMobile,
}: {
  name: string; role: string; initials: string; dark: boolean;
  onToggleTheme: () => void; onOpenMobile: () => void;
}) {
  return (
    <header className="vy-header">
      <button className="vy-hamburger" onClick={onOpenMobile} aria-label="Open navigation"><Menu className="h-[18px] w-[18px]" /></button>
      <div className="vy-header-brand-mini">
        <span className="vy-brand-mark vy-brand-mark--sm">V</span>
        <div>
          <div className="vy-brand-name">Vyonix</div>
          <div className="vy-brand-sub">Business Manager</div>
        </div>
      </div>

      <button className="vy-search" aria-label="Search">
        <Search className="h-3.5 w-3.5" />
        <span className="vy-search-text">Search anything…</span>
        <kbd>⌘ K</kbd>
      </button>
      <button className="vy-icon-btn vy-search-icon" aria-label="Search"><Search className="h-4 w-4" /></button>

      <div style={{ flex: 1, minWidth: 0 }} />

      <Clocks />

      <button className="vy-icon-btn" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="vy-bell-dot" /></button>
      <button className="vy-icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <form action="/auth/signout" method="post" title={`${name} · ${role} — sign out`}>
        <button className="vy-avatar" type="submit" aria-label="Sign out">{initials}</button>
      </form>
    </header>
  );
}

function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);
  const zones: [string, string][] = [["MAR", "Africa/Casablanca"], ["LA", "America/Los_Angeles"], ["CN", "Asia/Shanghai"]];
  const fmt = (tz: string) => {
    if (!now) return "--:--";
    try { return now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };
  return (
    <div className="vy-header-clocks" style={{ display: "flex", gap: 12, alignItems: "center", marginRight: 6 }}>
      {zones.map(([l, tz]) => (
        <span key={tz} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "hsl(var(--muted-fg))" }}>{l}</span>
          <span className="vy-mono" style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{fmt(tz)}</span>
        </span>
      ))}
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
