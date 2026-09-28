// ============================================================================
// POST EVENT SCENES, EACH IN ITS STYLE — Front Page · Statistics · Schedule ·
// Gallery · Thank You (slice 1 of "EVERY STYLE OF EVERY SCENE SHIPS").
// ============================================================================
//
// Owner, 2026-09-29, on `prototypes/post_event_scenes_styles_2026-09-29.html`:
// *"those are all designs that we they can pick from. all should work. and they
// pick since we already have the designs"*. Every style below is translated
// from that file's phone frames (375 px first) — the class names in the notes
// are the prototype's, so the next reader can open it beside this.
//
// ── WHAT THESE ARE, AND ARE NOT ─────────────────────────────────────────────
// Presentational server components. Every value they draw arrives ALREADY
// through the story's two fences — `storyAudienceAdmits` and
// `redactStoryLayers` (`editorial-content.tsx`) — so nothing here asks "may
// they see it?" a second time; they only choose how to lay out what is allowed.
// No data read, no `server-only`, no hooks.
//
// ── TAP A PART ──────────────────────────────────────────────────────────────
// Each scene's small label, heading and words are its three PARTS — the same
// three every Event Hub scene has, found by the SAME selectors
// (`HUB_SCENE_ELEMENT_SELECTOR`: `.pahina-eyebrow` · `h1–h3` · `p`). So the
// couple's own font · size · colour for a part is the shipped scoped `<style>`
// (`hubElementSceneCss`), placed straight after the scene, and the Maker's
// bridge stamps and restyles these parts exactly as it does any section's.
// Text that is NOT one of the three (a micro-label under a number) is a `span`
// or a `div`, never a `p`, so a style for "Words" lands on words only.
//
// 🔒 NEVER AN EMPTY BOX. A scene with nothing in it is not drawn for a guest.
// Only the couple, in the Maker's canvas and its whole-stage preview, meets the
// scene's placeholder — its own layout, with the line that says what fills it.

import type { ReactElement, ReactNode } from 'react';
import type { DayChapter } from './data';
import type { PostEventStyleId } from '@/lib/post-event-styles';
import { postEventElementScope } from '@/lib/post-event-styles';

export type PeWords = Partial<Record<'label' | 'heading' | 'body', string>>;

/** The couple's own words for a part, or the words written from the day. */
const say = (words: PeWords, part: keyof PeWords, fallback: string): string => words[part] ?? fallback;

const EYEBROW = 'pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-700';
const EYEBROW_ON_PHOTO = 'pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-cream/90';
const MICRO = 'font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/60';

const fmt = (n: number) => n.toLocaleString('en-PH');

/**
 * ONE SCENE ON THE PAGE — its box, and the couple's part styles right after it.
 * `data-post-event-look` is what the Maker's bridge reads to know this scene's
 * parts are tappable (the shipped blocks of other scenes are not, yet).
 */
export function PostEventSceneFrame({
  scene,
  style,
  css,
  id,
  className = '',
  children,
}: {
  scene: string;
  style: PostEventStyleId;
  /** `hubElementSceneCss(postEventElementScope(scene), elements)` — null when none. */
  css: string | null;
  id?: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <section
        id={id}
        data-post-event-look={scene}
        data-post-event-style={style}
        className={`relative scroll-mt-6 ${className}`}
      >
        {children}
      </section>
      {css ? (
        <style hidden data-hub-els={postEventElementScope(scene)}>
          {css}
        </style>
      ) : null}
    </>
  );
}

/** The couple-only line that says what fills a scene before it has anything. */
export function PeWaiting({ text }: { text: string }): ReactElement {
  return (
    <span data-post-event-waiting="" className="mt-4 block font-serif text-lg italic leading-snug text-ink/70">
      {text}
    </span>
  );
}

