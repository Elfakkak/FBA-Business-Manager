import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead } from "@/components/ui/primitives";
import { packagingOnHand, money, num, type PackagingItem, type PackagingMove, type Product } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Boxes } from "lucide-react";
import { AddPackagingButton, ReceiveButton } from "./packaging-actions";

export default async function PackagingPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: moves }, { data: products }] = await Promise.all([
    supabase.from("packaging_items").select("*").order("name"),
    supabase.from("packaging_moves").select("*"),
    supabase.from("products").select("id, parent"),
  ]);

  const allMoves = (moves ?? []) as PackagingMove[];
  const familyName = new Map<string, string>();
  for (const p of (products ?? []) as Pick<Product, "id" | "parent">[]) familyName.set(p.id, p.parent);

  const rows = ((items ?? []) as PackagingItem[]).map((it) => {
    const d = packagingOnHand(it, allMoves);
    return { item: it, ...d, product: it.family_id ? familyName.get(it.family_id) ?? null : null };
  });

  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Catalog"
        title="Packaging inventory"
        sub="Mailers, cartons, inserts and labels — tracked on their own, assignable to a product family."
        actions={<AddPackagingButton families={(products ?? []) as { id: string; parent: string }[]} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Packaging items" value={num(rows.length)} sub={`${num(totalUnits)} units on hand`} />
        <Kpi label="Inventory value" value={money(totalValue)} sub="at last unit cost" tone="info" />
        <Kpi label="Low / reorder" value={num(lowCount)} sub="at or below reorder point" tone={lowCount ? "warning" : "success"} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Packaging</th>
                <th className="px-4 py-2 font-medium">For product</th>
                <th className="px-4 py-2 text-right font-medium">On hand</th>
                <th className="px-4 py-2 text-right font-medium">Unit cost</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No packaging yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.item.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info"><Boxes className="h-4 w-4" /></div>
                      <div>
                        <div className="font-medium">{r.item.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.item.kind}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.product ? <Badge tone="brand">{r.product}</Badge> : <span className="text-muted-foreground">Any product</span>}
                  </td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono font-semibold", r.low && "text-warning")}>{num(r.onHand)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-muted-foreground">{money(r.unit)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{money(r.value)}</td>
                  <td className="px-4 py-2.5">
                    {r.low ? <Badge tone="warning">Reorder</Badge> : <Badge tone="success">In stock</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ReceiveButton itemId={r.item.id} name={r.item.name} onHand={r.onHand} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
