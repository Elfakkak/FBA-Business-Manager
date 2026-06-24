import { createClient } from "@/lib/supabase/server";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  PackageOpen,
  Factory,
  Truck,
  Wallet,
  TrendingUp,
  Settings,
} from "lucide-react";

// App sections mirror the prototype nav. `section` matches the RLS
// can_view() keys so visibility lines up with what Simo grants Youness.
const SECTIONS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: Factory },
  { key: "catalog", label: "Catalog", icon: Package },
  { key: "catalog", label: "Inventory", icon: Warehouse },
  { key: "packaging", label: "Packaging", icon: PackageOpen },
  { key: "suppliers", label: "Suppliers", icon: Boxes },
  { key: "partners", label: "Partners", icon: Boxes },
  { key: "shipments", label: "Shipments", icon: Truck },
  { key: "finance", label: "Finance", icon: Wallet },
  { key: "performance", label: "Performance", icon: TrendingUp },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("name, role, is_owner, section_perms")
    .eq("auth_uid", user!.id)
    .maybeSingle();

  const isOwner = profile?.is_owner || profile?.role === "Owner";
  const perms = (profile?.section_perms ?? {}) as Record<string, boolean>;
  const canView = (k: string) => isOwner || perms[k] === true;

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-surface-raised/60 p-4 md:block">
        <div className="mb-6 px-2">
          <div className="text-lg font-semibold tracking-tight">Manifest</div>
          <p className="text-xs text-muted-foreground">FBA Business Manager</p>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map((s, i) => {
            const allowed = canView(s.key);
            const Icon = s.icon;
            return (
              <div
                key={`${s.key}-${i}`}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${
                  allowed
                    ? "text-foreground hover:bg-accent"
                    : "cursor-not-allowed text-muted-foreground/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{s.label}</span>
                {!allowed && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide">
                    hidden
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {profile?.name ?? user?.email}
            </span>{" "}
            <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {profile?.role ?? "—"}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
              Sign out
            </button>
          </form>
        </header>

        <main className="flex-1 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Phase 0 — Foundation is live
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Next.js 16 + TypeScript + Tailwind v4 on Vercel, backed by Supabase
            (Postgres + Auth + RLS). The full 30-table schema is migrated and
            row-level security is enforcing per-section visibility. Pages get
            built out in Phase 1+.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Database" value="30 tables" sub="schema migrated" tone="net" />
            <Card title="Auth + RLS" value="Active" sub="owner / view-only" tone="net" />
            <Card
              title="Your access"
              value={isOwner ? "Full (Owner)" : "View-only"}
              sub={
                isOwner
                  ? "all sections"
                  : `${Object.values(perms).filter(Boolean).length} sections granted`
              }
              tone="revenue"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  tone: "net" | "revenue" | "expense";
}) {
  const toneColor =
    tone === "net"
      ? "text-net"
      : tone === "revenue"
        ? "text-revenue"
        : "text-expense";
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className={`tabular mt-2 text-2xl font-semibold ${toneColor}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
