/**
 * apps/web/lib/element-runs-adapt.ts
 *
 * ✍ PER-LETTER STYLES ADAPT WHEN THE WORDS CHANGE (owner 2026-09-28,
 * DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA…", answer 2: *"can't it
 * adapt?"*): the old and new text are diffed and each styled run is remapped
 * onto the characters that SURVIVED —
 *
 *   · a kept letter keeps its style (even when it moved, or changed case);
 *   · an inserted letter takes no special style — so typing inside a styled
 *     word splits its run around the new letter;
 *   · a deleted letter drops its style with it;
 *   · never cleared wholesale, never left on the wrong letter.
 *
 * Before this, a run was dropped the moment its text's hash changed
 * (`hubTextHash`), which kept it off the wrong letter by taking every letter's
 * style away. The hash is still the identity check; this is what happens
 * instead of the drop, when the text the runs were made on is known
 * (`HubElementStyle.was`).
 *
 * ── HOW IT DIFFS ───────────────────────────────────────────────────────────
 * By USER-PERCEIVED CHARACTER, never by UTF-16 code unit: "💍" is two code
 * units and a decomposed "ñ" (n + U+0303) is two code points, and a diff that
 * could keep half of either would leave a run on a broken glyph. Offsets in and
 * out stay UTF-16 code units — the unit a browser's `Range` and `textContent`
 * count in, and the one every run is stored in.
 *
 * Two characters are "the same letter" when they match after NFC, lower-casing
 * and folding every whitespace to one space: "maria" → "Maria" keeps the style
 * on the M, a precomposed "ñ" equals a decomposed one, and a line break that
 * became a space is the same gap.
 *
 * A longest-common-subsequence that prefers the alignment in the fewest pieces
 * (a kept word stays one run), then a stray-match cleanup (a lone shared "e"
 * between "Jose" and "Pedro" is part of the rewrite, not a survivor). The
 * table is bounded (`MAX_CELLS`); past it, the common head and tail are
 * matched and only a middle that fits is aligned — otherwise nothing in the
 * middle is claimed kept: its styles drop, the head's and the tail's still
 * follow their letters. Dropping is the safe failure; guessing is not.
 *
 * Pure. No I/O.
 */

import type { HubElementRun } from './element-style';

/** The largest middle the LCS table may cover (old × new characters). */
const MAX_CELLS = 250_000;

type Unit = { s: number; e: number; k: string };

type Segmenter = { segment(input: string): Iterable<{ segment: string; index: number }> };
const SEGMENTER: Segmenter | null = (() => {
  try {
    const S = (Intl as unknown as { Segmenter?: new (loc?: string, o?: { granularity: string }) => Segmenter }).Segmenter;
    return S ? new S(undefined, { granularity: 'grapheme' }) : null;
  } catch {
    return null;
  }
})();

/** The comparison key: one letter, whatever its case, composition or kind of space. */
function keyOf(ch: string): string {
  if (/^\s+$/.test(ch)) return ' ';
  return ch.normalize('NFC').toLowerCase();
}

/** The text as user-perceived characters, each with its code-unit span. */
function unitsOf(text: string): Unit[] {
  const out: Unit[] = [];
  if (SEGMENTER) {
    for (const { segment, index } of SEGMENTER.segment(text)) out.push({ s: index, e: index + segment.length, k: keyOf(segment) });
    return out;
  }
  /* No grapheme segmenter: code points, with a combining mark kept on the letter before it. */
  let at = 0;
  for (const cp of Array.from(text)) {
    const prev = out[out.length - 1];
    if (prev && /^\p{M}$/u.test(cp)) {
      prev.e += cp.length;
      prev.k = keyOf(text.slice(prev.s, prev.e));
    } else {
      out.push({ s: at, e: at + cp.length, k: keyOf(cp) });
    }
    at += cp.length;
  }
  return out;
}

/** Match-count weight: one more kept letter always outweighs any number of fewer pieces. */
const BIG = 4096;

/**
 * The longest common subsequence of `a` and `b` (by key), written into `map`
 * at `offA` / `offB`. Of the alignments that keep the most letters it takes the
 * one in the FEWEST pieces — "families" matched whole, never "familie" plus an
 * "s" borrowed from "friends" — so a kept word stays one run.
 */
function align(a: Unit[], b: Unit[], map: number[], offA: number, offB: number): void {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  /* F0: best score from (i, j) when the step before was NOT a match there;
     F1: when it was (a match here continues the same piece, no new piece). */
  const F0 = new Int32Array((n + 1) * w);
  const F1 = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const skip = Math.max(F0[(i + 1) * w + j]!, F0[i * w + j + 1]!);
      if (a[i]!.k === b[j]!.k) {
        const cont = F1[(i + 1) * w + j + 1]!;
        F0[i * w + j] = Math.max(skip, BIG - 1 + cont);
        F1[i * w + j] = Math.max(skip, BIG + cont);
      } else {
        F0[i * w + j] = skip;
        F1[i * w + j] = skip;
      }
    }
  }
  let i = 0;
  let j = 0;
  let joined = false;
  while (i < n && j < m) {
    const here = (joined ? F1 : F0)[i * w + j]!;
    if (a[i]!.k === b[j]!.k && here === (joined ? BIG : BIG - 1) + F1[(i + 1) * w + j + 1]!) {
      map[offA + i] = offB + j;
      i += 1;
      j += 1;
      joined = true;
    } else if (here === F0[(i + 1) * w + j]!) {
      i += 1;
      joined = false;
    } else {
      j += 1;
      joined = false;
    }
  }
}

/** A word boundary: whitespace or punctuation, or past either end. */
const BOUNDARY = /^[\s\p{P}\p{S}]$/u;
const isEdge = (u: Unit[], i: number) => i < 0 || i >= u.length || BOUNDARY.test(u[i]!.k);

