import type { ReactNode } from 'react';
import { formatEventDate } from '@/lib/events';
import {
  hubElementInlineStyle,
  hubElementMotionAttr,
  hubRunInlineStyle,
  hubTextSegments,
  type HubElementStyles,
  type HubHeroElementKey,
} from '@/lib/element-style';
import { HERO_DESIGN_ATTR, HERO_DESIGN_DEFAULT, type HeroDesignId } from '@/lib/hero-design';

/**
 * PahinaMasthead — the typographic hero of the Pahina guest site
 * (design 2026-07-25 spec §3/§7 · wave A PR-2).
 *
 * 🎴 FOUR DESIGNS, ONE SET OF PARTS (owner 2026-09-26, `lib/hero-design.ts`):
 * `design` picks the ARRANGEMENT of the same parts — 1 The Card (the default,
 * every line of it byte-identical to before the designs existed) · 2 The
 * Marquee (the names are the art, a small mark between two rules) · 3 The
 * Crest (the mark in a ring, the names on one line under it like a seal) · 4
 * The Letter (ranged left, anchored low, the mark in the corner). Drawn from
 * `prototypes/hero_scene_templates_2026-09-25.html`. Every part keeps its
 * `data-el` key and its `data-motion` hook, so a part is the same tap-to-edit
 * element in every design and the couple's per-part edits ride across designs.
 * The root carries `data-hero-design` off the default, which the navigator's
 * tile reads to crop The Letter from the foot (`lib/maker-tile-preview.ts`).
 *
 * ONE component for every hero call-site (anonymous banner, anonymous text,
 * guest media, guest text) so the two identity trees cannot drift — the same
 * reasoning as `resolveSiteBodyPlan`. The old treatment painted the names over
 * the photo behind a cream scrim; Pahina makes the masthead purely typographic
 * (stacked names, italic ampersand, gild date) and demotes the photo to a
 * COVER PLATE below (`mediaSlot`), so type never fights the picture.
 *
 * Personalization precedence unchanged: the monogram mount (HeroMonogram with
 * its animated-SKU logic) is passed in via `monogramSlot`, untouched.
 */

/**
 * Split "Maria & Jose" / "Maria and Jose" into stacked lines. Falls back to a
 * single line when no separator is found (solo-named events, debuts).
 *
 * `twoPeople` is the event's own fact — `terminology.person_b` is non-null, i.e.
 * this event HAS two people at its centre (`EventWords.twoPeople`). When it is
 * FALSE the name is one line whatever punctuation it contains, because the
 * stacked-with-a-gild-joiner treatment is the WEDDING masthead and an ampersand
 * in a company name is not two people:
 *
 *     "Ayala & Partners Year-End"  →  ONE line   (was: "Ayala" & "Partners…")
 *     "Bench & Co Summer Outing"   →  ONE line   (was: "Bench" & "Co Summer…")
 *     "Maria & Juan" (a wedding)   →  still split, unchanged
 *
 * 🔒 IT DEFAULTS TO `true`, WHICH IS TODAY'S BEHAVIOUR, and that direction is
 * deliberate — the same reasoning as `event-words-provider.tsx`'s wedding
 * fallback. Production is weddings; a caller that has not been wired yet must
 * keep splitting rather than silently flattening a real couple's masthead onto
 * one line. The invisibility that creates is closed by a guard, not by a scary
 * default: `event-words.test.ts` asserts every call site passes the flag.
 */
export function splitCoupleNames(
  displayName: string,
  twoPeople = true,
): {
  first: string;
  second: string | null;
  joiner: string | null;
} {
  if (!twoPeople) return { first: displayName, second: null, joiner: null };
  const amp = /\s*&\s*/.exec(displayName);
  if (amp) {
    const [first = '', ...rest] = displayName.split(/\s*&\s*/);
    return { first, second: rest.join(' & ') || null, joiner: '&' };
  }
  const and = /\s+and\s+/i.exec(displayName);
  if (and) {
    const first = displayName.slice(0, and.index);
    const second = displayName.slice(and.index + and[0].length);
    return { first, second: second || null, joiner: 'and' };
  }
  return { first: displayName, second: null, joiner: null };
}

