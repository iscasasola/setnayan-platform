import Link from 'next/link';
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  FREE_MOMENT_CAP,
  LOVE_STORY_CHAPTER_LABEL,
  LOVE_STORY_CHAPTER_PROMPT,
  formatMomentDate,
  groupByChapter,
  loveStoryScenes,
  mayAddMoment,
  type LoveStoryMoment,
} from '@/lib/love-story-moments';
import { AddMomentLabel, MomentSheet } from './moment-sheet';
import { LoveStoryProLine } from './love-story-pro-line';
import { HubSavesImmediately } from '../../_components/hub-draft-field';

/**
 * OUR LOVE STORY — THE SCRAPBOOK (Event Hub Maker Phase 7).
 *
 * Structure from `prototypes/our_love_story_scrapbook_2026-09-25.html`, top to
 * bottom: the bar (Pick from our events · Show it on our Event Hub · Open in
 * Event Hub Maker ↗) → the masthead "Our Love Story" with the couple's names,
 * three stats and the ONE theme line → the years strip / rail → the book, one
 * chapter at a time, each moment a page, each empty chapter a gentle prompt →
 * "On our Event Hub", the moments as the scenes guests will meet.
 *
 * 🎨 NO THEME PICKER (owner 2026-09-25: *"The do not have to pick since it the
 * theme is found on the Event Hub Maker"*). The book wears the event's theme
 * through `--ls-*` custom properties the page sets from the registry, and says
 * so in one line with a link to where the theme IS chosen.
 * `the-love-story-reaches-the-pixels.test.ts` holds that.
 *
 * Presentational: every fact arrives resolved from the page, so a test can
 * render it. The one action is passed in bound.
 */
export type LoveStoryBookProps = {
  eventId: string;
  names: string;
  partners: readonly string[];
  eyebrow: string;
  moments: readonly LoveStoryMoment[];
  since: number | null;
  daysToTheDay: number | null;
  themeName: string;
  motionLabel: string;
  makerHref: string;
  guestHref: string | null;
  ownsPro: boolean;
  storeShell: boolean;
  proHref: string;
  proPrice: string | null;
  /** `?pro=` from a refused write — the line is drawn at the top. */
  refused: 'stories' | 'photos' | null;
  /** Is the Love Story section itself off the Event Hub (widget mode hidden)? */
  sectionHidden: boolean;
  mediaUrls: Readonly<Record<string, string>>;
  action: (formData: FormData) => void | Promise<void>;
  /** The "Pick from our events" block, drawn by the page (it reads other events). */
  pickSlot: React.ReactNode;
};

const eye = 'font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[color:var(--ls-muted)]';

