'use client';

import { useEffect, useRef, useState } from 'react';

import { momentReadLine, momentVoiceLines, type LoveStoryScene, type MomentVoiceSlot } from '@/lib/love-story-moments';
import { formatCount } from '@/lib/format-number';

import { WHOLE_PHOTO_CLASS } from '@/lib/whole-photo';

import { GlimpseRail } from './glimpse-rail';

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
  partners = [],
}: {
  scenes: readonly LoveStoryScene[];
  mediaUrls?: Readonly<Record<string, string>>;
  /** 🗣 The partners in slot order — a moment told in voices reads "Name: words", one per voice (`momentReadLine`). */
  partners?: readonly string[];
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
                  on ? 'text-ink' : 'text-ink/70 hover:text-ink'
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
                {/* The chapter under its date — never twice when the date is the chapter. */}
                {s.when ? <span className="font-sans text-xs uppercase tracking-[0.12em]">{s.chapterLabel}</span> : null}
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
        {/* 📖 The moment's title (owner 2026-10-07), when it has one. */}
        {current.title ? <h3 data-love-title="" className="mt-2 font-pahina text-2xl leading-tight text-ink">{current.title}</h3> : null}
        <p className="mt-2 whitespace-pre-line font-pahina text-xl font-light leading-snug text-ink">{momentReadLine(current, partners)}</p>
        {current.place ? <p className="mt-1 text-sm leading-relaxed text-ink/65">{current.place}</p> : null}
      </article>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   🗣 TWO VOICES — CONVERSATION · TWO-LANE TIMELINE · SWIPE CARDS
   ══════════════════════════════════════════════════════════════════════════
   Owner, 2026-10-17 (DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES"), verbatim: *"Approved — build the two-voices
   Love Story: Conversation as the default look, Timeline and Swipe cards as Pro looks in Style."* The contract is the
   prototype `prototypes/love_story_two_voices_2026-10-17.html`.

   EVERY LOOK HOLDS THE SAME RULE (`momentVoiceLines`, `a-moment-shows-only-the-voices-that-wrote.test.ts`): only the
   voices that were written show, each under its partner's own first name (slot a = the first name, b = the second);
   a moment nobody wrote a voice for shows its line told together, unchanged. The voices are content and FREE.

   COLOUR: one each, from the event's own palette — the first voice the gild, the second the ink. No frame around a
   voice (a frame is only for something pressed: Read more, a dot).

   ENTRANCE (Animate ◆ Pro, owner 2026-10-16): each look's own choreography — bubbles landing a beat apart, the line
   drawing down with the words sliding in from their sides, a card's photo developing — plays ONLY when the scene has
   an entrance of its own (`entrance`, an Animate choice that is already Pro at ✓ Apply), only once it is on screen,
   and never under reduced motion. At rest the page is complete. */

/** A voice longer than this opens clamped, with Read more (prototype: 220 in a bubble or a card, 170 in a lane). */
const LONG_VOICE = 220;
const LONG_LANE = 170;

/** The look's own entrance, scoped to `[data-love-entrance][data-love-play]` (set once it is seen). */
const ENTRANCE_CSS = `
@keyframes love-in{from{opacity:0}}
@keyframes love-rise{from{opacity:0;transform:translateY(10px)}}
@keyframes love-left{from{opacity:0;transform:translateX(-14px)}}
@keyframes love-right{from{opacity:0;transform:translateX(14px)}}
@keyframes love-draw{from{transform:scaleY(0)}}
@keyframes love-develop{from{filter:sepia(1) saturate(.5) contrast(.9) brightness(.85);opacity:0}}
[data-love-play] [data-love-fx="in"]{animation:love-in 1.1s cubic-bezier(.22,.61,.36,1) both;animation-delay:var(--love-at,0s)}
[data-love-play] [data-love-fx="rise"]{animation:love-rise .7s cubic-bezier(.22,.61,.36,1) both;animation-delay:var(--love-at,0s)}
[data-love-play] [data-love-fx="left"]{animation:love-left .8s cubic-bezier(.22,.61,.36,1) both;animation-delay:var(--love-at,0s)}
[data-love-play] [data-love-fx="right"]{animation:love-right .8s cubic-bezier(.22,.61,.36,1) both;animation-delay:var(--love-at,0s)}
[data-love-play] [data-love-fx="draw"]{animation:love-draw 1.6s cubic-bezier(.22,.61,.36,1) both;transform-origin:top}
[data-love-play] [data-love-fx="develop"]{animation:love-develop 1.1s ease-out both}
@media (prefers-reduced-motion:reduce){[data-love-play] [data-love-fx]{animation:none!important}}
`;

/** Plays the look's entrance once its root is first on screen — only when the scene has one (`entrance`). */
function useEntrance(entrance: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!entrance || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [entrance]);
  return {
    ref,
    attrs: entrance ? { 'data-love-entrance': '', ...(play ? { 'data-love-play': '' } : {}) } : {},
    style: entrance ? <style>{ENTRANCE_CSS}</style> : null,
  };
}

/** The monogram dot's initial — decoration (aria-hidden); the name beside it is the words. */
const INITIAL_SIZE = 'text-[9.5px]'; // legibility-ok — aria-hidden initial in an 18 px dot (prototype `.who i`)

/** The partner's monogram dot and first name — the voice's colour. */
function Who({ slot, name, flip = false }: { slot: MomentVoiceSlot; name: string; flip?: boolean }) {
  if (!name) return null;
  const tone = slot === 'a' ? 'text-gild' : 'text-ink';
  const dot = slot === 'a' ? 'bg-gild' : 'bg-ink';
  return (
    <p className={`inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] ${tone} ${flip ? 'flex-row-reverse' : ''}`}>
      <span aria-hidden className={`grid h-[18px] w-[18px] place-items-center rounded-full font-sans ${INITIAL_SIZE} font-semibold tracking-normal text-cream ${dot}`}>
        {name.charAt(0).toUpperCase()}
      </span>
      {name}
    </p>
  );
}

/** One voice's words — clamped with Read more when long (a frame only on the button, which is pressed). */
function Said({ words, long, lines, slot, alignEnd = false }: { words: string; long: number; lines: 4 | 6; slot: MomentVoiceSlot; alignEnd?: boolean }) {
  const [open, setOpen] = useState(false);
  const clamp = words.length > long;
  return (
    <>
      <p
        {...{ [`data-love-voice-${slot}`]: '' }}
        className={`mt-1 whitespace-pre-line font-pahina text-[17px] font-light leading-snug text-ink ${clamp && !open ? (lines === 4 ? 'line-clamp-4' : 'line-clamp-6') : ''}`}
      >
        {words}
      </p>
      {clamp ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`mt-2 inline-flex min-h-[32px] items-center rounded-full border border-ink/15 px-3 font-sans text-xs font-medium text-ink ${alignEnd ? 'ml-auto' : ''}`}
        >
          {open ? 'Read less' : 'Read more'}
        </button>
      ) : null}
    </>
  );
}

