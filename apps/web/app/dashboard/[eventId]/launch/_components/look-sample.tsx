'use client';

import { useEffect, useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { backgroundLayOf, lookGroundPictures, type LookGroundSources } from '@/lib/background-pick';
import { LANDING_WORDS } from '@/lib/guest-landing';
import { AmbientEffectLayer } from '@/app/[slug]/_components/ambient-effect';
import { ambientWash } from '@/lib/ambient-effects';
import { hubMainEffect, isHubMainFollow, type HubMainGround } from '@/lib/hub-canvas';
import type { InviteThemeId } from '@/lib/invite-themes';
import { lookEffectOn, lookSampleEffect, lookSampleGround, lookSampleScope, type LookSampleRow } from '@/lib/look-sample';
import { lookSampleVersion, readLookSample, subscribeLookSample, tellLookSampleWorn, type LookSampleValues } from '@/lib/look-sample-store';
import { boardWithMainColours, mainColoursOf, type MainColourDraft } from '@/lib/main-colours';
import { LOOK_SECTION_ITEM_KEYS } from '@/lib/maker-details-items';
import { holdCanvasRedraw } from '@/lib/maker-refresh';
import { tellFilmLoad } from '@/lib/pick-load';
import { isStdLibrarySrc } from '@/lib/std-backgrounds';
import { LoopPicture } from '../../website/editor/_components/background-cards';
import { StillOverSwatch } from '../../website/editor/_components/main-background-panel';
import { useMaker } from './maker-context';

/**
 * 🪟 STUDIO › LOOK'S SAMPLE SCREEN — a sample of the header text and the buttons, on the real background.
 *
 * Owner, 2026-10-08 (DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF WHAT IS BEING EDITED — NOT THE COVER PAGE";
 * approved prototype `background_sources_amend_2026-10-08_fable.html`, part D): *"our preview should not be this.
 * but a sample of the header text, buttons on the actual screen"* · *"this should be a preview of whatever we edit
 * here."*
 *
 * WHAT IT DRAWS, top to bottom — the prototype's `.spec`: the small label · the names in the Headings face with
 * the "&" in Accent 2 · a short rule · the date · one line of text · the two real buttons · and one row that
 * carries the styles the rest of the page uses: a section heading ("Our day"), a link ("Directions") and a caption
 * with a code in the fixed mono — so EVERY text style a font or colour change touches is on the sample (round 3,
 * note § 2.B "two fonts, nine text styles, one fixed mono"). Under the words: the page's own paper (a colour or a
 * blend), or the picture / film behind every scene with the veil the page's rule measures over it.
 *
 * 🔑 IT IS A PIECE OF THE GUEST PAGE, NOT A DRAWING OF ONE. The root wears exactly what the guest scope wears
 * (`GuestLookScope`: `sn-editorial`, `data-hub-theme`, `data-art`, the Buttons attributes, the inline variables),
 * resolved by the guest page's own sequence (`lib/look-sample.ts`), and the buttons are the guest page's classes
 * (`.button-primary` · `.button-secondary`). So a colour, a font or a shape shows here as it will show to a guest.
 *
 * ⚡ NO REQUEST. Everything is in hand: the server hands the drafted values once (`seed`, from reads the Maker
 * already made), and each Look control tells what it just drew (`lib/look-sample-store.ts`) — the sample redraws in
 * the browser. It mounts no guest-page frame; the only bytes it can ask for are the background's own still and
 * film, the same stable addresses the card it was picked from already drew.
 */
export type LookSampleSeed = {
  eventId: string;
  themeId: InviteThemeId;
  /**
   * The theme's own faces — the class names the guest scope wears for them (`siteSkin(theme).className`, the
   * `next/font` variables). Resolved on the server, where the guest layout resolves it; '' for Classic.
   */
  fontClassName: string;
  /** The look columns, the draft over live. */
  row: LookSampleRow;
  /** The main background, the draft over live. */
  main: HubMainGround | null;
  /** The cover photo's ref — a stored follow is the cover only while it is this photo. */
  coverRef: string | null;
  sources: LookGroundSources;
  words: { names: string | null; date: string | null; line: string | null };
  musicOn: boolean;
};

/** The sample's own words where the event has none yet — never an empty header. */
const SAMPLE_NAMES = 'Your names';
const EYEBROW = 'Together with their families';
const BLUR_PX = { soft: 5, strong: 14 } as const;

function useLookSample(seed: LookSampleSeed) {
  /* One number that moves with every tell — the values themselves are read (and settled against the server's) in render. */
  useSyncExternalStore(subscribeLookSample, lookSampleVersion, lookSampleVersion);
  const server: LookSampleValues & { music: boolean } = {
    main: seed.main,
    five: mainColoursOf(seed.row.role_palette, seed.themeId),
    bg: seed.row.site_bg_color,
    art: seed.row.site_art_direction,
    fontKey: seed.row.site_font_key,
    roles: seed.row.site_roles ?? null,
    buttonStyle: seed.row.site_button_style,
    buttonColour: seed.row.site_button_color,
    music: seed.musicOn,
  };
  const now = readLookSample(seed.eventId, server);
  /* The five are laid into the board only while a pick is newer than the server's — else the board is used as it is. */
  return { ...now, fivePicked: now.five.join() === server.five.join() ? null : now.five };
}

/** Is Look's sample the screen — a Look item open in the Maker's Details? (`theme` = the whole Look.) */
export function lookSampleOnScreen(selection: { kind: string; key?: string } | null | undefined, detailsItem: string | null | undefined): boolean {
  if (!selection || selection.kind !== 'tool' || selection.key !== 'details') return false;
  return detailsItem === 'theme' || (LOOK_SECTION_ITEM_KEYS as readonly string[]).includes(detailsItem ?? '');
}

export function LookSample({ seed }: { seed: LookSampleSeed }) {
  const maker = useMaker();
  const now = useLookSample(seed);
  /* ⚡ While the sample is the screen the stage canvas is hidden — it is not re-rendered per pick. It redraws once,
     when Stages (or any page) is shown again, and only if a pick asked (`holdCanvasRedraw`). */
  const onScreen = lookSampleOnScreen(maker?.selection ?? null, maker?.detailsItem ?? null);
  useEffect(() => {
    holdCanvasRedraw(onScreen);
    return () => holdCanvasRedraw(false);
  }, [onScreen]);
  const five = now.fivePicked;
  const rolesKey = JSON.stringify(now.roles ?? null);
  const fiveKey = five ? five.join() : '';

  /* The drafted row with every pick laid over — what the guest page would read after Apply. */
  const row: LookSampleRow = useMemo(
    () => ({
      role_palette: five
        ? boardWithMainColours(seed.row.role_palette, Object.fromEntries(five.map((hex, i) => [String(i), hex])) as MainColourDraft, seed.themeId)
        : seed.row.role_palette,
      site_bg_color: now.bg ?? null,
      site_button_color: now.buttonColour ?? null,
      site_button_style: now.buttonStyle ?? null,
      site_font_key: now.fontKey ?? null,
      site_roles: now.roles ?? null,
      site_art_direction: now.art ?? null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fiveKey` is the five by content
    [seed.row.role_palette, seed.themeId, fiveKey, now.bg, now.buttonColour, now.buttonStyle, now.fontKey, rolesKey, now.art],
  );
  const main = now.main ?? null;
  const followsCover = isHubMainFollow(main) ? main.of === seed.coverRef : false;
  /* A follow whose photo is gone is not on the page — it wears the theme's own ground (`resolveMainGround`). */
  const drawn: HubMainGround | null = isHubMainFollow(main) && !followsCover ? null : main;

  const scope = useMemo(() => lookSampleScope(row, seed.themeId), [row, seed.themeId]);
  const ground = useMemo(() => lookSampleGround(drawn, row, seed.themeId, followsCover), [drawn, row, seed.themeId, followsCover]);
  const lay = useMemo(
    () =>
      backgroundLayOf(
        /* Nothing stored = the theme's own ground, exactly as `{ ground: 'theme' }` draws it. */
        { main: drawn ?? { ground: 'theme' }, bg: row.site_bg_color },
        lookGroundPictures(seed.sources, isStdLibrarySrc),
        { scrim: ground.scrim, vars: ground.vars },
        /* The paper (and its blend) is the scope's own — a colour or a pattern paints none of its own here. */
        true,
      ),
    [drawn, row.site_bg_color, seed.sources, ground],
  );
  const picture = lay && lay.still ? lay : null;
  /* ✨ THE EFFECT ON TOP (owner 2026-10-08) — what it lies on is measured ONCE here (`lookEffectOn`: the guest page asks
     the same function of the event's own columns), and the effect is `lookSampleEffect` of it: the guest page's own
     answer, so this is what a guest will see. The effect is read off the STORED background — a follow whose photo is
     gone still carries it. */
  const effect = hubMainEffect(main);
  const effectKey = effect ? `${effect.kind}:${effect.intensity}:${effect.colour ?? ''}` : '';
  const effectOn = useMemo(() => lookEffectOn(drawn, row, seed.themeId, followsCover, { scope, ground }), [drawn, row, seed.themeId, followsCover, scope, ground]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `effectKey` is the effect by content
  const fx = useMemo(() => lookSampleEffect(effect, effectOn), [effectKey, effectOn]);
  /* The Effects cards draw their miniatures over what THIS screen is drawing over — told after the render, never in it. */
  const wornVeil = effectOn.veil ? ambientWash(effectOn.veil.color, effectOn.veil.opacity) : null;
  useEffect(() => {
    tellLookSampleWorn(seed.eventId, { ground: effectOn.ground, five: effectOn.five, veil: wornVeil, names: seed.words.names });
  }, [seed.eventId, seed.words.names, effectOn, wornVeil]);

  const style = {
    /* The couple's fonts are IN the scope's variables (`proSiteVarsFor` → `hubFontVars`, then `siteFontLook`) — as on the
       guest page. They are not spread a second time: that put the Names face back over a Headings face. */
    ...(scope.vars ?? {}),
    ...(scope.buttons?.vars ?? {}),
    /* A picture's tint and a dark shade's flipped words win over the scope, as the guest page's `!important` sheet does. */
    ...(picture ? ground.vars : {}),
  } as CSSProperties;

  const [first, second] = splitNames(seed.words.names);
  const moving = Boolean(picture?.clip);
  const blur = picture?.blur ? { filter: `blur(${BLUR_PX[picture.blur]}px)`, transform: 'scale(1.08)' } : undefined;
  const drifting = !moving && drawn !== null && 'motion' in drawn && drawn.motion === 'parallax';
  const speaker = maker?.detailsItem === 'music' && now.music === true;

  return (
    <div
      data-look-sample=""
      /* 🌑 A LIVE PREVIEW STAYS CLEAR behind a pop-up (owner 2026-10-08) — a sheet's dark is cut around this box. */
      data-popup-clear=""
      data-look-sample-ground={picture ? (moving ? 'film' : 'picture') : scope.ombre ? 'blend' : 'colour'}
      /* The guest scope's own marks — see the docblock. Not `contents`: here the scope IS the box. */
      className={`sn-editorial relative isolate flex min-h-[250px] w-full flex-1 flex-col overflow-hidden bg-cream text-ink ${scope.theme ? seed.fontClassName : ''}`.trim()}
      data-hub-theme={scope.theme ?? undefined}
      data-art={scope.art ?? undefined}
      data-guest-look=""
      data-hub-btn-shape={scope.buttons?.shape ?? undefined}
      data-hub-btn-paint={scope.buttons?.paint ?? undefined}
      /* 🔤 The marks of the fonts the couple chose — the guest scope's own attribute, so the page's own rules apply here. */
      data-hub-roles={scope.roles ?? undefined}
      style={style}
      aria-label="Sample of your Event Hub"
      role="img"
    >
      {/* 🌈 The paper: the page colour, or its blend (`ombreLook`'s own CSS, its veil baked in). */}
      {scope.ombre && !picture ? <div aria-hidden data-look-sample-ombre="" className="absolute inset-0 -z-10" style={{ backgroundImage: scope.ombre }} /> : null}
      {/* 🖼 The picture or the film behind every scene — its still first, the film when it moves. */}
      {picture ? (
        <div aria-hidden data-look-sample-picture="" className="absolute inset-0 -z-10 overflow-hidden">
          <div className={`absolute inset-0${drifting ? ' sn-look-sample-drift' : ''}`} style={blur}>
            {/* 🥧 The film's own figure (`buffered` / `duration` of THIS element) is told to the pick that waits for it — no request. */}
            <LoopPicture src={picture.clip} onLoad={(load) => tellFilmLoad(picture.clip, load)}>
              <StillOverSwatch src={picture.still} swatch="transparent" position={picture.position} />
            </LoopPicture>
          </div>
          {ground.veil ? (
            <div data-look-sample-veil="shade" className="absolute inset-0" style={{ backgroundColor: ground.veil.color, opacity: Number(ground.veil.opacity.toFixed(2)) }} />
          ) : ground.scrim !== null ? (
            <div data-look-sample-veil="paper" className="absolute inset-0" style={{ backgroundColor: `rgb(var(--color-cream) / ${ground.scrim.toFixed(2)})` }} />
          ) : null}
        </div>
      ) : null}
      {/* 🧵 A stored pattern, in the page's ink over the colour. */}
      {!picture && lay?.image ? (
        <div aria-hidden data-look-sample-pattern="" className="absolute inset-0 -z-10" style={{ backgroundImage: lay.image, backgroundSize: lay.size ?? undefined }} />
      ) : null}

      {/* ✨ The effect — over the background and its veil, under the words. Shapes and a stylesheet: no request. */}
      {fx ? <AmbientEffectLayer spec={fx} className="absolute inset-0 -z-10" /> : null}
      <span aria-hidden className="absolute left-2.5 top-2 z-10 text-[9px] font-bold uppercase tracking-[0.14em] text-ink/55" style={{ fontFamily: 'var(--font-app), system-ui, sans-serif' }}>
        Sample
      </span>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-[22px] py-3 text-center">
        {/* The small label — the guest page's own eyebrow style (`EYEBROW` in `post-event-scene-views.tsx`: the labels
            face, small caps spacing, the Accent deepened to read). */}
        <p data-look-sample-eyebrow="" className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em] text-terracotta-700">
          {EYEBROW}
        </p>
        {/* 🔤 THE NAMES, AS THE HERO DRAWS THEM: `font-pahina` + `data-hub-names` (`pahina-masthead.tsx`). Until 2026-10-08 this
            line was `font-display` — the headings' face — and so showed the names in a font the guest page never used for
            them: the SAMPLE was the one that was wrong. */}
        <p data-look-sample-names="" data-hub-names="" className="font-pahina text-[30px] font-medium leading-[1.05] text-ink">
          {second ? (
            <>
              {first} <em className="text-[0.85em] font-normal italic text-gild">&amp;</em> {second}
            </>
          ) : (
            first
          )}
        </p>
        <span aria-hidden data-look-sample-rule="" className="my-2 block h-px w-14 bg-gild" />
        {seed.words.date ? (
          <p data-look-sample-date="" className="font-sans text-[12.5px] tracking-[0.02em] text-ink">
            {seed.words.date}
          </p>
        ) : null}
        {seed.words.line ? (
          <p data-look-sample-line="" className="mt-1.5 font-sans text-[12px] leading-[1.45] text-ink/90">
            {seed.words.line}
          </p>
        ) : null}
        {/* The two real buttons — the guest page's own classes, never tappable here. */}
        <div aria-hidden className="pointer-events-none mt-3 flex w-full max-w-[300px] gap-2">
          <span data-look-sample-button="primary" className="button-primary min-w-0 flex-1 whitespace-nowrap px-2.5 text-[12.5px]">
            {LANDING_WORDS.reply}
          </span>
          <span data-look-sample-button="secondary" className="button-secondary min-w-0 flex-1 whitespace-nowrap px-2.5 text-[12.5px]">
            Details
          </span>
        </div>
        {/* Every other text style on the page, in one row: a section heading (the Headings face), a link, and a
            caption whose code is the fixed mono no font choice changes (`--font-space-mono`). */}
        <p aria-hidden data-look-sample-styles="" className="mt-2.5 flex items-baseline gap-3 font-sans text-[11.5px] text-ink">
          <span data-look-sample-style="heading" className="font-display text-[14px]">
            Our day
          </span>
          <span data-look-sample-style="link" className="font-medium text-link underline underline-offset-2">
            Directions
          </span>
          <span data-look-sample-style="caption" className="opacity-75">
            Table 7 · code{' '}
            <b data-look-sample-style="code" className="font-medium" style={{ fontFamily: 'var(--font-space-mono), ui-monospace, Menlo, monospace' }}>
              {sampleCode(first, second, seed.words.date)}
            </b>
          </span>
        </p>
      </div>

      {/* 🔊 Music: the speaker a guest taps, on the sample while Music is the tab open. It plays nothing here. */}
      {speaker ? (
        <span aria-hidden data-look-sample-speaker="" className="absolute bottom-2.5 right-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-terracotta-700 ring-1 ring-black/10">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

/** The caption's code — the couple's own initials and year ("M&J-2026"), as a guest's pass prints one. */
export function sampleCode(first: string, second: string | null, date: string | null): string {
  const year = /\b(?:19|20)\d\d\b/.exec(date ?? '')?.[0] ?? '2026';
  const a = first.trim().charAt(0).toUpperCase() || 'M';
  const b = second?.trim().charAt(0).toUpperCase();
  return b ? `${a}&${b}-${year}` : `${a}-${year}`;
}

/** "Maria & Jose" → the two names around the "&"; one name (or none) stays whole. */
export function splitNames(names: string | null): [string, string | null] {
  const whole = (names ?? '').trim();
  if (!whole) return [SAMPLE_NAMES, null];
  const parts = whole.split(/\s+(?:&|and)\s+/i);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : [whole, null];
}
