/**
 * app/[slug]/_lib/first-screen-fit.ts — THE FIRST SCREEN MAKES ROOM FOR ITS ONE ACTION.
 *
 * A stranger's one button, "Get inside", has its place under the cover. Measured
 * on the live sample event (2026-10-11): that place is below a 375 × 667 screen
 * and under the bottom bar at 375 × 812. The first cut of the fix docked the
 * button over the cover (`position: sticky`); re-measured on the preview it then
 * SAT ON the couple's names, the date or the link in 5 of 8 first screens. A
 * button that covers the names is worse than a button below the fold.
 *
 * 🔑 THE RULE: THE BUTTON IS IN THE COVER'S FLOW, AND THE COVER MAKES ROOM FOR IT.
 * Nothing is ever drawn underneath it. When the cover and the button do not both
 * fit above the bottom bar (or above the cookie banner, on a first visit), the
 * cover gives way in this order, and only as far as it needs:
 *
 *   1. AIR     — the cover's own padding and the gap above the button close up;
 *   2. THE MARK — the monogram is drawn smaller (never under `MARK_MIN` of itself);
 *   3. PARTS   — whole parts of the cover move BELOW the button, where a scroll
 *                finds them, in `GIVE_WAY_ORDER`: the photo, the link down, the time,
 *                the mark, the eyebrow, the invitation line, the date.
 *
 * 📷 THE PHOTO FIRST (owner 2026-10-13, DECISION_LOG, on a PHOTO cover: *"do it"* —
 * the photo moves so the names, the date and "Get inside" are on the stranger's
 * first screen). A photo cover's plate (`pahina-masthead.tsx` `coverPlate`) sits
 * under the date and is taller than most phone screens, so on today's page the
 * door was below it at every size. It is the first part to give way: drawn below
 * the button, where a scroll finds it, whole. A photo cover has no air or mark the
 * stylesheet can close (those values are the card's), so for it only step 3 runs.
 * A card cover has no plate: for it nothing changes.
 *
 * THE NAMES NEVER GIVE WAY. The date goes last: an invitation that fits only two
 * things shows who and when. If even the names and the button do not fit (a
 * 320 × 568 phone with the cookie banner up is close), the button sits directly
 * under the names, in flow — below the edge rather than over them.
 *
 * Pure: boxes in, a plan out. `first-screen-door.tsx` measures the page, asks
 * this, and writes the plan; `the-first-screen-keeps-its-action.test.ts` runs it
 * on the boxes measured from the real page at four phone sizes × two banner
 * states.
 */

/** One block of the first screen, in document pixels (top of the page = 0). */
export type FitBox = { key: string; top: number; bottom: number };
/** The cover's parts in the order the page writes them, and the button under them. */
export type FitSnapshot = { parts: FitBox[]; door: FitBox };

/** What gives way, first to last. The names are not on the list. */
export const GIVE_WAY_ORDER: readonly string[] = ['plate', 'link', 'time', 'mark', 'eyebrow', 'line', 'date'];
/** The smallest the mark is drawn, as a share of its own size. */
export const MARK_MIN = 0.55;

export type FitPlan = {
  /** How much of the cover's air is kept: 1 = as designed, 0 = closed up. */
  air: number;
  /** The mark's size: 1 = as designed, down to `MARK_MIN`. */
  mark: number;
  /** The parts that moved below the button, in the order the page writes them. */
  gives: string[];
  /**
   * How far each block is drawn from its own place (px, + is down), measured with the air closed up and the
   * mark small. `first-screen-door.tsx` measures again once `air` and `mark` are written and lays the same
   * `gives` out on what it finds (`layoutFirstScreen`) — this is the plan's own arithmetic, for the test.
   */
  shift: Record<string, number>;
  /** Where the button's bottom edge lands, at most. */
  doorBottom: number;
  /** Does the button end at or above the limit? False only when the names and the button alone do not fit. */
  fits: boolean;
};

/**
 * Lay the blocks out again with `gives` moved below the button: the kept parts in
 * their own order, the button, then the given parts in their own order — each
 * keeping the gap it had above it. Nothing overlaps by construction: every block
 * starts where the one before it ends.
 */
