/**
 * lib/studio-details.ts — THE NEW MAKER'S STUDIO, AS DETAILS' GROUPS (owner
 * 2026-10-06; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3
 * PR 4; prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`).
 *
 * Studio's tiles open Details' own items (`lib/studio-tiles.ts`), and a
 * `form: true` group already draws its items' editors one under the other as
 * ONE scrolling form (`details-workspace.tsx`). So the prototype's three
 * full-screen forms are a REGROUPING of the items that ship — no item, editor
 * or column is added:
 *
 *   Info     — the "Your event" form without its gifts (Event Name · Date ·
 *              Venue · Opening line · Special message · Event Hub address · QR)
 *   E-Gifts  — "E-Gifts" (the answer + the ways to give) · the thank-you line
 *   Prints   — every piece of the invitation set · every print for the day ·
 *              Download the set (owner: "yes add prints as the eleventh tile")
 *
 * Pure: the groups in, the groups out. Only while the new Maker is on
 * (`MakerDetails`'s `studio`); every couple today keeps the shipped list.
 */
import { FREE_PRINT_KEYS, type DetailsItemKey } from '@/lib/maker-details-items';
import { PRINT_SET_KEYS } from '@/lib/print-pieces';

/** The gifts items that leave Info for E-Gifts, in the prototype's order. */
export const STUDIO_GIFT_ITEMS: readonly DetailsItemKey[] = ['gifts', 'thank-you'];
/** The groups Prints gathers, in the shipped list's order. */
export const STUDIO_PRINT_GROUPS = ['set', 'day', 'download'] as const;

/** Said under the read-only Date and Venue (DECISION_LOG 2026-10-06 "DATE AND VENUE LIVE IN SUPPLIERS"). */
export const STUDIO_SUPPLIERS_LINE = 'Set when you book your venue in Suppliers';

type Group<I extends { key: DetailsItemKey }> = { key: string; label: string; items: I[]; form?: true; hidden?: true };

export function studioDetailsGroups<I extends { key: DetailsItemKey }>(groups: readonly Group<I>[]): Group<I>[] {
  const out: Group<I>[] = [];
  const gifts: I[] = [];
  const prints: I[] = [];
  let printsAt = -1;
  for (const g of groups) {
    if (g.key === 'event') {
      const keep = g.items.filter((i) => !STUDIO_GIFT_ITEMS.includes(i.key));
      gifts.push(...STUDIO_GIFT_ITEMS.flatMap((k) => g.items.filter((i) => i.key === k)));
      out.push({ ...g, label: 'Info', items: keep });
      if (gifts.length) out.push({ key: 'gifts', label: 'E-Gifts', items: gifts, form: true });
      continue;
    }
    if ((STUDIO_PRINT_GROUPS as readonly string[]).includes(g.key)) {
      if (printsAt < 0) {
        printsAt = out.length;
        out.push({ key: 'prints', label: 'Prints', items: prints, form: true });
      }
      prints.push(...g.items);
      continue;
    }
    out.push(g);
  }
  return out.filter((g) => g.items.length > 0);
}

/**
 * 📱 FULL SCREEN — every Studio tool but Look (owner 2026-10-06: *"We want to provide the maximum
 * screen experience for all 10 with respect to the task they need to do"*). On a phone, while a
 * Studio tool is open (`[data-maker-studio-full]`, the shell's), a FORM tool's editor fills the
 * screen under its Tool ▾ row and the picture steps aside; the Love Story's scrapbook — its cards,
 * each opened in place — fills it the other way. Hidden, never unmounted: every editor still posts.
 * CSS only, drawn by the server beside Details — not one byte in the Maker's first-load JavaScript.
 */
export const STUDIO_FORM_ITEMS: readonly DetailsItemKey[] = [
  'names',
  'date',
  'venues',
  'parents',
  'opening-line',
  'special-message',
  'address',
  'qr',
  ...STUDIO_GIFT_ITEMS,
  'rsvp',
  ...PRINT_SET_KEYS,
  ...FREE_PRINT_KEYS,
  'download',
];
export const STUDIO_PAGE_ITEMS: readonly DetailsItemKey[] = ['love-story'];

/** The top nav (52 px) and the tool's row (52 px), less the panel's own 4 px inset each side. */
const UNDER_THE_ROWS = 'calc(100dvh - 100px - env(safe-area-inset-bottom))';

export function studioFullScreenCss(): string {
  const on = (keys: readonly DetailsItemKey[]) => `:is(${keys.map((k) => `[data-details-item="${k}"]`).join(',')})`;
  const ws = (keys: readonly DetailsItemKey[]) => `[data-maker-studio-full] [data-details-workspace]${on(keys)}`;
  const form = ws(STUDIO_FORM_ITEMS);
  const page = ws(STUDIO_PAGE_ITEMS);
  return (
    '@media (max-width:1023.98px){' +
    `${form}{--maker-lt-h:${UNDER_THE_ROWS}}` +
    `${form} [data-details-body],${form} [data-details-sheet-head]{display:none}` +
    `${page} [data-details-editor-panel]{display:none}` +
    /* 🌄 Look: its one bar (Background · Colours · Fonts · Music) is the section picker — no second ▾ above it. */
    '[data-details-editor-panel]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]) [data-details-sheet-head]{display:none}' +
    `[data-maker-studio-full]:has([data-details-workspace]${on([...STUDIO_FORM_ITEMS, ...STUDIO_PAGE_ITEMS])}) [data-maker-studio-room]{display:none}` +
    '}'
  );
}
