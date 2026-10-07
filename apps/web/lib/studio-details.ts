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
 * 🗂 THE FORMS' GROUP HEADINGS (prototype `infoForm` / `EDITORS.prints` `.gh`): the item each
 * group starts at. Info: "Your event" then "Your Event Hub" (from its address on). Prints: "Your
 * invitation set" then "For the day". Words only — no field, no write.
 */
export const STUDIO_FORM_HEADS: Partial<Record<DetailsItemKey, { title: string; line?: string }>> = {
  names: { title: 'Your event' },
  address: { title: 'Your Event Hub' },
  invitation: { title: 'Your invitation set' },
  [FREE_PRINT_KEYS[0]!]: { title: 'For the day', line: 'free for every event' },
};

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
/* 🎨 Mood Board & Dress Code (plan PR 5) fills the screen too — its four tabs and their tools are all in its body. */
export const STUDIO_PAGE_ITEMS: readonly DetailsItemKey[] = ['love-story', 'mood-board'];

/** The top nav (52 px) and the tool's row (52 px) — the panel fills the rest, edge to edge (prototype `.full`).
 *  The panel's own height is `--maker-lt-h` less 8 px (`MAKER_LT_TOOL`), so this is 104 − 8. */
const UNDER_THE_ROWS = 'calc(100dvh - 96px)';
/** The prototype's warm page (`--page` #F3F0EA), on the app's tokens — the same mix as `STUDIO_PAGE_BG`. */
const STUDIO_PAGE = 'color-mix(in srgb,rgb(var(--color-gild)) 9%,rgb(var(--color-cream)))';

/**
 * 🎨 THE PROTOTYPE'S ROWS ON THE SHIPPED FIELDS (owner 2026-10-07 side-by-side: *"seems like nothing
 * was built properly"*). Inside a full-screen Studio tool only (`[data-maker-studio-full]`, a phone):
 *
 *   · each field of a form (`[data-details-form-field]`) is a row on a white band, a hairline above
 *     (prototype `.grp .fr`) — never a box (`lint-no-card`); its group heading (`.gh`) sits on the
 *     warm page above the band; its name is the row's 14 px label;
 *   · every switch is the prototype's `.sw` — 46 × 28, green when on;
 *   · every text field is 44 px on the warm page (`.gx-f input`).
 *
 * CSS only, drawn by the server beside Details — the shipped Maker (flag off) never has the attribute.
 */
const W = '[data-maker-studio-full] [data-details-workspace]';
const STUDIO_SKIN_CSS =
  `${W} [data-details-form-field]{background:rgb(var(--color-cream));margin-left:-16px;margin-right:-16px;padding:12px 16px;border-top:1px solid rgb(var(--color-ink)/.1)}` +
  `${W} [data-details-form-group]{margin:-12px -16px 4px;padding:18px 22px 6px;background:${STUDIO_PAGE};border-bottom:1px solid rgb(var(--color-ink)/.1)}` +
  `${W} [data-details-form-heading]{font-size:14px;font-weight:600;line-height:1.3}` +
  /* The print words' Save: the prototype's one ink pill, its "The card redraws." helper gone (helper text lives behind ⓘ). */
  `${W} [data-save-words-note]{display:none}` +
  /* A print's row names it (Studio › Prints, `data-print-studio`) — the form's own heading would say it twice. */
  `${W} [data-details-editor]:has(> [data-print-studio]) > [data-details-form-heading]{display:none}` +
  /* The tool's name is the Tool ▾ row's — no second masthead over the march, the Mood Board, the Logo (prototype `.full`). */
  `${W} [data-details-body-head]{display:none}` +
  '[data-details-workspace]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]) [data-details-body-head]{display:none}' +
  `${W} [data-save-words] button[type=submit]{min-height:44px;padding:0 22px;border-radius:9999px;background:rgb(var(--color-ink));color:rgb(var(--color-cream))}` +
  `${W} input[role=switch]+span{width:46px;height:28px}` +
  `${W} input[role=switch]+span::after{width:22px;height:22px;left:3px;top:3px}` +
  `${W} input[role=switch]:checked+span{background-color:#4f6b4a}` +
  `${W} input[role=switch]:checked+span::after{transform:translateX(18px)}` +
  `${W} [data-details-editor] :is(input:not([type]),input[type=text],input[type=url],input[type=tel],input[type=email],input[type=search],input[type=date],textarea){min-height:44px;border-radius:var(--m-r-sm);border-color:rgb(var(--color-ink)/.1);background:${STUDIO_PAGE};font-size:14px}`;

export function studioFullScreenCss(): string {
  const on = (keys: readonly DetailsItemKey[]) => `:is(${keys.map((k) => `[data-details-item="${k}"]`).join(',')})`;
  const ws = (keys: readonly DetailsItemKey[]) => `[data-maker-studio-full] [data-details-workspace]${on(keys)}`;
  const form = ws(STUDIO_FORM_ITEMS);
  const page = ws(STUDIO_PAGE_ITEMS);
  return (
    '@media (max-width:1023.98px){' +
    `${form}{--maker-lt-h:${UNDER_THE_ROWS}}` +
    /* 📐 The prototype's `.full`: the editor is the screen under the Tool row — edge to edge, the warm
       page behind it, no floating sheet (no inset, no rounded top, no ring). */
    `[data-maker-studio-full] [data-details-workspace] [data-details-editor-panel][data-phone-chrome="panel"]{left:0;right:0;bottom:0;border-radius:0;box-shadow:none;background:${STUDIO_PAGE}}` +
    `[data-maker-studio-full] [data-details-workspace]{background:${STUDIO_PAGE}}` +
    /* The Tool row's own ✓ Saved steps aside where the tool portals its own (the Mood Board's Saved · ✨ Auto). */
    '[data-studio-row-end]:has([data-mood-board-studio-bar]) [data-studio-row-saved]{display:none}' +
    `${form} [data-details-body],${form} [data-details-sheet-head]{display:none}` +
    `${page} [data-details-editor-panel]{display:none}` +
    /* 🌄 Look: its one bar (Background · Colours · Fonts · Music) is the section picker — no second ▾ above it. */
    '[data-details-editor-panel]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]) [data-details-sheet-head]{display:none}' +
    /* 🌄 …and Look's panel is the lower third's whole width at half the screen (prototype `.lt`, owner "the toolbar is half the screen"): no column beside it, no
       floating sheet — a hairline over the page, the controls under it. */
    '[data-details-workspace] [data-details-editor-panel][data-phone-chrome="panel"]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]){left:0;right:0;bottom:0;height:calc(50dvh - 26px);border-radius:0;box-shadow:none;border-top:1px solid rgb(var(--color-ink)/.1)}' +
    `[data-maker-studio-full]:has([data-details-workspace]${on([...STUDIO_FORM_ITEMS, ...STUDIO_PAGE_ITEMS])}) [data-maker-studio-room]{display:none}` +
    STUDIO_SKIN_CSS +
    '}'
  );
}
