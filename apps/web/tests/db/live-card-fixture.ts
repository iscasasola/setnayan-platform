/**
 * A LIVE service card, as a db-test fixture — carrying what going live needs.
 *
 * Since H2 (migration 20271222415682, owner 2026-09-09: *"the cover-photo ·
 * title · inclusions requirements stay"*), a card inserted live must carry a
 * cover photo (checked immediately by `enforce_service_publish_gate`) and at
 * least one named "what's included" line (checked at COMMIT by a deferred
 * constraint trigger, because inclusions are child rows). The rule binds every
 * writer — fixtures included — so a test that needs a LIVE card makes one here
 * rather than re-typing the two extras at each site.
 *
 * The card and its inclusion are written in ONE transaction, which is exactly
 * why the inclusion check is deferred: the card row must exist before a child
 * row can point at it.
 *
 * ⚠ This is not a way AROUND the gate — it satisfies it. A test about the gate
 * itself must write its rows by hand (see a-card-needs-a-cover-and-whats-
 * included.db.test.ts) so the refusal it asserts is the database's own.
 */
import type { PGlite } from '@electric-sql/pglite';

/** A stored cover reference — the shape `primary_photo_r2_key` holds. */
export const FIXTURE_COVER = 'r2://media/test-fixtures/service-cover.webp';
/** The one "what's included" line a fixture card carries. */
export const FIXTURE_INCLUSION = 'Everything in the package';

type Queryable = Pick<PGlite, 'query' | 'transaction'>;

/**
 * Insert one LIVE card and its "what's included" line; returns its id.
 * `fields` must name at least `vendor_profile_id` and `category`; a price is
 * the caller's (the gate still refuses a card without one — some tests rely on
 * exactly that). `is_active` defaults to TRUE, like the column.
 */
export async function insertLiveCard(
  db: Queryable,
  fields: Record<string, unknown>,
): Promise<string> {
  const row: Record<string, unknown> = {
    is_active: true,
    primary_photo_r2_key: FIXTURE_COVER,
    ...fields,
  };
  const cols = Object.keys(row);
  for (const c of cols) {
    if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`insertLiveCard: bad column ${c}`);
  }
  return db.transaction(async (tx) => {
    const r = await tx.query<{ vendor_service_id: string; vendor_profile_id: string }>(
      `INSERT INTO public.vendor_services (${cols.join(', ')})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING vendor_service_id, vendor_profile_id`,
      cols.map((c) => row[c]),
    );
    const card = r.rows[0]!;
    await tx.query(
      `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
       VALUES ($1, $2, $3)`,
      [card.vendor_service_id, card.vendor_profile_id, FIXTURE_INCLUSION],
    );
    return card.vendor_service_id;
  });
}

/** Give an existing card what going live needs (before flipping it live). */
export async function makeCardPublishable(db: Queryable, vendorServiceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE public.vendor_services
          SET primary_photo_r2_key = COALESCE(NULLIF(btrim(primary_photo_r2_key), ''), $2)
        WHERE vendor_service_id = $1`,
      [vendorServiceId, FIXTURE_COVER],
    );
    await tx.query(
      `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
       SELECT vendor_service_id, vendor_profile_id, $2 FROM public.vendor_services
        WHERE vendor_service_id = $1`,
      [vendorServiceId, FIXTURE_INCLUSION],
    );
  });
}
