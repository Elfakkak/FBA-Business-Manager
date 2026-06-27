// Instant skeleton while the product page's data loads — makes opening a product
// feel immediate instead of waiting on the server round-trips.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-3 w-40 animate-pulse rounded bg-muted" />
      <div className="h-7 w-72 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="vy-card h-24 animate-pulse" />)}
      </div>
      <div className="vy-card h-40 animate-pulse" />
      <div className="vy-card h-64 animate-pulse" />
    </div>
  );
}
