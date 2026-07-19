import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { EgiftMethodKind } from '@/lib/egift-kinds';

/**
 * apps/web/lib/egift.ts (server-only)
 *
 * Read side of the Pabuya e-gift surface. Fetches a couple's e-gift
 * destinations (event_egift_methods · migration 20270725000000) and resolves
 * each uploaded QR image's `r2://…` ref to a presigned display URL.
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

/** Render-ready view: the row + a resolved (presigned) QR image URL. */
export type EgiftMethodView = EgiftMethodRow & {
  /** Presigned GET URL for the QR image, or null when none uploaded. */
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
  const v = process.env.PABUYA_PUBLIC_ROUTE_ENABLED;
  return v === '1' || v === 'true';
}

/**
 * Fetch a single event's e-gift methods in display order (sort_order, then
 * created_at as a stable tiebreaker), each with its QR image resolved to a
 * presigned URL.
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
  return await Promise.all(
    rows.map(async (row): Promise<EgiftMethodView> => {
      const qrDisplayUrl = row.qr_r2_key
        ? await displayUrlForStoredAsset(row.qr_r2_key).catch(() => null)
        : null;
      return { ...row, qrDisplayUrl };
    }),
  );
}