/**
 * 🧹 A STRAY MATCH IS NOT A KEPT LETTER. "Jose" → "Pedro" shares an "e", and
 * "story" → "journey" a "y"; a bare LCS would leave the old word's style on
 * those letters of the new one — letters the couple never styled, in a word
 * they replaced. A kept piece is released back into the rewrite when it is
 * PART of a word (never a whole kept word) and:
 *
 *   · between two edits: no longer than either (diff-match-patch's semantic
 *     cleanup rule) — "Cale" → "Caroline" does not keep the lone "l";
 *   · at an end of the text: shorter than the REPLACEMENT beside it (as much
 *     deleted as inserted) — the "y" of "journey" goes, while the "a" of
 *     "Maria" → "Marisa" (a pure insertion) and the "C" of "Cale" → "Cole" (a
 *     one-for-one letter) stay.
 *
 * Repeated until nothing more is released.
 */
function releaseStrays(map: number[], a: Unit[], b: Unit[]): void {
  for (;;) {
    const pieces: Array<{ i: number; j: number; len: number }> = [];
    for (let i = 0; i < a.length; i += 1) {
      const j = map[i]!;
      if (j < 0) continue;
      const last = pieces[pieces.length - 1];
      if (last && last.i + last.len === i && last.j + last.len === j) last.len += 1;
      else pieces.push({ i, j, len: 1 });
    }
    let released = false;
    for (let k = 0; k < pieces.length; k += 1) {
      const p = pieces[k]!;
      const endI = p.i + p.len - 1;
      const endJ = p.j + p.len - 1;
      const opens = (u: Unit[], s: number) => isEdge(u, s - 1) || isEdge(u, s);
      const closes = (u: Unit[], e: number) => isEdge(u, e + 1) || isEdge(u, e);
      if (opens(a, p.i) && opens(b, p.j) && closes(a, endI) && closes(b, endJ)) continue;
      const prev = pieces[k - 1];
      const next = pieces[k + 1];
      const delB = p.i - (prev ? prev.i + prev.len : 0);
      const insB = p.j - (prev ? prev.j + prev.len : 0);
      const delA = (next ? next.i : a.length) - (endI + 1);
      const insA = (next ? next.j : b.length) - (endJ + 1);
      const before = Math.max(delB, insB);
      const after = Math.max(delA, insA);
      const stray =
        before > 0 && after > 0
          ? p.len <= before && p.len <= after
          : before > 0
            ? p.len < Math.min(delB, insB)
            : after > 0
              ? p.len < Math.min(delA, insA)
              : false;
      if (stray) {
        for (let t = 0; t < p.len; t += 1) map[p.i + t] = -1;
        released = true;
        break;
      }
    }
    if (!released) return;
  }
}

/**
 * For every character of `was`, the index of the character of `now` it
 * survived as — or -1 when it was deleted (or sits in a middle too large to
 * diff).
 */
function survivors(was: Unit[], now: Unit[]): number[] {
  const map = new Array<number>(was.length).fill(-1);
  if (was.length === 0 || now.length === 0) return map;
  if (was.length * now.length <= MAX_CELLS) {
    align(was, now, map, 0, 0);
    releaseStrays(map, was, now);
    return map;
  }
  /* Too long to align whole: the common head and tail first, then the middle
     if it fits — else the middle keeps nothing. */
  let head = 0;
  while (head < was.length && head < now.length && was[head]!.k === now[head]!.k) {
    map[head] = head;
    head += 1;
  }
  let tail = 0;
  while (
    tail < was.length - head &&
    tail < now.length - head &&
    was[was.length - 1 - tail]!.k === now[now.length - 1 - tail]!.k
  ) {
    map[was.length - 1 - tail] = now.length - 1 - tail;
    tail += 1;
  }
  const a = was.slice(head, was.length - tail);
  const b = now.slice(head, now.length - tail);
  if (a.length > 0 && b.length > 0 && a.length * b.length <= MAX_CELLS) align(a, b, map, head, head);
  releaseStrays(map, was, now);
  return map;
}

/**
 * ✍ THE RUNS MADE ON `was`, AS THEY FALL ON `now` — kept letters keep their
 * style, inserted letters are plain, deleted letters take theirs with them.
 *
 * A run whose letters are split by an insertion becomes one run per surviving
 * piece, each with the run's own font · colour · size. The result is sorted
 * and never overlaps (each old letter survives as at most one new letter, and
 * the runs did not overlap). A run with no survivor is gone.
 */
export function adaptHubRuns(runs: readonly HubElementRun[], was: string, now: string): HubElementRun[] {
  const look = (r: HubElementRun) => {
    const { start: _s, end: _e, ...rest } = r;
    return rest;
  };
  if (was === now) return runs.map((r) => ({ ...r }));
  const a = unitsOf(was);
  const b = unitsOf(now);
  const map = survivors(a, b);
  const out: HubElementRun[] = [];
  for (const r of runs) {
    /* The run's letters: every character that STARTS inside it. */
    let piece: { from: number; to: number } | null = null;
    const flush = () => {
      if (piece) out.push({ start: b[piece.from]!.s, end: b[piece.to]!.e, ...look(r) });
      piece = null;
    };
    for (let i = 0; i < a.length; i += 1) {
      const u = a[i]!;
      if (u.s < r.start || u.s >= r.end) continue;
      const j = map[i]!;
      if (j < 0) continue;
      if (piece && j === piece.to + 1) piece.to = j;
      else {
        flush();
        piece = { from: j, to: j };
      }
    }
    flush();
  }
  out.sort((x, y) => x.start - y.start || x.end - y.end);
  return out;
}
