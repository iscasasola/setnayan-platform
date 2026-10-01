import { loveStoryScenes } from '@/lib/love-story-moments';
import { SITE_MENU_ANCHORS } from '../_lib/site-menu';

import { LoveStoryYears } from './our-love-story-styles';
import { OurStory, ourStoryRenders } from './our-story';

/**
 * Our Love Story — the guest render of `events.love_story`.
 *
 * 🔑 EACH STORY IS A SCENE (owner 2026-09-25, Event Hub Maker Phase 7). The
 * widget draws ONE part per visible moment, in story order, from
 * `loveStoryScenes` — the same list the scrapbook's "On our Event Hub" shows.
 * A couple who never opened the scrapbook still has a story: `resolveMoments`
 * seeds the moments from the onboarding words (how we met · the spark · the yes
 * · milestones), so the legacy keys keep rendering exactly as moments.
 *
 * ── THE SHAPE IS THE SCENE SEAM ────────────────────────────────────────────
 * One `<section>` root; its direct children are the parts — the opening card,
 * then one `<article data-love-scene>` per moment. The canvas frame's "one part
 * after another" addresses exactly those children
 * (`every-widget-is-one-section.test.ts`), so each moment arrives in turn with
 * the theme's motion today. ⏭ Phase 5's scene renderer takes the same list
 * (each scene carries its `canvas` and a suggested `template`) and replaces the
 * `<article>` below; nothing upstream changes.
 *
 * Photos (Event Hub Pro) arrive already signed in `mediaUrls` — resolved ONCE
 * for the whole page by `SiteBody`, never here, so the widget stays pure and a
 * ref whose signing failed simply draws no picture.
 *
 * Hides entirely when there is no visible moment. Defensive parse — love_story
 * is JSONB (unknown).
 */
export function OurLoveStoryWidget({
  config,
  mediaUrls,
  sceneStyle = null,
}: {
  config: unknown;
  mediaUrls?: Readonly<Record<string, string>>;
  /**
   * 🎨 `chapters` (this, the default) · `essay` (the shipped `OurStory`
   * full variant) · `years` (`our-love-story-styles.tsx`). The essay composes
   * from the onboarding words; a story told only in moments has none of them,
   * so there it falls back to the chapters rather than drawing nothing.
   */
  sceneStyle?: string | null;
}) {
  const scenes = loveStoryScenes(config);
  if (scenes.length === 0) return null;
  if (sceneStyle === 'essay' && ourStoryRenders(config)) {
    return (
      <div data-scene-style="essay">
        <OurStory loveStory={config} variant="full" />
      </div>
    );
  }
  if (sceneStyle === 'years') return <LoveStoryYears scenes={scenes} mediaUrls={mediaUrls} />;

  // Pahina chapter grammar (design 2026-07-25 §7). NOTE: this widget carries an
  // unnumbered eyebrow — `OurStory` also renders a story chapter from the same
  // `love_story` column on a different path, and a couple who enables this
  // widget could surface both on one page. Since owner 2026-09-25 "drop the
  // numbers" neither carries a chapter numeral anymore, so two "Our story"
  // headings never collide on a number; the label alone still reads correctly.
  return (
    /* 📖 THIS IS THE STORY THE "Our Love Story" TAB LANDS ON (guest text audit
       2026-09-30): with this scene on the page the prose `OurStory` is not drawn
       (it told the story a second time), so the tab's anchor is here. */
    <section id={SITE_MENU_ANCHORS.story} className="scroll-mt-6 space-y-10" data-love-story-scenes={scenes.length}>
      <div>
        <p className="pahina-eyebrow">
          <span>Our love story</span>
        </p>
      </div>
      {scenes.map((s) => {
        const photos = s.media.map((ref) => mediaUrls?.[ref]).filter((u): u is string => Boolean(u));
        return (
          <article
            key={s.id}
            data-love-scene={s.id}
            data-love-template={s.template}
            className="max-w-prose border-l border-ink/12 pl-5"
          >
            {/* `data-love-*`: the Maker's canvas lays a moment's words here as they
                are typed (`applyLoveStoryPreview`, lib/maker-live-preview.ts). */}
            <p data-love-when="" className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
              {`${s.when ? `${s.when} · ` : ''}${s.chapterLabel}`}
            </p>
            {photos.length > 0 ? (
              <div className={`mt-3 grid gap-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {photos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                ))}
              </div>
            ) : null}
            <p data-love-line="" className="mt-2 whitespace-pre-line font-pahina text-xl font-light leading-snug text-ink">{s.line}</p>
            <p data-love-place="" hidden={!s.place} className="mt-1 text-sm leading-relaxed text-ink/65">
              {s.place ?? ''}
            </p>
          </article>
        );
      })}
    </section>
  );
}
