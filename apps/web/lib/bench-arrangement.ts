/**
 * bench-arrangement.ts — WHERE THE COUPLE PUT A CARD, AND WHAT THE SORT MAY
 * STILL ORDER AROUND IT.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * Owner, 2026-09-09, in two steps: *"bottom tier only. top tier can be long
 * pressed and dragged to be rearranged."* then, on the recommendation to let one
 * gesture serve the whole rail: *"okay then. let both rearrange."* And, asked
 * whether a hand-made order applies inside a category or across the whole bench:
 * ***"per category."***
 *
 * ── THE MODEL IS PINS + SORT, SO THE TWO FEATURES STOP FIGHTING ─────────────
 * A dragged card is PINNED where it was put · the sort orders everything
 * UNPINNED · a supplier who arrives later lands in its normal computed position
 * among the unpinned and never jumps to the front.
 *
 * 🔑 THAT LAST CLAUSE IS WHY PINS ARE SPARSE ABSOLUTE SLOTS AND NOT A SAVED
 * LIST. A saved list of every card in order would have to say something about a
 * supplier it has never seen — and whatever it said would be wrong: append and
 * a new supplier is buried below cards the couple never ranked; prepend and it
 * jumps the queue. Recording only the cards the couple actually MOVED leaves
 * everything else to the lens, which is the one part of this that already knows
 * how to rank a stranger.
 *
 * ── IT IS THE SAME SHAPE AS `inline-more-order.ts`, INVERTED ────────────────
 * There, protected rows hold their slots and the tail is re-ordered inside the
 * slots left over. Here, PINNED cards hold their slots and the sort fills the
 * slots left over. Both are "write into the slots you are allowed to write
 * into", and neither can move a card it was not given permission to move.
 *
 * ── PER CATEGORY, WHICH ALSO DECIDES THE RESET ──────────────────────────────
 * An arrangement is keyed by (celebration, tile). A caterer can never outrank a
 * florist — the page's own grouping never puts them in one rail anyway — and
 * **one Reset clears one category**. A couple who arranged their caterers three
 * weeks ago must not lose that by tidying their florists today.
 *
 * ── AND IT IS THE CELEBRATION'S, NOT THE BROWSER'S ──────────────────────────
 * Owner: *"all hosts of that event see the same order."* Unlike the sort lens
 * (`persistBenchSort`, localStorage, per browser), the arrangement is stored on
 * the event, because a shortlist is a plan the hosts make together and a private
 * order produces *"why is the caterer first for you and third for me?"*
 *
 * Pure and framework-free — no React, no server action, no Supabase — so every
 * rule here is a unit test rather than something only a browser could show you.
 */

/** One card the couple moved: which card, and the slot it now occupies. */
export type BenchPin = {
  /** `event_vendors.vendor_id` — the bench card's identity. Every card on the
   *  rail has one, manually-added suppliers included: `event_manual_vendors` is
   *  a detail table hung off an `event_vendors` row, never a second card
   *  source, so one key reaches the whole rail. */
  vendorId: string;
  /** 0-based slot in this category's rail. */
  position: number;
};

/** Read a pin set as a map, ignoring anything malformed rather than throwing —
 *  a bad row must cost the couple their arrangement, never their bench. */
export function pinMap(pins: readonly BenchPin[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pins) {
    if (!p || typeof p.vendorId !== 'string' || p.vendorId === '') continue;
    if (!Number.isInteger(p.position) || p.position < 0) continue;
    // First write wins, so a duplicated id cannot silently move a card.
    if (!out.has(p.vendorId)) out.set(p.vendorId, p.position);
  }
  return out;
}

/**
 * Lay a category's rail out: pinned cards into their own slots, everything else
 * into the slots left over, in the order the lens already put them.
 *
 * `entries` arrives ALREADY SORTED — this function never ranks anything. It is
 * handed the lens's answer and decides only which of those cards may keep the
 * position the lens gave it.
 *
 * ⚠ TWO THINGS THAT LOOK LIKE EDGE CASES AND ARE THE NORMAL CASE:
 *  • A pin can point PAST the end of the rail — the couple pinned the 6th card
 *    and then removed two suppliers. It is clamped to the last slot rather than
 *    dropped, because a pin is the couple's instruction and "as far right as
 *    there is room" is the honest reading of it.
 *  • Two pins can want one slot, after a clamp or a stale write. The lower
 *    position is placed first and the other takes the next free slot at or
 *    after the one it asked for — deterministic, and it never silently discards
 *    a card the couple moved.
 *
 * Returns a NEW array containing exactly the entries it was given.
 */
