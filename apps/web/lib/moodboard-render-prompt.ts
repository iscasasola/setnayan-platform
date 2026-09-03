/**
 * The stylist brief and the cache key for one Mood Board render (MB8).
 *
 * Pure — no Supabase, no DOM, no `fetch`. Everything here is a function of the
 * board state the couple can see, so a brief can be reproduced from a stored
 * `event_renders` row and argued about later.
 *
 * ── THE BRIEF EXTENDS `buildPrompt()`, IT DOES NOT REPLACE IT ─────────────
 * The design lock names `buildPrompt()` (lib/reception-scene.ts) as the stylist
 * brief, and that function already carries hard-won corrections this module
 * must not re-litigate: it folds in EVERY selection rather than the primary one
 * (a brief describing one of two chosen ceiling treatments renders a room the
 * couple did not design, and reads as a success while doing it); it takes five
 * palette colours rather than four (a 4-cap silently dropped every theme's
 * Accent 2); and it names the reception venue, which it referenced zero times
 * until 2026-09-03, so a garden and a ballroom produced a byte-identical brief.
 *
 * So `buildRenderPrompt` CALLS it and then narrows. Re-deriving a whole-room
 * brief here would quietly discard all three of those fixes — the exact
 * "recreating a working thing is a defect" failure RULE 0 is about.
 *
 * ── NARROWING IS ADDITIVE, ON PURPOSE ─────────────────────────────────────
 * A part render still gets the whole room's brief, with a FOCUS clause on top.
 * That is not laziness: the couple's cake table is meant to sit in their room,
 * lit their way, in their colours. Stripping the context would produce a
 * technically-correct photograph of a generic cake. The whole look is the same
 * brief with no focus clause — which is precisely why it costs five credits
 * instead of one and is the better buy.
 *
 * ── THE NOTE IS UNTRUSTED TEXT ────────────────────────────────────────────
 * `note` is free text a couple typed. It is length-capped from
 * `moodboard_render_config.max_note_chars` (admin-editable), stripped of the
 * characters that could make it read as a new instruction block, and appended
 * as a clearly-labelled aside rather than spliced into the middle of the
 * brief. It is also EXCLUDED from the cache digest — see below.
 */

import {
  buildPrompt,
  optionIds,
  type ReceptionDesign,
  type RoleColors,
  type ReceptionVenue,
} from './reception-scene';
import { renderPartById, WHOLE_LOOK_PART_ID } from './moodboard-render-parts';

/** The digest's version prefix. Bump when the normalisation below changes. */
export const RENDER_DIGEST_VERSION = 1;

export type RenderPromptArgs = {
  /** `whole_look`, or a `RenderPart.id`. */
  partId: string;
  design: ReceptionDesign;
  /** The reception palette — `role_palette.reception`. */
  palette: string[];
  roleColors?: RoleColors;
  venue?: ReceptionVenue;
  /** The couple's per-box free text, or null. */
  note?: string | null;
  /** `moodboard_render_config.max_note_chars`. Never defaulted — see below. */
  maxNoteChars: number;
};

/**
 * Flatten a couple's note into something safe to append.
 *
 * Newlines and the fence/heading characters go, because a note is one aside in
 * a brief and a multi-line block reads to a model like a second set of
 * instructions. This is not a claim to have solved prompt injection — the
 * blast radius here is "the couple gets a photo they did not want, having
 * spent their own credit on it", so proportionate flattening is the right
 * amount of effort, not an adversarial filter.
 */
