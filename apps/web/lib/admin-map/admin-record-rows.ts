/**
 * admin-record-rows.ts — turning found RECORDS into rows the admin's own
 * search box can offer.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The owner ruled that an admin must be able to find a guest by NAME across
 * every celebration — "we must be able to find them and have our actions as
 * admin available when we find them."
 *
 * That search was built and it works. It lives inside the Entity map console
 * at `/admin/ugat/map`, which is a page you have to already know about. The
 * box on the admin bar — the one the owner actually types into, the one he
 * asked for by name after saying *"i do not see the AI searchbar"* — searched
 * **no database record at all**. Measured, not assumed: the only reads behind
 * that box are `platform_retail_catalog_v2` (the price rows) and
 * `admin_search_phrases` (the learned-phrase memory). Its whole corpus is the
 * curated menu, the scanned route tree, the job vocabulary and the SKU list.
 * Typing a person's name into it could not return a record, and the AI
 * fallback could not rescue that: every href it returns is re-validated
 * against the scanned route map, so it can only ever answer with a PAGE.
 *
 * 🔑 **A FIX NOBODY CAN REACH IS NO FIX** — the fifth time this project has
 * written that sentence down, and the palette's own docblock is where the
 * fourth one is recorded. The search was not missing. The DOOR was.
 *
 * ── WHAT THIS FILE IS, AND IS NOT ───────────────────────────────────────────
 * It is the presentation rule between the shipped search and the box. It runs
 * no query and opens no client. **There is deliberately no second search** —
 * `fetchUgatSearch` is called as it stands, so the admin gate, the ILIKE
 * sanitiser, the `deleted_at is null` filter and the guest privacy fence are
 * the ones already reviewed, not new copies of them that can drift.
 *
 * ── THE OWNER'S FENCE, ENFORCED HERE ────────────────────────────────────────
 * *"A result row shows only what identifies the record — a name plus a status.
 * NEVER contact details. Those live on the record's own page."*
 *
 * `redactContactDetail` below is a FLOOR, not a description of today. The
 * guest arm of the search already selects no email, mobile or address, so no
 * contact detail reaches this file from that arm — but the USER arm's subtitle
 * IS an email address, and a seventh arm added later would inherit whatever
 * this layer tolerates. The rule is applied to every arm rather than to the
 * one that needs it, because a fence that only covers the case somebody
 * remembered is the shape this repo keeps paying for.
 *
 * A detected contact detail drops the WHOLE subtitle rather than cutting the
 * offending run out of it. Partial redaction leaves mangled text that still
 * carries the parts it did not recognise; dropping is the only version with no
 * half-leak, and the row is still identified by its name and its category.
 */

/**
 * The shape this layer consumes. Deliberately STRUCTURAL rather than imported
 * from `lib/ugat/data.ts`: that module is `server-only`, this one is imported
 * by a `'use client'` component, and `lint-server-only-boundary` exists
 * because a value crossing that line is a build error nothing local catches.
 * `UgatSearchGroup[]` is assignable to this without a cast.
 */
export interface AdminRecordSearchHit {
  id: string;
  type: string;
  title: string;
  sub: string;
  href: string;
  score: number;
}

export interface AdminRecordSearchGroup {
  category: string;
  hits: AdminRecordSearchHit[];
}

/** One found record, as the admin's search box offers it. */
export interface AdminRecordRow {
  /** Display id — `public_id ?? uuid`. Used only as a React key. */
  id: string;
  /** `guest` · `vendor` · `event` · `user` · `order` · `taxonomy`. */
  kind: string;
  /** The group heading this row sits under, e.g. `Guests`. */
  category: string;
  /** The name. What a person typed to find this. */
  title: string;
  /** Status and context — never a contact detail. May be empty. */
  detail: string;
  /** Where this ONE record opens. Never empty: the search guarantees it. */
  href: string;
}

/**
 * How many records the box offers at once.
 *
 * Small on purpose. This sits UNDER the deterministic page and job hits, and
 * the box's whole job is still navigation — records are the long tail, not the
 * headline. The search itself caps each arm at 6, so the ceiling here is what
 * decides how many of six categories can be seen at once.
 */
