/**
 * THE THREE VOICES — §5 of the Editorial Experience Spec, built.
 *
 * The spec has always said a guest column is not a flat pile of quotes:
 *
 *   **Parents** — highest weight. Large type, centre placement, full attribution.
 *   **Best man + maid of honour** — named, bylined, distinguished by a role badge.
 *   **Guests** — pull-quote treatment in the masonry.
 *
 * Measured 2026-08-18: **none of it was built.** The wall rendered every column
 * identically and the only role words anywhere in the editorial tree were inside
 * SAMPLE PROSE. The data was there the whole time — `guest_columns.guest_id`
 * joins straight to `guests.role`, and that enum already carries
 * `bride_parents`, `groom_parents`, `maid_of_honor`, `best_man`,
 * `principal_sponsor` and the rest. The reader simply never selected it.
 *
 * ── 🔒 A ROLE IS AS IDENTIFYING AS A NAME, AND IS GATED THE SAME WAY ─────────
 * There is exactly ONE maid of honour. Printing "Maid of Honour" above an
 * unnamed column would name her to everybody at the wedding — so the role
 * follows the SAME consent as the byline (`author_named_publicly`, the DPO
 * ruling of 2026-08-06). No name, no badge. That is enforced at the READER, so
 * an unconsented role never reaches this file at all.
 */

/** `guests.role` values that carry editorial weight. Everything else is a guest. */
export type ColumnVoice = 'parents' | 'named' | 'guest';

const PARENT_ROLES = new Set(['bride_parents', 'groom_parents']);

/**
 * The roles the spec calls out by name — they earn a badge, not extra size.
 * Deliberately NOT every role in the enum: a ring bearer with a badge is
 * clutter, and the spec asks for distinction where it means something.
 */
const NAMED_ROLES = new Set([
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'principal_sponsor',
  'officiant',
]);

export function voiceOf(role: string | null | undefined): ColumnVoice {
  const r = (role ?? '').trim();
  if (PARENT_ROLES.has(r)) return 'parents';
  if (NAMED_ROLES.has(r)) return 'named';
  return 'guest';
}

/** How a badge reads to a guest. Never the raw enum. */
const ROLE_LABEL: Record<string, string> = {
  bride_parents: 'Parents of the bride',
  groom_parents: 'Parents of the groom',
  maid_of_honor: 'Maid of honour',
  matron_of_honor: 'Matron of honour',
  best_man: 'Best man',
  principal_sponsor: 'Principal sponsor',
  officiant: 'Officiant',
};

export function roleLabel(role: string | null | undefined): string | null {
  const r = (role ?? '').trim();
  return ROLE_LABEL[r] ?? null;
}

export type ColumnLike = { role?: string | null };

/**
 * Parents first, then the named party, then everyone else — each group keeping
 * the order it arrived in (submission order), so the wall is stable between
 * renders and nobody's column jumps around.
 *
 * 🔑 A STABLE SORT, ON PURPOSE. `Array.prototype.sort` is stable in every
 * engine this runs on, so equal weights keep submission order. A list that
 * reorders itself between visits is a list nobody trusts.
 */
export function byVoiceWeight<T extends ColumnLike>(columns: readonly T[]): T[] {
  const WEIGHT: Record<ColumnVoice, number> = { parents: 0, named: 1, guest: 2 };
  return [...columns].sort((a, b) => WEIGHT[voiceOf(a.role)] - WEIGHT[voiceOf(b.role)]);
}
