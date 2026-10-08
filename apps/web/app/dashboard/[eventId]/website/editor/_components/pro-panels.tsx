'use client';

import { sanitizeHubFontKey } from '@/lib/hub-fonts';
import { tellLookSample } from '@/lib/look-sample-store';
import { FontPick } from './font-pick';
import { MAGIC_TRAVELLERS, MAGIC_TRAVELLER_LABEL } from '@/lib/magic-move';
import Link from 'next/link';
import { useState } from 'react';
import { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { INVITE_THEMES, LEGACY_THEME_ALIASES, type InviteThemeId } from '@/lib/invite-themes';
import {
  BACKGROUND_EFFECTS,
  BACKGROUND_EFFECT_LABEL,
  encodeBackgroundChoice,
  ombreCss,
  ombreLook,
  parseSiteBackground,
  type BackgroundEffect,
} from '@/lib/ombre';
import { InfoTip } from '@/app/_components/info-tip';
import { unlockLabel } from './unlock-label';
import { HubDraftField } from '../../_components/hub-draft-field';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel, type PaidMarkState } from '@/lib/paid-mark';
import { ColourWell } from './colour-well';
import { PickMenu } from './pick-menu';
import { DraftsAsYouGo } from './drafts-as-you-go';
import { useMaker } from '../../../launch/_components/maker-context';

/**
 * Website Pro panels for the unified editor (PR-4).
 *
 * `ProLockPanel` is the LOCKED state of any Pro row: one honest line about what
 * the row is part of, plus the single umbrella CTA. There is deliberately no
 * per-feature buy button — the nine Pro items are ONE unlock (owner 2026-07-24),
 * so nine separate purchase affordances would misrepresent it. Its price is NOT
 * written here: the server page reads it live from `platform_retail_catalog_v2`
 * and passes the formatted string down as `priceLabel` (see `unlock-label.ts`).
 *
 * `ColorsPanel` is the first unlocked Pro panel: two hex fields posting to the
 * SAME `updateSiteColors` action the sub-page uses, with the hidden `return_to`
 * that brings the couple back to the editor (lib/editor-return.ts). Blank = fall
 * back to the Mood-Board palette, matching the action's own parse.
 *
 * Grandfathering is decided SERVER-side (page.tsx `lockedIf`) exactly as PR
 * #3664 defined it — a couple with existing content keeps editing. These
 * components only render the decision.
 */

/**
 * The nine Pro items, named the way the couple sees them.
 *
 * 🔑 THE LIST NOW LIVES IN `lib/website-pro-items.ts` AND IS RE-EXPORTED HERE
 * UNDER ITS OWN NAME — the Event Hub controller offers the same one unlock on
 * whichever channel the couple is standing on, and it needs these nine names on
 * the server. Copying them would have made two lists of one fact, each passing
 * its own suite. Nothing that imports `WEBSITE_PRO_ITEMS` from this file moves.
 */
export { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';

export function ProLockPanel({
  featureName,
  unlockHref,
  priceLabel,
}: {
  featureName: string;
  unlockHref: string;
  /** The live catalogue price, formatted — null when the catalogue did not answer. */
  priceLabel: string | null;
}) {
  return (
    <div className="border-t border-dashed border-amber-300/60 bg-amber-50/60 p-3">
      <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-amber-900">
        {/* ◆ never a padlock (owner 2026-09-28: "remove padlock … the diamond icon"). */}
        <PaidMark state="try" bare label={paidMarkLabel('try', 'Event Hub Pro')} size="xs" tone="current" />
        {featureName} is part of Event Hub PRO
      </p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink/60">
        One unlock covers all nine: {WEBSITE_PRO_ITEMS.join(' · ')}. It also removes the
        “Powered by Setnayan” mark from your page.
      </p>
      <Link
        href={unlockHref}
        className="mt-2 inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-300"
      >
        {unlockLabel(priceLabel)}
      </Link>
    </div>
  );
}

export function ColorsPanel({
  action,
  eventId,
  rowKey,
  bgColor,
  buttonColor,
  artDirection,
  fontKey = null,
  magicTraveller = null,
  proLocked = false,
  proLock = null,
  proMark = null,
  themeId = 'house',
  moodBoard = null,
  part = null,
}: {
  /**
   * 🎨 THE LOOK IS ONE PANEL (owner, live iPhone test 2026-10-02 — tracker f40;
   * `lib/maker-look-sections.ts`): Look draws this row as two of its sections,
   * in order — **Font** (`'font'`: the one font dropdown, alone) then
   * **Colours** (`'colours'`: page and button colour, Candlelight, Magic
   * Move). Each part is its own form posting only its own fields, and the
   * action reads an absent field as "unchanged", so neither part can clear the
   * other's. Null (the panel whole) is kept for the harnesses that draw it.
   *
   * 🌈 2026-10-08 (owner, the Look restudy — *"colors here is not color of the
   * background but the colors of the different fonts, and buttons and
   * highlights"*): Look draws the `'colours'` part as TWO, in two sections —
   * **`'page'`** (the page fill alone: one colour · Plain · Dawn · Diagonal ·
   * Glow) under Look › Background, and **`'art'`** (Candlelight · Magic Move,
   * the Pro half alone) under Look › Elements › Colours. Same fields, same door.
   * `'colours'` (both, one form) stays for the Event Details record row.
   */
  part?: 'font' | 'colours' | 'page' | 'art' | null;
  /**
   * 🎨 THE COLOURS THE MOOD BOARD GIVES THE PAGE (`moodBoardSiteColours`, the
   * guest page's own resolver) — what the wells show while a colour is left
   * blank, and the swatches offered first. Null = no Mood Board palette: the
   * wells then show the theme's own page and button colours.
   */
  moodBoard?: { background: string; buttons: string; swatches: string[] } | null;
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  rowKey: string;
  /** `events.site_bg_color` as stored — a plain `#rrggbb` OR an encoded ombré (`lib/ombre.ts`). */
  bgColor: string | null;
  /** The live theme — its two inks measure the effect previews. Legacy ids are read as their alias. */
  themeId?: InviteThemeId | string;
  buttonColor: string | null;
  /** Pahina art direction (PR-5b) — 'candlelight' is the dark direction. */
  artDirection: 'daylight' | 'candlelight' | null;
  /** The couple's saved typeface, or null for the theme's own. */
  fontKey?: string | null;
  /** Which element travels as a guest scrolls, or null for nothing. */
  magicTraveller?: string | null;
  /** The Pro half (face, art direction, magic move) is locked — both colours
   *  stay editable, because they are free (owner 2026-09-24 background,
   *  2026-09-28 button). Its fields are then NOT rendered, and the action reads
   *  an absent field as "unchanged", so a free couple's save cannot touch the
   *  Pro half. */
  proLocked?: boolean;
  /** The lock shown in place of the Pro half — an ELEMENT, never a function. */
  proLock?: React.ReactNode;
  /**
   * 💎 The Pro half's mark (`makerProMark`): ◆ PRO while a couple without Pro
   * tries it (owner 2026-09-28 — the pick is drafted; Apply asks), the diamond
   * once owned, none in the store shell.
   */
  proMark?: PaidMarkState | null;
}) {
  const mark = proMark ? <PaidMark state={proMark} label={paidMarkLabel(proMark, 'Event Hub Pro')} size="xs" /> : null;
  /* 🌗 In the new Maker's Studio, Candlelight is Background › Shade ▾'s darkest step (owner 2026-10-08, the Look
     restudy § 3.1) whenever the main background's panel is there to hold it — one field, one place. This
     form then posts no `site_art_direction`, which the action reads as unchanged. */
  const maker = useMaker();
  const shadeHoldsArt = part === 'art' && maker?.stagesStudio === true && Boolean(maker.lookPages?.look?.background);
  /* ══ THE TYPEFACE ═════════════════════════════════════════════════
     Owner's Pro list names "Custom Fonts". A FIXED list, because
     `next/font` resolves at build time: every face here is already served
     from our own origin, so choosing one costs a guest nothing and cannot
     fail. A couple-uploaded file would mean a runtime `@font-face` against
     R2 on a guest's first paint and a face that fails to load SILENTLY —
     the page simply set in something else, with nothing logged.

     🔤 THE ONE FONT DROPDOWN (owner 2026-09-29: "the font across all event
     hub editor. can be one style") — `FontPick`: Recently used · Most used
     · All fonts, each name SET IN ITS OWN FACE, "In use" marked. It posts
     `site_font_key` from a hidden field, exactly as the radios it replaced.

     ⛔ "The theme's own" is always first and always available — a couple
     must be able to take a choice back. It posts `''`, which the action
     reads as "clear", distinct from an absent field meaning "unchanged". */
  const typeface = (
    <fieldset className={part === 'font' ? undefined : 'mt-3 border-t border-dashed border-ink/10 pt-3'}>
      <legend className="sr-only">Typeface</legend>
      {/* 🆓 FREE since 2026-10-05 (owner: "Colors, and Fonts are all free") — no ◆. */}
      <p className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink/80">Typeface</p>
      <FontPick
        eventId={eventId}
        label="Typeface"
        name="site_font_key"
        dataAttr="data-site-font"
        value={sanitizeHubFontKey(fontKey)}
        /* 🪟 Studio › Look's sample screen sets the names in the face from the tap (`look-sample.tsx`). */
        onPick={(key) => tellLookSample(eventId, { fontKey: key })}
        lead="Default"
        className="mt-1.5 min-h-11 w-full justify-between border border-ink/15"
      />
    </fieldset>
  );
  /* 🧭 IN THE NEW MAKER'S STUDIO a Look part sits FLUSH with the rows around it (owner's preview walk 2026-10-08:
     a tall empty gap, with a hairline, between Magic Move and Palette — it was this form's own padding and rule
     stacked on the next row's). The shipped Maker keeps the panel's padded block. */
  const flush = maker?.stagesStudio === true && (part === 'art' || part === 'page' || part === 'font');
  /* A Pro half that is locked with no lock to show (the app-store shell) has nothing to draw. */
  if (part === 'art' && proLocked && !proLock) return null;
  /* ✈ MAGIC MOVE LEFT LOOK (owner 2026-10-08, on the local copy: *"remove magic move"*). Look's Colours part
     (`part="art"`) no longer draws it — and posts no `site_magic_traveller`, which the action reads as UNCHANGED:
     a mark already set to travel keeps travelling on the guest page (`the-mark-travels-or-sits-still.test.ts`).
     In the Studio, where Candlelight is Background › Shade ▾'s, that leaves this part with nothing to draw. */
  if (shadeHoldsArt) return null;
  return (
    <form action={action} data-look-form={part ?? undefined} className={flush ? 'flex flex-col' : 'border-t border-dashed border-ink/10 bg-cream/40 p-3'}>
      {/* Into the draft (`updateSiteColors`' door) — a free couple may TRY the
          Pro half here and pays at Apply. */}
      <HubDraftField />
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=${rowKey}`}
      />
      {/* ✍ Every change drafts itself — no Save button (INTERACTION_RULES §8). */}
      <DraftsAsYouGo />
      {part === 'font' ? (
        typeface
      ) : (
      <>
      {/* 🌈 THE BACKGROUND — one colour, one effect (owner 2026-09-25). One
          field, one hidden `bg_color`. Full width: the four effect chips need
          the room, and the button colour sits under it. */}
      {/* In Look the "Background" is the section above (behind every scene); here it is the page's colour. */}
      {part === 'art' ? null : (
        <BackgroundField id={`${rowKey}-bg`} value={bgColor} themeId={themeId} eventId={eventId} moodBoard={moodBoard} label={part === 'colours' || part === 'page' ? 'Page' : 'Background'} />
      )}
      {/* 🎨 Free for everyone since 2026-09-28 (owner: "change … color …
          only when you start adding themes will it be pro") — never locked.
          🔘 In Look it lives in Look › Buttons (2026-10-04) — the same
          `site_button_color`, beside the shape and fill it goes with — so the
          Colours section no longer draws it (one field, one place). This form
          then posts no `button_color`, which the action reads as unchanged. */}
      {part === 'colours' || part === 'page' || part === 'art' ? null : (
        <div className="mt-3">
          <ButtonColourField name="button_color" defaultValue={buttonColor} eventId={eventId} moodBoard={moodBoard} themeId={themeId} />
        </div>
      )}
      {part === 'page' ? null : proLocked ? (
        <div className="mt-3">{proLock}</div>
      ) : (
      <>

      {/* Candlelight (design spec §4) — ONE dropdown (owner: any set of choices
          is one dropdown). A hidden field ALWAYS posts one of the two values:
          the action treats an absent field as "leave unchanged", so the dark
          direction can always be turned back off from here. */}
      {shadeHoldsArt ? null : <ArtDirectionPick value={artDirection ?? 'daylight'} mark={mark} leads={part === 'art'} />}

      {part === 'colours' || part === 'art' ? null : typeface}

      {/* ══ MAGIC MOVE ═══════════════════════════════════════════════════
          Owner, 2026-09-23: element animation is *"something I really want"*,
          and *"the idea is like how keynote's magic move operate"*.

          🔑 IT IS A DIFFERENT KIND OF MOTION FROM THE CANVAS: everything in
          "How it moves" is a HANDOVER — one section fades out, the next fades
          in; this is one element staying on screen and travelling between two
          real places. Its option says so in its own name ("Your monogram
          travels down the page") — no caption under it (owner 2026-10-05).

          ⛔ "Nothing travels" is first, always available, and posts `''` — the
          action reads that as "clear", distinct from an absent field meaning
          "unchanged", exactly as the typeface above does. A couple must be able
          to take this back, and this is the first motion on the guest page that
          moves an element ACROSS the viewport. */}
      {part === 'art' ? null : <MagicMovePick value={magicTraveller} mark={mark} />}
      </>
      )}
      </>
      )}
    </form>
  );
}

/** The theme's own page and button colours — what a page with no Mood Board wears. */
function themeOwnColours(themeId: string) {
  const theme = INVITE_THEMES[(themeId in INVITE_THEMES ? themeId : LEGACY_THEME_ALIASES[themeId] ?? 'house') as InviteThemeId];
  return { theme, background: theme.palette.canvas, buttons: theme.palette.accent };
}

/**
 * BUTTONS — Keynote's split well (`colour-well.tsx`). Blank = the Mood Board's
 * button colour, and the well SHOWS that colour, labelled "From your Mood
 * Board" (owner 2026-09-27: *"mood board palettes did not update"* — the old
 * swatch drew a fixed cream for blank). A hidden field carries the choice, so
 * blank stays possible.
 */
function ButtonColourField({
  name,
  defaultValue,
  moodBoard,
  themeId,
}: {
  name: string;
  defaultValue: string | null;
  /** No longer read (the device's "Saved colours" went with the well's own panel, 2026-10-08) — still handed by the mount above. */
  eventId: string;
  moodBoard: { background: string; buttons: string; swatches: string[] } | null;
  themeId: string;
}) {
  const [hex, setHex] = useState<string>(defaultValue ?? '');
  const fallback = moodBoard?.buttons ?? themeOwnColours(themeId).buttons;
  const unsetLabel = moodBoard ? 'From your Mood Board' : 'Default';
  return (
    <div data-button-colour-field="">
      <p className="mb-1 text-[0.7rem] font-semibold text-ink/60">Buttons</p>
      <input type="hidden" name={name} value={hex} />
      <ColourWell
        value={hex || null}
        shown={fallback}
        what="your buttons"
        palette={moodBoard?.swatches ?? []}
        unsetLabel={unsetLabel}
        onPick={(c) => setHex(c.slice(0, 7))}
        onUnset={() => setHex('')}
        data="buttons"
      />
    </div>
  );
}

/* ══ THE BACKGROUND: ONE COLOUR, ONE EFFECT ═══════════════════════════════
   Owner, 2026-09-25, verbatim: *"so the pick a color, and you apply either
   plain, dawn, diagonal or glow effect. that's it"*. The couple picks ONE
   colour with the swatch (the same native picker the buttons use), then one of
   four effects. Each effect chip is a REAL preview derived from the colour they
   picked — drawn by the same `ombreCss` the guest paper paints with — and the
   strip under them shows the effect at size with the ink the legibility rule
   will give the page, so what the couple sees here is what a guest will read.

   One hidden `bg_color` carries the choice in the column's own text form
   (`encodeBackgroundChoice`: a hex for Plain, `ombre:<effect>:<hex>` for the
   rest, '' to clear) — the action and the draft read it through
   `parseSiteBackground`, so the panel cannot post a shape the server does not
   understand. Free: no lock, no price (`OMBRE_IS_PRO`). With no colour picked
   there is nothing to derive from, so the effects wait for the swatch. */

function BackgroundField({
  id,
  value,
  themeId,
  moodBoard,
  label = 'Background',
}: {
  label?: string;
  id: string;
  value: string | null;
  themeId: string;
  /** No longer read (the device's "Saved colours" went with the well's own panel, 2026-10-08) — still handed by the mount above. */
  eventId: string;
  moodBoard: { background: string; buttons: string; swatches: string[] } | null;
}) {
  const stored = parseSiteBackground(value);
  const { theme, background: themeGround } = themeOwnColours(themeId);

  const [hex, setHex] = useState<string>(stored ? (stored.kind === 'plain' ? stored.hex : stored.ombre.base) : '');
  const [effect, setEffect] = useState<BackgroundEffect>(stored?.kind === 'ombre' ? stored.ombre.shape : 'plain');

  const posted = encodeBackgroundChoice(hex, effect);
  /* 🎨 The colour every preview derives from: the couple's pick, else THE
     COLOUR THE PAGE ACTUALLY WEARS — the Mood Board's (`moodBoardSiteColours`,
     the guest page's own resolver), else the theme's. Never a fixed cream. */
  const resolved = moodBoard?.background ?? themeGround;
  const previewBase = hex || resolved;
  const unsetLabel = moodBoard ? 'From your Mood Board' : 'Default';
  const look = effect === 'plain' ? null : ombreLook(theme, { shape: effect, base: previewBase });

  return (
    <div data-background-field="" id={id}>
      <input type="hidden" name="bg_color" value={posted} />
      <div className="mb-1.5">
        <InfoTip label={label} labelClassName="text-[0.7rem] font-semibold text-ink/60" align="start">
          Pick one colour, then an effect. Plain is the flat colour; Dawn, Diagonal and Glow blend it
          softly, lighter and darker, like a wallpaper. Your words are re-measured over the whole
          blend so they stay easy to read.
        </InfoTip>
      </div>

      {/* THE ONE COLOUR — Keynote's split well; blank shows the colour the page wears. */}
      <ColourWell
        value={hex || null}
        shown={resolved}
        what="the page"
        palette={moodBoard?.swatches ?? []}
        unsetLabel={unsetLabel}
        onPick={(c) => setHex(c.slice(0, 7).toLowerCase())}
        onUnset={() => {
          setHex('');
          setEffect('plain');
        }}
        data="page"
      />

      {/* THE FOUR EFFECTS — each chip previews the picked colour under that effect. */}
      <div role="group" aria-label="Background effect" className="mt-2 grid grid-cols-4 gap-1.5">
        {BACKGROUND_EFFECTS.map((e) => {
          const on = effect === e;
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              data-background-effect={e}
              onClick={() => {
                /* An effect is made FROM a colour: with none picked, it takes the
                   colour the page already wears (the Mood Board's). */
                if (!hex && e !== 'plain') setHex(resolved);
                setEffect(e);
              }}
              className="group text-left transition-transform duration-300 ease-in-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                aria-hidden
                className={`block h-11 rounded-md border-2 transition-colors duration-300 ${
                  on ? 'border-ink' : 'border-ink/10 group-hover:border-ink/30'
                }`}
                style={
                  e === 'plain'
                    ? { backgroundColor: previewBase }
                    : { backgroundImage: ombreCss({ shape: e, base: previewBase }) }
                }
              />
              <span className={`mt-0.5 block text-[0.66rem] leading-tight ${on ? 'font-semibold text-ink' : 'text-ink/60'}`}>
                {BACKGROUND_EFFECT_LABEL[e]}
              </span>
            </button>
          );
        })}
      </div>

      {/* THE PREVIEW — the effect at size, with the ink the page will actually use. */}
      {look ? (
        <div
          data-ombre-preview=""
          aria-hidden
          className="mt-2 flex h-16 items-end rounded-md px-3 pb-2"
          style={{ backgroundImage: look.css }}
        >
          <span className="text-[0.72rem] font-semibold" style={{ color: look.legibility.ink }}>
            Your words read like this
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 🌗 ART DIRECTION — Daylight · Candlelight as ONE dropdown, ◆ beside its name
 * (owner, live iPhone test 2026-10-05: any set of choices is one dropdown).
 */
function ArtDirectionPick({ value, mark, leads = false }: { value: 'daylight' | 'candlelight'; mark: React.ReactNode; /** First in its form — no rule over it. */ leads?: boolean }) {
  const [art, setArt] = useState<'daylight' | 'candlelight'>(value);
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3${leads ? '' : ' mt-3 border-t border-dashed border-ink/10 pt-3'}`} data-look-art-direction="">
      <p className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink/80">Art direction{mark}</p>
      <input type="hidden" name="site_art_direction" value={art} />
      <PickMenu
        label="Art direction"
        value={art}
        dataAttr="data-art-direction-pick"
        options={[
          { key: 'daylight', label: 'Daylight' },
          { key: 'candlelight', label: 'Candlelight' },
        ]}
        onPick={(k) => setArt(k === 'candlelight' ? 'candlelight' : 'daylight')}
      />
    </div>
  );
}

