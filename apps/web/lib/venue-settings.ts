/**
 * venue-settings.ts — the ONE list of the reception settings a host can choose,
 * and (since 2026-09-03) the ONE list of the CEREMONY settings beside it.
 *
 * ── A WEDDING HAS TWO VENUES (owner, 2026-09-03) ────────────────────────────
 * Owner: *"venue is 2. ceremony and reception"* · *"ceremony venue is civil
 * registrar, church, mosque, garden, etc."* The schema stored ONE. Both lists
 * live in this file on purpose: the defect being fixed is that nothing said
 * which venue `venue_setting` meant, and two files could not have said it any
 * better than one file saying it twice, side by side.
 *
 *   · VENUE_SETTINGS          → `events.venue_setting`           — the RECEPTION
 *   · CEREMONY_VENUE_SETTINGS → `events.ceremony_venue_setting`  — the CEREMONY
 *
 * They deliberately SHARE two words (`garden`, `beach`) and that is not
 * duplication: a garden ceremony followed by a ballroom reception is one of the
 * commonest Philippine pairings, and the two columns are independent.
 *
 * WHY THIS FILE EXISTS. `events.venue_setting` was hand-written in seven
 * places: the DB CHECK constraint, three server-action allowlists (create-event,
 * the couple's details page, the vendor's compatibility picker), the couple's
 * own `<select>`, and two label maps on Explore. Adding `restaurant` meant
 * editing all seven, and missing any ONE of them fails differently and quietly:
 *
 *   · miss an allowlist  → the couple picks it and the save is rejected
 *   · miss the picker    → the value exists and nobody can choose it
 *   · miss a label map   → the chip renders "restaurant" in raw snake_case
 *   · miss the CHECK     → the write fails at the database
 *
 * None of those throw anywhere a test was looking. So the list lives here now,
 * and `venue-settings.test.ts` fails if any copy drifts from it.
 *
 * ── RESTAURANT (owner, 2026-08-05) ──────────────────────────────────────────
 * Owner: *"we should allow restaurants to be venues as well?"* — asked after
 * finding the product could not describe one. It could not, at four layers
 * at once: no `venue_setting` value, so a couple could not say it; a
 * `venue_directory_type` that DID have the word but zero rows behind it; both
 * mapping functions returning null; and the 3D plan drawing a hotel ballroom.
 *
 * It matters most for the event types opened up the same day (the seat pass and
 * the 3D venue for non-weddings): a christening, birthday or debut reception at
 * a restaurant is arguably the commonest Philippine case, and it was the one
 * shape the product had no way to express.
 */

/**
 * Every RECEPTION setting a host may choose, in the order they are offered.
 * `restaurant` sits after the halls because that is where a host looking for an
 * indoor room will scan next, and before the outdoor options.
 *
 * ── `civil_registrar` LEFT THIS LIST 2026-09-03 (owner decision) ────────────
 * It describes where you MARRY, never where you dine, and it now lives in
 * CEREMONY_VENUE_SETTINGS below. The comment on VENUE_SETTING_TO_DIRECTORY_TYPE
 * had said so in prose for a month ("it is a CEREMONY venue, and the reception
 * filter never offers it") while the DB CHECK went on accepting it as a
 * reception — so "Make it real" could bill a couple for a banquet rendered
 * inside a registrar's office.
 *
 * ⚠ THE VENDOR SIDE READS THIS LIST TOO. `COMPATIBLE_VENUE_SETTINGS` /
 * `ALLOWED_VENUE_SETTINGS` (lib/vendor-compatibility.ts) derive from it, so a
 * vendor's `compatible_venue_settings` array loses its `civil_registrar` tag on
 * their next save. That is correct rather than lossy: the array is only ever
 * matched against `events.venue_setting` (explore's `compatible_venue_settings.cs`
 * filter and wedding-plan-groups' per-pick warning), and no event can hold
 * `civil_registrar` there any more, so the tag could never match again. Rows
 * already carrying it — every admin-seeded religious venue and officiant, tagged
 * by 20260617000000 — are harmless and are left alone.
 */
export const VENUE_SETTINGS = [
  'banquet_hall',
  'restaurant',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
] as const;

export type VenueSetting = (typeof VENUE_SETTINGS)[number];

export function isVenueSetting(value: unknown): value is VenueSetting {
  return typeof value === 'string' && (VENUE_SETTINGS as readonly string[]).includes(value);
}

/** Long form — the couple's picker and Explore's facet chips. */
export const VENUE_SETTING_LABEL: Record<VenueSetting, string> = {
  banquet_hall: 'Hotel Ballroom / Banquet Hall',
  restaurant: 'Restaurant',
  garden: 'Garden Estate',
  beach: 'Beach',
  destination: 'Destination Resort',
  heritage: 'Heritage / Hacienda',
  outdoor_tent: 'Outdoor Tent',
};

/** Short form — inline banner copy ("Restaurant venues only"). */
export const VENUE_SETTING_SHORT_LABEL: Record<VenueSetting, string> = {
  banquet_hall: 'Banquet hall',
  restaurant: 'Restaurant',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination resort',
  heritage: 'Heritage venue',
  outdoor_tent: 'Outdoor tent',
};

/**
 * The value `events.venue_setting` holds when the couple has NOT chosen.
 *
 * 🔑 THIS IS NOT A COLUMN DEFAULT — the column has had none since 20260521080000
 * dropped it (along with NOT NULL). It is what both WRITERS stamp:
 * `create-event/actions.ts` falls back to it for a missing or unrecognised
 * field, and `onboarding/wedding/actions.ts` declares it as `DEFAULT_VENUE`
 * with the comment "the couple refines it later". Meanwhile some genuine picks
 * also collapse onto it (an events place, a private restaurant room).
 *
 * So on this column `banquet_hall` and "never said" are the SAME BYTES, and no
 * reader can separate them. Any surface that spends money on the strength of
 * the venue must treat this one value as unproven — see
 * `receptionVenuePhrase()` below, which refuses to assert it.
 */