function chapterYears(moments: readonly LoveStoryMoment[]): string {
  const years = moments.map((m) => m.date?.y).filter((y): y is number => typeof y === 'number');
  if (years.length === 0) return '';
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

export function LoveStoryBook(p: LoveStoryBookProps) {
  const chapters = groupByChapter(p.moments);
  const scenes = loveStoryScenes({ moments: p.moments });
  const canAdd = mayAddMoment(p.moments.length, p.ownsPro);
  const sheetProps = {
    action: p.action,
    moments: p.moments,
    partners: p.partners,
    ownsPro: p.ownsPro,
    storeShell: p.storeShell,
    proHref: p.proHref,
    proPrice: p.proPrice,
    eventId: p.eventId,
    mediaUrls: p.mediaUrls,
  };
  const proLine = <LoveStoryProLine storeShell={p.storeShell} href={p.proHref} price={p.proPrice} />;
  const addButton = canAdd ? (
    <MomentSheet
      {...sheetProps}
      trigger={<AddMomentLabel />}
      triggerClassName="button-primary inline-flex items-center gap-1.5"
    />
  ) : (
    <div data-love-story-cap="reached">
      <p className="text-[13px] text-[color:var(--ls-muted)]">
        {FREE_MOMENT_CAP} of {FREE_MOMENT_CAP} free stories told
      </p>
      {proLine}
    </div>
  );
  let chapterNo = 0;

  return (
    <div className="-mx-4 bg-[color:var(--ls-canvas)] px-4 pb-24 text-[color:var(--ls-ink)] sm:-mx-6 sm:px-6 lg:rounded-md">
      {/* ── THE BAR ── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--ls-rule)] py-4">
        <div>
          <p className={eye}>{p.eyebrow}</p>
          <p className="font-pahina text-lg">Our Love Story</p>
        </div>
        <nav aria-label="Love Story actions" className="flex flex-wrap items-center gap-2 text-[13px]">
          <a href="#pick" className="rounded-full px-3 py-1.5 ring-1 ring-inset ring-[color:var(--ls-rule)] hover:bg-black/5">
            Pick from our events
          </a>
          <a href="#on-our-event-hub" className="rounded-full px-3 py-1.5 ring-1 ring-inset ring-[color:var(--ls-rule)] hover:bg-black/5">
            Show it on our Event Hub
          </a>
          <Link href={p.makerHref} className="rounded-full px-3 py-1.5 text-[color:var(--ls-heading)] hover:bg-black/5">
            Open in Event Hub Maker ↗
          </Link>
        </nav>
      </header>

      {/* ── THE MASTHEAD ── */}
      <section aria-labelledby="love-story-title" className="py-10 text-center sm:py-14">
        <h1 id="love-story-title" className="font-pahina text-5xl font-light tracking-tight sm:text-6xl">
          Our <i className="text-[color:var(--ls-heading)]">Love Story</i>
        </h1>
        <p className="mt-3 font-pahina text-xl text-[color:var(--ls-muted)]">{p.names}</p>
        <dl className="mx-auto mt-6 flex max-w-md justify-center gap-8">
          <div>
            <dd className="font-pahina text-3xl">{p.moments.length}</dd>
            <dt className={eye}>{p.moments.length === 1 ? 'moment' : 'moments'}</dt>
          </div>
          {p.since ? (
            <div>
              <dd className="font-pahina text-3xl">{p.since}</dd>
              <dt className={eye}>since</dt>
            </div>
          ) : null}
          {p.daysToTheDay !== null && p.daysToTheDay >= 0 ? (
            <div>
              <dd className="font-pahina text-3xl">{p.daysToTheDay}</dd>
              <dt className={eye}>days to the day</dt>
            </div>
          ) : null}
        </dl>
        {/* The ONE theme line — never a picker. */}
        <p data-love-story-theme-line className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-[14px]">
          <span className={eye}>Theme</span>
          <b className="font-medium">{p.themeName}</b>
          <span aria-hidden>·</span>
          <Link href={p.makerHref} className="text-[color:var(--ls-heading)] underline decoration-1 underline-offset-4">
            Change in Event Hub Maker ↗
          </Link>
          <InfoTip label="About the theme" align="center">
            Our Love Story wears the theme your Event Hub already has — its colours and motion. Themes are chosen in
            the Event Hub Maker, not here.
          </InfoTip>
        </p>
        {/* The prototype's phone dock, placed IN the page rather than pinned:
            the phone already stacks the moment strip and the nav at the foot,
            and a third pinned bar slid under them (harness, 2026-09-25). */}
        {p.refused ? null : <div className="mt-6 flex justify-center">{addButton}</div>}
        {p.refused ? (
          <div role="status" data-love-story-refused={p.refused} className="mx-auto mt-6 max-w-md">
            <p className="text-[14px]">
              {p.refused === 'photos'
                ? 'Your words are free — photos come with Event Hub Pro.'
                : `Your first ${FREE_MOMENT_CAP} stories are free.`}
            </p>
            <div className="flex justify-center">{proLine}</div>
          </div>
        ) : null}
      </section>

      {/* ── YEARS STRIP (phone / tablet) ── */}
      <nav aria-label="Chapters" className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto bg-[color:var(--ls-canvas)] px-4 py-2 lg:hidden">
        {chapters.map(({ chapter, moments }) => (
          <a
            key={chapter}
            href={`#ch-${chapter}`}
            className="shrink-0 rounded-full px-3 py-1 text-[13px] text-[color:var(--ls-muted)] ring-1 ring-inset ring-[color:var(--ls-rule)]"
          >
            {chapterYears(moments) || LOVE_STORY_CHAPTER_LABEL[chapter]}
          </a>
        ))}
      </nav>

      <div className="mx-auto flex max-w-5xl gap-10">
        {/* ── DESKTOP RAIL ── */}
        <aside aria-label="Timeline" className="sticky top-6 hidden h-fit w-48 shrink-0 lg:block">
          <ol className="space-y-3 border-l border-[color:var(--ls-rule)] pl-4">
            {chapters.map(({ chapter, moments }) => (
              <li key={chapter}>
                <a href={`#ch-${chapter}`} className="block">
                  <span className="font-pahina text-lg">{chapterYears(moments) || '—'}</span>
                  <small className={`block ${eye}`}>{LOVE_STORY_CHAPTER_LABEL[chapter]}</small>
                </a>
              </li>
            ))}
          </ol>
        </aside>

        {/* ── THE BOOK ── */}
        <div className="min-w-0 flex-1 space-y-16">
          {chapters.map(({ chapter, moments }) => {
            const numbered = chapter !== 'before';
            if (numbered) chapterNo += 1;
            return (
              <section key={chapter} id={`ch-${chapter}`} className="scroll-mt-16">
                <header className="mb-6">
                  <p className={`${eye} text-[color:var(--ls-heading)]`}>
                    {numbered ? `Chapter ${chapterNo}` : 'Before us · optional'}
                  </p>
                  <h2 className="mt-1 font-pahina text-3xl font-light sm:text-4xl">
                    {LOVE_STORY_CHAPTER_LABEL[chapter]}
                  </h2>
                </header>
                {moments.length === 0 ? (
                  <p className="border-l-2 border-[color:var(--ls-rule)] pl-4 font-pahina text-lg italic text-[color:var(--ls-muted)]">
                    {LOVE_STORY_CHAPTER_PROMPT[chapter]}
                  </p>
                ) : (
                  <ol className="space-y-10">
                    {moments.map((m) => (
                      <li key={m.id} id={`moment-${m.id}`} data-moment={m.id} className="scroll-mt-20">
                        <article className={m.hidden ? 'opacity-60' : undefined}>
                          {(m.media ?? []).length > 0 ? (
                            <div className="mb-4 grid grid-cols-2 gap-2">
                              {(m.media ?? []).map((ref) =>
                                p.mediaUrls[ref] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={ref}
                                    src={p.mediaUrls[ref]}
                                    alt=""
                                    className="aspect-[4/5] w-full rounded-md object-cover shadow-md"
                                  />
                                ) : null,
                              )}
                            </div>
                          ) : null}
                          <p className="flex flex-wrap items-baseline gap-x-3">
                            <b className="font-pahina text-lg font-medium">{formatMomentDate(m.date) || 'Undated'}</b>
                            {m.place ? <span className="text-[14px] text-[color:var(--ls-muted)]">{m.place}</span> : null}
                          </p>
                          <p className="mt-2 max-w-prose whitespace-pre-line font-pahina text-2xl font-light leading-snug">
                            {m.line}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[color:var(--ls-muted)]">
                            {m.added_by ? <span>Added by {m.added_by}</span> : null}
                            {(m.media ?? []).length === 0 ? <span>words only</span> : null}
                            {m.hidden ? <span>Off the Event Hub</span> : null}
                            <MomentSheet
                              {...sheetProps}
                              moment={m}
                              trigger={
                                <>
                                  <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
                                </>
                              }
                              triggerClassName="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-black/5"
                            />
                            <form action={p.action}>
                              <HubSavesImmediately />
                              <input type="hidden" name="intent" value="arrange" />
                              <input type="hidden" name="id" value={m.id} />
                              {m.hidden ? null : <input type="hidden" name="hidden" value="on" />}
                              <button type="submit" className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-black/5">
                                {m.hidden ? (
                                  <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : (
                                  <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                                )}
                                {m.hidden ? 'Show on the Event Hub' : 'Keep off the Event Hub'}
                              </button>
                            </form>
                            <form action={p.action}>
                              <HubSavesImmediately />
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={m.id} />
                              <button type="submit" className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-black/5">
                                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Remove
                              </button>
                            </form>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--ls-rule)] pt-6">
            <p className="text-[14px] text-[color:var(--ls-muted)]">
              {p.ownsPro
                ? 'Add as many moments as you like, with your photos.'
                : `Up to ${FREE_MOMENT_CAP} stories, in your words, are free.`}
            </p>
            {addButton}
          </div>

          {p.pickSlot}

          {/* ── ON OUR EVENT HUB — the moments as scenes ── */}
          <section id="on-our-event-hub" aria-labelledby="on-hub-title" className="scroll-mt-16 border-t border-[color:var(--ls-rule)] pt-10">
            <p className={eye}>Your moments, as scenes</p>
            <h2 id="on-hub-title" className="mt-1 font-pahina text-3xl font-light">
              On our <i className="text-[color:var(--ls-heading)]">Event Hub</i>
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--ls-muted)]">
              {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} from {p.moments.length}{' '}
              {p.moments.length === 1 ? 'moment' : 'moments'} · on the Invitation · Theme {p.themeName} · Motion{' '}
              {p.motionLabel}
            </p>
            {p.sectionHidden ? (
              <p role="status" className="mt-3 text-[14px]">
                Your Love Story section is switched off on the Event Hub —{' '}
                <Link href={p.makerHref} className="text-[color:var(--ls-heading)] underline underline-offset-4">
                  turn it on in the Event Hub Maker
                </Link>
                .
              </p>
            ) : null}
            <ol className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {scenes.map((s, i) => (
                <li key={s.id} data-scene={s.id} className="w-56 shrink-0">
                  <div className="flex aspect-[4/5] flex-col justify-end bg-[color:var(--ls-surface)] p-4 shadow-md">
                    <p className={eye}>
                      {s.when ? `${s.when} · ` : ''}
                      {s.chapterLabel}
                    </p>
                    <p className="mt-2 line-clamp-5 font-pahina text-lg leading-snug">{s.line}</p>
                  </div>
                  <p className="mt-2 text-[12px] text-[color:var(--ls-muted)]">
                    Scene {i + 1} · {s.media.length ? 'photo + words' : 'words only'}
                  </p>
                </li>
              ))}
              {scenes.length === 0 ? (
                <li className="text-[14px] text-[color:var(--ls-muted)]">A scene appears here the moment you add one.</li>
              ) : null}
            </ol>
            {p.guestHref ? (
              <p className="mt-4">
                <Link href={p.guestHref} className="text-[14px] text-[color:var(--ls-heading)] underline underline-offset-4">
                  See it on your Invitation ↗
                </Link>
              </p>
            ) : null}
          </section>
        </div>
      </div>

    </div>
  );
}