/**
 * ✈ MAGIC MOVE — "Nothing travels" or the one thing that travels, as ONE
 * dropdown. "Nothing travels" is first and always there; it posts `''`, which
 * the action reads as "clear" (an absent field means "unchanged").
 */
function MagicMovePick({ value, mark, leads = false }: { value: string | null; mark: React.ReactNode; /** First in its form — no rule over it. */ leads?: boolean }) {
  const [magic, setMagic] = useState<string>(value && (MAGIC_TRAVELLERS as readonly string[]).includes(value) ? value : '');
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3${leads ? '' : ' mt-3 border-t border-dashed border-ink/10 pt-3'}`} data-look-magic-move="">
      <p className="inline-flex shrink-0 items-center gap-1.5 text-[0.72rem] font-semibold text-ink/80">Magic Move{mark}</p>
      <input type="hidden" name="site_magic_traveller" value={magic} />
      <PickMenu
        label="Magic Move"
        value={magic === '' ? 'none' : magic}
        dataAttr="data-magic-move-pick"
        options={[
          { key: 'none', label: 'Nothing travels' },
          ...MAGIC_TRAVELLERS.map((t) => ({ key: t, label: MAGIC_TRAVELLER_LABEL[t] })),
        ]}
        onPick={(k) => setMagic(k === 'none' ? '' : k)}
      />
    </div>
  );
}
