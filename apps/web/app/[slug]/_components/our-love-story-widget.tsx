import { loveStoryScenes } from '@/lib/love-story-moments';

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
}: {
  config: unknown;
  mediaUrls?: Readonly<Record<string, string>>;
}) {
  const scenes = loveStoryScenes(config);
  if (scenes.length === 0) return null;

  // Pahina chapter grammar (design 2026-07-25 §7). NOTE: this widget carries an
  // unnumbered eyebrow — `OurStory` also renders a story chapter from the same
  // `love_story` column on a different path, and a couple who enables this
  // widget could surface both on one page. Since owner 2026-09-25 "drop the
  // numbers" neither carries a chapter numeral anymore, so two "Our story"
  // headings never collide on a number; the label alone still reads correctly.
  return (
    <section className="space-y-10" data-love-story-scenes={scenes.length}>
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
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
              {s.when ? `${s.when} · ` : ''}
              {s.chapterLabel}
            </p>
            {photos.length > 0 ? (
              <div className={`mt-3 grid gap-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {photos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                ))}
              </div>
            ) : null}
            <p className="mt-2 whitespace-pre-line font-pahina text-xl font-light leading-snug text-ink">{s.line}</p>
            {s.place ? <p className="mt-1 text-sm leading-relaxed text-ink/65">{s.place}</p> : null}
          </article>
        );
      })}
    </section>
  );
}
