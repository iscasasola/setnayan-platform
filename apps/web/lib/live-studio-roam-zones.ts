/**
 * apps/web/lib/live-studio-roam-zones.ts
 *
 * PURE, Supabase-free helpers for the Live Studio ROAM controller — the host-facing
 * surface where a couple sets up the multiple channels (zones/cameras/venues) guests
 * pick between (2026-07-24 "make Roam buyable" task; see live-studio-roam.ts for the
 * data layer + live-studio-roam-provision.ts for the mirror/pool spine).
 *
 * A "zone" is one entry in live_studio_roam_zones — one camera/place a guest can watch.
 * The controller lets the host name each channel, group it under a venue, mark the
 * featured (default) one, and order them. This module holds the input normalization,
 * the dense zone-index allocator, and the capacity cap — kept pure so the server
 * actions (setup/actions.ts) and the unit tests share one source of truth and the
 * injection/validation rules can't drift between write and test.
 */

/** Field length caps — keep labels short enough to render as picker chips. */
export const ROAM_ZONE_LABEL_MAX = 60;
export const ROAM_VENUE_LABEL_MAX = 60;

/**
 * Max zones a host can configure per event. A guest camera picker with more than a
 * dozen live tiles is unusable on a phone, and each zone maps to one YouTube
 * broadcast on the (capacity-capped) pool channel — so this is both a UX and a
 * concurrency guard. Generous enough for ceremony + reception + a few booths across
 * two venues.
 */
export const MAX_ROAM_ZONES = 12;

/**
 * Normalize a host-entered channel label. Trims, collapses inner whitespace, and
 * enforces the length cap. Returns null when the result is empty (the caller
 * rejects) — a zone MUST have a label (mirrors the NOT NULL column + the
 * parseRoamManifest read-side barrier that drops label-less entries).
 */
export function normalizeZoneLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, ROAM_ZONE_LABEL_MAX);
}

/**
 * Normalize the optional venue grouping label. Same cleaning as the zone label but
 * empty → null (no venue grouping) rather than a rejection, because venue_label is
 * a nullable column (single unlabeled group).
 */
export function normalizeVenueLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, ROAM_VENUE_LABEL_MAX);
}

/**
 * Next dense zone_index for a new zone. Zones are 1..N per event; the UNIQUE
 * (event_id, zone_index) constraint means we allocate max(existing)+1 (dense-enough;
 * a delete can leave a gap, which is fine — the picker orders by zone_index, it does
 * not require contiguity). Empty set → 1.
 */
export function computeNextZoneIndex(
  existing: ReadonlyArray<{ zone_index: number }>,
): number {
  let max = 0;
  for (const z of existing) {
    if (typeof z.zone_index === 'number' && Number.isFinite(z.zone_index) && z.zone_index > max) {
      max = z.zone_index;
    }
  }
  return max + 1;
}

/** True when the host still has room to add a zone under the cap. */
export function canAddZone(currentCount: number): boolean {
  return currentCount < MAX_ROAM_ZONES;
}

export type NormalizedZoneInput = {
  label: string;
  venueLabel: string | null;
  isFeatured: boolean;
};

export type ZoneInputResult =
  | { ok: true; value: NormalizedZoneInput }
  | { ok: false; reason: string };

/**
 * Validate + normalize the raw controller form input for creating/updating a zone.
 * Single choke point so the server action and the tests agree on every rule:
 *   • label required (post-normalize) — else a friendly rejection
 *   • venue optional
 *   • featured coerced from the checkbox value ('on'/'true'/true)
 */
export function normalizeZoneInput(input: {
  label?: unknown;
  venueLabel?: unknown;
  isFeatured?: unknown;
}): ZoneInputResult {
  const label = normalizeZoneLabel(input.label);
  if (!label) {
    return { ok: false, reason: 'Give this camera a name so guests know what they’re watching.' };
  }
  const venueLabel = normalizeVenueLabel(input.venueLabel);
  const isFeatured =
    input.isFeatured === true ||
    input.isFeatured === 'on' ||
    input.isFeatured === 'true' ||
    input.isFeatured === '1';
  return { ok: true, value: { label, venueLabel, isFeatured } };
}