export function applyBenchArrangement<T>(
  entries: readonly T[],
  pins: readonly BenchPin[],
  keyOf: (entry: T) => string,
): T[] {
  const byId = pinMap(pins);
  const n = entries.length;
  if (n === 0 || byId.size === 0) return [...entries];

  const slots: (T | null)[] = new Array<T | null>(n).fill(null);
  const pinned: { entry: T; want: number }[] = [];
  const loose: T[] = [];
  for (const e of entries) {
    const want = byId.get(keyOf(e));
    if (want == null) loose.push(e);
    else pinned.push({ entry: e, want });
  }

  // Placed from the RIGHTMOST request inward.
  //
  // ⚠ THIS ONLY MATTERS IN ONE CASE, AND IT IS WORTH GETTING RIGHT: two pins
  // that both point PAST the end of the rail (the couple pinned the 5th and the
  // 8th card, then removed suppliers). Both clamp to the last slot, and one of
  // them has to settle for the slot before it. Working inward from the right
  // means the card that asked to be FURTHEST right is the one that gets the
  // last slot — going the other way puts the card that asked for slot 8 in
  // front of the card that asked for slot 5, which is visibly backwards.
  //
  // With distinct in-range positions no two pins collide at all, so the order
  // is irrelevant; with equal positions the sort is stable and array order
  // decides, exactly as before.
  pinned.sort((a, b) => b.want - a.want);
  for (const { entry, want } of pinned) {
    let i = Math.min(Math.max(want, 0), n - 1);
    while (i < n && slots[i] !== null) i += 1;
    // Asked for a slot at or past the end and everything to its right is taken:
    // walk back to the last free one rather than lose the card.
    if (i >= n) {
      i = n - 1;
      while (i >= 0 && slots[i] !== null) i -= 1;
    }
    if (i >= 0) slots[i] = entry;
  }

  let next = 0;
  for (const e of loose) {
    while (next < n && slots[next] !== null) next += 1;
    if (next < n) slots[next] = e;
  }

  // Every slot is filled: exactly `n` entries went into exactly `n` slots.
  return slots.filter((s): s is T => s !== null);
}

/**
 * What to persist after the couple moves one card.
 *
 * 🔑 THE WHOLE PIN SET IS RETURNED, NOT A DELTA, and that is deliberate: the
 * write is then one idempotent replacement of one category's arrangement, with
 * no partial state a failed second query could leave behind.
 *
 * 🔑 AND ALREADY-PINNED CARDS ARE RE-PINNED TO WHERE THEY NOW SHOW. A pin means
 * "this card sits here"; if moving X displaces Y, then Y's stored slot has to
 * become the slot Y is actually in, or the next render puts Y somewhere the
 * couple never dropped it and the rail appears to move on its own.
 *
 * `displayed` is the order currently ON SCREEN — pins already applied — because
 * that is the only order the couple can have been aiming at.
 */
export function pinsAfterMove(args: {
  displayed: readonly string[];
  pinned: Iterable<string>;
  moved: string;
  toIndex: number;
}): BenchPin[] {
  const { displayed, moved, toIndex } = args;
  const from = displayed.indexOf(moved);
  if (from < 0) return [];
  const rest = displayed.filter((id) => id !== moved);
  const to = Math.min(Math.max(toIndex, 0), rest.length);
  const next = [...rest.slice(0, to), moved, ...rest.slice(to)];

  const keep = new Set<string>(args.pinned);
  keep.add(moved);
  const out: BenchPin[] = [];
  next.forEach((id, position) => {
    if (keep.has(id)) out.push({ vendorId: id, position });
  });
  return out;
}

/** Where a card lands when the couple nudges it one slot with the keyboard.
 *  Returns null at the ends — a no-op move must not write, or every arrow press
 *  at the edge of the rail is a database round trip and a new "Your order". */
export function keyboardMoveTarget(
  displayed: readonly string[],
  card: string,
  direction: 'left' | 'right',
): number | null {
  const i = displayed.indexOf(card);
  if (i < 0) return null;
  const to = direction === 'left' ? i - 1 : i + 1;
  if (to < 0 || to > displayed.length - 1) return null;
  return to;
}

/**
 * Does this category still carry an arrangement the couple would recognise?
 *
 * A pin on a supplier who is no longer on the rail is not an arrangement — it
 * is a leftover, and offering "Your order · Reset" for it would ask the couple
 * to undo something they cannot see. (The row is cleaned up by the cascade when
 * the supplier is removed; this covers the render in between.)
 */
export function hasVisibleArrangement(
  pins: readonly BenchPin[],
  presentIds: Iterable<string>,
): boolean {
  const present = new Set(presentIds);
  for (const [id] of pinMap(pins)) if (present.has(id)) return true;
  return false;
}

/** What the category's rail says once the couple has moved something. */
export const YOUR_ORDER_LABEL = 'Your order';
/** …and the one control that gives the lens its rail back. */
export const RESET_ORDER_LABEL = 'Reset';

/**
 * The sentence under the chip. It names the LENS the sort would otherwise be
 * using, so Reset is a legible offer rather than a bare undo — and it says
 * "this category", because Reset reaches exactly one.
 */
export function arrangementNote(modeLabel: string): string {
  return `You arranged this category. Reset puts it back to ‘${modeLabel}’.`;
}
