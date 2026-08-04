/**
 * ⭐ THE NAME ON THE RECEIPT COMES FROM THE SAME ROW AS THE PRICE.
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────────
 * `/api/v1/billing/initialize-maya` resolved the PRICE from the admin catalog
 * (`platform_retail_catalog_v2` / `platform_package_catalog`, fail-closed) but
 * resolved the line-item TITLE from a module-level `TITLE_BOOK` map that was
 * NOT demo-fenced. So the real charge path printed titles nobody had maintained
 * since the V2 seed — `PAPIC_SEATS` billed as "Papic Professional 5 Seats Pass"
 * (a retired product) and `PAPIC_GUEST` as "Papic Guest AI Gallery" (not the
 * shipped name). The couple saw that name at checkout, and it was the name the
 * admin then reconciled the reference against.
 *
 * A hardcoded title can drift from the catalog; a catalog title cannot drift
 * from itself. One row, one product: the title and the price now travel
 * together or the sale is refused.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * A catalog row is billable only if it carries BOTH a price and a title. No
 * title ⇒ no line item ⇒ no sale. We never prettify a service_code into a
 * product name on a charge path — `PAPIC_SEATS` → "PAPIC SEATS" is not a name,
 * it is a leak of an internal identifier onto a payment record.
 *
 * Pure by design (no I/O, no `server-only`) so the fail-closed decision is unit
 * testable without a database — same split as `order-charge-math.ts` (pure)
 * beside `order-charge-authority.ts` (I/O).
 */

/** The shape both V2 catalog tables share for the two columns we bill on. */
export type CatalogLineRow = {
  title?: unknown;
  retail_price_php?: unknown;
};

/** A billable checkout line: the product's real name and its real price. */
export type CatalogLine = {
  title: string;
  price: number;
};

/**
 * Turn a catalog row into a billable line, or `null` when the row cannot be
 * billed. Callers translate `null` into their own refusal (the à-la-carte path
 * 400s on the service code; the bundle path throws, which 500s).
 *
 * The price truthiness check reads the RAW column value before `Number()`,
 * preserving the exact semantics the price-only reader shipped with (Supabase
 * returns NUMERIC as either a number or a string depending on the driver, and a
 * ₱0 row has always been treated as unsellable here).
 */
export function catalogLineFromRow(
  row: CatalogLineRow | null | undefined,
): CatalogLine | null {
  if (!row) return null;
  // Raw truthiness first — unchanged from the price-only reader this replaces.
  if (!row.retail_price_php) return null;

  const title = typeof row.title === 'string' ? row.title.trim() : '';
  // Fail closed rather than fall back to a hardcoded or prettified name.
  if (!title) return null;

  const price = Number(row.retail_price_php);
  // A non-numeric price used to flow through as NaN and render "NaN" on the
  // Maya payload (NaN <= 0 is false, so the empty-order guard let it past).
  if (!Number.isFinite(price) || price <= 0) return null;

  return { title, price };
}
