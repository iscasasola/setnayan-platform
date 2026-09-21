'use client';

import type { StudioAnimKind } from '@/lib/monogram-studio-shared';
import type { CommitMonogramInput } from './commit-actions';

/**
 * The seam between row 2 (the editor OR the uploader) and rows 3–4 (the effects
 * and the two buttons) on the Monogram Maker.
 *
 * The page is server-rendered and the rows are siblings, so they share nothing
 * but the window. Two things cross it:
 *
 *  • PLAY — tapping an effect plays it ON the mark in row 2, in place (owner's
 *    concept: the effect row sits under the mark, not beside a second copy of
 *    it). The studio hands it to its engine; the uploader to its own player.
 *
 *  • THE MARK — "Use Static Image" and "Unlock Animation & Apply" are the only
 *    save on the page, so they must ask whichever editor is open for the mark
 *    on screen. The open editor registers a provider; the buttons call it.
 */

export type MarkPayload =
  | { ok: true; mark: Pick<CommitMonogramInput, 'source' | 'svg' | 'config' | 'inkMode'> }
  | { ok: false; error: string };

type Provider = () => MarkPayload;

let provider: Provider | null = null;

/** The open editor calls this on mount; the returned function unregisters. */
export function provideMark(fn: Provider): () => void {
  provider = fn;
  return () => {
    if (provider === fn) provider = null;
  };
}

/** What the open editor would save right now. With no editor mounted, the
 *  mark already saved stays as it is. */
export function currentMark(): MarkPayload {
  return provider ? provider() : { ok: true, mark: { source: 'none' } };
}

const PLAY = 'setnayan:monogram-play';

export type PlayDetail = { kind: StudioAnimKind; dur: number; smooth: number; delay: number };

export function playOnMark(detail: PlayDetail): void {
  window.dispatchEvent(new CustomEvent<PlayDetail>(PLAY, { detail }));
}

export function onPlay(fn: (d: PlayDetail) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<PlayDetail>).detail);
  window.addEventListener(PLAY, h);
  return () => window.removeEventListener(PLAY, h);
}