/** The date chip: "2018 · How we met" — its own date, then its chapter. */
const whenOf = (s: LoveStoryScene) => `${s.when ? `${s.when} · ` : ''}${s.chapterLabel}`;

/** The moment's date, in the guest tree's PROTECTED 0.66rem gild eyebrow — written ONCE for all
 *  three looks (as `RoleLabel` is for the venue looks), so the protected-eyebrow count gains one
 *  source line, not three. `lead` is the look's own placement classes, prepended unchanged. */
function MomentWhen({ s, fx, at, lead }: { s: LoveStoryScene; fx: 'in' | undefined; at?: string; lead?: string }) {
  return (
    <p data-love-when="" data-love-fx={fx} style={at ? ({ '--love-at': at } as React.CSSProperties) : undefined} className={`${lead ? `${lead} ` : ''}font-mono text-[0.66rem] uppercase tracking-[0.26em] text-gild`}>
      {whenOf(s)}
    </p>
  );
}
const photosOf = (s: LoveStoryScene, mediaUrls?: Readonly<Record<string, string>>) =>
  s.media.map((ref) => mediaUrls?.[ref]).filter((u): u is string => Boolean(u));

/**
 * 🎞 A MOMENT'S PHOTOS, AS GLIMPSE (owner 2026-10-17, DECISION_LOG "A LOVE STORY MOMENT'S PHOTOS SHOW AS GLIMPSE"),
 * verbatim: *"Use the Glimpse swipe for a moment's photos: one big, the next peeking, swipe or auto-scroll; one photo
 * stays as now."* A moment holding two or more photos draws them at its photo slot as the Photos scene's OWN rail
 * (`GlimpseRail` — still until the guest swipes (owner 2026-10-24: *"there shouldnt be the auto scrolling photos"*),
 * tap → the shipped full-screen photo, the moment's title under it); never a second carousel. ONE photo is not this: each look keeps its own `<img>`, unchanged.
 *
 * The rail is sized from the moment, not the window: the box is a size container and `width` is in its `cqw`, so the
 * centre card sits where the look's single photo sits and the neighbours peek inside the moment. The look's own
 * entrance (`data-love-fx`) rides on the box, so the whole rail arrives as the one photo did.
 */
