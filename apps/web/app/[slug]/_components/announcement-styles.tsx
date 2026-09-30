import { Megaphone } from 'lucide-react';

import { splitFirstSentence } from '@/lib/scene-style-text';

/**
 * THE ANNOUNCEMENT'S OTHER TWO SHAPES — B · The notice and C · The line
 * (prototype `every_scene_three_styles_2026-09-29.html` §15). A · The banner is
 * `DayOfAnnouncement`'s own card.
 *
 * Same words, same tones: a style changes the SHAPE, never the register —
 * calm before the day, the urgent terracotta on it. The words are the
 * coordinator's own, rendered as text (never markdown, never HTML), and the
 * live region is kept, so a guest's screen reader still hears a new one.
 */

type Props = { body: string; stage: 'before' | 'live' };

/** B · The notice — an ink card, the first sentence as its headline. */
export function AnnouncementNotice({ body, stage }: Props) {
  const live = stage === 'live';
  const { lead, rest } = splitFirstSentence(body);
  return (
    <aside role="status" aria-live="polite" className="mx-auto mt-4 w-full max-w-3xl px-4" data-scene-style="notice">
      <div className={`border-l-4 px-4 py-4 ${live ? 'border-terracotta bg-ink text-cream' : 'border-ink/30 bg-paper-deep text-ink'}`}>
        <p className={`font-sans text-xs font-bold uppercase tracking-[0.14em] ${live ? 'text-cream/80' : 'text-ink/60'}`}>
          {live ? 'From the coordinator' : 'Announcement'}
        </p>
        <p className="mt-2 whitespace-pre-line font-pahina text-2xl font-light leading-snug">{lead}</p>
        {rest ? <p className={`mt-2 whitespace-pre-line text-[15px] leading-snug ${live ? 'text-cream/85' : 'text-ink/75'}`}>{rest}</p> : null}
      </div>
    </aside>
  );
}

/** C · The line — one quiet line; a long message wraps under the megaphone rather than hiding. */
export function AnnouncementLine({ body, stage }: Props) {
  const live = stage === 'live';
  return (
    <aside role="status" aria-live="polite" className="mx-auto mt-2 w-full max-w-3xl px-4" data-scene-style="line">
      <p className={`flex items-start gap-2 border-b py-2 text-[15px] leading-snug ${live ? 'border-terracotta/40 text-ink' : 'border-ink/12 text-ink/80'}`}>
        <Megaphone aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${live ? 'text-terracotta-700' : 'text-ink/60'}`} strokeWidth={1.75} />
        <span className="sr-only">{live ? 'From the coordinator: ' : 'Announcement: '}</span>
        <span className="min-w-0 whitespace-pre-line">{body}</span>
      </p>
    </aside>
  );
}
