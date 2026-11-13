import type { SupplierRow } from './suppliers-rows';

/**
 * 🏪 "Suppliers on this event · N" on Details (v113 `sups`; B1 step 6.6) — the other booked suppliers, name and service.
 * Booked shops only (the brief carries the roster from booking on); not drawn when the brief did not carry it.
 */
export function SuppliersList({ rows }: { rows: SupplierRow[] | undefined }) {
  if (rows === undefined) return null;
  return (
    <section data-details-suppliers="" aria-label="Suppliers on this event">
      <p className="home-k2 pb-1">Suppliers on this event · {rows.length}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink/70">No other supplier is booked yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.key} className="flex min-h-12 items-center gap-3 py-2" data-details-supplier="">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="block text-xs text-ink/70">{r.service}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
