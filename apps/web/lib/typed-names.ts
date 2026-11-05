/**
 * typed-names.ts — ✍ THE EVENT'S NAMES, AS TYPED: one rule for what a typed
 * name may hold and how the two people's names become the page's names.
 *
 * Owner, 2026-10-01 (DECISION_LOG "ELEVEN OWNER ANSWERS" #1, *"wait for
 * apply"*): names typed in the Maker — on the hero (tap-to-type) or in Details ›
 * Your event — are DRAFT until Apply, like every Maker edit. So three places
 * read this rule and none may disagree:
 *
 *   · the Personalization page's writer (`updateEventMatchCriteria`), which
 *     writes the names live where the Maker is not involved;
 *   · the Maker's Details › Names editor, which drafts the very same columns;
 *   · the draft's sanitizer (`lib/hub-draft.ts`), the gate every drafted value
 *     passes on its way in and out.
 *
 * Pure and import-free on purpose: `lib/hub-draft.ts` is read in the browser,
 * and `lib/match-criteria.ts` (where `sanitizeName` used to live) pulls the
 * region list in with it.
 */

/** Letters, spaces, apostrophes and hyphens only — digits and symbols are dropped as typed. */
export function sanitizeName(raw: string): string {
  return (raw || '').replace(/[^\p{L}\s'-]/gu, '');
}

/** Per-field name length cap (matches the form input maxLength). */
export const MAX_NAME_LEN = 80;

/**
 * The longest page name (`events.display_name`) a draft holds — two full
 * names and their joiner ("Maria Clara Concepcion Reyes & …") fit.
 */
export const DISPLAY_NAME_MAX = 160;

/**
 * The page's names (`events.display_name`) as typed, or NULL when they cannot
 * be stored: nothing left after trimming, a control character, or markup
 * (`<` / `>`). Never repaired — a refused name is said, not silently changed.
 */
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(raw.replace(/[\t\n\r]/g, ' '))) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0 || t.length > DISPLAY_NAME_MAX) return null;
  return t;
}

/**
 * ONE person's full name as `bride_name` / `groom_name` store it ("First
 * Last"): letters only, one space, capped. '' → null (cleared).
 */
export function cleanPersonName(raw: unknown): string | null | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = sanitizeName(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN * 2 + 1);
  return t.length > 0 ? t : null;
}

/* ═══ 🔀 ONE ORDER FOR THE TWO NAMES (owner 2026-10-21, verbatim: *"it should be Indalecio & Claire. And the title
 * should be consistent"*) ═════════════════════════════════════════════════════════════════════════════════════════
 *
 * The event's name — `events.display_name`, "Indalecio & Claire" — is the ONE stored fact that says which name comes
 * first. The cover, the page title, the link picture, every print and pass, the emails, Home and the Events board all
 * read it as stored. What disagreed was Event Details: its Event name row RE-COMPOSED the line from the two people,
 * always the first person (the bride's slot) first — so it read "Claire & Indalecio" over a cover that said
 * "Indalecio & Claire", and any name kept there wrote that order back. No new column: the order is read from the
 * stored name (`nameOrderOf`), and every line that puts two people's names together is composed HERE
 * (`coupleNameColumns` · `joinCoupleNames` · `coupleNamesLine`), so no surface can pick an order of its own.
 * Guarded by `lib/one-couple-name-order.test.ts` (no line joins two people's names outside this file). */

/** Which of the two people the event's name puts first: `a` = the first person's slot (`bride_name`), `b` = the second (`groom_name`). */
export type NameOrder = 'a-first' | 'b-first';

/** An event whose name says nothing about the order (no name yet, one name, the same name twice) reads the first person first. */
export const DEFAULT_NAME_ORDER: NameOrder = 'a-first';

/** The two values in the event's order. */
export function inNameOrder<T>(order: NameOrder, a: T, b: T): [T, T] {
  return order === 'b-first' ? [b, a] : [a, b];
}

/** The two halves of an event's name ("Indalecio & Claire" / "Indalecio and Claire"), or null when it names one. */
function nameHalves(displayName: string | null | undefined): [string, string] | null {
  const t = (displayName ?? '').replace(/\s+/g, ' ').trim();
  const m = /^(.+?)\s*(?:&|\band\b)\s*(.+)$/i.exec(t);
  return m ? [m[1]!.trim(), m[2]!.trim()] : null;
}

