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
 * Every pick the couple can make maps to ITS OWN value. Only a pick that is
 * not in this table falls to the default, and that default is the one value
 * this repo already documents as "may also mean never said"
 * (`AMBIGUOUS_VENUE_SETTING`). The table's targets are typed against the
 * shared vocabulary so a key added to the CHECK without a pick, or a pick
 * without a legal target, cannot compile.
 */
import { AMBIGUOUS_VENUE_SETTING, type VenueSetting } from './venue-settings';

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

/** The venue setting for the couple's FIRST reception pick; the default when they made none. */
export function venueSettingForReceptionPicks(picks: readonly string[]): VenueSetting {
  for (const p of picks) {
    const v = RECEPTION_PICK_TO_VENUE_SETTING[p];
    if (v) return v;
  }
  return AMBIGUOUS_VENUE_SETTING;
}
