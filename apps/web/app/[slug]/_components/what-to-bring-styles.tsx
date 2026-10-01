import { Check, X } from 'lucide-react';

import { isADont, paragraphsOf, splitFirstSentence } from '@/lib/scene-style-text';

/**
 * WHAT TO BRING'S OTHER TWO STYLES — B · The list and C · The gift line
 * (prototype `every_scene_three_styles_2026-09-29.html` §9). A · The note is
 * `WhatToBringWidget` itself.
 *
 * The data is `events.what_to_bring` and nothing else. "The list" makes a row
 * of each line the couple typed — nothing is invented, and a row that begins
 * "No…" / "Please don't…" is marked ✕, read from the words, not a setting.
 */

/** B · The list — each paragraph is a row. */
export function WhatToBringList({ text }: { text: string }) {
  const rows = paragraphsOf(text);
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3" data-scene-style="list">
      <p className="pahina-eyebrow">
        <span>What to bring</span>
      </p>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {rows.map((row, i) => {
          const dont = isADont(row);
          return (
            <li key={i} className="flex items-start gap-3 py-3" data-bring-row={dont ? 'dont' : 'do'}>
              {dont ? (
                <X aria-label="Please don't" className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
              ) : (
                <Check aria-label="Please do" className="mt-0.5 h-4 w-4 shrink-0 text-gild" strokeWidth={2} />
              )}
              <p className="text-base leading-relaxed text-ink/80">{row}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** C · The gift line — centred, the first sentence large, the rest under a rule. */
export function WhatToBringGiftLine({ text }: { text: string }) {
  const { lead, rest } = splitFirstSentence(text);
  if (!lead) return null;
  return (
    <section className="space-y-3 text-center" data-scene-style="gift-line">
      <p className="pahina-eyebrow justify-center">
        <span>What to bring</span>
      </p>
      <p className="mx-auto max-w-prose font-pahina text-3xl font-light leading-snug text-ink">{lead}</p>
      {rest ? (
        <>
          <p aria-hidden className="text-gild">✦</p>
          <p className="mx-auto max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/75">{rest}</p>
        </>
      ) : null}
    </section>
  );
}