export const MAX_ADMIN_RECORD_ROWS = 8;

/**
 * Below this many characters the box does not go to the database at all.
 *
 * Matches the search's own two-character floor (`ugatSearchInner` returns []
 * under it), so a shorter query costs a round trip that can only ever return
 * nothing. Three, not two: this fires on every keystroke of a live typist, and
 * two letters matches a large share of a guest list by prefix.
 */
export const MIN_RECORD_QUERY_LENGTH = 3;

/** How long the box waits after the last keystroke before asking. */
export const RECORD_SEARCH_DEBOUNCE_MS = 180;

/**
 * An email address anywhere in the string.
 *
 * Not anchored: the point is to detect a contact detail EMBEDDED in a subtitle
 * ("Replied yes · maria@example.com"), not to validate a whole field.
 */
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * A phone-shaped run: nine or more digits, separators allowed between them.
 *
 * ⚠ NINE, NOT SEVEN, AND THE REASON IS A FALSE POSITIVE THIS ALREADY HAD.
 * An ISO date — `2026-08-27` — is eight digits with separators, so a
 * seven-digit floor silently redacts the subtitle of any record whose name
 * carries a date, and a celebration named for its date is an ordinary thing in
 * this product. A PH mobile number is 11 digits and an international one
 * 10–13, so nine clears every real number while leaving a date alone.
 */
const PHONE_SHAPE = /(?:\d[\s().+-]*){9,}/;

/** Does this text carry something that belongs on the record's own page? */
export function looksLikeContactDetail(text: string): boolean {
  if (!text) return false;
  return EMAIL_SHAPE.test(text) || PHONE_SHAPE.test(text);
}

/**
 * The subtitle, or nothing at all. See the fence in this file's header: a
 * detected contact detail drops the whole string rather than editing it.
 */
export function redactContactDetail(text: string | null | undefined): string {
  const s = (text ?? '').trim();
  if (!s) return '';
  return looksLikeContactDetail(s) ? '' : s;
}

/**
 * Flatten the search's grouped result into the rows the box renders.
 *
 * ── WHY EVERY CATEGORY GETS ONE ROW BEFORE ANY CATEGORY GETS TWO ────────────
 * 🔑 THIS IS THE OWNER'S RULING SURVIVING THE CAP, and a plain "sort by score,
 * take the top N" quietly loses it. The search caps each arm at 6 and returns
 * vendors first; a query that matches six shops fills all eight slots before
 * the guest arm is read, so the one thing the ruling was ABOUT — finding a
 * guest by name — would be the row that gets dropped, silently, with no
 * symptom but an absence. Every category that matched is therefore guaranteed
 * its best row first; only the slots left over are filled by score.
 *
 * Scores are comparable across categories — every arm scores through the same
 * `scoreUgatMatch` — so ordering the remainder by score is honest rather than
 * arbitrary. Ties keep the order the search returned them in, which is stable.
 */
export function toAdminRecordRows(
  groups: readonly AdminRecordSearchGroup[] | null | undefined,
  limit: number = MAX_ADMIN_RECORD_ROWS,
): AdminRecordRow[] {
  if (!groups?.length || limit <= 0) return [];

  const toRow = (g: AdminRecordSearchGroup, h: AdminRecordSearchHit): AdminRecordRow => ({
    id: h.id,
    kind: h.type,
    category: g.category,
    title: h.title,
    detail: redactContactDetail(h.sub),
    href: h.href,
  });

  const firsts: Array<{ row: AdminRecordRow; score: number }> = [];
  const rest: Array<{ row: AdminRecordRow; score: number }> = [];

  for (const g of groups) {
    // A hit with no destination is not offerable. The search's type makes
    // `href` required, so this is a floor against a future arm, not a case
    // that can happen today.
    const usable = (g.hits ?? []).filter((h) => h && h.href);
    usable.forEach((h, i) => {
      (i === 0 ? firsts : rest).push({ row: toRow(g, h), score: h.score ?? 0 });
    });
  }

  // Each category's best row keeps the search's category order; the remainder
  // competes on score alone.
  rest.sort((a, b) => b.score - a.score);

  return [...firsts, ...rest].slice(0, limit).map((e) => e.row);
}
