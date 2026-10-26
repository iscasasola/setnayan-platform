import { Fragment, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { HUB_FX_LETTER_ATTR, HUB_FX_LINE_ATTR, HUB_FX_WORD_ATTR, hubFxCut, hubFxPieces, type HubFxCut } from '@/lib/part-fx';
import { AMBIENT_PHOTO_LEAK_SPEC } from '@/lib/ambient-effects';
import { AmbientEffectLayer } from './ambient-effect';
import { splitCoupleNames } from '@/lib/split-names';
import { formatEventDate } from '@/lib/events';
import { formatHubDate, formatHubTime } from '@/lib/hub-date-formats';
import {
  hubElementInlineStyle,
  hubElementMotionAttr,
  hubElementPhotoParallax,
  hubElementWordCut,
  hubRunInlineStyle,
  hubTextSegments,
  sanitizeHubElementMotion,
  type HubElementStyles,
  type HubHeroElementKey,
} from '@/lib/element-style';
import { HERO_DESIGN_ATTR, HERO_DESIGN_DEFAULT, type HeroDesignId } from '@/lib/hero-design';
import { COVER_FOOT_ATTR, COVER_SCENE_ATTR, COVER_SCENE_FOOT, COVER_SCENE_SCREEN, COVER_SCENE_UPPER, COVER_SWIPE_HINT } from '@/lib/cover-scene';
import { COVER_RSVP_CHANGE, COVER_RSVP_DECLINED, COVER_RSVP_GOING, type CoverRsvp } from '@/lib/cover-rsvp';
import { HUB_RSVP_DEFAULT_WORDS } from '@/lib/element-style';
import type { CoverSceneLayer } from '../_lib/cover-scene-layer';
import { COVER_LINE_ATTR, COVER_LINE_OWN } from '@/lib/hub-veil';
import { COVER_SCENE_CREAM_VARS, CoverSceneGround } from './cover-scene-ground';
import { FirstScreenDoor } from './first-screen-door';
import { moreAnswersWords } from '@/lib/guest-one-path';

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

/* The one rule for splitting a name line into its people — its own file, so the Maker's canvas reads the same one
   (`lib/split-names.ts`). Re-exported: every caller that named it here still finds it here. */
export { splitCoupleNames };

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
  linkWords = null,
  elements = null,
  stampElements = false,
  design = HERO_DESIGN_DEFAULT,
  looks = null,
  ground = null,
  waiting = null,
  rsvp = null,
  still = false,
  foot: withFoot = true,
  fitFoot = !stampElements,
  door = null,
  kitSlot = null,
}: {
  /**
   * 🔘 THE RSVP BUTTON at the cover's foot (owner 2026-10-16) — this reader's state (`coverRsvpOf`): the couple's words
   * (default "Confirm attendance"), "You're coming ✓ · Change", "You can't make it · Change", or a shut window's line,
   * plain and not pressable. Null: no reply on this page — no button (the hint stays).
   */
  rsvp?: CoverRsvp | null;
  /**
   * The foot (the RSVP button and the "Swipe up" hint). Every cover has it — a first screen never ends with neither a
   * way in nor the hint (live on cale-ice 2026-10-17, owner: *"where is the RSVP and swipe marker?"*). False only where
   * a caller draws no first screen at all.
   */
  foot?: boolean;
  /**
   * 📐 Fit the cover so its RSVP button is wholly on the first screen (`FirstScreenDoor foot rsvp`, owner 2026-10-20).
   * Default: on, except where the parts are stamped for the Maker's canvas. The lab passes it for its guest view.
   */
  fitFoot?: boolean;
  /**
   * 🚪 THE STRANGER'S ONE DOOR, IN THE FOOT (owner 2026-10-17, *"the button shows after the cover?"* · *"Change the
   * button to 'Confirm your Booking'"*). Since the Cover Scene took the whole first screen, the door that stood UNDER
   * the cover was drawn below the fold. So a stranger's door stands where a guest's RSVP button does — in place of it,
   * never beside it (the one-button rule, owner 2026-09-26/27) — with the "Swipe up" hint under it. A cover LINE like
   * the button: behind a closed veil it waits for the unveil. Absent → the RSVP button, as before.
   */
  door?: ReactNode;
  /**
   * 🎬 The cover's entrance is Still (`coverEntranceIsStill`): no line enters — after an unveil they appear together,
   * so every line is marked as its own and the veil's default entrance passes them by.
   */
  still?: boolean;
  /**
   * 🕯 THE LOOK'S ART KIT AT THE COVER (`lib/art-kits.ts`, owner 2026-10-16) — the drape pair and the araña,
   * `<KitSlot slot="cover">`. Drawn right after the ground, as the header's own child, so the kit's stylesheet can lay
   * it UNDER the words and over the ground. Absent → the cover byte for byte as before.
   */
  kitSlot?: ReactNode;
  /**
   * 👻 THE LOADING SCREEN ONLY (`invitation-skeleton.tsx`): the parts the real cover will bring in with a Build in of
   * their own — each keeps its place but is not drawn for a moment (`data-el-waits`, globals.css). Absent on the page.
   */
  waiting?: readonly string[] | null;
  /**
   * 🖼 THE COVER SCENE'S BACKGROUND, resolved (`_lib/cover-scene-layer.ts`) — drawn behind the words, the whole first
   * screen tall; the words take the tone measured over it. Absent → The theme's own: the cover byte for byte as before.
   */
  ground?: CoverSceneLayer | null;
  /**
   * 🎨 THE PARTS' OWN STYLES (owner 2026-10-07, `lib/scene-styles-parts.ts`) — each
   * picked part's `data-part-look` value (`partLookAttr`), drawn by `globals.css`.
   * Absent (or a part not listed) = the shipped look, byte for byte.
   */
  looks?: Partial<Record<'mark' | 'eyebrow' | 'names' | 'date' | 'venue', string>> | null;
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
    /** 🗓 The time's fact, for Format ▾ (`invitationCard`): its start as stored and its title. */
    timeAt?: string | null;
    timeTitle?: string | null;
    hubHref: string;
    hubLabel: string;
  };
  /**
   * 🔗 THE LINK'S AUTOMATIC WORDS FOR THIS VIEWER (`hubLinkWords`,
   * `_lib/invitation-card.ts`): the card's own words, less whatever the page it
   * opens does not hold for them — a stranger is never promised "the place".
   * Absent → `card.hubLabel`, as before. The couple's own words still win.
   */
  linkWords?: string | null;
}) {
  /* 🖼 The Cover Scene's own attributes (its shape and tone, when it has a ground) and its ground, first in the header. */
  const cover = {
    [COVER_SCENE_ATTR]: ground ? ground.shape : '',
    ...(ground ? { 'data-cover-tone': ground.tone, ...(ground.tone === 'cream' ? { style: COVER_SCENE_CREAM_VARS } : {}) } : {}),
  };
  const coverGround =
    ground || kitSlot ? (
      <>
        {ground ? <CoverSceneGround layer={ground} /> : null}
        {kitSlot}
      </>
    ) : null;
  /* 📐 The words sit in the UPPER part (`COVER_SCENE_UPPER` gives the top padding), the foot at the bottom — so the
     ground's box only needs its stacking (owner 2026-10-16). */
  const coverBox = ground ? ' relative isolate' : '';
  const names = splitCoupleNames(displayName, twoPeople);
  /* 🗓 FORMAT ▾ (tap-to-type): the date and the time written the couple's way
     (`lib/hub-date-formats.ts`); no format = today's words, byte for byte. */
  const dateLabel = formatHubDate(eventDate, elements?.date?.format) ?? formatEventDate(eventDate);
  const ownTime = card?.timeAt ? formatHubTime(card.timeAt, elements?.time?.format) : null;
  const timeLabel = card?.timeLabel ? (ownTime ? `${(card.timeTitle ?? '').trim() || 'Starts'} ${ownTime}` : card.timeLabel) : null;
  /* ✍ THE EYEBROW AND THE INVITATION LINE — the couple's own words when they
     typed some (`HubElementStyle.word`), else the card's, as before. A row the
     page does not draw (the solemn register's eyebrow) stays undrawn. */
  const ownEyebrow = elements?.eyebrow?.word ?? null;
  const lineText = card?.line ? (elements?.line?.word ?? card.line) : null;
  /* In the Maker canvas only: each part's automatic words (to put back when
     the couple clears theirs) and the facts Format ▾ writes from. */
  const namesJoinerAuto = names.joiner === '&' && card ? 'and' : (names.joiner ?? '');
  const makerFacts: Partial<Record<HubHeroElementKey, Record<string, string>>> = stampElements
    ? {
        eyebrow: { 'data-el-word': (card ? card.eyebrow : eyebrow) ?? '' },
        line: { 'data-el-word': card?.line ?? '' },
        joiner: { 'data-el-word': namesJoinerAuto },
        date: { 'data-el-iso': eventDate ?? '' },
        time: { 'data-el-at': card?.timeAt ?? '', 'data-el-title': card?.timeTitle ?? '' },
      }
    : {};
  /**
   * 🎭 ONE LINE OF THE COVER (`COVER_LINE_ATTR`, `lib/hub-veil.ts`): not drawn while a veil is closed, and entering after
   * the unveil — with its own Build in (`own`) or the cover's default (owner 2026-10-16, "BEHIND THE VEIL, NONE OF THE
   * COVER'S WORDS SHOW"). The joiner is not a line of its own: it sits inside the names and enters with them.
   * Inert on a page with no veil — nothing reads it there.
   */
  const line = (key?: HubHeroElementKey) => ({
    [COVER_LINE_ATTR]: still || (key && sanitizeHubElementMotion(elements?.[key]?.motion)?.in) ? COVER_LINE_OWN : '',
  });
  /** The day's badge ("Happening now") is a line too — stamped on the element the page hands in, so its box is unchanged. */
  const badge = isValidElement(badgeSlot)
    ? cloneElement(badgeSlot as ReactElement<Record<string, unknown>>, line())
    : badgeSlot;
  /** The part's own style and, in the Maker canvas only, its key. */
  const el = (key: HubHeroElementKey) => ({
    ...(stampElements ? { 'data-el': key, ...makerFacts[key] } : {}),
    ...(key === 'joiner' ? {} : line(key)),
    ...(waiting?.includes(key) ? { 'data-el-waits': '' } : {}),
    ...(looks && key in looks && looks[key as keyof typeof looks] ? { 'data-part-look': looks[key as keyof typeof looks] } : {}),
    // The part's own motion rides as custom properties; this is the hook the
    // ONE gated rule in globals.css reads (`[data-el-motion]`).
    ...hubElementMotionAttr(elements?.[key]),
    // A part the couple hid is never drawn — for a guest, and on the Maker's canvas too: a hidden line LEAVES the
    // cover at once and comes back from Cover Scene › Edit's list (owner-approved 2026-10-16), never ghosted. The
    // joiner is no line of that list (it sits inside the Event title), so on the canvas it stays ghosted to be found.
    style: hubElementInlineStyle(elements?.[key], { editor: stampElements && key === 'joiner' }),
  });
  /** ✍ In the Maker canvas only: each person's name, so a tap types in THAT
   *  person (`type-in-place-canvas.ts`) and the joiner stays the Joiner's. */
  const person = (i: 0 | 1) => (stampElements ? { 'data-el-person': String(i) } : {});
  /**
   * ✍ A piece of a part's text, with its runs (one letter, one word in its own
   * face) drawn as spans — server-side, so what a guest sees is exactly what
   * the canvas showed. `whole` is the part's WHOLE text as a browser reads it
   * (`textContent`), which the runs' offsets and their `of` hash are measured
   * on; a run made on older text is dropped, never moved (`hubTextSegments`).
   */
  const txt = (key: HubHeroElementKey, text: string, whole: string = text, segmentStart = 0) => {
    const parts = hubTextSegments(text, elements?.[key], { text: whole, segmentStart });
    /* ✨ WORD BY WORD · SPREAD · GLOW (owner-approved 2026-10-16, "SIX NEW EFFECTS"): the words cut into spans HERE,
       server-side, so a guest's first frame is already the cut one — the one cutter `lib/part-fx.ts`, inside each run. */
    const fx = hubElementWordCut(elements?.[key]);
    if (fx) {
      const cut = hubFxCut(fx.words, whole);
      let at = segmentStart;
      const drawn = parts.map((p, i) => {
        const pieces = fxWords(p.text, whole, at, cut);
        at += p.text.length;
        return p.run ? (
          <span key={i} data-el-run="" style={hubRunInlineStyle(p.run)}>
            {pieces}
          </span>
        ) : (
          <Fragment key={i}>{pieces}</Fragment>
        );
      });
      return cut.line ? <span {...{ [HUB_FX_LINE_ATTR]: '' }}>{drawn}</span> : drawn;
    }
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
  /* 🗓 THE DATE'S WORDS — written out (`dateLabel`, with the couple's runs), or, for the
     Big day and Numerals styles, laid out in pieces from the date itself. */
  const dateWords = partDateWords(looks?.date ?? null, eventDate) ?? (dateLabel ? txt('date', dateLabel) : null);
  /** 📍 The place's words — written out, or for Name first, the place large and the city small. */
  const placeWords = (name: string) => partPlaceWords(looks?.venue ?? null, name) ?? txt('venue', name);
  /* 🔗 THE JOINER — the couple's own word when they chose one (and · & · + ·
     their own, `HubElementStyle.word`), else the word the display name gives,
     exactly as before the Joiner existed. */
  const ownJoiner = elements?.joiner?.word ?? null;
  const cardJoiner = ownJoiner ?? (names.joiner === '&' ? 'and' : (names.joiner ?? ''));
  const plainJoiner = ownJoiner ?? names.joiner ?? '';
  const cardNames = `${names.first}${names.second ? `${cardJoiner}${names.second}` : ''}`;
  const plainNames = `${names.first}${names.second ? `${plainJoiner}${names.second}` : ''}`;
  /**
   * ✍ THE SECOND NAME'S TWO ELEMENTS, FOR THE MAKER'S CANVAS TO DRAW WITH (owner 2026-10-11: he typed one name, then
   * "Bolognese & Pasta" — "it did not make the secondary font": the cover had been drawn for ONE name, so there was
   * no joiner and no second line on the page to type into, and the whole line landed in the first).
   *
   * In the Maker's canvas only, for an event with two people at its centre, the names part ends with a holder that
   * is never shown (`data-el-names-two`, `display: none`) carrying the joiner and the second person's line EXACTLY as
   * this file draws them — the same `pair` call the live names use — so the canvas never keeps a copy of a design's
   * classes. Its two elements wear their stamps under AWAY names (`data-el-away`, `data-el-person-away`): no reader
   * of the page's parts finds them, and the canvas gives them their real names as it puts a copy on the page
   * (`type-in-place-canvas.ts` `layNames`). `data-amp` is what "&" is drawn as on this cover (the card writes
   * "and"). A guest's page never has it.
   *
   * ⚠ Real elements, not a `<template>`: the page is hydrated, and a template's children live in its `content` —
   * React finds none where it drew two and throws the page away to draw it again (measured in the lab, 2026-10-11).
   */
  const away = (stamps: Record<string, unknown>) => {
    /* (`data-el-word` — the joiner's automatic word — is left off: the canvas writes the typed line's.) */
    const { 'data-el': el0, 'data-el-person': person0, 'data-el-word': _word, ...rest } = stamps;
    void _word;
    return { ...rest, ...(el0 !== undefined ? { 'data-el-away': el0 } : {}), ...(person0 !== undefined ? { 'data-el-person-away': person0 } : {}) };
  };
  /**
   * 🔤 THE JOINER WEARS THE NAMES FONT (owner 2026-10-17, on the cover's "&": *"how about the &?"*): every joiner, in every
   * design, carries `data-hub-joiner` — the hook ONE rule in `globals.css` ("THE COUPLE'S FOUR FONTS") sets the couple's
   * Names font on, under the scope's names mark only. Its gold and its italic stay (the italic only where the face has
   * one); a joiner given its own font in Cover Scene › Edit keeps it (inline wins).
   */
  const joinerStamp = (forCanvas?: boolean) => ({ 'data-hub-joiner': '', ...(forCanvas ? away(el('joiner')) : el('joiner')) });
  const secondStamp = (forCanvas?: boolean) => (forCanvas ? away(person(1)) : person(1));
  const namesTwo = (pair: (joiner: ReactNode, second: ReactNode, forCanvas?: boolean) => ReactNode) =>
    stampElements && twoPeople ? (
      <span data-el-names-two="" data-amp={card ? 'and' : '&'} hidden aria-hidden style={{ display: 'none' }}>
        {pair(ownJoiner ?? '', '', true)}
      </span>
    ) : null;
  /** The Card's joiner and second line (design 1, with `card`) — and the plain cover's (design 1, a hero photo). */
  const stackedPair = (size: string, joiner: ReactNode, second: ReactNode, forCanvas?: boolean) => (
    <>
      <span {...joinerStamp(forCanvas)} className={`block font-pahina ${size} italic text-gild`} aria-hidden>
        {joiner}
      </span>
      <span {...secondStamp(forCanvas)} className="block">{second}</span>
    </>
  );
  const cardPair = (joiner: ReactNode, second: ReactNode, forCanvas?: boolean) => stackedPair('text-[0.5em]', joiner, second, forCanvas);
  const plainPair = (joiner: ReactNode, second: ReactNode, forCanvas?: boolean) => stackedPair('text-[0.42em]', joiner, second, forCanvas);

  /* 🔗 THE LINK DOWN INTO THE HUB — a part like the others (owner 2026-09-28,
     tapping it in the Maker: "why can't i update the text"). Its words are the
     couple's when they wrote some (`HubElementStyle.word`), else the card's
     own. The part is the WRAPPER, so its look reaches the words and the ↓ alike
     (the link inherits colour and face from it) and an alignment moves the
     link as it moves every other part. `data-el-words` marks, in the Maker
     canvas only, the words the instant preview rewrites. */
  const hubLink = (align: 'start' | 'center') => {
    if (!card) return null;
    const autoWords = linkWords ?? card.hubLabel;
    const words = elements?.link?.word ?? autoWords;
    const whole = `${words}↓`;
    return (
      <div {...el('link')} className="mt-4 font-pahina text-base italic text-mulberry hover:text-mulberry-600">
        <a
          href={card.hubHref}
          className={`inline-flex min-h-[44px] flex-col justify-center gap-1 ${align === 'start' ? 'items-start' : 'items-center'}`}
        >
          {/* In the Maker only: which words the preview rewrites, and the card's
              own words to put back when the couple clears theirs. */}
          <span {...(stampElements ? { 'data-el-words': '', 'data-el-word': autoWords } : {})}>
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
      {placeWords(name)}
    </p>
  );

  /* 🔘 THE FOOT — THE RSVP BUTTON AND, UNDER IT, THE "SWIPE UP" HINT (owner 2026-10-16, DECISION_LOG "THE COVER: WORDS
     IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT"). The button is a real one (`.button-primary`,
     44 px, framed — Look › Buttons styles it) that goes to the SHIPPED reply (the reply page, which asks a visitor
     without a key for the passcode first); answered, it says so and offers Change; a shut window is plain words, no
     frame, not pressable. The hint is the page's own affordance — never a part, never hidden — and nods gently (still
     under reduced motion). Both are cover LINES (`line()`): behind a closed veil neither shows, and both enter last. */
  const rsvpWords = elements?.rsvp?.word ?? HUB_RSVP_DEFAULT_WORDS;
  const rsvpPart = !rsvp ? null : !('href' in rsvp) ? (
    <p {...el('rsvp')} data-cover-rsvp={rsvp.kind} className="text-sm text-ink/70">
      {rsvp.line}
    </p>
  ) : (
    <a {...el('rsvp')} data-cover-rsvp={rsvp.kind} href={rsvp.href} className="button-primary min-h-11 gap-1.5 px-7">
      {rsvp.kind === 'ask' ? (
        <span {...(stampElements ? { 'data-el-words': '', 'data-el-word': HUB_RSVP_DEFAULT_WORDS } : {})}>{rsvpWords}</span>
      ) : (
        <span>
          {rsvp.kind === 'going' ? COVER_RSVP_GOING : COVER_RSVP_DECLINED}
          {/* ✉️ Coming, with answers still owed: "N more answers" in Change's place (owner 2026-10-20, `moreAnswersOf`). */}
          {rsvp.kind === 'going' ? <b aria-hidden> ✓</b> : null} · <u className="underline-offset-2" {...(rsvp.more ? { 'data-cover-rsvp-more': String(rsvp.more) } : {})}>{rsvp.more ? moreAnswersWords(rsvp.more) : COVER_RSVP_CHANGE}</u>
        </span>
      )}
    </a>
  );
  const foot = !withFoot ? null : (
    <div {...{ [COVER_FOOT_ATTR]: '' }} className={COVER_SCENE_FOOT}>
      {door ? (
        <div {...line()} data-cover-door="" className="w-full space-y-3">
          {door}
        </div>
      ) : (
        rsvpPart
      )}
      {/* 🎯 The button opens the RSVP page itself (owner 2026-10-26, `lib/cover-rsvp.ts`) — a plain link; no glide. */}
      {/* 📐 THE BUTTON IS WHOLLY ON THE FIRST SCREEN (owner 2026-10-20, DECISION_LOG "THE COVER'S REPLY BUTTON HAS THREE
          STATES": *"lift the button so it's fully visible on first open"* — measured on iPhone 13, its box was y 644–688
          in a 664-tall screen). The text cover is taller than a short phone, so the guest's foot is fitted by the SAME
          rule as the stranger's door in the foot (`FirstScreenDoor foot`, 2026-10-18): the air closes, the mark draws
          smaller, and only then whole parts move below the whole foot — never onto the date or the place. Not in the
          Maker's canvas (`fitFoot`, default off while the canvas stamps its parts): the couple edits the cover as written. */}
      {fitFoot && !door && rsvp && 'href' in rsvp ? <FirstScreenDoor foot rsvp /> : null}
      <p {...line()} data-cover-hint="" aria-hidden className="flex flex-col items-center gap-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink/70">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-[cover-hint-nod_2.4s_ease-in-out_infinite] fill-none stroke-current motion-reduce:animate-none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 15l6-6 6 6" />
        </svg>
        {COVER_SWIPE_HINT}
      </p>
    </div>
  );

  /* 🖼 THE PHOTO CAPTION — a part (owner 2026-09-28, "make it editable"): the
     couple's own words, else the venue it has always repeated. In the Maker
     the part keeps the venue (`data-el-word`) so clearing puts it back. */
  const captionWords = elements?.caption?.word ?? mediaCaption ?? null;

  /* ── THE COVER PLATE (photo/video demoted below the type) — one markup for
     every design of the plain masthead. See the note inside. */
  /* 🖼 ONE BACKGROUND (owner 2026-10-15, "Yes, one background"): with a Cover Scene ground the picture IS the screen —
     the photo plate under the words is not drawn a second time. */
  const coverPlate = mediaSlot && !ground ? (
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
      {/* 🖼 THE PHOTO IS A PART (owner-approved 2026-10-16, "SIX NEW EFFECTS"): its key in the Maker's canvas, and its
          own motion — Reveal ▾ (Develop · Curtain on the picture), its Action (Drift on the box; Ken Burns on the
          picture; Light leak over it; Still) — through the SAME hooks every cover part wears (`hubElementMotionAttr`).
          NOT a cover line (`line()`): the plate keeps its place under the veil exactly as before. A photo that stores
          nothing draws byte for byte as before. */}
      <div
        {...(stampElements ? { 'data-el': 'photo' } : {})}
        {...hubElementMotionAttr(elements?.photo)}
        style={hubElementInlineStyle(elements?.photo)}
        className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink/10 sm:aspect-[3/2]"
      >
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
        <div
          {...(hubElementPhotoParallax(elements?.photo) ? { 'data-pahina-parallax': '' } : {})}
          {...(stampElements || elements?.photo?.motion ? { 'data-el-pic': '' } : {})}
          className="absolute inset-0"
        >
          {mediaSlot}
        </div>
        {/* 🖼 Light leak — drawn where it is chosen; on the Maker's canvas always, shown only while it is (a pick then
            needs no redraw — `globals.css` hides it on a photo that does not leak). */}
        {stampElements || elements?.photo?.motion?.during === 'leak' ? <PhotoLightLeak /> : null}
      </div>
      {captionWords ? (
        <figcaption
          {...el('caption')}
          {...(stampElements ? { 'data-el-word': mediaCaption ?? '' } : {})}
          /* The plate bleeds `-mx-4` past the column; a centred caption (The
             Card) sits inside it anyway, a ranged-left one (The Letter) would
             start 16px off the phone's edge — so off the default the caption
             keeps the column's own gutter. */
          className={`mt-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55${
            design === HERO_DESIGN_DEFAULT ? '' : ' px-4 sm:px-0'
          }`}
        >
          {txt('caption', captionWords)}
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
    const eyebrowAuto = card ? card.eyebrow : eyebrow;
    const eyebrowText = eyebrowAuto ? (ownEyebrow ?? eyebrowAuto) : null;
    const HUB_LINK = hubLink(design === 'letter' ? 'start' : 'center');
    const TIME = timeLabel ? (
      <p {...el('time')} className="mt-2 text-xs uppercase tracking-[0.24em] text-ink/70">
        {txt('time', timeLabel)}
      </p>
    ) : null;
    const VENUE = !card && venueName ? venuePart(venueName) : null;
    const LINE = lineText ? (
      <p
        {...el('line')}
        className={`mt-4 text-base leading-relaxed text-ink/80 ${design === 'letter' ? 'max-w-[24ch]' : 'mx-auto max-w-[26ch]'}`}
      >
        {txt('line', lineText)}
      </p>
    ) : null;
    /* The names, stacked on a phone; from `sm` The Marquee and The Crest set
       them on one wrapping row with the joiner inline, as the prototype does. */
    /* The joiner and the second person's line — once for the names as drawn, once for the canvas's template. */
    const PAIR = (joiner: ReactNode, second: ReactNode, forCanvas?: boolean) => (
      <>
        <span
          {...joinerStamp(forCanvas)}
          className={
            design === 'marquee'
              ? 'block font-pahina text-[0.5em] italic leading-[1.1] text-gild sm:inline sm:text-[0.55em]'
              : design === 'crest'
                ? 'font-pahina text-[0.9em] italic text-gild'
                : 'ml-[0.06em] block font-pahina text-[0.4em] italic leading-[1.1] text-gild'
          }
          aria-hidden
        >
          {joiner}
        </span>
        <span {...secondStamp(forCanvas)} className={design === 'crest' ? undefined : design === 'marquee' ? 'block sm:inline' : 'block'}>
          {second}
        </span>
      </>
    );
    const NAMES = (
      <h1
        {...el('names')}
        data-motion="arrive-names" data-hub-names=""
        className={
          design === 'marquee'
            ? 'mt-5 font-pahina text-[clamp(2.75rem,15vw,5.5rem)] font-light leading-[0.98] tracking-tight text-ink [overflow-wrap:anywhere] [text-wrap:balance] sm:flex sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-[0.24em] sm:text-[5.5rem]'
            : design === 'crest'
              ? 'mt-6 flex flex-wrap items-baseline justify-center gap-x-[0.3em] font-pahina text-[clamp(1.5rem,7vw,2.25rem)] font-light leading-[1.1] text-ink [overflow-wrap:anywhere] sm:text-[2.5rem]'
              : 'mt-3 font-pahina text-[clamp(2.75rem,14vw,5.5rem)] font-light leading-[0.98] tracking-tight text-ink [overflow-wrap:anywhere] sm:text-[5.5rem]'
        }
      >
        <span {...person(0)} className={design === 'crest' ? undefined : 'block sm:inline'}>{txt('names', names.first, whole, 0)}</span>
        {names.second ? PAIR(txt('names', joinerWord, whole, names.first.length), txt('names', names.second, whole, names.first.length + joinerWord.length)) : null}
        {namesTwo(PAIR)}
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
          design === 'crest' ? 'uppercase tracking-[0.26em] text-ink/70' : 'font-pahina text-ink'
        }`}
      >
        {design === 'crest' ? (
          <span className="text-xs">{dateWords}</span>
        ) : (
          <span className="text-2xl sm:text-[1.65rem]">{dateWords}</span>
        )}
      </p>
    ) : null;

    if (design === 'marquee') {
      return (
        <header data-pahina-first-screen="" {...{ [HERO_DESIGN_ATTR]: design, ...cover }} className={`${COVER_SCENE_UPPER} text-center${coverBox}`}>
        {coverGround}
          {badge}
          <div>
            {eyebrowText ? (
              <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/70">
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
          {foot}
        </header>
      );
    }

    if (design === 'crest') {
      return (
        <header data-pahina-first-screen="" {...{ [HERO_DESIGN_ATTR]: design, ...cover }} className={`${COVER_SCENE_UPPER} text-center${coverBox}`}>
        {coverGround}
          {badge}
          <div>
            {eyebrowText ? (
              <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/70">
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
          {foot}
        </header>
      );
    }

    /* The Letter — ranged left, anchored low on a phone (the header fills
       most of the first screen and its words sit at the foot); from `sm` it is
       a left column with the mark above the words. */
    return (
      <header
        data-pahina-first-screen=""
        {...{ [HERO_DESIGN_ATTR]: design, ...cover }}
        /* 🖼 The Cover Scene fills the whole first screen on every device (owner 2026-10-15) — and its words sit in the
           UPPER part (owner 2026-10-16): The Letter keeps its ranged-left column, now from the top, the mark above it. */
        className={`relative flex ${COVER_SCENE_SCREEN} flex-col justify-start pt-[clamp(36px,7svh,58px)] text-left${ground ? ' isolate' : ''}`}
      >
        {coverGround}
        {monogramSlot ? (
          <div
            {...el('mark')}
            data-motion="arrive-mark"
            /* In flow above the words (they start at the top now, 2026-10-16), so the Happening-now pill below it
               never lands on top of it. */
            className="mb-6 flex h-12 w-12 items-center justify-center sm:h-16 sm:w-16"
          >
            <span className="block scale-[0.6] sm:scale-[0.8]">{monogramSlot}</span>
          </div>
        ) : null}
        <div className="pr-[14%] sm:max-w-[60%] sm:pr-0">
          {badge ? <div className="mb-4 flex justify-start">{badge}</div> : null}
          {eyebrowText ? (
            <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.26em] text-ink/70">
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
        {foot}
      </header>
    );
  }

  if (card) {
    return (
      <header data-pahina-first-screen="" {...cover} className={`${COVER_SCENE_UPPER} text-center${coverBox}`}>
        {coverGround}
        {badge}
        {/* 🖼 THE COVER LOSES ITS FRAME (owner 2026-10-06, DECISION_LOG "THE COVER
            LOSES ITS FRAME, WEARS THE GLOBAL BACKGROUND"; 2026-10-07 *"for
            everyone"*): no paper card, no gold hairline — the words sit on the
            Event Hub's main background, in the page's own adaptive inks (the
            same ground and the same legibility rule every other part reads). */}
        <div data-cover-frameless="" className="mx-auto max-w-md">
          <div className="px-5 pb-7 pt-8">
            <p {...el('eyebrow')} className="text-xs uppercase tracking-[0.36em] text-ink/70">{txt('eyebrow', ownEyebrow ?? card.eyebrow)}</p>
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
              data-motion="arrive-names" data-hub-names=""
              className="mt-5 font-pahina text-[2.9rem] font-light leading-[1.06] tracking-tight text-ink"
            >
              <span {...person(0)} className="block">{txt('names', names.first, cardNames, 0)}</span>
              {names.second ? cardPair(txt('names', cardJoiner, cardNames, names.first.length), txt('names', names.second, cardNames, names.first.length + cardJoiner.length)) : null}
              {namesTwo(cardPair)}
            </h1>
            {lineText ? <p {...el('line')} className="mt-4 text-sm leading-relaxed text-ink/80">{txt('line', lineText)}</p> : null}
            {dateLabel ? (
              /* The face and colour on the part, so the couple's own reach the
                 words (see the designs' DATE above). */
              <p {...el('date')} data-motion="arrive-date" className="mt-4 flex items-center justify-center gap-3 font-pahina text-ink">
                <span aria-hidden className="h-px w-5 bg-gild/60" />
                <span className="text-xl">{dateWords}</span>
                <span aria-hidden className="h-px w-5 bg-gild/60" />
              </p>
            ) : null}
            {timeLabel ? (
              <p {...el('time')} className="mt-2 text-xs uppercase tracking-[0.24em] text-ink/70">{txt('time', timeLabel)}</p>
            ) : null}
          </div>
        </div>
        {hubLink('center')}
        {foot}
      </header>
    );
  }

  return (
    <header data-pahina-first-screen="" {...cover} className={`${COVER_SCENE_UPPER} text-center${coverBox}`}>
        {coverGround}
      {badge}
      {/* owner 2026-09-25 "drop the numbers": the chapter numeral is gone —
          hiding a section no longer leaves a gap in a numbered sequence.
          When there is no eyebrow (the solemn register), render no row at
          all rather than an empty one with a stray decorative rule. */}
      {eyebrow ? (
        <p {...el('eyebrow')} className="pahina-eyebrow justify-center">
          {/* In the Maker: the words the canvas types into, and the page's own to put back. */}
          <span {...(stampElements ? { 'data-el-words': '', 'data-el-word': eyebrow } : {})}>{txt('eyebrow', ownEyebrow ?? eyebrow)}</span>
        </p>
      ) : null}
      {monogramSlot ? <div {...el('mark')} data-motion="arrive-mark" className="mt-6 flex justify-center">{monogramSlot}</div> : null}

      {/* Stacked names — Fraunces display, italic gild joiner between lines. */}
      <h1 {...el('names')} data-motion="arrive-names" data-hub-names="" className="mt-6 font-pahina text-[2.9rem] font-light leading-[1.04] tracking-tight text-ink sm:text-6xl">
        <span {...person(0)} className="block">{txt('names', names.first, plainNames, 0)}</span>
        {names.second ? plainPair(txt('names', plainJoiner, plainNames, names.first.length), txt('names', names.second, plainNames, names.first.length + plainJoiner.length)) : null}
        {namesTwo(plainPair)}
      </h1>

      <hr {...line()} className="pahina-rule mx-auto mt-7 w-24" />

      {/* The gild date — oversized lining numerals; venue meta beneath. */}
      {dateLabel ? (
        <p {...el('date')} data-motion="arrive-date" className="mt-6 font-pahina text-[clamp(1.6rem,6vw,2.4rem)] font-light tracking-tight text-gild">
          {dateWords}
        </p>
      ) : null}
      {venueName ? venuePart(venueName) : null}

      {/* Cover plate — the photo/video demoted below the type, framed like a
          printed plate with a mono caption. Only when media exists. */}
      {coverPlate}
      {foot}
    </header>
  );
}

/* ── 🎨 THE PARTS' OWN STYLES that lay their words out differently (`lib/scene-styles-parts.ts`) ── */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** The date in pieces, for Big day (weekday · day · month year) and Numerals (dd.mm.yy). Null: the line as written. */
function partDateWords(look: string | null, iso: string | null): ReactNode | null {
  if (look !== 'date.big-day' && look !== 'date.numerals') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (look === 'date.numerals') {
    return <span data-date-piece="figures">{`${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${String(y).slice(2)}`}</span>;
  }
  return (
    <>
      <span data-date-piece="weekday">{WEEKDAYS[day.getUTCDay()]}</span>
      <span data-date-piece="day">{d}</span>
      <span data-date-piece="month">{`${MONTHS[mo - 1]} ${y}`}</span>
    </>
  );
}

/** The place in two pieces for Name first — the place, then the city (after the last comma or ·). Null: as written. */
function partPlaceWords(look: string | null, name: string): ReactNode | null {
  if (look !== 'venue.name-first') return null;
  const cut = Math.max(name.lastIndexOf(','), name.lastIndexOf('·'));
  const place = (cut > 0 ? name.slice(0, cut) : name).trim();
  const city = cut > 0 ? name.slice(cut + 1).trim() : '';
  return (
    <>
      <span data-place-piece="name">{place}</span>
      {city ? <span data-place-piece="city">{city}</span> : null}
    </>
  );
}

/**
 * ✨ ONE PIECE OF A PART'S TEXT, CUT FOR WORD BY WORD · SPREAD · GLOW (`lib/part-fx.ts`): a span per word — its place in
 * the stagger (`--el-fx-i`) and the copy Glow blurs under it (`data-t`) — and, for Spread on a short part, a span per
 * letter with its start (`--el-fx-x`). The spaces stay text. What CSS does with them is `globals.css` "THE SIX NEW
 * EFFECTS", behind the reduced-motion gate; outside it the spans are plain inline text, the words at rest.
 */
export function fxWords(text: string, whole: string, start: number, cut: HubFxCut): ReactNode[] {
  return hubFxPieces(text, whole, start, cut).map((p, k) =>
    'space' in p ? (
      p.space
    ) : (
      <span key={k} {...{ [HUB_FX_WORD_ATTR]: '' }} data-t={p.word} style={{ '--el-fx-i': p.i } as CSSProperties}>
        {p.letters
          ? p.letters.map((l, j) => (
              <span key={j} {...{ [HUB_FX_LETTER_ATTR]: '' }} style={{ '--el-fx-x': l.x } as CSSProperties}>
                {l.c}
              </span>
            ))
          : p.word}
      </span>
    ),
  );
}

/**
 * 🖼 LIGHT LEAK INSIDE THE PHOTO — the shipped background Light leak ◆ (`lib/ambient-effects.ts` `leak`, the eight
 * effects' ONE drawing) laid over the cover's photo and clipped to it (owner-approved 2026-10-16, "Light leak reuses the
 * shipped ambient `leak`"): `AMBIENT_PHOTO_LEAK_SPEC`. Its reduced-motion still is the ambient sheet's own; Save-Data's
 * is `globals.css`'s.
 */
export function PhotoLightLeak() {
  return (
    <span data-el-leak="" aria-hidden className="pointer-events-none absolute inset-0">
      <AmbientEffectLayer spec={AMBIENT_PHOTO_LEAK_SPEC} className="absolute inset-0" />
    </span>
  );
}
