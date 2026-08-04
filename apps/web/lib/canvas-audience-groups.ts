/**
 * AUDIENCE GROUPING — how the canvas's "Who it's for" sheet reads the ONE
 * `vendor_coverages.event_types` array.
 *
 * ── THE DEFECT THIS MODULE EXISTS TO PREVENT (2026-07-28 review) ───────────
 * The first cut hardcoded two curated lists — Life events (6) and Events (5) —
 * and rendered only those. Live prod vocab has SIXTEEN active keys, so
 * `celebration`, `gala_night`, `simple_event`, `date` and `hangout` rendered no
 * chip at all. That is not a cosmetic gap, because of what happens on save:
 *
 *   • only RENDERED checkboxes post, and
 *   • `updateCoverageServes` is REPLACE-ALL.
 *
 * So a vendor whose coverage read `['wedding','celebration']` and who opened
 * the sheet to add one faith would have saved `['wedding']` — `celebration`
 * silently deleted, with nothing on screen to show it existed. Worse, a
 * coverage serving ONLY unlisted types posts zero event types, and
 * `parseEventTypes` force-writes `['wedding']` — an audience the vendor never
 * chose. `syncProfileFromCoverages` then propagates the loss into
 * `vendor_profiles.event_types` and out to Explore discovery.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * THE UNION OF THE RENDERED GROUPS IS ALWAYS THE WHOLE VOCAB. The owner's
 * Life-events / Events split is kept — it is how a vendor thinks about who they
 * serve — and everything else lands in a third catch-all group. An event type
 * an admin adds to `event_type_vocab` tomorrow therefore appears on this sheet
 * with no code change, and nothing is ever strippable.
 *
 * The split is PRESENTATION ONLY. All three groups write the same single
 * `event_types` array; there is no second column and no priority between them.
 * `canvas-audience-groups.test.ts` asserts the union invariant directly, so a
 * future vocab key cannot fall through the way these five did.
 */

export type AudienceOption = { key: string; label: string };

export type AudienceGroupId = 'life' | 'events' | 'more';

export type AudienceGroup = {
  id: AudienceGroupId;
  heading: string;
  blurb: string;
  options: AudienceOption[];
};

/**
 * The owner's two curated groups (2026-07-27). These are a READING ORDER, not a
 * whitelist — see `audienceGroups`, where everything outside them is still
 * rendered. Adding a key here only moves it out of "More events".
 */
export const LIFE_EVENT_KEYS: ReadonlyArray<string> = [
  'wedding',
  'debut',
  'christening',
  'birthday',
  'anniversary',
  'gender_reveal',
];

export const ORGANISED_EVENT_KEYS: ReadonlyArray<string> = [
  'corporate',
  'graduation',
  'reunion',
  'tournament',
  'travel',
];

const HEADINGS: Record<AudienceGroupId, { heading: string; blurb: string }> = {
  life: {
    heading: 'Life events',
    blurb: 'Milestones. Couples planning these find you.',
  },
  events: {
    heading: 'Events',
    blurb: 'Organised occasions. Same coverage rows — one list, shown in halves.',
  },
  more: {
    heading: 'More events',
    blurb:
      'Everything else Setnayan currently serves. Same list again — a new event ' +
      'type appears here automatically.',
  },
};

/**
 * Split the live vocab into the three rendered groups.
 *
 * INVARIANT (tested): every option in, exactly once out. The two curated groups
 * are ordered by their curated list — the owner's reading order — and the
 * catch-all preserves the vocab's own `sort_order`, which is what the admin
 * console controls.
 *
 * Pure. Duplicate keys in the input are collapsed, so a vocab hiccup cannot
 * render the same chip twice (two checkboxes with the same name+value would
 * post the value twice).
 */
export function audienceGroups(
  options: ReadonlyArray<AudienceOption>,
): AudienceGroup[] {
  const byKey = new Map<string, AudienceOption>();
  for (const o of options) if (!byKey.has(o.key)) byKey.set(o.key, o);

  const pick = (keys: ReadonlyArray<string>): AudienceOption[] =>
    keys.map((k) => byKey.get(k)).filter((o): o is AudienceOption => o !== undefined);

  const curated = new Set<string>([...LIFE_EVENT_KEYS, ...ORGANISED_EVENT_KEYS]);
  const rest = [...byKey.values()].filter((o) => !curated.has(o.key));

  return [
    { id: 'life', ...HEADINGS.life, options: pick(LIFE_EVENT_KEYS) },
    { id: 'events', ...HEADINGS.events, options: pick(ORGANISED_EVENT_KEYS) },
    { id: 'more', ...HEADINGS.more, options: rest },
  ];
}