/** `name` ("Indalecio Casasola II", or a first name alone) begins with the word(s) `part` ("Indalecio"). */
function begins(name: string | null | undefined, part: string): boolean {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const p = part.toLowerCase();
  return p !== '' && (n === p || n.startsWith(`${p} `));
}

/**
 * 🔀 THE STORED ORDER — read from the event's own name. `a` / `b` are the two people's names (first names, or the
 * stored "First Last"). "Indalecio & Claire" over a = Claire, b = Indalecio → `b-first`. Anything the name does not
 * settle (no second half, neither or both halves match) → the default, so an event never changes order by being read.
 */
export function nameOrderOf(
  displayName: string | null | undefined,
  a: string | null | undefined,
  b: string | null | undefined,
): NameOrder {
  const halves = nameHalves(displayName);
  if (!halves) return DEFAULT_NAME_ORDER;
  const [lead, follow] = halves;
  const aLeads = begins(a, lead);
  const bLeads = begins(b, lead);
  if (bLeads && !aLeads) return 'b-first';
  if (aLeads && !bLeads) return 'a-first';
  // The same first name twice ("Sam & Sam") — the second half decides, else the default.
  if (aLeads && bLeads && begins(a, follow) !== begins(b, follow)) return begins(a, follow) ? 'b-first' : 'a-first';
  return DEFAULT_NAME_ORDER;
}

/** Two names joined the one way ("X & Y"), in the event's order; one name alone when the other is missing; '' for none. */
export function joinCoupleNames(
  a: string | null | undefined,
  b: string | null | undefined,
  order: NameOrder = DEFAULT_NAME_ORDER,
): string {
  return inNameOrder(order, (a ?? '').trim(), (b ?? '').trim())
    .filter(Boolean)
    .join(' & ');
}

/**
 * The two people's FULL names ("Indalecio Casasola II & Claire Buanhog") in the order the event's name keeps — for a
 * surface that prints both people in full. '' when neither is stored.
 */
export function coupleNamesLine(ev: {
  display_name?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
}): string {
  return joinCoupleNames(ev.bride_name, ev.groom_name, nameOrderOf(ev.display_name, ev.bride_name, ev.groom_name));
}

/**
 * The two people's FIRST names joined in the event's order — what a surface shows when the event's own name is empty
 * (the first word of each stored "First Last"; never a surname). '' when neither is stored.
 */
export function coupleFirstNamesLine(ev: {
  display_name?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
}): string {
  const first = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] ?? '';
  return joinCoupleNames(first(ev.bride_name), first(ev.groom_name), nameOrderOf(ev.display_name, ev.bride_name, ev.groom_name));
}

/**
 * THE TWO PEOPLE'S NAMES → THE COLUMNS. `bride_name` / `groom_name` store
 * "First Last"; the page's names (`display_name`) are the FIRST names, "Ana &
 * Miguel" — the warm label onboarding writes — in the event's ORDER (`order`,
 * read from the stored name with `nameOrderOf`; a new event reads the first
 * person first). When neither first name is left the page's names are NOT
 * touched (`display_name` absent): a page is never made nameless by clearing a
 * form.
 */
export function coupleNameColumns(
  a: { first: string; last: string },
  b: { first: string; last: string },
  order: NameOrder = DEFAULT_NAME_ORDER,
): { bride_name: string | null; groom_name: string | null; display_name?: string } {
  const cap = (v: string) => sanitizeName(v).trim().slice(0, MAX_NAME_LEN);
  const aFirst = cap(a.first);
  const bFirst = cap(b.first);
  const bride = [aFirst, cap(a.last)].filter(Boolean).join(' ') || null;
  const groom = [bFirst, cap(b.last)].filter(Boolean).join(' ') || null;
  const display = joinCoupleNames(aFirst, bFirst, order);
  return { bride_name: bride, groom_name: groom, ...(display ? { display_name: display } : {}) };
}

/**
 * ✍ THE NAMES TYPED ON THE HERO → the page's names, or NULL (refused): empty,
 * markup, or — for two people — one side left blank ("Ana & " would print a
 * dangling joiner on every page). The two sides are joined the way the page
 * splits them (`splitCoupleNames`: " & "). One person's page keeps an "&" as
 * typed: it is their name, not a joiner.
 */
export function typedDisplayName(typed: string, twoPeople: boolean): string | null {
  const name = cleanDisplayName(typed);
  if (!name) return null;
  if (twoPeople && /&/.test(name) && name.split(/\s*&\s*/).some((s) => s.trim().length === 0)) return null;
  return name;
}