export function sanitizeRenderNote(
  note: string | null | undefined,
  maxNoteChars: number,
): string | null {
  if (!note) return null;
  const flat = note
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[`*#_<>{}[\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!flat) return null;
  // A cap of 0 or a nonsense cap must not silently become "unlimited".
  const cap = Number.isFinite(maxNoteChars) && maxNoteChars > 0 ? Math.floor(maxNoteChars) : 0;
  if (cap === 0) return null;
  return flat.slice(0, cap);
}

/**
 * The focus clause for one part. `null` for the whole look, which has none.
 *
 * Derived from the registry's own label and group — never a hand-written map
 * of twenty part names, which would go stale the first time a zone is added
 * and would go stale SILENTLY (the couple designs the new zone, pays for it,
 * and gets a photo focused on nothing in particular).
 */
export function focusClauseForPart(partId: string): string | null {
  if (partId === WHOLE_LOOK_PART_ID) return null;
  const part = renderPartById(partId);
  if (!part) return null;
  switch (part.group) {
    case 'people':
      return `Frame the photograph on ${part.label} and their attire, filling the frame with them; the reception around them stays in view but out of focus.`;
    case 'places':
      return `Frame the photograph on the ${part.label.toLowerCase()}, filling the frame with it as the subject.`;
    case 'room':
      return `Frame the photograph on the ${part.label.toLowerCase()}, filling the frame with it as the subject, within the reception described above.`;
  }
}

/** The full brief sent to the model, and stored on the render row. */
export function buildRenderPrompt(args: RenderPromptArgs): string {
  const base = buildPrompt(args.design, args.palette, args.roleColors, args.venue);
  const focus = focusClauseForPart(args.partId);
  const note = sanitizeRenderNote(args.note, args.maxNoteChars);

  const parts = [base];
  if (focus) parts.push(focus);
  if (note) {
    // Labelled, and last. A couple's aside is the most specific thing they
    // said and should not be buried mid-brief, but it must also be legible as
    // THEIRS rather than as ours.
    parts.push(`The couple adds: "${note}".`);
  }
  return parts.join(' ');
}

/* ── the cache digest ─────────────────────────────────────────────────────── */

/**
 * A tiny stable string hash. FNV-1a, hex.
 *
 * Not a crypto hash on purpose: this is a cache bucket, not a secret, and
 * `node:crypto` would drag a Node built-in into a module that MB7's client
 * component already imports transitively. Collisions here are cheap by
 * construction — the digest is COARSE anyway, and a collision serves a render
 * of a very similar board.
 */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Quantise a hex colour to a coarse bucket.
 *
 * 🔑 THIS IS THE WHOLE REASON THE CACHE CAN WORK AT ALL. Couples pick arbitrary
 * hexes from a wheel. An exact-hex key is unique per couple, so the pool would
 * hold thousands of entries and match nothing, while every test and every
 * dashboard reported a working cache. Rounding each channel to a 32-step bucket
 * collapses the whole 16.7M-colour space to at most 8×8×8 keys per slot, which
 * is what makes a shared pool possible at all.
 *
 * ⚠ AND ONE HONEST LIMIT, FOR MB9: a pair that STRADDLES a bucket boundary
 * still forks. "#8B1E3F" and "#8C1F41" are indistinguishable in a photograph
 * and get DIFFERENT keys, because 0x3F and 0x41 sit either side of 64. That is
 * a property of every fixed-grid bucketing and no bucket size removes it — a
 * coarser grid only moves the boundaries. It is written down here, and
 * asserted in `moodboard-render-prompt.test.ts`, so MB9 does not measure a
 * lower hit rate than it expected and go hunting a defect that is not there.
 *
 * The cost of a boundary miss is a cache MISS — the couple pays for a render
 * they were already willing to pay for. Never a wrong image, never a wrong
 * charge. If nearer-neighbour matching is ever wanted it needs a real
 * perceptual probe (the repo has OKLCH ΔE in `lib/color-space.ts`), not a
 * finer grid, and it must bump `RENDER_DIGEST_VERSION`.
 */
export function quantizeHex(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return '000';
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const q = (c: number) => (c >> 5).toString(16); // 8 buckets per channel
  return `${q(r)}${q(g)}${q(b)}`;
}

export type RenderDigestArgs = {
  partId: string;
  design: ReceptionDesign;
  palette: string[];
  venueSetting: string | null | undefined;
};

/**
 * `v<n>:<digest>` — the value written to `event_renders.config_digest` and the
 * key MB9 will match on.
 *
 * ── WHAT IS IN IT, AND WHAT IS DELIBERATELY NOT ───────────────────────────
 * IN: the part, the venue setting, the quantised major colours, and the
 * SELECTED OPTION IDS per zone (sorted, so selection order cannot fork the
 * key).
 *
 * NOT IN — and each omission is a decision, not an oversight:
 *   · **the free-text note.** The owner's rule: a render made with a note is
 *     stored but never offered to another couple. The exclusion here is the
 *     other half of `event_renders.reusable` being GENERATED on
 *     `note IS NULL` — together they mean a personally-shaped render can
 *     neither be found by a cache probe nor be admitted to the pool. This is
 *     the entire privacy story for reuse; there is no second rule underneath.
 *   · **role/attire colours**, for a ROOM or PLACE part: they do not appear in
 *     the subject, so including them would fork the key on a fact the
 *     photograph does not contain.
 *   · **the event id.** Obviously — a per-event key caches nothing. Said out
 *     loud because it is the one-character mistake that makes all of this look
 *     like it works.
 *
 * ⚠ MB9 OWNS THE LOOKUP; MB8 ONLY WRITES THIS. If MB9 finds the bucketing too
 * coarse or too fine, it bumps `RENDER_DIGEST_VERSION` and the old pool ages
 * out of matching — no column, no backfill, no migration.
 */
export function renderConfigDigest(args: RenderDigestArgs): string {
  const colors = args.palette
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
    .slice(0, 5)
    .map(quantizeHex);

  // Zone selections, sorted at both levels so neither key order nor selection
  // order can produce two digests for one board.
  const zones: string[] = [];
  for (const zoneId of Object.keys(args.design).sort()) {
    const attrs = args.design[zoneId as keyof ReceptionDesign];
    if (!attrs) continue;
    const picks: string[] = [];
    for (const attrId of Object.keys(attrs).sort()) {
      // `optionIds` is the shipped reader for "a bare string or an array" —
      // reusing it means a future third representation of a selection reaches
      // the digest for free, instead of being silently read as "no selection"
      // by a private copy of the parsing here.
      const ids = [...optionIds(attrs[attrId])].sort();
      if (ids.length > 0) picks.push(`${attrId}=${ids.join('+')}`);
    }
    if (picks.length > 0) zones.push(`${zoneId}[${picks.join(';')}]`);
  }

  const canonical = [
    `p=${args.partId}`,
    `v=${args.venueSetting ?? ''}`,
    `c=${colors.join(',')}`,
    `z=${zones.join('|')}`,
  ].join('&');

  return `v${RENDER_DIGEST_VERSION}:${fnv1a(canonical)}`;
}
