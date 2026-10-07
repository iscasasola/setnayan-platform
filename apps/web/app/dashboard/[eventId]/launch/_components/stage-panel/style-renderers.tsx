'use client';

import type { ReactElement } from 'react';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { WhatToBringWidget } from '@/app/[slug]/_components/what-to-bring-widget';

/**
 * 🖼 THE STYLES A MINIATURE CAN DRAW ITSELF — the SHIPPED widget of each scene, given the style id it is
 * asked for (`sceneStyle`), fed the part's real content read off the canvas (`readFacts`). Every style id
 * the registry lists for these types draws non-empty — `lib/every-look-draws-a-picture.test.ts`.
 */
export type Facts = { targetIso: string | null; bare: boolean; text: string; signedBy: string | null };

/** What a renderer needs, read off the live section. */
export function readFacts(section: HTMLElement): Facts {
  const bare = section.querySelector('[data-scene-card="bare"]') !== null;
  /* ⏱ The countdown's own reading (days · hours · mins · secs) → the venue's day, so every style counts to the SAME instant. */
  let targetIso: string | null = null;
  /* The reading the part shows now, in whichever style it wears: four tiles (d h m s), a big number with its
     "h · m · s" line, a calendar — its counts are the 1–3 digit numbers, in order (a year is skipped). */
  /* Digits run straight into their unit in the text ("65Days02Hours"): every digit run, a year (4+) left out. */
  const nums = ((section.textContent ?? '').match(/\d+/g) ?? []).filter((n) => n.length <= 3).map(Number);
  if (nums.length >= 1) {
    const [d = 0, h = 0, m = 0, s = 0] = nums;
    const at = Date.now() + (((d * 24 + h) * 60 + m) * 60 + s) * 1000 + 60_000;
    try {
      targetIso = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_EVENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
    } catch {
      targetIso = null;
    }
  }
  const text = (section.querySelector('[data-el="body"], blockquote, p')?.textContent ?? '').trim();
  return { targetIso, bare, text, signedBy: null };
}

/** Scene type → its shipped styles, drawn from the facts. Null: no client renderer for that style. */
export const STYLE_RENDERERS: Partial<Record<string, (style: string, f: Facts) => ReactElement | null>> = {
  countdown: (style, f) => (f.targetIso ? <CountdownWidget targetIso={f.targetIso} bare={f.bare} sceneStyle={style === 'four-tiles' ? null : style} /> : null),
  special_message: (style, f) => (f.text ? <SpecialMessageWidget text={f.text} signedBy={f.signedBy} sceneStyle={style === 'note' ? null : style} /> : null),
  what_to_bring: (style, f) => (f.text ? <WhatToBringWidget text={f.text} sceneStyle={style === 'note' ? null : style} /> : null),
};

