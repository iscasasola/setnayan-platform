import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStoredAsset } from '@/lib/uploads';
import { pabuyaQrPath } from '@/lib/pabuya-qr-url';
import type { EgiftMethodKind } from '@/lib/egift-kinds';
import { envFlagEnabled } from '@/lib/env-flag';

/**
 * apps/web/lib/egift.ts (server-only)
 *
 * Read side of the Pabuya e-gift surface. Fetches a couple's e-gift
 * destinations (event_egift_methods · migration 20270725000000) and resolves
 * each uploaded QR image's `r2://…` ref to a PERMANENT display URL — the
 * `/api/pabuya/qr/<public_id>` route, never a time-limited signed one.
 *
 * Used by BOTH the couple dashboard (/dashboard/[eventId]/pabuya, user-scoped
 * client — RLS returns the couple's own rows) AND the public guest surface
 * (/[slug]/pabuya, service-role admin client behind the published gate). The
 * `enabledOnly` flag is what the public read passes so hidden rows never leak.
 */

/** Raw row shape (the table is untyped in the Supabase client). */
export type EgiftMethodRow = {
  egift_method_id: string;
  public_id: string;
  event_id: string;
  method_kind: EgiftMethodKind;
  label: string;
  account_name: string | null;
  handle: string | null;
  qr_r2_key: string | null;
  note: string | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Render-ready view: the row + a resolved QR image URL. */
export type EgiftMethodView = EgiftMethodRow & {
  /**
   * PERMANENT URL for the QR image, or null when none uploaded.
   *
   * This used to be a 24-hour R2 presigned GET. It is now the stable
   * `/api/pabuya/qr/<public_id>` path — a gift page is read for months, and a
   * URL that expires renders as a broken QR on the one surface where a broken
   * QR reads as "these payment details are wrong". See lib/pabuya-qr-url.ts.
   */
  qrDisplayUrl: string | null;
};

const SELECT_COLUMNS =
  'egift_method_id, public_id, event_id, method_kind, label, account_name, handle, qr_r2_key, note, is_enabled, sort_order, created_at, updated_at';

/**
 * Rollout flag for the PUBLIC guest surface (/[slug]/pabuya). OFF by default —
 * the couple can build + preview their e-gift set in the dashboard immediately,
 * but the public route only goes live once the owner sets
 * `PABUYA_PUBLIC_ROUTE_ENABLED=1` in the environment. Keeps net-new public
 * surface behind an owner-controlled switch (the route returns notFound while
 * off), so it can't surprise-ship. The dashboard reads this to decide whether
 * to show the "Open ↗" link.
 */
export function isPabuyaPublicRouteEnabled(): boolean {
  /*
    🔴 THIS USED TO BE `v === '1' || v === 'true'` — TWO EXACT SPELLINGS,
    case-sensitive and untrimmed — and it cost the owner a switch he had already
    set.

    He turned the page on, redeployed, and `/[slug]/pabuya` still answered 404.
    Every other gate was measured and passed: the event exists, weddings carry
    the `website` surface, and the visibility gate REDIRECTS rather than 404s. It
    was this line. `TRUE`, `True`, or `true ` with a trailing space — trivially
    easy to produce in a web form — each failed silently, and a flag that is off
    renders as a page that was never built.

    🔑 THE REPO ALREADY HAD THE ANSWER: `envFlagEnabled` accepts
    true · 1 · yes · on, case-insensitively and trimmed. This function was a
    private re-implementation of a shared rule, and being private is exactly why
    it was stricter than the rule it was copying.
  */
  return envFlagEnabled(process.env.PABUYA_PUBLIC_ROUTE_ENABLED);
}

/**
 * Fetch a single event's e-gift methods in display order (sort_order, then
 * created_at as a stable tiebreaker), each with its QR image resolved to its
 * permanent route URL.
 *
 * Fully fail-soft: any read error (e.g. the migration not yet applied on prod)
 * returns [] rather than throwing, so a couple's dashboard / the public page
 * never crashes over a missing table.
 */
export async function fetchEgiftMethods(
  supabase: SupabaseClient,
  eventId: string,
  opts: { enabledOnly?: boolean } = {},
): Promise<EgiftMethodView[]> {
  let query = supabase
    .from('event_egift_methods')
    .select(SELECT_COLUMNS)
    .eq('event_id', eventId);
  if (opts.enabledOnly) query = query.eq('is_enabled', true);

  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const rows = data as unknown as EgiftMethodRow[];
  return rows.map((row): EgiftMethodView => ({ ...row, qrDisplayUrl: qrUrlFor(row) }));
}

/**
 * The QR URL for one row.
 *
 * An `r2://…` ref resolves to the permanent route; a legacy external URL the
 * couple pasted before R2 upload existed passes straight through, exactly as
 * the old shared resolver did for it.
 *
 * 🔑 NO AWAIT, AND THAT IS PART OF THE FIX. The old shape signed every row on
 * every render — an N-call round trip to R2 to produce URLs that then expired.
 * Building a path needs neither.
 */
function qrUrlFor(row: EgiftMethodRow): string | null {
  if (!row.qr_r2_key) return null;
  const ref = parseStoredAsset(row.qr_r2_key);
  if (!ref) return null;
  return ref.kind === 'legacy_url' ? ref.url : pabuyaQrPath(row.public_id);
}
