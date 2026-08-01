/**
 * MY LINES — matching a host's saved lines onto a new wedding, and filling the
 * names in.
 *
 * Owner-locked 2026-08-01. Spec: `Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`.
 *
 * ── WHAT THIS DECIDES ──────────────────────────────────────────────────────
 *
 * An emcee does ~40 weddings a year saying nearly the same things with the
 * names swapped. `vendor_lines` keeps his craft; this module works out WHICH
 * saved line belongs on WHICH moment of a wedding he has just opened, and how
 * loudly to admit it when the match is a guess.
 *
 * Pure and total, for the same reason `emcee-script-layer.ts` is: the
 * interesting part is a set of decisions, and a decision is only trustworthy if
 * a test can hold it down. Both surfaces (his prep tab, his library) are
 * renderers over {@link matchLines} and {@link fillSlots}.
 *
 * ── THE THREE-RUNG LADDER, AND WHY IT IS A LADDER ──────────────────────────
 *
 * `BLOCK_CUE` has 9 coarse block types; real moments are specific ("Money
 * Dance", "Grand Entrance"). Keying on type alone would put one line on every
 * `program` block, which is worse than useless — it would put the WRONG words
 * in a host's mouth while looking helpful.
 *
 *   1. EXACT      — his own named segment (`activity_id`). The same UUID
 *                   travels to every wedding, so this is the only rung that is
 *                   simply true. Shown as "yours".
 *   2. BY NAME    — normalized label. A hand-typed "Money Dance" matches, but
 *                   the caller MUST flag it; two weddings can use one word for
 *                   two different things.
 *   3. DAY-PART   — block type, and ONLY for singleton framing moments. If a
 *                   type occurs more than once on this timeline it is NOT a
 *                   framing moment, and rung 3 is refused outright.
 *
 * No rung matches ⇒ NO FILL. "Nothing in your lines fits this yet" is a correct
 * answer; a confident wrong line is not.
 *
 * ── TWO RULES THAT PROTECT A PERSON, NOT A PROPERTY ────────────────────────
 *
 *   · A PRIVATE moment never pre-fills. "Watch for Grace by the sound booth" is
 *     last wedding's coordinator, and he is holding a live microphone.
 *   · A stored line never contains a real name — it carries slots. So a line
 *     cannot carry one couple's details into another couple's wedding, and the
 *     guarantee is structural rather than a matter of anyone remembering.
 */
import type { ScriptBlock } from './emcee-script-layer';

/** A saved line, as stored in `vendor_lines`. */
export type SavedLine = {
  line_id: string;
  activity_id: string | null;
  label_key: string | null;
  block_type: string | null;
  /** A TEMPLATE — carries slot tokens, never real names. */
  body: string;
  is_private_note: boolean;
};

/** Which rung matched. The UI shows this; rung 2 must be visibly flagged. */
export type MatchRung = 'exact' | 'by_name' | 'day_part';

export type LineMatch = {
  blockId: string;
  line: SavedLine;
  rung: MatchRung;
  /** TRUE only for `exact`. Anything else the host should glance at. */
  trusted: boolean;
};

/**
 * Normalize a moment's label into a match key. Case, punctuation and spacing
 * vary wildly between couples ("Money Dance", "money-dance", "Money  dance!"),
 * and none of that variation is meaningful.
 */
export function labelKey(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null;
  const k = label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return k.length > 0 ? k : null;
}

/**
 * Which block types occur exactly once on this timeline. Only those may use
 * rung 3 — that is the whole guard against "the same line on every program
 * block". Computed from the wedding in hand, never assumed from a constant,
 * because whether a type is a framing moment is a property of THIS timeline.
 */