function MomentGlimpse({
  photos,
  width,
  label,
  fx,
  at,
  className = '',
}: {
  photos: readonly string[];
  width: string;
  label: string;
  fx?: 'in' | 'develop';
  at?: string;
  className?: string;
}) {
  return (
    <div
      data-love-photos={photos.length}
      data-love-fx={fx}
      style={at ? ({ '--love-at': at } as React.CSSProperties) : undefined}
      className={`w-full min-w-0 [container-type:inline-size] ${className}`}
    >
      <GlimpseRail urls={photos} width={width} label={label} caption={label} whole />
    </div>
  );
}

/**
 * 🖼 A MOMENT'S ONE PHOTO, WHOLE (owner 2026-10-17, on live "The Proposal", a man cut off at the photo's edge: *"there
 * might be a better way to present instead if it looking cropped"*). The look's place for the photo is reserved as
 * before (its width and shape, at most 70 % of the screen's height), so the words below never jump while it loads;
 * the photo is drawn WHOLE inside it at its own shape, centred, never cropped, with the Glimpse cards' corners and
 * lift — one photo and several read as one family. A moment's photos carry no stored crop or focal point (`media` is
 * refs only), so there is nothing to honour but the whole picture.
 */
function MomentPhoto({ src, place, fx, at }: { src: string; place: string; fx?: 'in' | 'develop'; at?: string }) {
  return (
    <span data-love-photo="" className={`relative block ${place}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" data-love-fx={fx} style={at ? ({ '--love-at': at } as React.CSSProperties) : undefined} className={WHOLE_PHOTO_CLASS} />
    </span>
  );
}

/** The centre card's width in each look — where that look's one photo sits (Conversation 72 %, the lane 150 px). */
const GLIMPSE_IN_CONVERSATION = '72cqw';
const GLIMPSE_IN_TIMELINE = '46cqw';
const GLIMPSE_IN_CARD = '56cqw';

type VoicesLookProps = {
  scenes: readonly LoveStoryScene[];
  partners: readonly string[];
  mediaUrls?: Readonly<Record<string, string>>;
  /** The scene has an entrance of its own (Animate, ◆ Pro) — only then does the look's choreography play. */
  entrance?: boolean;
  /** The Love Story tab's anchor — the look the page draws carries it (`SITE_MENU_ANCHORS.story`). */
  anchorId?: string;
};

/**
 * 🗣 CONVERSATION (free, the default) — the story as a thread: the date chip, the title and the photo centred, then
 * the first partner's bubble on the left and the second's on the right, oldest first. No voice: the line, centred, in
 * italics, as the narrator.
 */
export function LoveStoryConversation({ scenes, partners, mediaUrls, entrance = false, anchorId }: VoicesLookProps) {
  const fx = useEntrance(entrance);
  if (scenes.length === 0) return null;
  return (
    <section
      ref={fx.ref}
      id={anchorId}
      className="scroll-mt-6 space-y-7"
      data-scene-style="conversation"
      data-love-story-scenes={scenes.length}
      {...fx.attrs}
    >
      {fx.style}
      <p className="pahina-eyebrow">
        <span>Our love story</span>
      </p>
      {scenes.map((s) => {
        const voices = momentVoiceLines(s, partners);
        const photos = photosOf(s, mediaUrls);
        const photo = photos[0];
        return (
          <article key={s.id} data-love-scene={s.id} className="grid gap-2.5">
            <MomentWhen s={s} fx="in" lead="text-center" />
            {s.title ? (
              <h3 data-love-title="" data-love-fx="in" className="text-center font-pahina text-2xl leading-tight text-ink">
                {s.title}
              </h3>
            ) : null}
            {photos.length > 1 ? (
              <MomentGlimpse photos={photos} width={GLIMPSE_IN_CONVERSATION} label={s.title || whenOf(s)} fx="in" />
            ) : photo ? (
              <MomentPhoto src={photo} fx="in" place="aspect-[4/5] max-h-[70svh] w-[72%] max-w-full justify-self-center" />
            ) : null}
            {voices.map((v, i) => (
              <div
                key={v.slot}
                data-love-bubble={v.slot}
                data-love-fx="rise"
                style={{ '--love-at': `${0.45 + i * 0.35}s` } as React.CSSProperties}
                className={
                  v.slot === 'a'
                    ? 'flex max-w-[86%] flex-col items-start justify-self-start rounded-2xl rounded-bl-sm bg-gild/10 px-3.5 pb-3 pt-2.5'
                    : 'flex max-w-[86%] flex-col items-end justify-self-end rounded-2xl rounded-br-sm bg-ink/[0.06] px-3.5 pb-3 pt-2.5 text-right'
                }
              >
                <Who slot={v.slot} name={v.name} flip={v.slot === 'b'} />
                <Said words={v.words} long={LONG_VOICE} lines={4} slot={v.slot} alignEnd={v.slot === 'b'} />
              </div>
            ))}
            {voices.length === 0 && s.line ? (
              <p data-love-line="" data-love-fx="in" className="text-center whitespace-pre-line font-pahina text-lg font-light italic leading-snug text-ink">
                {s.line}
              </p>
            ) : null}
            <p data-love-place="" hidden={!s.place} className="text-center text-sm leading-relaxed text-ink/65">
              {s.place ?? ''}
            </p>
          </article>
        );
      })}
    </section>
  );
}

/**
 * 🗣 TWO-LANE TIMELINE (◆ Pro) — one line down the centre; each moment's date, title and photo sit on it, the first
 * partner's words branch left and the second's right. One voice alone keeps its own side; no voice, the line centred.
 */
export function LoveStoryTimeline({ scenes, partners, mediaUrls, entrance = false, anchorId }: VoicesLookProps) {
  const fx = useEntrance(entrance);
  if (scenes.length === 0) return null;
  return (
    <section
      ref={fx.ref}
      id={anchorId}
      className="scroll-mt-6 space-y-6"
      data-scene-style="timeline"
      data-love-story-scenes={scenes.length}
      {...fx.attrs}
    >
      {fx.style}
      <p className="pahina-eyebrow">
        <span>Our love story</span>
      </p>
      {/* The centre line is drawn in SEGMENTS — between one moment and the next, and down between the two lanes —
          never behind a date or a title (no fill under words: the scene may wear its own background). */}
      <div className="grid">
        {scenes.map((s, idx) => {
          const voices = momentVoiceLines(s, partners);
          const photos = photosOf(s, mediaUrls);
          const photo = photos[0];
          const a = voices.find((v) => v.slot === 'a');
          const b = voices.find((v) => v.slot === 'b');
          return (
            <article key={s.id} data-love-scene={s.id} className="grid justify-items-center">
              {idx > 0 ? <span aria-hidden data-love-fx="draw" className="block h-8 w-px bg-ink/15" /> : null}
              <MomentWhen s={s} fx="in" at="0.3s" lead="py-0.5 text-center" />
              {s.title ? (
                <h3 data-love-title="" data-love-fx="in" style={{ '--love-at': '0.3s' } as React.CSSProperties} className="mt-1 text-center font-pahina text-xl leading-tight text-ink">
                  {s.title}
                </h3>
              ) : null}
              {photos.length > 1 ? (
                <MomentGlimpse photos={photos} width={GLIMPSE_IN_TIMELINE} label={s.title || whenOf(s)} fx="in" at="0.3s" className="mt-2.5" />
              ) : photo ? (
                <MomentPhoto src={photo} fx="in" at="0.3s" place="mt-2.5 aspect-[4/5] max-h-[70svh] w-[150px] max-w-full" />
              ) : null}
              {a || b ? (
                <div className="relative mt-3.5 grid w-full grid-cols-2 gap-x-[22px]">
                  <span aria-hidden data-love-fx="draw" className="absolute -top-3.5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-ink/15" />
                  {a ? (
                    <div data-love-lane="a" data-love-fx="left" style={{ '--love-at': '0.9s' } as React.CSSProperties} className="col-start-1 flex min-w-0 flex-col items-end border-r-2 border-gild pr-2.5 text-right">
                      <Who slot="a" name={a.name} flip />
                      <Said words={a.words} long={LONG_LANE} lines={6} slot="a" alignEnd />
                    </div>
                  ) : null}
                  {b ? (
                    <div data-love-lane="b" data-love-fx="right" style={{ '--love-at': '1.25s' } as React.CSSProperties} className="col-start-2 flex min-w-0 flex-col items-start border-l-2 border-ink pl-2.5 text-left">
                      <Who slot="b" name={b.name} />
                      <Said words={b.words} long={LONG_LANE} lines={6} slot="b" />
                    </div>
                  ) : null}
                </div>
              ) : s.line ? (
                <p data-love-line="" data-love-fx="in" style={{ '--love-at': '0.3s' } as React.CSSProperties} className="mt-2 whitespace-pre-line px-2.5 text-center font-pahina text-[17px] font-light italic leading-snug text-ink">
                  {s.line}
                </p>
              ) : null}
              <p data-love-place="" hidden={!s.place} className="mt-1.5 text-center text-sm leading-relaxed text-ink/65">
                {s.place ?? ''}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 🗣 SWIPE CARDS (◆ Pro) — one moment per card, full width: the photo and date, the title, then the voices stacked
 * (first, then second). Swiped sideways (the next card peeks so the swipe is found); a dot jumps; the page still
 * scrolls on past the deck. Each card plays its own entrance the first time it is shown.
 */
export function LoveStoryCards({ scenes, partners, mediaUrls, entrance = false, anchorId }: VoicesLookProps) {
  const fx = useEntrance(entrance);
  const deck = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = deck.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const first = el.firstElementChild as HTMLElement | null;
        if (!first) return;
        const i = Math.round(el.scrollLeft / (first.offsetWidth + 16));
        setActive(Math.max(0, Math.min(scenes.length - 1, i)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scenes.length]);
  if (scenes.length === 0) return null;
  const jump = (i: number) => {
    const el = deck.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (el && first) el.scrollTo({ left: i * (first.offsetWidth + 16), behavior: 'smooth' });
  };
  return (
    <section
      ref={fx.ref}
      id={anchorId}
      className="scroll-mt-6"
      data-scene-style="cards"
      data-love-story-scenes={scenes.length}
      {...fx.attrs}
    >
      {fx.style}
      <p className="pahina-eyebrow mb-6">
        <span>Our love story</span>
      </p>
      <div
        ref={deck}
        aria-label="Our story, one moment at a time"
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {scenes.map((s, idx) => {
          const voices = momentVoiceLines(s, partners);
          const photos = photosOf(s, mediaUrls);
          const photo = photos[0];
          const on = idx === active;
          return (
            <article
              key={s.id}
              data-love-scene={s.id}
              data-love-card={on ? 'active' : ''}
              aria-roledescription="card"
              className="grid min-w-0 shrink-0 basis-[calc(100%-28px)] snap-start content-start gap-2.5"
            >
              {/* 👆 Two swipes, one per place: inside the photos the finger moves the photos (the rail is its own
                  scroller and contains its overscroll, so it never hands the swipe on to the deck); anywhere else on
                  the card — the date, the words, the next card peeking — it moves the cards. */}
              {photos.length > 1 ? (
                <MomentGlimpse photos={photos} width={GLIMPSE_IN_CARD} label={s.title || whenOf(s)} fx={on ? 'develop' : undefined} />
              ) : photo ? (
                <MomentPhoto src={photo} fx={on ? 'develop' : undefined} place="aspect-[4/3] max-h-[70svh] w-full max-w-full" />
              ) : null}
              <MomentWhen s={s} fx={on ? 'in' : undefined} />
              {s.title ? (
                <h3 data-love-title="" data-love-fx={on ? 'in' : undefined} className="font-pahina text-2xl leading-tight text-ink">
                  {s.title}
                </h3>
              ) : null}
              {voices.length > 0 ? (
                <div className="grid gap-3">
                  {voices.map((v, i) => (
                    <div
                      key={v.slot}
                      data-love-card-voice={v.slot}
                      data-love-fx={on ? 'rise' : undefined}
                      style={{ '--love-at': `${0.5 + i * 0.35}s` } as React.CSSProperties}
                      className={
                        v.slot === 'a'
                          ? 'flex max-w-[90%] flex-col items-start border-l-2 border-gild pl-3'
                          : 'flex max-w-[90%] flex-col items-end justify-self-end border-r-2 border-ink pr-3 text-right'
                      }
                    >
                      <Who slot={v.slot} name={v.name} flip={v.slot === 'b'} />
                      <Said words={v.words} long={LONG_VOICE} lines={4} slot={v.slot} alignEnd={v.slot === 'b'} />
                    </div>
                  ))}
                </div>
              ) : s.line ? (
                <p data-love-line="" data-love-fx={on ? 'in' : undefined} className="whitespace-pre-line font-pahina text-lg font-light italic leading-snug text-ink">
                  {s.line}
                </p>
              ) : null}
              <p data-love-place="" hidden={!s.place} className="text-sm leading-relaxed text-ink/65">
                {s.place ?? ''}
              </p>
            </article>
          );
        })}
      </div>
      {scenes.length > 1 ? (
        <>
          <div role="tablist" aria-label="Moments" className="mt-4 flex items-center justify-center gap-0.5">
            {scenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Moment ${i + 1}`}
                onClick={() => jump(i)}
                className="grid h-8 min-w-[24px] place-items-center"
              >
                <span aria-hidden className={`block h-1.5 rounded-full transition-all ${i === active ? 'w-[18px] bg-gild' : 'w-1.5 bg-ink/15'}`} />
              </button>
            ))}
          </div>
          <p className="mt-1 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink/65">
            Swipe · {formatCount(active + 1)} of {formatCount(scenes.length)}
          </p>
        </>
      ) : null}
    </section>
  );
}