export const AMBIGUOUS_VENUE_SETTING: VenueSetting = 'banquet_hall';

/**
 * The room phrase a photoreal render brief may assert for each reception
 * setting. Separate from the labels above because a UI chip and an image prompt
 * want different words ("Heritage / Hacienda" is a filter name; "in a heritage
 * hacienda venue" is an instruction to a renderer).
 */
export const VENUE_SETTING_SCENE_PHRASE: Record<VenueSetting, string> = {
  banquet_hall: 'in a hotel ballroom',
  restaurant: 'in a restaurant dining room',
  garden: 'in an outdoor garden',
  beach: 'on a beach',
  destination: 'at a destination resort',
  heritage: 'in a heritage hacienda venue',
  outdoor_tent: 'under an outdoor reception tent',
};

/**
 * The room phrase for a stored `events.venue_setting`, or `null` when nothing
 * may honestly be asserted.
 *
 * Returns null for: an absent value, a value outside the vocabulary, and —
 * the case that matters — `AMBIGUOUS_VENUE_SETTING`, unless the caller passes
 * positive evidence that the couple actually chose it.
 *
 * ⚠ `chosen` IS A CLAIM ABOUT EVIDENCE, NOT A CONVENIENCE FLAG. Pass true only
 * from a request that has just received the couple's own submission, or from a
 * surface that has shown them the venue and had it confirmed. Reading the column
 * is not evidence; that is the entire point.
 */
export function receptionVenuePhrase(
  setting: string | null | undefined,
  opts?: { chosen?: boolean },
): string | null {
  if (!isVenueSetting(setting)) return null;
  if (setting === AMBIGUOUS_VENUE_SETTING && opts?.chosen !== true) return null;
  return VENUE_SETTING_SCENE_PHRASE[setting];
}

/**
 * Every CEREMONY venue setting — where the couple MARRIES, mirroring
 * `events.ceremony_venue_setting` and its CHECK
 * (`events_ceremony_venue_setting_check`, migration 20271197508087, which
 * carries the full per-value reasoning).
 *
 * 🔑 THE GOVERNING RULE: this list names the KIND OF PLACE. `events.ceremony_type`
 * already names the RITE. So there is no `catholic_church` / `christian_church`
 * split (that is `venue_directory_type`'s job, where faith IS the admin
 * classification) and no `inc_chapel`: `ceremony_type = 'inc'` plus `chapel`
 * already resolves to the directory's INC chapel with no ambiguity, and a
 * dedicated value would make the faith true in two columns at once.
 *
 * ⚠ Unlike VENUE_SETTINGS, the column is NULLABLE with no default. NULL means
 * the couple has not said — the distinction `venue_setting` can no longer make
 * about itself.
 */
export const CEREMONY_VENUE_SETTINGS = [
  'church',
  'chapel',
  'mosque',
  'temple',
  'civil_registrar',
  'garden',
  'beach',
  'ancestral_house',
  'hotel_venue',
] as const;

export type CeremonyVenueSetting = (typeof CEREMONY_VENUE_SETTINGS)[number];

export function isCeremonyVenueSetting(value: unknown): value is CeremonyVenueSetting {
  return (
    typeof value === 'string' && (CEREMONY_VENUE_SETTINGS as readonly string[]).includes(value)
  );
}

/** Long form — the couple's ceremony-venue picker. */
export const CEREMONY_VENUE_SETTING_LABEL: Record<CeremonyVenueSetting, string> = {
  church: 'Church / Cathedral',
  chapel: 'Chapel',
  mosque: 'Mosque',
  temple: 'Temple',
  civil_registrar: "Civil Registrar's Office",
  garden: 'Garden',
  beach: 'Beach',
  ancestral_house: 'Ancestral House',
  hotel_venue: 'Hotel (same venue as reception)',
};

/** Short form — inline copy and chips. */
export const CEREMONY_VENUE_SETTING_SHORT_LABEL: Record<CeremonyVenueSetting, string> = {
  church: 'Church',
  chapel: 'Chapel',
  mosque: 'Mosque',
  temple: 'Temple',
  civil_registrar: 'Civil registrar',
  garden: 'Garden',
  beach: 'Beach',
  ancestral_house: 'Ancestral house',
  hotel_venue: 'Hotel',
};

/**
 * The couple's RECEPTION setting → the marketplace's `venue_directory_type`.
 *
 * Every value now maps, because the one that never could — `civil_registrar` —
 * left this vocabulary on 2026-09-03. The comment here used to explain its
 * absence as deliberate ("it is a CEREMONY venue, and the reception filter
 * never offers it"), which was true, and the schema disagreed with it for a
 * month. `Partial<>` is kept so a future reception setting with no directory
 * equivalent does not have to invent one.
 *
 * There is deliberately NO ceremony equivalent of this map. Ceremony venues are
 * matched on `ceremony_type` and faith, never on a venue setting — see
 * migration 20260617000000, which fixed exactly the bug of filtering ceremony
 * venues by the couple's reception style.
 */
export const VENUE_SETTING_TO_DIRECTORY_TYPE: Partial<Record<VenueSetting, string>> = {
  banquet_hall: 'hotel_ballroom',
  restaurant: 'restaurant',
  garden: 'garden',
  beach: 'beach',
  destination: 'destination_resort',
  heritage: 'heritage',
  outdoor_tent: 'outdoor_tent',
};
