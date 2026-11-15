/**
 * reception-pick-to-venue-setting.ts — the couple's onboarding reception pick
 * (`setting_*`, screen 10) → `events.venue_setting`. Pure; executed by
 * `reception-pick-to-venue-setting.test.ts`.
 *
 * ── THE DEFECT (owner, 2026-09-23) ────────────────────────────────────────
 * "Where is the event place. this means the data is wrong." The old map in
 * onboarding/wedding/actions.ts sent `setting_events_place` AND
 * `setting_restaurant` to `banquet_hall` — the first because the column had no
 * such value, the second needlessly (restaurant has been legal since
 * 20271114090000). A couple who said "events place" was stored as a hotel
 * ballroom, and nothing downstream (Explore's venue facet, the supplier's
 * "Venues you work" match, the 3D room, the render brief) could ever know.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * Every pick the couple can make maps to ITS OWN value. No recognised pick is
 * NULL — "Not set" (owner 13 Nov 2026, F-W2-02) — never the old default
 * `AMBIGUOUS_VENUE_SETTING`, the value this repo documents as "may also mean
 * never said". The table's targets are typed against the
 * shared vocabulary so a key added to the CHECK without a pick, or a pick
 * without a legal target, cannot compile.
 */
import type { VenueSetting } from './venue-settings';

/** The seven reception picks the onboarding offers (refinements.ts `setting_*`). */
export const RECEPTION_PICK_TO_VENUE_SETTING: Readonly<Record<string, VenueSetting>> = {
  setting_ballroom: 'banquet_hall',
  setting_events_place: 'events_place',
  setting_heritage: 'heritage',
  setting_restaurant: 'restaurant',
  setting_garden: 'garden',
  setting_beach: 'beach',
  setting_resort: 'destination',
};

/**
 * The venue setting for the couple's FIRST reception pick — or NULL when they made none: "Not set", never a default
 * "Banquet hall" (owner 13 Nov 2026, walk F-W2-02; the wedding constraint allows it since migration 20271345020514).
 */
export function venueSettingForReceptionPicks(picks: readonly string[]): VenueSetting | null {
  for (const p of picks) {
    const v = RECEPTION_PICK_TO_VENUE_SETTING[p];
    if (v) return v;
  }
  return null;
}
