// V2 Cutover Phase G — IndexedDB + service-worker offline daemon scaffolding.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK · V2
// publisher posture" lists 7 media services that need offline capture +
// queued upload during pilot venues with weak WiFi. The 5-20 family-and-
// friends pilot cohort (per [[project_setnayan_pilot_timeline]]) is
// unlikely to materially exercise these surfaces — venues for the pilot
// have WiFi or 4G — but having the IndexedDB + service-worker scaffold
// in place means V1.x engineering pickup per-service is a small last-
// mile job rather than a foundation-pour.
//
// Per-service sync handlers live under ./service-handlers/ and return
// `{ ok: false, error: 'V1.x post-pilot' }` placeholders today. Phase G
// only ships the bus (IDB schema, service worker, sync orchestrator,
// admin diagnostic). Phase G+1..Phase G+7 (one per service) wire up the
// real upload paths in V1.x.

/**
 * The 7 media services that own an offline queue. Each maps to an
 * IndexedDB object store + a stub handler under ./service-handlers/.
 *
 * The ordering follows the canonical service catalog in CLAUDE.md
 * 2026-05-28 third row (Papic → Panood → Patiktok → Pabati → SDE →
 * Camera Bridge → Live Wall). Keep the union literal in the same
 * order so grep over the codebase reads in the same sequence the
 * brief uses.
 */
export type ServiceCode =
  | 'papic'
  | 'panood'
  | 'patiktok'
  | 'pabati'
  | 'sde'
  | 'camera_bridge'
  | 'live_wall';

/**
 * Canonical ordered list of ServiceCode values. Use this when iterating
 * queues so the order is stable + matches the spec.
 *
 * `as const` + the `ServiceCode[]` annotation keeps the literal narrow
 * (TS infers the union members rather than `string[]`), so downstream
 * consumers can `SERVICE_CODES.forEach((svc) => ...)` and get the union
 * type back.
 */
export const SERVICE_CODES: readonly ServiceCode[] = [
  'papic',
  'panood',
  'patiktok',
  'pabati',
  'sde',
  'camera_bridge',
  'live_wall',
] as const;

/**
 * Display labels for the admin diagnostic page. Brand voice — no
 * engineering jargon, no "V1.x" markers in user-facing copy per
 * [[feedback_setnayan_no_dev_text_post_launch]]. The diagnostic page
 * itself frames the daemon as "scaffolded for pilot" but the per-
 * service rows just read as their canonical product names.
 */
export const SERVICE_LABELS: Record<ServiceCode, string> = {
  papic: 'Papic — photo capture',
  panood: 'Panood — livestream cache',
  patiktok: 'Patiktok — booth video',
  pabati: 'Pabati — guest clips',
  sde: 'Same-day-edit working copies',
  camera_bridge: 'Camera Bridge — DSLR transit',
  live_wall: 'Live Wall — gallery cache',
};

/**
 * A single pending item sitting in an offline queue.
 *
 * `item_id` is a client-minted UUIDv4 (crypto.randomUUID) — it becomes
 * the IndexedDB keyPath. Service handlers idempotency-key off this
 * value so retries don't duplicate uploads.
 *
 * `payload` is intentionally `Record<string, unknown>` rather than a
 * generic + per-service shape — Phase G is bus scaffolding only, and
 * each service handler will narrow the type when it lands in V1.x.
 * Keeping it loose here means we don't have to thread a generic
 * parameter through openOfflineDB / enqueue / listOfflineItems just
 * to support a future use case.
 *
 * `retry_count` + `last_error` are populated by the sync daemon when a
 * handler returns `{ ok: false, error }`. The admin diagnostic surfaces
 * `last_error` so a venue operator can see why a queue isn't draining.
 *
 * `queued_at` is an ISO-8601 string (not Date) so it round-trips through
 * IDB cleanly. IDB stores Date objects, but ISO strings are friendlier
 * for the admin UI + future server-side log shipping.
 */
export interface OfflineItem {
  item_id: string;
  event_id: string;
  queued_at: string;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error?: string;
}

/**
 * Output shape of `getOfflineQueueStats()` — one row per service with
 * the current pending count. The admin diagnostic renders this as a
 * 7-row table; the sync daemon uses it as a pre-flight check before
 * triggering uploads.
 */
export interface OfflineQueueStat {
  service: ServiceCode;
  pending: number;
}

/**
 * Result returned by per-service handlers via the sync daemon.
 *
 * `ok: true` means the item uploaded successfully — the daemon will
 * dequeue. `ok: false` keeps the item in the queue; `error` is stored
 * on the IDB row's `last_error` for the diagnostic page to show.
 */
export type SyncResult = { ok: true } | { ok: false; error: string };

/**
 * Aggregate result of `triggerSyncNow()` — one row per service with
 * how many items synced + how many failed in this pass. Exposed on
 * the admin diagnostic [Trigger sync now] button.
 */
export interface SyncRunSummary {
  service: ServiceCode;
  synced: number;
  failed: number;
}