function Photo({ url, alt = '', className = '' }: { url: string | null; alt?: string; className?: string }): ReactElement {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} aria-hidden={alt ? undefined : true} className={`h-full w-full object-cover ${className}`} loading="lazy" decoding="async" />
  ) : (
    /* No photo yet: the theme's own warm ground — never a grey box. */
    <span aria-hidden className={`block h-full w-full bg-gradient-to-br from-terracotta/25 via-cream to-terracotta/40 ${className}`} />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   01 · FRONT PAGE
   ══════════════════════════════════════════════════════════════════════════ */

export type FrontPageFacts = {
  /** The names as the event is called (`displayName`). */
  names: string;
  /** Two named people who took vows (`EventWords.twoPeople`) — the "married" words. */
  vows: boolean;
  solemn: boolean;
  eventWord: string;
  dateLong: string | null;
  /** `18 · 12 · 2026` — the eyebrow's date, or null. */
  dateDots: string | null;
  venueName: string | null;
  venueCity: string | null;
  heroPhotoUrl: string | null;
  heroVideoUrl: string | null;
  /** The masthead's edition line (`mastheadEdition`). */
  edition: string;
  invited: number;
  saidYes: number;
  photos: number | null;
  chapters: number | null;
};

function frontMeta(f: FrontPageFacts): string {
  const bits: string[] = [];
  const where = [f.venueName, f.venueCity].filter(Boolean).join(', ');
  if (where) bits.push(where);
  if (f.saidYes > 0) bits.push(`${fmt(f.saidYes)} guests`);
  else if (f.invited > 0) bits.push(`${fmt(f.invited)} invited`);
  if (f.photos && f.photos > 0) bits.push(`${fmt(f.photos)} photos`);
  if (f.chapters && f.chapters > 0) bits.push(`${fmt(f.chapters)} ${f.chapters === 1 ? 'chapter' : 'chapters'}`);
  return bits.join(' · ');
}

/** The eyebrow a wedding, a wake and every other celebration each get — never "Are married" on a birthday. */
function frontKicker(f: FrontPageFacts): string {
  if (f.solemn) return 'In loving memory';
  if (f.vows) return 'Are married';
  return `The ${f.eventWord}`;
}

export function FrontPageScene({
  style,
  facts: f,
  words,
}: {
  style: PostEventStyleId;
  facts: FrontPageFacts;
  words: PeWords;
}): ReactElement {
  if (style === 'magazine') {
    /* .cover-mag — masthead, one photo, the names as the headline, a deck of three facts. */
    const who = f.saidYes > 0 ? `${fmt(f.saidYes)} said yes` : f.invited > 0 ? `${fmt(f.invited)} invited` : null;
    const where = [f.venueName, f.venueCity].filter(Boolean).join(', ') || null;
    return (
      <div className="flex flex-col pb-6">
        <div className="flex items-baseline justify-between border-b border-terracotta/50 pb-2 pt-2">
          <span className="font-mono text-xl font-semibold uppercase tracking-[0.2em] text-ink">Setnayan</span>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/60">{f.edition}</span>
        </div>
        <div className="relative -mx-4 mt-4 h-[330px] overflow-hidden sm:-mx-6 sm:h-[420px]">
          <Photo url={f.heroPhotoUrl} alt={`${f.names} — the cover`} />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/40" />
          <span className="absolute bottom-4 left-5 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cream">
            The {f.eventWord} issue
          </span>
        </div>
        <div className="pt-5">
          <p className={EYEBROW}>{say(words, 'label', frontKicker(f))}</p>
          <h1 className="mt-1 font-serif text-[3.1rem] leading-[0.98] text-ink sm:text-[4.5rem]">{say(words, 'heading', f.names)}</h1>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm text-ink">
            {f.dateLong ? (
              <div>
                <dt className={MICRO}>When</dt>
                <dd className="m-0 mt-0.5">{f.dateLong}</dd>
              </div>
            ) : null}
            {where ? (
              <div>
                <dt className={MICRO}>Where</dt>
                <dd className="m-0 mt-0.5">{where}</dd>
              </div>
            ) : null}
            {who ? (
              <div>
                <dt className={MICRO}>Who</dt>
                <dd className="m-0 mt-0.5">{who}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    );
  }
  if (style === 'card') {
    /* .cover-card — the card the guests know from the Save the Date, in the past tense. */
    const heading = f.solemn ? 'Remembered' : f.vows ? 'Were married' : `The ${f.eventWord}, remembered`;
    return (
      <div className="flex justify-center px-2 py-8">
        <div className="relative flex aspect-[5/7] w-full max-w-sm flex-col items-center rounded-md bg-cream px-6 py-7 text-center shadow-[0_30px_60px_-30px_rgba(30,34,41,0.55),0_2px_4px_rgba(30,34,41,0.06)]">
          <span aria-hidden className="pointer-events-none absolute inset-2.5 ring-1 ring-inset ring-terracotta/50" />
          <p className={EYEBROW}>{say(words, 'label', f.vows ? 'Together with their families' : f.eventWord)}</p>
          <span className="mt-2 font-script text-3xl leading-none text-terracotta-700">{f.names}</span>
          <span className="relative my-3 block w-full flex-1 overflow-hidden rounded-sm">
            <Photo url={f.heroPhotoUrl} alt={`${f.names} — the cover`} />
          </span>
          <h1 className="font-serif text-[2.1rem] leading-none text-ink">{say(words, 'heading', heading)}</h1>
          {f.dateLong ? <span className="mt-2 block text-sm text-ink/70">{f.dateLong}</span> : null}
          {f.venueName || f.venueCity ? (
            <span className="mt-3 block font-mono text-xs uppercase tracking-[0.22em] text-terracotta-700">
              {[f.venueName, f.venueCity].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  /* full-bleed · .cover-bleed — the hero fills the screen; the words sit low over a scrim. */
  const meta = frontMeta(f);
  return (
    <div className="relative -mx-4 min-h-[86svh] overflow-hidden bg-ink sm:-mx-6">
      {f.heroVideoUrl ? (
        <video
          src={f.heroVideoUrl}
          poster={f.heroPhotoUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0">
          <Photo url={f.heroPhotoUrl} alt={`${f.names} — the cover`} />
        </span>
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/25 via-transparent to-ink/75" />
      <div className="absolute inset-x-6 bottom-16 z-[1] text-cream">
        <p className={EYEBROW_ON_PHOTO}>{say(words, 'label', f.dateDots ? `Post Event · ${f.dateDots}` : 'Post Event')}</p>
        <span className="mt-2 block font-script text-4xl leading-none text-cream/90">the day after</span>
        <h1 className="mb-2.5 mt-1.5 font-serif text-[3.4rem] leading-[0.98] text-cream sm:text-[5rem]">{say(words, 'heading', f.names)}</h1>
        {meta || words.body ? <p className="m-0 text-[0.95rem] text-cream/85">{say(words, 'body', meta)}</p> : null}
      </div>
      <span aria-hidden className="absolute bottom-6 left-6 z-[1] font-mono text-xs uppercase tracking-[0.22em] text-cream/85">
        ▾ Read the day
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   03 · STATISTICS
   ══════════════════════════════════════════════════════════════════════════ */

export type StatisticsFacts = {
  invited: number;
  saidYes: number;
  /** replied / invited, 0–100 — null when nobody was invited. */
  repliedPct: number | null;
  /** Null = not counted yet (before the day). */
  photos: number | null;
  wishes: number;
  chapters: number | null;
  suppliers: number;
  names: string;
  dateLong: string | null;
  venue: string | null;
  eventWord: string;
  /** Before the day — the day's own counts read "counted after the day". */
  waiting: boolean;
};

type Figure = { n: number | null; label: string };

/** The figures a scene may show — a zero is not a number worth printing, and the day's counts wait for the day. */
function figures(f: StatisticsFacts): Figure[] {
  const out: Figure[] = [];
  if (f.waiting) {
    out.push({ n: null, label: 'photos · counted after the day' });
    out.push({ n: null, label: 'wishes · counted after the day' });
  } else {
    if (f.photos && f.photos > 0) out.push({ n: f.photos, label: f.photos === 1 ? 'photo' : 'photos' });
    if (f.wishes > 0) out.push({ n: f.wishes, label: f.wishes === 1 ? 'wish' : 'wishes' });
    if (f.chapters && f.chapters > 0) out.push({ n: f.chapters, label: f.chapters === 1 ? 'chapter' : 'chapters' });
  }
  if (f.suppliers > 0) out.push({ n: f.suppliers, label: f.suppliers === 1 ? 'supplier' : 'suppliers' });
  return out;
}

export function StatisticsScene({
  style,
  facts: f,
  words,
}: {
  style: PostEventStyleId;
  facts: StatisticsFacts;
  words: PeWords;
}): ReactElement {
  const figs = figures(f);
  const lead: Figure = f.saidYes > 0 ? { n: f.saidYes, label: `said yes, of ${fmt(f.invited)} invited` } : { n: f.invited, label: 'invited' };
  if (style === 'receipt') {
    /* .receipt — the day itemised like a till receipt. */
    const lines: Array<[string, number | null]> = [
      ['Invited', f.invited],
      ['Said yes', f.saidYes],
    ];
    if (!f.waiting) {
      if (f.chapters && f.chapters > 0) lines.push(['Chapters of the day', f.chapters]);
      if (f.photos && f.photos > 0) lines.push(['Photos taken by guests', f.photos]);
      if (f.wishes > 0) lines.push(['Wishes left', f.wishes]);
    } else {
      lines.push(['Photos taken by guests', null]);
    }
    if (f.suppliers > 0) lines.push(['Suppliers', f.suppliers]);
    return (
      <div className="flex min-h-[70svh] items-center py-8">
        <div className="relative -mx-1 w-full bg-cream px-5 pb-7 pt-6 shadow-[0_20px_40px_-24px_rgba(30,34,41,0.55)]">
          <div className="text-center">
            <p className={EYEBROW}>{say(words, 'label', f.venue ?? f.eventWord)}</p>
            <h2 className="my-1.5 font-serif text-[1.65rem] leading-tight text-ink">{say(words, 'heading', f.names)}</h2>
            {f.dateLong ? <span className={MICRO}>{f.dateLong}</span> : null}
          </div>
          <span aria-hidden className="my-3 block h-px bg-gradient-to-r from-terracotta/60 to-transparent" />
          <ul className="m-0 list-none p-0">
            {lines.map(([label, n]) => (
              <li key={label} className="flex items-baseline justify-between border-b border-dashed border-ink/20 py-1.5 text-base text-ink">
                <span>{label}</span>
                <span className="font-serif text-2xl font-semibold tabular-nums">{n === null ? '—' : fmt(n)}</span>
              </li>
            ))}
            <li className="mt-1.5 flex items-baseline justify-between border-t-[1.5px] border-ink pt-3 text-ink">
              <span className={EYEBROW}>Total</span>
              <span className="font-serif text-[2.1rem] font-semibold leading-none">one day</span>
            </li>
          </ul>
          <span className="mt-3.5 block text-center text-xs tracking-[0.06em] text-ink/60">THANK YOU FOR COMING · PLEASE COME AGAIN</span>
        </div>
      </div>
    );
  }
  if (style === 'infographic') {
    /* .infog — a track, a ring and dots; one comparison each. */
    const came = f.invited > 0 ? Math.round((f.saidYes / f.invited) * 1000) / 10 : null;
    const ring = f.repliedPct;
    return (
      <div className="flex min-h-[70svh] flex-col justify-center py-8">
        <p className={EYEBROW}>{say(words, 'label', 'By the numbers')}</p>
        <h2 className="mb-3 mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink">{say(words, 'heading', 'The day, measured')}</h2>
        <div className="flex flex-col gap-5">
          {came !== null ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
              <span className={MICRO}>Invited → said yes</span>
              <span className="font-serif text-[2.1rem] leading-none text-ink">
                {fmt(f.saidYes)} <span className="text-lg text-ink/60">/ {fmt(f.invited)}</span>
              </span>
              <span className="relative col-span-2 block h-1.5 overflow-hidden rounded-full bg-ink/10">
                <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-terracotta/60 to-terracotta" style={{ width: `${Math.min(100, came)}%` }} />
              </span>
            </div>
          ) : null}
          {ring !== null ? (
            <div className="grid grid-cols-[auto_1fr] items-center gap-4">
              <span
                className="grid h-[92px] w-[92px] place-items-center rounded-full"
                style={{ background: `conic-gradient(rgb(var(--color-terracotta)) 0 ${ring}%, rgb(var(--color-ink) / 0.08) 0)` }}
              >
                <span className="grid h-[70px] w-[70px] place-items-center rounded-full bg-cream font-serif text-2xl text-ink">{Math.round(ring)}%</span>
              </span>
              <span className="text-sm text-ink/70">of the {fmt(f.invited)} invited replied.</span>
            </div>
          ) : null}
          {figs.length > 0 ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
              <span className={MICRO}>{figs.map((x) => x.label.split(' · ')[0]).join(' · ')}</span>
              <span className="font-serif text-[2.1rem] leading-none text-ink">{figs.map((x) => (x.n === null ? '—' : fmt(x.n))).join(' · ')}</span>
              {f.chapters && f.chapters > 0 && !f.waiting ? (
                <span aria-hidden className="col-span-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(40, f.chapters) }, (_, i) => (
                    <span key={i} className="h-[11px] w-[11px] rounded-full bg-terracotta" />
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  /* big-numbers · .bignums — one figure leads; the rest step down. Numbers only. */
  return (
    <div className="flex min-h-[70svh] flex-col justify-center py-8">
      <p className={EYEBROW}>{say(words, 'label', 'By the numbers')}</p>
      <div className="mt-2.5 flex flex-col gap-5">
        <div className="flex items-baseline gap-3.5">
          <span className="font-serif text-[6.5rem] leading-[0.86] tracking-tight text-ink sm:text-[9rem]">{fmt(lead.n ?? 0)}</span>
          <span className={`${MICRO} max-w-[9rem]`}>{lead.label}</span>
        </div>
        {figs.map((x) => (
          <div key={x.label} className="flex items-baseline gap-3.5">
            <span className="font-serif text-[4.2rem] leading-[0.88] tracking-tight text-ink">{x.n === null ? '—' : fmt(x.n)}</span>
            <span className={MICRO}>{x.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   04 · SCHEDULE — one chapter per event-day block (= a Papic chapter)
   ══════════════════════════════════════════════════════════════════════════ */

/** "3:00 PM" from the chapter's own instant, in Manila; the kicker sentence when there is none. */
export function chapterClock(c: Pick<DayChapter, 'atIso' | 'time'>): { t: string; ap: string } | null {
  const ms = c.atIso ? Date.parse(c.atIso) : Number.NaN;
  if (Number.isFinite(ms)) {
    const s = new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
    const m = /^(\d{1,2}:\d{2})\s*([AP]M)$/i.exec(s.replace(/ /g, ' ').trim());
    if (m) return { t: m[1]!, ap: m[2]!.toUpperCase() };
  }
  return null;
}

const chapterName = (c: DayChapter, i: number) => c.title ?? c.time ?? `Chapter ${i + 1}`;
const mediaUrl = (m: DayChapter['media'][number] | undefined) => (m ? (m.type === 'clip' ? (m.posterUrl ?? null) : m.url) : null);

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

export function ScheduleScene({
  style,
  chapters,
  words,
  placeholder,
}: {
  style: PostEventStyleId;
  chapters: readonly DayChapter[];
  words: PeWords;
  /** The couple-only line before the chapters exist. */
  placeholder: string | null;
}): ReactElement {
  const label = say(words, 'label', 'As the day unfolded');
  if (chapters.length === 0) {
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        {placeholder ? <PeWaiting text={placeholder} /> : null}
      </div>
    );
  }
  if (style === 'timeline') {
    /* .sched — every block on one screen; time as the margin figure. */
    const count = COUNT_WORDS[chapters.length] ?? fmt(chapters.length);
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className="mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink">
          {say(words, 'heading', `${count} ${chapters.length === 1 ? 'chapter' : 'chapters'}`)}
        </h2>
        <ol className="m-0 mt-1.5 list-none p-0">
          {chapters.map((c, i) => {
            const clock = chapterClock(c);
            const strip = c.media.slice(0, 3).map(mediaUrl).filter((u): u is string => Boolean(u));
            return (
              <li key={c.leadId ?? i} className="grid grid-cols-[78px_1fr] gap-x-3.5 py-3">
                <span className="text-right font-serif text-2xl leading-none text-terracotta-700">
                  {clock ? clock.t : '—'}
                  {clock ? <span className="mt-1 block font-mono text-xs tracking-[0.18em] text-ink/60">{clock.ap}</span> : null}
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 font-serif text-[1.4rem] leading-tight text-ink">{chapterName(c, i)}</h3>
                  {strip.length > 0 ? (
                    <span className="mt-2 flex gap-1.5">
                      {strip.map((u, k) => (
                        <span key={k} className="block h-[70px] flex-1 overflow-hidden rounded-sm">
                          <Photo url={u} />
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  if (style === 'clock-face') {
    /* .clock — the chapters placed around a dial by their time; the span is the hero number. */
    const times = chapters.map((c) => (c.atIso ? Date.parse(c.atIso) : Number.NaN));
    const known = times.filter((t) => Number.isFinite(t));
    const first = known.length ? Math.min(...known) : Number.NaN;
    const last = known.length ? Math.max(...known) : Number.NaN;
    const span = Number.isFinite(first) && last > first ? last - first : 0;
    const hours = span > 0 ? Math.round((span / 3_600_000) * 2) / 2 : null;
    const hoursLabel = hours === null ? null : Number.isInteger(hours) ? String(hours) : `${Math.floor(hours)}½`;
    const firstClock = chapterClock(chapters[0]!);
    const lastClock = chapterClock(chapters[chapters.length - 1]!);
    return (
      <div className="flex flex-col items-center py-8">
        <p className={`${EYEBROW} text-center`}>{label}</p>
        <div className="relative mt-4 h-[300px] w-[300px] rounded-full shadow-[inset_0_0_0_1px_rgb(var(--color-terracotta)/0.5)] sm:h-[360px] sm:w-[360px]">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            {firstClock && lastClock ? (
              <span className={`${MICRO} block`}>
                {firstClock.t} {firstClock.ap} → {lastClock.t} {lastClock.ap}
              </span>
            ) : null}
            {hoursLabel ? (
              <>
                <span className="block font-serif text-[2.2rem] leading-none text-ink">{hoursLabel}</span>
                <span className={`${MICRO} block`}>hours</span>
              </>
            ) : (
              <span className="block font-serif text-[2.2rem] leading-none text-ink">{chapters.length}</span>
            )}
          </div>
          {chapters.map((c, i) => {
            const t = times[i]!;
            // Placed by their time around the dial (−90° = the top); evenly when a time is unknown.
            const frac = span > 0 && Number.isFinite(t) ? (t - first) / span : chapters.length > 1 ? i / (chapters.length - 1) : 0;
            const angle = (-90 + frac * 300) * (Math.PI / 180);
            const left = 50 + 46 * Math.cos(angle);
            const top = 50 + 46 * Math.sin(angle);
            const clock = chapterClock(c);
            return (
              <span
                key={c.leadId ?? i}
                className="absolute h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <span className="block h-full w-full overflow-hidden rounded-full shadow-[0_8px_20px_-10px_rgba(30,34,41,0.5)]">
                  <Photo url={mediaUrl(c.media[0])} />
                </span>
                {clock ? (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-serif text-sm font-semibold text-terracotta-700">{clock.t}</span>
                ) : null}
                <span className="absolute left-1/2 top-[56px] w-24 -translate-x-1/2 truncate text-center font-mono text-xs uppercase tracking-[0.1em] text-ink/60">
                  {chapterName(c, i)}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  /* one-per-screen · .chap — one chapter per screen; a full frame, its line, more photos; the next announced below. */
  return (
    <div className="py-4">
      <p className={EYEBROW}>{label}</p>
      {chapters.map((c, i) => {
        const clock = chapterClock(c);
        const lead = c.media[0];
        const next = chapters[i + 1];
        const nextClock = next ? chapterClock(next) : null;
        return (
          <article key={c.leadId ?? i} className="flex min-h-[80svh] flex-col py-4">
            <div className="relative -mx-5 h-[420px] overflow-hidden sm:-mx-10 sm:h-[560px]">
              {lead?.type === 'clip' ? (
                <video src={lead.url} poster={lead.posterUrl ?? undefined} autoPlay muted loop playsInline aria-hidden className="h-full w-full object-cover" />
              ) : (
                <Photo url={mediaUrl(lead)} alt={`${chapterName(c, i)} — a moment from the day`} />
              )}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/5 via-transparent to-ink/60" />
              <div className="absolute inset-x-5 bottom-4 z-[1] text-cream">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-cream/90">
                  Chapter {i + 1} of {chapters.length}
                  {clock ? ` · ${clock.t} ${clock.ap}` : ''}
                </span>
                <h3 className="mt-1 font-serif text-[2.6rem] leading-none text-cream">{chapterName(c, i)}</h3>
              </div>
            </div>
            {c.writeUp ? <p className="mt-3 font-serif text-[1.05rem] italic text-ink/85">{c.writeUp}</p> : null}
            {c.media.length > 1 ? (
              <span className="mt-3 flex gap-1.5">
                {c.media.slice(1, 5).map((m, k) => (
                  <span key={k} className="block h-16 flex-1 overflow-hidden rounded-sm">
                    <Photo url={mediaUrl(m)} />
                  </span>
                ))}
              </span>
            ) : null}
            {next ? (
              <span className={`${MICRO} mt-5 block text-center`}>
                ▾ Next{nextClock ? ` · ${nextClock.t} ${nextClock.ap}` : ''} · {chapterName(next, i + 1)}
              </span>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   05 · GALLERY — the preview in the flow; the whole gallery opens up
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * What the gallery shows IN THE FLOW, in its style. It sits inside the
 * open-up's button, so nothing in it may be interactive.
 */
export function GalleryPreview({
  style,
  photos,
  captures,
  total,
  names,
  words,
}: {
  style: PostEventStyleId;
  photos: readonly string[];
  /** The same captures with their shutter time — optional (uploads carry none). */
  captures?: ReadonlyArray<{ url: string; atMs: number | null }>;
  total: number;
  names: string;
  words: PeWords;
}): ReactElement {
  const head = (
    <>
      <p className={EYEBROW}>{say(words, 'label', 'From the day')}</p>
      <h2 className="mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink">
        {say(words, 'heading', style === 'film-strip' ? `One roll, ${fmt(total)} ${total === 1 ? 'frame' : 'frames'}` : `${fmt(total)} ${total === 1 ? 'photo' : 'photos'}`)}
      </h2>
    </>
  );
  const clockOf = (ms: number | null) =>
    ms === null
      ? null
      : new Date(ms)
          .toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
          .replace(/ /g, ' ');
  if (style === 'mosaic') {
    /* .mosaic — wide and tall tiles break the grid. */
    const ten = photos.slice(0, 10);
    const shape = (i: number) => (i === 0 ? 'col-span-2 row-span-2' : i === 4 ? 'col-span-2' : i === 5 ? 'row-span-2' : '');
    return (
      <div>
        {head}
        <span className="mt-3.5 grid auto-rows-[104px] grid-cols-3 gap-1.5">
          {ten.map((u, i) => (
            <span key={`${i}-${u.slice(-16)}`} className={`block overflow-hidden rounded-sm ${shape(i)}`}>
              <Photo url={u} alt={i === 0 ? `${names} — a moment from the day` : ''} />
            </span>
          ))}
        </span>
      </div>
    );
  }
  if (style === 'film-strip') {
    /* .film .reel — sprocket holes, one frame at a time, frame number and minute. */
    const frames = (captures && captures.length > 0 ? captures.slice(0, 8) : photos.slice(0, 8).map((url) => ({ url, atMs: null }))).map((c, i) => ({
      ...c,
      n: String(i + 1).padStart(4, '0'),
      clock: clockOf(c.atMs),
    }));
    return (
      <div>
        {head}
        <span className="relative -mx-5 mt-4 block bg-ink px-5 py-3.5 sm:-mx-10">
          <span aria-hidden className="absolute inset-x-0 top-0.5 block h-2.5 bg-[radial-gradient(circle,rgb(var(--color-cream))_0_3px,transparent_3.5px)] bg-[length:16px_10px]" />
          <span className="flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {frames.map((f, i) => (
              <span key={`${f.n}`} className="relative block h-[300px] w-[240px] shrink-0 snap-start overflow-hidden rounded-sm">
                <Photo url={f.url} alt={i === 0 ? `${names} — a frame from the day` : ''} />
                <span className="absolute bottom-2 left-2 font-mono text-xs tracking-[0.2em] text-cream">
                  {f.n}
                  {f.clock ? ` · ${f.clock}` : ''}
                </span>
              </span>
            ))}
          </span>
          <span aria-hidden className="absolute inset-x-0 bottom-0.5 block h-2.5 bg-[radial-gradient(circle,rgb(var(--color-cream))_0_3px,transparent_3.5px)] bg-[length:16px_10px]" />
        </span>
      </div>
    );
  }
  /* grid · .grid2 — two columns, filed by the time they were taken. */
  const eight = captures && captures.length > 0 ? captures.slice(0, 8) : photos.slice(0, 8).map((url) => ({ url, atMs: null }));
  const rows: Array<{ heading: string | null; urls: string[] }> = [];
  for (const c of eight) {
    const h = c.atMs === null ? null : clockOf(Math.floor(c.atMs / 3_600_000) * 3_600_000);
    const last = rows[rows.length - 1];
    if (last && last.heading === h) last.urls.push(c.url);
    else rows.push({ heading: h, urls: [c.url] });
  }
  return (
    <div>
      {head}
      <span className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {rows.map((r, ri) => [
          r.heading ? (
            <span key={`h-${ri}`} className="col-span-full mb-0.5 mt-2 flex items-baseline gap-2.5">
              <span className="font-serif text-xl text-ink">{r.heading}</span>
            </span>
          ) : null,
          ...r.urls.map((u, k) => (
            <span key={`${ri}-${k}`} className="block aspect-square overflow-hidden rounded-sm">
              <Photo url={u} alt={ri === 0 && k === 0 ? `${names} — a moment from the day` : ''} />
            </span>
          )),
        ])}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   13 · THANK YOU — the couple's own closing words
   ══════════════════════════════════════════════════════════════════════════ */

export type ThankYouFacts = {
  /** The closing words — their special message, or their own words for this scene. */
  message: string | null;
  names: string;
  from: string;
  photoUrl: string | null;
  saidYes: number;
  photos: number | null;
  wishes: number;
};

export function ThankYouScene({
  style,
  facts: f,
  words,
  placeholder,
}: {
  style: PostEventStyleId;
  facts: ThankYouFacts;
  words: PeWords;
  placeholder: string | null;
}): ReactElement {
  const message = words.body ?? f.message;
  const label = say(words, 'label', f.from);
  if (style === 'words-only') {
    /* .wordsonly — two big words, a script line, the numbers once. Nothing else. */
    const bits = [
      f.saidYes > 0 ? `${fmt(f.saidYes)} of you` : null,
      f.photos && f.photos > 0 ? `${fmt(f.photos)} photos` : null,
      f.wishes > 0 ? `${fmt(f.wishes)} ${f.wishes === 1 ? 'wish' : 'wishes'}` : null,
    ].filter(Boolean);
    return (
      <div className="flex min-h-[70svh] flex-col justify-center py-8 text-center">
        <p className={EYEBROW}>{label}</p>
        <h2 className="mt-5 font-serif text-[4rem] leading-[0.95] text-ink">{say(words, 'heading', 'Thank you.')}</h2>
        <span className="mt-5 block font-script text-[2.6rem] leading-none text-terracotta-700">for coming</span>
        {bits.length > 0 ? <span className="mt-7 block text-base text-ink/70">{bits.join('. ')}.</span> : null}
        <span aria-hidden className="mx-auto mt-7 block text-terracotta">❦</span>
        <span className="mt-3 block text-sm text-ink/70">{f.names}</span>
      </div>
    );
  }
  if (style === 'photo-words') {
    /* .pwords — the photo on top, a shorter letter under it. */
    return (
      <div className="flex flex-col pb-8">
        <span className="relative -mx-5 block h-[380px] overflow-hidden sm:-mx-10 sm:h-[480px]">
          <Photo url={f.photoUrl} alt={`${f.names} — the send-off`} />
        </span>
        <div className="pt-6">
          <p className={EYEBROW}>{label}</p>
          <h2 className="mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink">{say(words, 'heading', 'Salamat.')}</h2>
          {message ? <p className="mt-3 whitespace-pre-line text-[1.05rem] leading-relaxed text-ink/90">{message}</p> : placeholder ? <PeWaiting text={placeholder} /> : null}
          <span className="mt-4 block font-script text-4xl leading-none text-terracotta-700">{f.names}</span>
        </div>
      </div>
    );
  }
  /* letter · .ty — the letter: a drop cap, their words, the signature. */
  return (
    <div className="flex min-h-[60svh] flex-col justify-center px-1.5 py-8">
      <p className={EYEBROW}>{label}</p>
      {message ? (
        <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-ink first-letter:float-left first-letter:pr-2 first-letter:pt-1.5 first-letter:font-serif first-letter:text-[3.75rem] first-letter:leading-[0.8] first-letter:text-terracotta-700">
          {message}
        </p>
      ) : placeholder ? (
        <PeWaiting text={placeholder} />
      ) : null}
      <span className="mt-6 block font-script text-[2.4rem] leading-none text-terracotta-700">{f.names}</span>
    </div>
  );
}