export function singletonBlockTypes(blocks: readonly ScriptBlock[]): Set<string> {
  const counts = new Map<string, number>();
  for (const b of blocks) {
    const t = typeof b.block_type === 'string' ? b.block_type : null;
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const singles = new Set<string>();
  for (const [t, n] of counts) if (n === 1) singles.add(t);
  return singles;
}

/**
 * MATCH the vendor's library onto this wedding's timeline.
 *
 * Pure and total. Returns at most one match per block — the highest rung that
 * answers. Blocks with no match are simply absent, which is how the caller
 * renders "nothing fits yet".
 *
 * @param activityByBlock block_id → activity_id, from the shipped
 *        `event_activity_picks.scheduled_block_id` bridge. Absent for any block
 *        the couple typed by hand, which is exactly when rung 2 earns its keep.
 */
export function matchLines(input: {
  blocks: readonly ScriptBlock[];
  lines: readonly SavedLine[];
  activityByBlock?: ReadonlyMap<string, string | null>;
}): LineMatch[] {
  const { blocks, lines } = input;
  const activityByBlock = input.activityByBlock ?? new Map<string, string | null>();

  // A private line is never a candidate for reuse — the rule is enforced here,
  // at the only place a line can enter a wedding, rather than at each caller.
  const usable = lines.filter((l) => !l.is_private_note && l.body.trim().length > 0);

  const byActivity = new Map<string, SavedLine>();
  const byLabel = new Map<string, SavedLine>();
  const byType = new Map<string, SavedLine>();
  for (const l of usable) {
    if (l.activity_id) byActivity.set(l.activity_id, l);
    else if (l.label_key) byLabel.set(l.label_key, l);
    else if (l.block_type) byType.set(l.block_type, l);
  }

  const singles = singletonBlockTypes(blocks);
  const out: LineMatch[] = [];

  for (const b of blocks) {
    // RULE: a private moment never pre-fills. Checked before any rung, so no
    // amount of key-matching can route around it.
    if (b.is_public !== true) continue;

    const activityId = activityByBlock.get(b.block_id) ?? null;
    if (activityId) {
      const hit = byActivity.get(activityId);
      if (hit) {
        out.push({ blockId: b.block_id, line: hit, rung: 'exact', trusted: true });
        continue;
      }
    }

    const key = labelKey(b.label);
    if (key) {
      const hit = byLabel.get(key);
      if (hit) {
        out.push({ blockId: b.block_id, line: hit, rung: 'by_name', trusted: false });
        continue;
      }
    }

    // Rung 3 only for a type that occurs ONCE on this timeline.
    const t = typeof b.block_type === 'string' ? b.block_type : null;
    if (t && singles.has(t)) {
      const hit = byType.get(t);
      if (hit) {
        out.push({ blockId: b.block_id, line: hit, rung: 'day_part', trusted: false });
      }
    }
  }

  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// SLOTS — a stored line carries tokens, never names.
// ───────────────────────────────────────────────────────────────────────────

/** `⟨the couple⟩` — the token shape. Angle quotes, so it cannot collide with
 *  anything a host would plausibly type. */
const SLOT_RE = /⟨([^⟩]{1,60})⟩/gu;

/**
 * AUTO-slots resolve from event fields the vendor may already read.
 * ASK-slots do not resolve — he answers them once per wedding.
 *
 * ⚠ Sponsor and title slots are ASK by necessity, not by preference: a booked
 * vendor CANNOT read `guests` (the shipped compiler deliberately omits the
 * roster), so no ninong/ninang name can ever auto-resolve without opening a new
 * RLS lane. That is a deliberate exposure widening and is out of scope.
 */
export const AUTO_SLOTS = ['the couple', 'the date', 'the venue'] as const;
export type AutoSlot = (typeof AUTO_SLOTS)[number];

export type SlotValues = Partial<Record<string, string>>;

export type FilledLine = {
  /** Ready to read aloud, with every resolvable slot substituted. */
  text: string;
  /** Slots still unfilled — these are what triage surfaces. */
  unfilled: string[];
};

/**
 * Fill a template's slots. Unresolved slots are LEFT IN, visibly, rather than
 * silently blanked: a host reading "please welcome ⟨how they're announced⟩" has
 * been warned; one reading "please welcome" has been ambushed.
 */
export function fillSlots(body: string, values: SlotValues): FilledLine {
  const unfilled: string[] = [];
  const text = body.replace(SLOT_RE, (whole, rawName: string) => {
    const name = rawName.trim();
    const v = values[name];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    if (!unfilled.includes(name)) unfilled.push(name);
    return whole;
  });
  return { text, unfilled };
}

/** Every slot a template references, in first-appearance order. */
export function slotsIn(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(SLOT_RE)) {
    const name = (m[1] ?? '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Turn what he actually typed into a storable TEMPLATE by swapping this
 * couple's details back out for slots.
 *
 * This is the privacy guarantee made mechanical: save is automatic (spec 3.1),
 * so the library must not depend on him remembering to anonymize. Longest value
 * first, so "Bea & Marco" is replaced before "Bea".
 */
export function toTemplate(body: string, values: SlotValues): string {
  const pairs = Object.entries(values)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim().length > 1)
    .map(([slot, v]) => [slot, v.trim()] as const)
    .sort((a, b) => b[1].length - a[1].length);

  let out = body;
  for (const [slot, value] of pairs) {
    // Escape the value — a couple's name can contain regex metacharacters.
    const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(esc, 'gi'), `⟨${slot}⟩`);
  }
  return out;
}
