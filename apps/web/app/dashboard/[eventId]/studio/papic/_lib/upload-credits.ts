/**
 * + ADD PHOTOS — WHAT A PICK COSTS, AND WHETHER THE POT COVERS IT (owner 2026-10-25: *"adding photos will use up papic
 * credits"*; 2026-10-26: an added photo costs 3, a camera photo 1 — `PAPIC_POINTS_PER_UPLOADED_PHOTO`).
 *
 * 🔑 ONE LADDER. Every number here comes from `papicCaptureCost` / `PAPIC_CLIP_COST_BANDS`
 * (`lib/papic-cameras-pure.ts`) — the SAME function `recordSeatCapture` bills with (`app/papic/actions.ts`) and the
 * presign seam gates with (`app/api/upload/route.ts`). A second copy of 1 · 2 · 3 · 5 · 8 in the sheet is a price that
 * can drift from what the couple is charged, so there is none: the sentence in the ⓘ is BUILT from the bands.
 * Held by `the-sheet-and-the-server-share-one-ladder.test.ts`.
 *
 * Pure — no React, no I/O — so the test drives it directly.
 */
import { PAPIC_CLIP_COST_BANDS, papicCaptureCost } from '@/lib/papic-cameras-pure';
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
 * The clip ladder in words, from the bands: "1–2 s · 2, 3 s · 3, 4–6 s · 5, 7–10 s · 8". Each band starts one second
 * after the previous band's top (seconds round UP — `papicSnippetCost`).
 */
export function clipLadderWords(): string {
  let from = 1;
  return PAPIC_CLIP_COST_BANDS.map((b) => {
    const span = from === b.maxSeconds ? `${b.maxSeconds} s` : `${from}–${b.maxSeconds} s`;
    from = b.maxSeconds + 1;
    return `${span} · ${formatCount(b.points)}`;
  }).join(', ');
}

/**
 * The ⓘ's sentence on cost — an added photo, a camera photo and the clip ladder, all read from the one function
 * (owner 2026-10-26: *"Sorry change the concept. Not 2 but 3. So it will be triple the credits to upload instead of coming from papic"*).
 */
export function costInfoLine(): string {
  const added = papicCaptureCost('photo', null, 'upload');
  const camera = papicCaptureCost('photo', null, 'camera');
  return `Each photo you add uses ${creditsCount(added)} — a photo taken with the camera uses ${creditsCount(camera)}. A snippet uses more the longer it runs (${clipLadderWords()}).`;
}
