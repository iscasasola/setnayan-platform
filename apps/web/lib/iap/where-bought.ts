/**
 * 🍎 WHERE WAS IT BOUGHT? — Home › Your services, in the iPhone app where Apple
 * sells (prototype `in_app_purchase_screens_2026-10-17_fable.html` frame 11:
 * "Live Watch · On · bought on the web · Go live").
 *
 * Ownership lives on the EVENT, in `orders` (the same rows `eventOwnsSku`
 * reads). An App Store purchase is an ordinary order whose
 * `payment_method_key` is `app_store` (lib/iap/fulfil.server.ts
 * `APP_STORE_CHANNEL`); every other order was placed on the web
 * (GCash / BDO, apply-then-pay). So the answer is read off the rows that still
 * confer ownership — and when it is not one clear answer (no order: an
 * internal host, a comp grant, a bundle; or one of each), nothing is claimed
 * and the line says "On" alone. Pure, so it is tested without a database.
 */
import { APP_STORE_CHANNEL_KEY } from './products';

export type BoughtWhere = 'app' | 'web' | null;

/** The order statuses that no longer confer ownership (lib/entitlements.ts `RELINQUISHED_STATUSES`). */
const GONE = new Set(['cancelled', 'refunded', 'lapsed']);

export function boughtWhere(
  rows: ReadonlyArray<{ status?: string | null; payment_method_key?: string | null }> | null,
): BoughtWhere {
  const live = (rows ?? []).filter((r) => !GONE.has(r.status ?? ''));
  if (live.length === 0) return null;
  const app = live.filter((r) => r.payment_method_key === APP_STORE_CHANNEL_KEY).length;
  if (app === live.length) return 'app';
  if (app === 0) return 'web';
  return null;
}

/**
 * Live Watch's line on Home in that app. `active` / `owned` are the page's
 * `eventSkuActive` / `eventOwnsSku` reads; `null` is a read that failed and
 * says "—", never "Not on yet" over a refusal.
 */
export function liveWatchHomeStatus(input: {
  active: boolean | null;
  owned: boolean | null;
  where: BoughtWhere;
}): string {
  const { active, owned, where } = input;
  if (active === null || owned === null) return '—';
  if (active) return where === 'web' ? 'On · bought on the web' : where === 'app' ? 'On · bought in the app' : 'On';
  return owned ? 'Being switched on' : 'Not on yet · one camera is free';
}
