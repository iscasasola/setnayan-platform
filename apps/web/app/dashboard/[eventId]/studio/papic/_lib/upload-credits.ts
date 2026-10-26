/**
 * + ADD PHOTOS — WHAT A PICK COSTS, AND WHETHER THE POT COVERS IT (owner 2026-10-25: *"adding photos will use up papic
 * credits"*; 2026-10-26: anything added costs the camera price × `PAPIC_UPLOAD_MULTIPLIER`).
 *
 * 🔑 ONE LADDER. Every number here comes from `papicCaptureCost` / `PAPIC_CLIP_COST_BANDS`
 * (`lib/papic-cameras-pure.ts`) — the SAME function `recordSeatCapture` bills with (`app/papic/actions.ts`) and the
 * presign seam gates with (`app/api/upload/route.ts`). A second copy of 1 · 2 · 3 · 5 · 8 in the sheet is a price that
 * can drift from what the couple is charged, so there is none: the sentence in the ⓘ is BUILT from the bands.
 * Held by `the-sheet-and-the-server-share-one-ladder.test.ts`.
 *
 * Pure — no React, no I/O — so the test drives it directly.
 */
import { PAPIC_CLIP_COST_BANDS, papicCaptureCost, papicClipCostFloor, papicSourceMultiplier, type PapicCaptureSource } from '@/lib/papic-cameras-pure';
import { countNoun, formatCount } from '@/lib/format-number';

/** One picked file, after it was read: a photo, or a clip whose length was measured. */
export type PickedCost = { kind: 'photo' | 'clip'; durationMs?: number | null };

/** What these files spend together — each one priced by the server's own function. */
export function selectionCost(picked: readonly PickedCost[]): number {
  // 'upload': every file this sheet sends lands on the Uploads camera — the source both seams charge by.
  return picked.reduce(
    (sum, p) => sum + papicCaptureCost(p.kind, p.kind === 'clip' ? (p.durationMs ?? null) : null, 'upload'),
    0,
  );
}

/**
 * The pot the sheet was opened with:
 *   · a number — credits left (the presign gate's own read for this camera, `papic_capture_points_available`);
 *   · 'unmetered' — the event holds the Papic Unlock pass, nothing is spent;
 *   · null — the pot could not be read. Never shown as 0; the server still decides each file.
 */
export type UploadPot = number | 'unmetered' | null;

export type CoverVerdict =
  | { ok: true; cost: number }
  /** The pot is short — say so BEFORE anything is uploaded, and offer Add more. */
  | { ok: false; cost: number; left: number; short: number };

export function coverVerdict(cost: number, pot: UploadPot): CoverVerdict {
  if (pot === 'unmetered' || pot === null) return { ok: true, cost };
  const left = Math.max(0, Math.floor(pot));
  return cost <= left ? { ok: true, cost } : { ok: false, cost, left, short: cost - left };
}

/** "1 credit" · "5 credits" — one word for the unit, everywhere on the sheet. */
export function creditsCount(n: number): string {
  return countNoun(n, 'credit', 'credits');
}

/**
 * A clip ladder in words, every price asked of `papicCaptureCost` at the band's top second: for 'upload' "1–2 s · 6,
 * 3 s · 9, 4–6 s · 15, 7–10 s · 24". Each band starts one second after the previous band's top (seconds round UP).
 */
export function clipLadderWords(source: PapicCaptureSource = 'upload'): string {
  let from = 1;
  return PAPIC_CLIP_COST_BANDS.map((b) => {
    const span = from === b.maxSeconds ? `${b.maxSeconds} s` : `${from}–${b.maxSeconds} s`;
    from = b.maxSeconds + 1;
    return `${span} · ${formatCount(papicCaptureCost('clip', b.maxSeconds * 1000, source))}`;
  }).join(', ');
}

const TIMES: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/**
 * The ⓘ's sentence on cost — all read from the one function (owner 2026-10-26: *"Normal papic credit is 1 credit when
 * used papic. 3 credits for photo if uploaded. So you multiply it by 3 always"*).
 */
export function costInfoLine(): string {
  const photo = papicCaptureCost('photo', null, 'upload');
  const low = papicClipCostFloor('upload');
  const high = papicCaptureCost('clip', PAPIC_CLIP_COST_BANDS[PAPIC_CLIP_COST_BANDS.length - 1]!.maxSeconds * 1000, 'upload');
  const m = papicSourceMultiplier('upload');
  return `A photo you add uses ${creditsCount(photo)} and a snippet ${formatCount(low)}–${formatCount(high)} by length (${clipLadderWords('upload')}) — ${TIMES[m] ?? formatCount(m)} times the camera.`;
}
