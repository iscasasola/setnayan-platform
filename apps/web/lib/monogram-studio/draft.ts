/**
 * lib/monogram-studio/draft.ts
 *
 * Client-only localStorage bridge that carries a monogram designed on the FREE
 * public studio (www.setnayan.com/monogram) through sign-up to the couple's new
 * wedding. The public studio stashes the rendered mark + re-editable config when
 * the visitor downloads or taps "start planning free"; after they sign up and
 * land in the dashboard, the Monogram maker shows a "pick up your design" card
 * that submits the stash to the normal saveStudioAction — which RE-SANITIZES the
 * SVG server-side and enforces couple membership, so a tampered localStorage
 * payload can never become an unsafe or cross-account mark.
 *
 * Device-bound by nature (localStorage): designing on one device and signing up
 * on another won't carry — the download is the cross-device fallback. Safe to
 * import anywhere; every function touches localStorage only when called (never
 * at module load), so it's SSR-safe.
 */

import type { StudioConfig } from '@/lib/monogram-studio-shared';

export const MONOGRAM_DRAFT_KEY = 'setnayan:monogram-draft';

export type MonogramDraft = { svg: string; config: StudioConfig; ts: number };

const MAX_BYTES = 500_000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — matches the onboarding-draft window

export function stashMonogramDraft(svg: string, config: StudioConfig): void {
  try {
    if (!svg || !svg.startsWith('<svg') || svg.length > MAX_BYTES) return;
    const payload = JSON.stringify({ svg, config, ts: Date.now() });
    if (payload.length > MAX_BYTES) return;
    localStorage.setItem(MONOGRAM_DRAFT_KEY, payload);
  } catch {
    /* private mode / quota / disabled storage — silently skip */
  }
}

export function readMonogramDraft(): MonogramDraft | null {
  try {
    const raw = localStorage.getItem(MONOGRAM_DRAFT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<MonogramDraft>;
    if (
      !o ||
      typeof o.svg !== 'string' ||
      !o.svg.startsWith('<svg') ||
      o.svg.length > MAX_BYTES ||
      typeof o.config !== 'object' ||
      o.config === null
    ) {
      return null;
    }
    if (typeof o.ts === 'number' && Date.now() - o.ts > TTL_MS) {
      clearMonogramDraft();
      return null;
    }
    return { svg: o.svg, config: o.config as StudioConfig, ts: typeof o.ts === 'number' ? o.ts : 0 };
  } catch {
    return null;
  }
}

export function clearMonogramDraft(): void {
  try {
    localStorage.removeItem(MONOGRAM_DRAFT_KEY);
  } catch {
    /* noop */
  }
}
