'use client';

import { useState } from 'react';

import type { LoveStoryScene } from '@/lib/love-story-moments';

/**
 * LOVE STORY · C · THE YEARS (prototype `every_scene_three_styles_2026-09-29.html`
 * §3). A · Chapters is `OurLoveStoryWidget`; B · The essay is the shipped
 * `OurStory variant="full"`, offered as a style of this scene.
 *
 * The same moments `loveStoryScenes` hands the chapters, as a rail — each
 * moment's own date (or its chapter, when it has none) with its first photo.
 * Tap one and its line opens under the rail. One screen, which is what a Save
 * the Date teaser wants. The first moment is open before any tap, so the
 * server markup already says something and never depends on a click.
 */
export function LoveStoryYears({
  scenes,
  mediaUrls,
}: {
  scenes: readonly LoveStoryScene[];
  mediaUrls?: Readonly<Record<string, string>>;
}) {
  const [open, setOpen] = useState(0);
  if (scenes.length === 0) return null;
  const current = scenes[Math.min(open, scenes.length - 1)]!;
  return (
    <section className="space-y-5" data-scene-style="years" data-love-story-scenes={scenes.length}>
      <p className="pahina-eyebrow">
        <span>Our love story</span>
      </p>
      <ol className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Our story, year by year">
        {scenes.map((s, i) => {
          const photo = s.media.map((ref) => mediaUrls?.[ref]).find((u): u is string => Boolean(u));
          const on = i === open;
          return (
            <li key={s.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-pressed={on}
                className={`flex min-h-[44px] w-24 flex-col items-center gap-2 rounded-md px-1 py-2 text-center transition-colors ${
                  on ? 'text-ink' : 'text-ink/60 hover:text-ink'
                }`}
              >
                <span
                  className={`block aspect-square w-20 overflow-hidden rounded-full bg-veil ${
                    on ? 'ring-2 ring-gild ring-offset-2 ring-offset-cream' : ''
                  }`}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="font-pahina text-lg leading-none">{s.when || s.chapterLabel}</span>
                <span className="font-sans text-xs uppercase tracking-[0.12em]">{s.chapterLabel}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <article data-love-scene={current.id} className="max-w-prose border-l border-ink/12 pl-5" aria-live="polite">
        <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">
          {current.when ? `${current.when} · ` : ''}
          {current.chapterLabel}
        </p>
        <p className="mt-2 whitespace-pre-line font-pahina text-xl font-light leading-snug text-ink">{current.line}</p>
        {current.place ? <p className="mt-1 text-sm leading-relaxed text-ink/65">{current.place}</p> : null}
      </article>
    </section>
  );
}
