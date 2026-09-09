/**
 * guest-count-provenance.ts — every guest count on a supplier's screen says
 * WHICH guest count it is.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE ─────────────────────────────────────────
 * A Setnayan conversation stores TWO headcounts and they are both true:
 *
 *   • `chat_threads.pax_at_inquiry` — what the couple asked with. The number a
 *     quote was written against.
 *   • the live count (`pax_current`, recomputed on view) — what they are
 *     planning for now.
 *
 * The supplier's conversation page showed both, in different places, and only
 * ONE of them said so. The header read *"planning for ~170 guests · was 150 at
 * inquiry"*; the accept card, four hundred lines away, rendered a bare
 * **"150 pax"** on the same screen. The owner caught it on a drawing.
 *
 * 🔑 MONEY RIDES ON IT. A supplier quotes against one number and is paid
 * against the other. The product already knows this — a *"guest count changed —
 * accept the new total or hold your price"* card exists precisely because the
 * two numbers diverge. An unlabelled figure is the input to that divergence.
 *
 * ── WHY A HELPER AND NOT FOUR CAREFUL EDITS ─────────────────────────────────
 * Four surfaces show a count today (header · accept card · quote builder ·
 * customer rail) and a fifth will exist by Christmas. Four careful edits leave
 * the fifth free to invent a sixth wording, which is how this got here: the
 * header's provenance was written once, by hand, in the header. So the wording
 * is built HERE, from one input, and the surfaces choose a BASIS — never a
 * sentence.
 *
 * ⛔ AND IT NEVER DROPS EITHER NUMBER. The obvious "simplification" is to show
 * only the live count. Do not: the quote was made against the old one, and
 * hiding that is exactly how two numbers silently diverge with nobody's name on
 * the difference.
 *
 * PURE — no React, no I/O, no clock.
 */

/** The two counts a thread carries. Either may be missing. */
export type GuestCounts = {
  /** What the couple is planning for now (live pax / `pax_current`). */
  live: number | null;
  /** What they asked with (`pax_at_inquiry`) — what a quote was written to. */
  atInquiry: number | null;
};

/**
 * WHICH of the two numbers a surface leads with.
 *
 * ⚠ A surface picks a basis, never a string. The accept card leads with the
 * inquiry count because that is what the supplier is being asked to accept; the
 * header and the rail lead with the live one because that is what the couple is
 * actually planning. Both then name the other.
 */
export type GuestCountBasis = 'live' | 'at_inquiry';

/** 'guests' reads in a sentence; 'pax' fits a chip. Same number either way. */
export type GuestCountUnit = 'guests' | 'pax';

export type GuestCountReading = {
  /** The number shown. */
  count: number;
  /** Which count it is, always: 'now planning' | 'at inquiry'. */
  basisLabel: string;
  /** The headline with its unit: '~170 guests' · '150 pax'. */
  label: string;
  /**
   * The OTHER count, named — 'was 150 at inquiry' · 'their plan says 170 now'.
   * Null only when there is no second number, or the two are equal (in which
   * case there is nothing to reconcile and a second figure is just noise).
   */
  otherLabel: string | null;
};

/**
 * ⚠ THE TILDE BELONGS TO THE LIVE COUNT ONLY. A live headcount is an estimate
 * that moves; the inquiry count is a fixed historical fact — the number on the
 * quote. Printing "~150 pax at inquiry" would soften a figure somebody is owed
 * money against.
 */
function withUnit(count: number, unit: GuestCountUnit, approximate: boolean): string {
  return `${approximate ? '~' : ''}${count} ${unit}`;
}

/**
 * Read one count with its provenance, or null when there is no number at all
 * (in which case a surface must draw nothing rather than invent a headcount).
 *
 * Falls back to the OTHER count when the requested basis is missing — and says
 * so, because a fallback that keeps the requested basis's label would print the
 * live number under the words "at inquiry".
 */
export function readGuestCount(
  counts: GuestCounts,
  basis: GuestCountBasis,
  opts?: { unit?: GuestCountUnit },
): GuestCountReading | null {
  const unit = opts?.unit ?? 'guests';
  const live = normalize(counts.live);
  const atInquiry = normalize(counts.atInquiry);

  // The basis actually available. Asking for one the thread does not carry
  // resolves to the other, under the other's own name.
  const resolved: GuestCountBasis | null =
    basis === 'live'
      ? live != null
        ? 'live'
        : atInquiry != null
          ? 'at_inquiry'
          : null
      : atInquiry != null
        ? 'at_inquiry'
        : live != null
          ? 'live'
          : null;
  if (resolved == null) return null;

  const count = resolved === 'live' ? live! : atInquiry!;
  const other = resolved === 'live' ? atInquiry : live;
  const sameNumber = other != null && other === count;

  if (resolved === 'live') {
    return {
      count,
      basisLabel: 'now planning',
      label: withUnit(count, unit, true),
      otherLabel: other != null && !sameNumber ? `was ${other} at inquiry` : null,
    };
  }
  return {
    count,
    basisLabel: 'at inquiry',
    label: withUnit(count, unit, false),
    otherLabel: other != null && !sameNumber ? `their plan says ${other} now` : null,
  };
}

/**
 * The two counts as ONE line, for a surface with room for a sentence: the
 * header and the customer rail.
 *
 *   "~170 guests · was 150 at inquiry"
 *   "~170 guests"                        (nothing has changed since inquiry)
 */
export function guestCountLine(
  counts: GuestCounts,
  basis: GuestCountBasis = 'live',
  opts?: { unit?: GuestCountUnit },
): string | null {
  const r = readGuestCount(counts, basis, opts);
  if (!r) return null;
  return r.otherLabel ? `${r.label} · ${r.otherLabel}` : r.label;
}

/**
 * The rail's Guests row: a value and the small print under it. Kept separate
 * from `guestCountLine` because the rail stacks them, and a row that renders
 * "~170 guests · was 150 at inquiry" on one line loses the shape the design
 * asks for without losing any words — which is the kind of drift nobody spots.
 */
export function guestCountRow(counts: GuestCounts): { value: string; note: string | null } | null {
  const r = readGuestCount(counts, 'live');
  if (!r) return null;
  return {
    value: `~${r.count} now`,
    note: r.otherLabel ? `${r.otherLabel.replace(/^was /, '')}` : null,
  };
}

/**
 * A chip: the number and, always, which number it is — "150 pax · at inquiry".
 *
 * ⚠ THE BASIS LABEL IS NOT CONDITIONAL. It renders even when the thread carries
 * only one count, because a supplier cannot tell "there is only one number" from
 * "somebody dropped the label" by looking. That indistinguishability is the
 * whole defect.
 */
export function guestCountChip(
  counts: GuestCounts,
  basis: GuestCountBasis,
  opts?: { unit?: GuestCountUnit },
): { label: string; basisLabel: string } | null {
  const r = readGuestCount(counts, basis, opts);
  if (!r) return null;
  return { label: r.label, basisLabel: r.basisLabel };
}

function normalize(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}