export function layoutFirstScreen(snap: FitSnapshot, gives: readonly string[]): { tops: Record<string, number>; doorTop: number; doorBottom: number } {
  const all = [...snap.parts, snap.door];
  const gapAbove = new Map<string, number>();
  all.forEach((b, i) => gapAbove.set(b.key, i === 0 ? 0 : Math.max(0, b.top - all[i - 1]!.bottom)));
  const kept = snap.parts.filter((p) => !gives.includes(p.key));
  const given = snap.parts.filter((p) => gives.includes(p.key));
  const sequence = [...kept, snap.door, ...given];
  const tops: Record<string, number> = {};
  const doorGap = gapAbove.get(snap.door.key) ?? 0;
  let y = all[0]!.top;
  sequence.forEach((b, i) => {
    // Each block keeps the gap it had above it; what follows the button stands at least the button's own gap off it.
    if (i > 0) y += sequence[i - 1] === snap.door ? Math.max(gapAbove.get(b.key) ?? 0, doorGap) : (gapAbove.get(b.key) ?? 0);
    tops[b.key] = y;
    y += b.bottom - b.top;
  });
  const doorTop = tops[snap.door.key]!;
  return { tops, doorTop, doorBottom: doorTop + (snap.door.bottom - snap.door.top) };
}

/** Which parts move below the button so that it ends at or above `limit` — as few as it takes, in `GIVE_WAY_ORDER`. */
export function planGiveWay(snap: FitSnapshot, limit: number): { gives: string[]; shift: Record<string, number>; doorBottom: number; fits: boolean } {
  const present = GIVE_WAY_ORDER.filter((k) => snap.parts.some((p) => p.key === k));
  let gives: string[] = [];
  let laid = layoutFirstScreen(snap, gives);
  for (const key of present) {
    if (laid.doorBottom <= limit) break;
    gives = [...gives, key];
    laid = layoutFirstScreen(snap, gives);
  }
  const shift: Record<string, number> = {};
  for (const b of [...snap.parts, snap.door]) {
    const d = Math.round(laid.tops[b.key]! - b.top);
    if (d !== 0) shift[b.key] = d;
  }
  // In the order the page writes them.
  const inOrder = snap.parts.filter((p) => gives.includes(p.key)).map((p) => p.key);
  return { gives: inOrder, shift, doorBottom: laid.doorBottom, fits: laid.doorBottom <= limit };
}

/**
 * The whole decision. `natural` is the first screen as designed; `noAir` with its
 * air closed up; `smallMark` with the air closed up AND the mark at `MARK_MIN` —
 * three measurements of the real page. `limit` is the y the button's bottom edge
 * may reach (the bottom bar's top, or the cookie banner's, less a gap).
 */
export function fitFirstScreen(m: { natural: FitSnapshot; noAir: FitSnapshot; smallMark: FitSnapshot }, limit: number): FitPlan {
  const none = { gives: [] as string[], shift: {} as Record<string, number> };
  if (m.natural.door.bottom <= limit) return { air: 1, mark: 1, ...none, doorBottom: m.natural.door.bottom, fits: true };

  // 1 · air — only as much as it needs (it closes up evenly, so the gain is linear).
  const airGain = m.natural.door.bottom - m.noAir.door.bottom;
  const airNeed = m.natural.door.bottom - limit;
  if (airGain > 0 && airGain >= airNeed) {
    const air = Math.max(0, Math.floor((1 - airNeed / airGain) * 100) / 100);
    return { air, mark: 1, ...none, doorBottom: m.natural.door.bottom - airGain * (1 - air), fits: true };
  }

  // 2 · the mark, smaller — again only as far as it needs.
  const markGain = m.noAir.door.bottom - m.smallMark.door.bottom;
  const markNeed = m.noAir.door.bottom - limit;
  if (markGain > 0 && markGain >= markNeed) {
    const cut = Math.min(1, Math.ceil((markNeed / markGain) * 100) / 100);
    return { air: 0, mark: 1 - cut * (1 - MARK_MIN), ...none, doorBottom: m.noAir.door.bottom - markGain * cut, fits: true };
  }

  // 3 · whole parts move below the button — and whatever room that leaves over is given back, the mark first.
  const plan = planGiveWay(m.smallMark, limit);
  let spare = Math.max(0, limit - plan.doorBottom);
  let mark = MARK_MIN;
  if (plan.gives.includes('mark')) {
    mark = 1; // below the button it is in nobody's way: its own size again
  } else if (markGain > 0) {
    const back = Math.min(1, Math.floor((spare / markGain) * 100) / 100);
    mark = MARK_MIN + back * (1 - MARK_MIN);
    spare -= markGain * back;
  }
  // The air above the button is at most all of it, so giving back this share can only fall short of the room.
  const air = airGain > 0 ? Math.min(1, Math.floor((spare / airGain) * 100) / 100) : 0;
  return { air, mark, ...plan, doorBottom: limit - spare + airGain * air, fits: plan.fits };
}