export function PahinaMasthead({
  displayName,
  eventDate,
  venueName,
  eyebrow = 'You are invited',
  badgeSlot,
  monogramSlot,
  mediaSlot,
  mediaCaption,
  twoPeople = true,
  card,
  elements = null,
  stampElements = false,
  design = HERO_DESIGN_DEFAULT,
}: {
  /**
   * 🎴 Which arrangement of the parts (`lib/hero-design.ts`). Absent → The
   * Card, the shipped hero, byte-identical to before.
   */
  design?: HeroDesignId;
  /**
   * 🔤 THE HERO'S PARTS IN THE COUPLE'S OWN LOOK — font · colour · size ·
   * animation per part (`lib/element-style.ts`), read off the hero row's
   * canvas. Absent → every part wears the theme, byte-identical to before.
   */
  elements?: HubElementStyles | null;
  /**
   * Stamp `data-el` on each part so the Maker canvas can tell WHICH part was
   * tapped (`editor-bridge.tsx`). ONLY in the Maker canvas — a guest's markup
   * never carries it.
   */
  stampElements?: boolean;
  displayName: string;
  eventDate: string | null;
  /** `EventWords.twoPeople` — false collapses the names to one line. Defaults
   *  to today's split so an un-wired caller cannot flatten a couple. */
  twoPeople?: boolean;
  venueName?: string | null;
  /** Eyebrow text. `null` renders no eyebrow row at all — the solemn
   *  register's answer (`mastheadEyebrow` in _lib/invitation-card.ts): a wake
   *  is never told "You are invited", and (owner 2026-09-25 "drop the
   *  numbers") there is no chapter numeral to fall back to either. */
  eyebrow?: string | null;
  /** Day-of badge etc. — rendered above the eyebrow when present. */
  badgeSlot?: ReactNode;
  /** The couple's mark (HeroMonogram) — mounted between eyebrow and names. */
  monogramSlot?: ReactNode;
  /** The demoted hero photo/video — rendered BELOW the type as a cover plate. */
  mediaSlot?: ReactNode;
  /** Mono caption under the cover plate (e.g. venue line). */
  mediaCaption?: string | null;
  /**
   * 🎴 THE INVITATION CARD (owner 2026-09-21, canvas "1 · Arrival": "doesn't
   * look like the event hub we planned"). When present, the masthead renders
   * as a paper card with a gold hairline frame — eyebrow, a large mark, the
   * names, the invitation line, the date between two gold rules, the time —
   * and a link down into the hub. Every word is resolved by the caller from
   * `EventWords`, so a birthday never says "marriage" and a funeral carries
   * no celebration line. Absent → the masthead renders exactly as before.
   */
  card?: {
    eyebrow: string;
    /** "invite you to celebrate their wedding" — null for the solemn register. */
    line: string | null;
    /** The first moment's time, the programme's own clock ("1:30 PM"). */
    timeLabel: string | null;
    hubHref: string;
    hubLabel: string;
  };
}) {
  const names = splitCoupleNames(displayName, twoPeople);
  const dateLabel = formatEventDate(eventDate);
  /** The part's own style and, in the Maker canvas only, its key. */
  const el = (key: HubHeroElementKey) => ({
    ...(stampElements ? { 'data-el': key } : {}),
    // The part's own motion rides as custom properties; this is the hook the
    // ONE gated rule in globals.css reads (`[data-el-motion]`).
    ...hubElementMotionAttr(elements?.[key]),
    // A part the couple hid is never drawn for a guest; in the Maker canvas it
    // is ghosted so it can be brought back (`hubElementDeclarations`).
    style: hubElementInlineStyle(elements?.[key], { editor: stampElements }),
  });
  /**
   * ✍ A piece of a part's text, with its runs (one letter, one word in its own
   * face) drawn as spans — server-side, so what a guest sees is exactly what
   * the canvas showed. `whole` is the part's WHOLE text as a browser reads it
   * (`textContent`), which the runs' offsets and their `of` hash are measured
   * on; a run made on older text is dropped, never moved (`hubTextSegments`).
   */
  const txt = (key: HubHeroElementKey, text: string, whole: string = text, segmentStart = 0) => {
    const parts = hubTextSegments(text, elements?.[key], { text: whole, segmentStart });
    if (parts.length === 1 && !parts[0]!.run) return text;
    return parts.map((p, i) =>
      p.run ? (
        <span key={i} data-el-run="" style={hubRunInlineStyle(p.run)}>
          {p.text}
        </span>
      ) : (
        p.text
      ),
    );
  };
  /* 🔗 THE JOINER — the couple's own word when they chose one (and · & · + ·
     their own, `HubElementStyle.word`), else the word the display name gives,
     exactly as before the Joiner existed. */
  const ownJoiner = elements?.joiner?.word ?? null;
  const cardJoiner = ownJoiner ?? (names.joiner === '&' ? 'and' : (names.joiner ?? ''));
  const plainJoiner = ownJoiner ?? names.joiner ?? '';
  const cardNames = `${names.first}${names.second ? `${cardJoiner}${names.second}` : ''}`;
  const plainNames = `${names.first}${names.second ? `${plainJoiner}${names.second}` : ''}`;

  /* 🔗 THE LINK DOWN INTO THE HUB — a part like the others (owner 2026-09-28,
     tapping it in the Maker: "why can't i update the text"). Its words are the
     couple's when they wrote some (`HubElementStyle.word`), else the card's
     own. The part is the WRAPPER, so its look reaches the words and the ↓ alike
     (the link inherits colour and face from it) and an alignment moves the
     link as it moves every other part. `data-el-words` marks, in the Maker
     canvas only, the words the instant preview rewrites. */
  const hubLink = (align: 'start' | 'center') => {
    if (!card) return null;
    const words = elements?.link?.word ?? card.hubLabel;
    const whole = `${words}↓`;
    return (
      <div {...el('link')} className="mt-4 font-pahina text-base italic text-mulberry hover:text-mulberry-600">
        <a
          href={card.hubHref}
          className={`inline-flex min-h-[44px] flex-col justify-center gap-1 ${align === 'start' ? 'items-start' : 'items-center'}`}
        >
          {/* In the Maker only: which words the preview rewrites, and the card's
              own words to put back when the couple clears theirs. */}
          <span {...(stampElements ? { 'data-el-words': '', 'data-el-word': card.hubLabel } : {})}>
            {txt('link', words, whole, 0)}
          </span>
          <span aria-hidden>{txt('link', '↓', whole, words.length)}</span>
        </a>
      </div>
    );
  };
  /** 📍 The plain masthead's venue — the event's own venue, styled as a part. */
  const venuePart = (name: string) => (
    <p {...el('venue')} className="mt-2 text-base text-ink/70">
      {txt('venue', name)}
    </p>
  );

  /* ── THE COVER PLATE (photo/video demoted below the type) — one markup for
     every design of the plain masthead. See the note inside. */
  const coverPlate = mediaSlot ? (
    <figure className="relative -mx-4 mt-8 sm:-mx-0">
      {/* ⚠ The `aspect-*` pair is LOAD-BEARING, not decoration. `mediaSlot`
          is always `HeroBackgroundMedia`, whose <img>/<video> is
          `absolute inset-0` — it was written for the OLD hero, a banner
          that held the names + date in flow and therefore had a height of
          its own. PR-2 demoted the media into this standalone box, which
          has no in-flow child at all, so it computed to zero content
          height: the couple's hero photo has not been visible on the plate
          since. A ratio restores the plate AND is what gives the parallax
          below a box to translate inside. Portrait on a phone (it reads as
          a cover), 3:2 from `sm` up so a 720px column doesn't become a
          900px-tall photo. */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink/10 sm:aspect-[3/2]">
        {/* Parallax layer (design §6 — "±6%, rAF-throttled transform on the
            media wrapper"). This div carries the transform; the media keeps
            filling it via its own `absolute inset-0` (an absolutely
            positioned box is a containing block for its abspos children).

            SAFETY IS THE FEATURE. The transform lives entirely in CSS,
            behind the SAME `.pahina-js` root flag as the scroll reveal, and
            the script writes only a custom property — never `transform`
            itself. So every path that drops the flag (no
            IntersectionObserver, reduced motion, the 2s self-heal, a script
            that throws) also drops the scale and the offset in the same
            frame, and this becomes an ordinary static `object-cover` photo.
            There is no state in which JS has moved the image and CSS cannot
            take it back. See pahina-motion.tsx + globals.css §6 for the
            scale/translate geometry that keeps the box always covered. */}
        <div data-pahina-parallax className="absolute inset-0">
          {mediaSlot}
        </div>
      </div>
      {mediaCaption ? (
        <figcaption
          /* The plate bleeds `-mx-4` past the column; a centred caption (The
             Card) sits inside it anyway, a ranged-left one (The Letter) would
             start 16px off the phone's edge — so off the default the caption
             keeps the column's own gutter. */
          className={`mt-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55${
            design === HERO_DESIGN_DEFAULT ? '' : ' px-4 sm:px-0'
          }`}
        >
          {mediaCaption}
        </figcaption>
      ) : null}
    </figure>
  ) : null;

  /* ═══ DESIGNS 2 · 3 · 4 — the same parts, arranged (`lib/hero-design.ts`). ═══
     The Card below is untouched; these three share its helpers (`el`, `txt`)
     so a part is the same element with the same key, motion hook and runs.
     With `card`: eyebrow · mark · names · line · date · time · the hub link.
     Without (a hero photo): eyebrow · mark · names · date · venue · the plate.
     🔒 Every text part may wrap (`[overflow-wrap:anywhere]`, no nowrap): long
     names ("Maria Clara Concepcion") must fit a 375px phone in every design. */
  if (design !== HERO_DESIGN_DEFAULT) {
    const joinerWord = card ? cardJoiner : plainJoiner;
    const whole = card ? cardNames : plainNames;
    const eyebrowText = card ? card.eyebrow : eyebrow;
    const HUB_LINK = hubLink(design === 'letter' ? 'start' : 'center');
    const TIME = card?.timeLabel ? (
      <p {...el('time')} className="mt-2 text-xs uppercase tracking-[0.24em] text-ink/60">
        {txt('time', card.timeLabel)}
      </p>
    ) : null;
    const VENUE = !card && venueName ? venuePart(venueName) : null;
    const LINE = card?.line ? (
      <p
        {...el('line')}
        className={`mt-4 text-base leading-relaxed text-ink/80 ${design === 'letter' ? 'max-w-[24ch]' : 'mx-auto max-w-[26ch]'}`}
      >
        {txt('line', card.line)}
      </p>
    ) : null;
    /* The names, stacked on a phone; from `sm` The Marquee and The Crest set
       them on one wrapping row with the joiner inline, as the prototype does. */
    const NAMES = (
      <h1
        {...el('names')}
        data-motion="arrive-names"
        className={
          design === 'marquee'
            ? 'mt-5 font-pahina text-[clamp(2.75rem,15vw,5.5rem)] font-light leading-[0.98] tracking-tight text-ink [overflow-wrap:anywhere] [text-wrap:balance] sm:flex sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-[0.24em] sm:text-[5.5rem]'
            : design === 'crest'
              ? 'mt-6 flex flex-wrap items-baseline justify-center gap-x-[0.3em] font-pahina text-[clamp(1.5rem,7vw,2.25rem)] font-light leading-[1.1] text-ink [overflow-wrap:anywhere] sm:text-[2.5rem]'
              : 'mt-3 font-pahina text-[clamp(2.75rem,14vw,5.5rem)] font-light leading-[0.98] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-[5.5rem]'
        }
      >
        <span className={design === 'crest' ? undefined : 'block sm:inline'}>{txt('names', names.first, whole, 0)}</span>
        {names.second ? (
          <>
            <span
              {...el('joiner')}
              className={
                design === 'marquee'
                  ? 'block font-pahina text-[0.5em] italic leading-[1.1] text-gild sm:inline sm:text-[0.55em]'
                  : design === 'crest'
                    ? 'font-pahina text-[0.9em] italic text-gild'
                    : 'ml-[0.06em] block font-pahina text-[0.4em] italic leading-[1.1] text-gild'
              }
              aria-hidden
            >
              {txt('names', joinerWord, whole, names.first.length)}
            </span>
            <span className={design === 'crest' ? undefined : design === 'marquee' ? 'block sm:inline' : 'block'}>
              {txt('names', names.second, whole, names.first.length + joinerWord.length)}
            </span>
          </>
        ) : null}
      </h1>
    );
    const DATE = dateLabel ? (
      <p
        {...el('date')}
        data-motion="arrive-date"
        /* 🎨 The face, colour and spacing sit on the PART, never on the inner
           span: an inner class would outrank the couple's own choice (the
           part's inline style), which then reached the part and stopped short
           of the words — the Date's "why can't I change it". Size stays on the
           span; the part's size is a `zoom`, which reaches it anyway. */
        className={`flex items-center gap-3 ${design === 'letter' ? 'mt-2 justify-start' : 'mt-3 justify-center'} ${
          design === 'crest' ? 'uppercase tracking-[0.26em] text-ink/60' : 'font-pahina text-ink'
        }`}
      >
        {design === 'crest' ? (
          <span className="text-xs">{txt('date', dateLabel)}</span>
        ) : (
          <span className="text-2xl sm:text-[1.65rem]">{txt('date', dateLabel)}</span>
        )}
      </p>
    ) : null;

    if (design === 'marquee') {
      return (
        <header data-pahina-first-screen="" {...{ [HERO_DESIGN_ATTR]: design }} className="text-center">
          {badgeSlot}
          <div>
            {eyebrowText ? (
              <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/60">
                {txt('eyebrow', eyebrowText)}
              </p>
            ) : null}
            {monogramSlot ? (
              <div {...el('mark')} data-motion="arrive-mark" className="mt-5 flex items-center justify-center gap-4">
                <span aria-hidden className="h-px w-14 bg-gild/60 sm:w-24" />
                {/* The mark renders at its own 80px; The Marquee shows it small
                    (~48px) between two rules — a scale, the card's own trick. */}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                  <span className="block scale-[0.6]">{monogramSlot}</span>
                </span>
                <span aria-hidden className="h-px w-14 bg-gild/60 sm:w-24" />
              </div>
            ) : null}
            {NAMES}
            {LINE}
            {DATE}
            {TIME}
            {VENUE}
          </div>
          {HUB_LINK}
          {coverPlate}
        </header>
      );
    }

    if (design === 'crest') {
      return (
        <header data-pahina-first-screen="" {...{ [HERO_DESIGN_ATTR]: design }} className="text-center">
          {badgeSlot}
          <div>
            {eyebrowText ? (
              <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/60">
                {txt('eyebrow', eyebrowText)}
              </p>
            ) : null}
            {monogramSlot ? (
              <div
                {...el('mark')}
                data-motion="arrive-mark"
                /* The crest: a double ring (a chip radius on a pressable-sized
                   circle, not a card), the mark large inside it. */
                className="relative mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-full border border-gild/70 bg-cream/60 shadow-[0_0_0_10px_rgba(255,255,255,0.22),0_30px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:h-72 sm:w-72"
              >
                <span aria-hidden className="pointer-events-none absolute inset-2 rounded-full border border-gild/35" />
                <span className="block scale-[1.65] sm:scale-[2.1]">{monogramSlot}</span>
              </div>
            ) : null}
            {NAMES}
            {LINE}
            {DATE}
            {TIME}
            {VENUE}
          </div>
          {HUB_LINK}
          {coverPlate}
        </header>
      );
    }

    /* The Letter — ranged left, anchored low on a phone (the header fills
       most of the first screen and its words sit at the foot); from `sm` it is
       a left column with the mark above the words. */
    return (
      <header
        data-pahina-first-screen=""
        {...{ [HERO_DESIGN_ATTR]: design }}
        className="relative flex min-h-[70svh] flex-col justify-end text-left sm:min-h-0 sm:justify-start"
      >
        {monogramSlot ? (
          <div
            {...el('mark')}
            data-motion="arrive-mark"
            /* `mb-auto`: in the phone's justify-end column the mark stays at the
               head of the screen while the words sit at the foot — in flow, so
               the Happening-now pill below it never lands on top of it. */
            className="mb-auto flex h-12 w-12 items-center justify-center sm:mb-6 sm:h-16 sm:w-16"
          >
            <span className="block scale-[0.6] sm:scale-[0.8]">{monogramSlot}</span>
          </div>
        ) : null}
        <div className="pr-[14%] sm:max-w-[60%] sm:pr-0">
          {badgeSlot ? <div className="mb-4 flex justify-start">{badgeSlot}</div> : null}
          {eyebrowText ? (
            <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.26em] text-ink/60">
              {txt('eyebrow', eyebrowText)}
            </p>
          ) : null}
          {NAMES}
          {LINE}
          {DATE}
          {TIME}
          {VENUE}
          {HUB_LINK}
        </div>
        {coverPlate}
      </header>
    );
  }

  if (card) {
    return (
      <header data-pahina-first-screen="" className="text-center">
        {badgeSlot}
        <div className="mx-auto max-w-md rounded-sm bg-cream p-3 shadow-[0_20px_48px_rgba(30,34,41,0.16)]">
          <div className="border border-gild/45 px-5 pb-7 pt-8">
            <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/60">{txt('eyebrow', card.eyebrow)}</p>
            {monogramSlot ? (
              <div {...el('mark')} data-motion="arrive-mark" className="mt-5 flex h-[9.5rem] items-center justify-center">
                {/* The mark renders at its own 80px; the card shows it at
                    ~150px. A scale, not a second size in every monogram branch:
                    the marks are SVG, so they stay crisp. */}
                <div className="scale-[1.85]">{monogramSlot}</div>
              </div>
            ) : null}
            <h1
              {...el('names')}
              data-motion="arrive-names"
              className="mt-5 font-pahina text-[2.9rem] font-light leading-[1.06] tracking-tight text-ink"
            >
              <span className="block">{txt('names', names.first, cardNames, 0)}</span>
              {names.second ? (
                <>
                  <span {...el('joiner')} className="block font-pahina text-[0.5em] italic text-gild" aria-hidden>
                    {txt('names', cardJoiner, cardNames, names.first.length)}
                  </span>
                  <span className="block">{txt('names', names.second, cardNames, names.first.length + cardJoiner.length)}</span>
                </>
              ) : null}
            </h1>
            {card.line ? <p {...el('line')} className="mt-4 text-sm leading-relaxed text-ink/80">{txt('line', card.line)}</p> : null}
            {dateLabel ? (
              /* The face and colour on the part, so the couple's own reach the
                 words (see the designs' DATE above). */
              <p {...el('date')} data-motion="arrive-date" className="mt-4 flex items-center justify-center gap-3 font-pahina text-ink">
                <span aria-hidden className="h-px w-5 bg-gild/60" />
                <span className="text-xl">{txt('date', dateLabel)}</span>
                <span aria-hidden className="h-px w-5 bg-gild/60" />
              </p>
            ) : null}
            {card.timeLabel ? (
              <p {...el('time')} className="mt-2 text-xs uppercase tracking-[0.24em] text-ink/60">{txt('time', card.timeLabel)}</p>
            ) : null}
          </div>
        </div>
        {hubLink('center')}
      </header>
    );
  }

  return (
    <header data-pahina-first-screen="" className="text-center">
      {badgeSlot}
      {/* owner 2026-09-25 "drop the numbers": the chapter numeral is gone —
          hiding a section no longer leaves a gap in a numbered sequence.
          When there is no eyebrow (the solemn register), render no row at
          all rather than an empty one with a stray decorative rule. */}
      {eyebrow ? (
        <p {...el('eyebrow')} className="pahina-eyebrow justify-center">
          <span>{txt('eyebrow', eyebrow)}</span>
        </p>
      ) : null}
      {monogramSlot ? <div {...el('mark')} data-motion="arrive-mark" className="mt-6 flex justify-center">{monogramSlot}</div> : null}

      {/* Stacked names — Fraunces display, italic gild joiner between lines. */}
      <h1 {...el('names')} data-motion="arrive-names" className="mt-6 font-pahina text-[2.9rem] font-light leading-[1.04] tracking-tight text-ink sm:text-6xl">
        <span className="block">{txt('names', names.first, plainNames, 0)}</span>
        {names.second ? (
          <>
            <span {...el('joiner')} className="block font-pahina text-[0.42em] italic text-gild" aria-hidden>
              {txt('names', plainJoiner, plainNames, names.first.length)}
            </span>
            <span className="block">{txt('names', names.second, plainNames, names.first.length + plainJoiner.length)}</span>
          </>
        ) : null}
      </h1>

      <hr className="pahina-rule mx-auto mt-7 w-24" />

      {/* The gild date — oversized lining numerals; venue meta beneath. */}
      {dateLabel ? (
        <p {...el('date')} data-motion="arrive-date" className="mt-6 font-pahina text-[clamp(1.6rem,6vw,2.4rem)] font-light tracking-tight text-gild">
          {txt('date', dateLabel)}
        </p>
      ) : null}
      {venueName ? venuePart(venueName) : null}

      {/* Cover plate — the photo/video demoted below the type, framed like a
          printed plate with a mono caption. Only when media exists. */}
      {coverPlate}
    </header>
  );
}
