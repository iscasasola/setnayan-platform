/**
 * apps/web/lib/scene-styles-parts.ts
 *
 * 🎨 THE PARTS' OWN STYLES — Names · Date · Place · Logo · Title, E-Gifts, and
 * the four for-each-guest parts (Your role · What to wear · Arrive by · Coming
 * with you). This file is theirs; `lib/scene-styles.ts` merges it like the
 * others.
 *
 * Owner, 2026-10-07 (DECISION_LOG "STAGES PANEL REDRAW APPROVED (#6398); THREE
 * FOLLOW-UPS AS ONE STEP"): *"1. all three together"* — real registered styles
 * for every part, ADDED TO THE GUEST RENDER, never invented in the Maker. The
 * design reference is the approved prototype's five-layout carousels
 * (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` — `L5`,
 * `LAYTEXT`, the `.el[data-el=…][data-preset]` rules), each drawn here under
 * its OWN name for what it looks like — never the prototype's shared family
 * words (`lib/layouts-are-the-shipped-scene-styles.test.ts`).
 *
 * ── WHO DRAWS THEM ─────────────────────────────────────────────────────────
 * The guest page, from the one stored pick: each part carries
 * `data-part-look="<part>.<style>"` (`partLookAttr`) and `globals.css` (the
 * "THE PARTS' OWN STYLES" block) draws it; the Date's Big day and Numerals and
 * the Place's Name first also lay their words out differently
 * (`pahina-masthead.tsx`). The FIRST style of every set is the shipped look and
 * carries NO attribute — an event that never picked draws byte-for-byte what it
 * drew before.
 *
 * ── WHERE A PICK LIVES ─────────────────────────────────────────────────────
 * Beside the five fixed parts' picks, in `events.style_preferences.scene_styles`
 * (`lib/fixed-scene-styles.ts` `PART_LOOK_SCENES`) — drafted, counted on ✓,
 * written by Apply. Free, like every style. No migration.
 *
 * Pure. No I/O. Client-safe.
 */
import type { HubStage } from '@/lib/hub-canvas';
import type { SceneStyleSet } from '@/lib/scene-styles';

/** The hero is drawn on these three (Post Event wears its own masthead). */
const HERO: readonly HubStage[] = ['save_the_date', 'rsvp', 'event'];
/** E-Gifts and the guest's own parts live on the Invitation. */
const INV: readonly HubStage[] = ['rsvp'];

/** The four for-each-guest parts share one family of looks — words on the page, no box. */
const MY_STYLES = [
  { id: 'plain', name: 'Plain', line: 'Ranged left, as written.', stages: INV },
  { id: 'centred', name: 'Centred', line: 'Everything centred.', stages: INV },
  { id: 'italic', name: 'Italic', line: 'The answer large, in italics.', stages: INV },
  { id: 'spaced-caps', name: 'Spaced caps', line: 'Small capitals, widely spaced.', stages: INV },
  { id: 'side-rule', name: 'Side rule', line: 'A gold rule down the left.', stages: INV },
] as const;

export const PART_SCENE_STYLE_SETS: readonly SceneStyleSet[] = [
  {
    type: 'hero_names',
    label: 'Names',
    styles: [
      { id: 'stacked', name: 'Stacked', line: 'One name a line, the joiner between.', stages: HERO },
      { id: 'one-line', name: 'One line', line: 'Both names on one line.', stages: HERO },
      { id: 'staggered', name: 'Staggered', line: 'The names step apart over a large, faint joiner.', stages: HERO },
      { id: 'spaced-caps', name: 'Spaced caps', line: 'Small capitals between two rules.', stages: HERO },
      { id: 'big-joiner', name: 'The joiner', line: 'The joiner large; the names small under it.', stages: HERO },
    ],
  },
  {
    type: 'hero_date',
    label: 'Date',
    styles: [
      { id: 'the-line', name: 'The line', line: 'The date written out, on one line.', stages: HERO },
      { id: 'big-day', name: 'Big day', line: 'The day large; the weekday and month small.', stages: HERO },
      { id: 'ruled', name: 'Between rules', line: 'Small capitals between two rules.', stages: HERO },
      { id: 'numerals', name: 'Numerals', line: 'The date in figures, large.', stages: HERO },
    ],
  },
  {
    type: 'hero_venue',
    label: 'Place',
    styles: [
      { id: 'the-line', name: 'The line', line: 'The place on one line.', stages: HERO },
      { id: 'name-first', name: 'Name first', line: 'The place large; the city small under it.', stages: HERO },
      { id: 'ruled', name: 'Between rules', line: 'Small capitals between two rules.', stages: HERO },
      { id: 'pin', name: 'The pin', line: 'A pin over the place.', stages: HERO },
    ],
  },
  {
    type: 'hero_mark',
    label: 'Logo',
    styles: [
      { id: 'as-made', name: 'As made', line: 'Your logo as it was made.', stages: HERO },
      { id: 'ringed', name: 'Ringed', line: 'Inside a fine double ring.', stages: HERO },
      { id: 'between-rules', name: 'Between rules', line: 'A rule either side.', stages: HERO },
      { id: 'large', name: 'Large', line: 'Larger, with room around it.', stages: HERO },
    ],
  },
  {
    type: 'hero_eyebrow',
    label: 'Title',
    styles: [
      { id: 'small-caps', name: 'Small caps', line: 'Small, spaced capitals.', stages: HERO },
      { id: 'serif', name: 'Serif', line: 'In the heading face, larger.', stages: HERO },
      { id: 'flanked', name: 'Flanked', line: 'Italic, a short rule either side.', stages: HERO },
      { id: 'ruled', name: 'Between rules', line: 'Capitals between two rules.', stages: HERO },
      { id: 'pill', name: 'The pill', line: 'White capitals on your main colour.', stages: HERO },
    ],
  },
  {
    type: 'gifts',
    label: 'E-Gifts',
    styles: [
      { id: 'door', name: 'The door', line: 'The gift door, as shipped.', stages: INV },
      { id: 'centred', name: 'Centred', line: 'Centred, the door stacked.', stages: INV },
      { id: 'side-rule', name: 'Side rule', line: 'A gold rule down the left.', stages: INV },
      { id: 'ruled', name: 'Between rules', line: 'Between two rules.', stages: INV },
    ],
  },
  { type: 'my_role', label: 'Your role', styles: MY_STYLES },
  { type: 'my_wear', label: 'What to wear', styles: MY_STYLES },
  { type: 'my_arrive', label: 'Arrive by', styles: MY_STYLES },
  { type: 'my_guests', label: 'Coming with you', styles: MY_STYLES },
];

/** The hero's parts that wear a style, by their `data-el` key → their registry type. */
export const HERO_PART_LOOK: Readonly<Record<'mark' | 'eyebrow' | 'names' | 'date' | 'venue', string>> = {
  mark: 'hero_mark',
  eyebrow: 'hero_eyebrow',
  names: 'hero_names',
  date: 'hero_date',
  venue: 'hero_venue',
};

/** The attribute a part carries for a picked style — null for the set's first (the shipped look). */
export function partLookAttr(type: string, styleId: string | null | undefined): string | null {
  const set = PART_SCENE_STYLE_SETS.find((s) => s.type === type);
  if (!set || !styleId || styleId === set.styles[0]!.id) return null;
  return set.styles.some((s) => s.id === styleId) ? `${type.replace(/^(hero|my)_/, '')}.${styleId}` : null;
}
