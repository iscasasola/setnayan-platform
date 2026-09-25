'use client';

import { HUB_FONTS, hubFontPreviewStack } from '@/lib/hub-fonts';
import {
  MAGIC_TRAVELLERS,
  MAGIC_TRAVELLER_LABEL,
  MAGIC_TRAVELLER_NOTE,
} from '@/lib/magic-move';
import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Lock } from 'lucide-react';
import { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { unlockLabel } from './unlock-label';
import { HubDraftField } from '../../_components/hub-draft-field';

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
        <Lock aria-hidden className="h-3 w-3" strokeWidth={2.5} />
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
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  rowKey: string;
  bgColor: string | null;
  buttonColor: string | null;
  /** Pahina art direction (PR-5b) — 'candlelight' is the dark direction. */
  artDirection: 'daylight' | 'candlelight' | null;
  /** The couple's saved typeface, or null for the theme's own. */
  fontKey?: string | null;
  /** Which element travels as a guest scrolls, or null for nothing. */
  magicTraveller?: string | null;
  /** The Pro half (buttons, face, art direction, magic move) is locked — the
   *  background colour stays editable, because it is free (owner 2026-09-24).
   *  Its fields are then NOT rendered, and the action reads an absent field as
   *  "unchanged", so a free couple's save cannot touch the Pro half. */
  proLocked?: boolean;
  /** The lock shown in place of the Pro half — an ELEMENT, never a function. */
  proLock?: React.ReactNode;
}) {
  return (
    <form action={action} className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
      {/* Into the draft (`updateSiteColors`' door) — a free couple may TRY the
          Pro half here and pays at Apply. */}
      <HubDraftField />
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=${rowKey}`}
      />
      <div className="grid grid-cols-2 gap-3">
        <HexField
          id={`${rowKey}-bg`}
          name="bg_color"
          label="Background"
          defaultValue={bgColor}
        />
        {proLocked ? null : (
          <HexField
            id={`${rowKey}-button`}
            name="button_color"
            label="Buttons"
            defaultValue={buttonColor}
          />
        )}
      </div>
      <p className="mt-1.5 text-[0.7rem] text-ink/45">
        Leave blank to use your Mood Board palette.
      </p>

      {proLocked ? (
        <>
          <div className="mt-3">{proLock}</div>
          <SaveButton />
        </>
      ) : (
      <>

      {/* Candlelight (design spec §4) — the second half of the Pro colour row.
          A radio pair rather than a checkbox so the form ALWAYS posts one of the
          two values: the action treats an absent field as "leave unchanged", and
          an unchecked checkbox posts nothing, which would make the dark
          direction impossible to turn back off from this panel. */}
      <fieldset className="mt-3 border-t border-dashed border-ink/10 pt-3">
        <legend className="sr-only">Art direction</legend>
        <p className="text-[0.72rem] font-semibold text-ink/80">Art direction</p>
        <div className="mt-1.5 flex gap-4">
          {(
            [
              ['daylight', 'Daylight', 'Light paper — the default.'],
              ['candlelight', 'Candlelight', 'Dark, warm, evening.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-1.5">
              <input
                type="radio"
                name="site_art_direction"
                value={value}
                defaultChecked={(artDirection ?? 'daylight') === value}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[0.72rem] font-medium text-ink">{label}</span>
                <span className="block text-[0.66rem] leading-tight text-ink/45">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ══ THE TYPEFACE ═════════════════════════════════════════════════
          Owner's Pro list names "Custom Fonts". A FIXED list, because
          `next/font` resolves at build time: every face here is already served
          from our own origin, so choosing one costs a guest nothing and cannot
          fail. A couple-uploaded file would mean a runtime `@font-face` against
          R2 on a guest's first paint and a face that fails to load SILENTLY —
          the page simply set in something else, with nothing logged.

          🔑 EACH NAME IS SET IN ITS OWN FACE. A list of font names all rendered
          in the same type tells the couple nothing; this is the one control on
          the page where the label IS the preview.

          ⛔ "The theme's own" is always first and always available — a couple
          must be able to take a choice back. It posts `''`, which the action
          reads as "clear", distinct from an absent field meaning "unchanged". */}
      <fieldset className="mt-3 border-t border-dashed border-ink/10 pt-3">
        <legend className="sr-only">Typeface</legend>
        <p className="text-[0.72rem] font-semibold text-ink/80">Typeface</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-ink/12 px-2 py-1.5">
            <input
              type="radio"
              name="site_font_key"
              value=""
              defaultChecked={!fontKey}
            />
            <span className="text-[0.72rem] text-ink/70">The theme&rsquo;s own</span>
          </label>
          {HUB_FONTS.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-ink/12 px-2 py-1.5"
            >
              <input
                type="radio"
                name="site_font_key"
                value={f.key}
                defaultChecked={fontKey === f.key}
              />
              <span className="min-w-0">
                <span
                  className="block truncate text-[0.95rem] leading-tight text-ink"
                  style={{ fontFamily: hubFontPreviewStack(f.key) }}
                >
                  {f.label}
                </span>
                <span className="block text-[0.62rem] leading-tight text-ink/45">{f.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ══ MAGIC MOVE ═══════════════════════════════════════════════════
          Owner, 2026-09-23: element animation is *"something I really want"*,
          and *"the idea is like how keynote's magic move operate"*.

          🔑 IT IS A DIFFERENT KIND OF MOTION FROM THE CANVAS, and the copy has
          to say so. Everything in "How it moves" is a HANDOVER — one section
          fades out, the next fades in. This is one element staying on screen
          and travelling between two real places. A couple reading "animation"
          twice in one editor would reasonably expect them to be the same knob.

          ⛔ "Nothing travels" is first, always available, and posts `''` — the
          action reads that as "clear", distinct from an absent field meaning
          "unchanged", exactly as the typeface above does. A couple must be able
          to take this back, and this is the first motion on the guest page that
          moves an element ACROSS the viewport. */}
      <fieldset className="mt-3 border-t border-dashed border-ink/10 pt-3">
        <legend className="sr-only">Magic Move</legend>
        <p className="text-[0.72rem] font-semibold text-ink/80">Magic Move</p>
        <p className="mt-0.5 text-[0.62rem] leading-snug text-ink/45">
          One thing stays on screen and travels as your guests scroll — not a fade from one
          section to the next.
        </p>
        <div className="mt-1.5 grid gap-1.5">
          <label className="flex cursor-pointer items-start gap-1.5 rounded-md border border-ink/12 px-2 py-1.5">
            <input
              type="radio"
              name="site_magic_traveller"
              value=""
              defaultChecked={!magicTraveller}
              className="mt-0.5"
            />
            <span className="text-[0.72rem] text-ink/70">Nothing travels</span>
          </label>
          {MAGIC_TRAVELLERS.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-start gap-1.5 rounded-md border border-ink/12 px-2 py-1.5"
            >
              <input
                type="radio"
                name="site_magic_traveller"
                value={t}
                defaultChecked={magicTraveller === t}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-[0.72rem] leading-tight text-ink">
                  {MAGIC_TRAVELLER_LABEL[t]}
                </span>
                <span className="block text-[0.62rem] leading-snug text-ink/45">
                  {MAGIC_TRAVELLER_NOTE[t]}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[0.62rem] leading-snug text-ink/45">
          Guests who have asked their phone for less motion see it sit still instead — nothing
          is lost, it simply stays where it is.
        </p>
      </fieldset>

      <SaveButton />
      </>
      )}
    </form>
  );
}

function HexField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string | null;
}) {
  // The swatch IS the picker (owner 2026-07-25): a native color input drives a
  // hidden text field so blank ( = "use my Mood-Board palette") stays possible —
  // <input type="color"> alone always posts a value, so it can never mean "unset".
  const [hex, setHex] = useState<string>(defaultValue ?? '');
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.7rem] font-semibold text-ink/60">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-7 w-7 shrink-0">
          <input
            id={id}
            type="color"
            aria-label={`Pick ${label.toLowerCase()} color`}
            value={hex || '#f4ecdd'}
            onChange={(e) => setHex(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer rounded-full border border-ink/15 p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none"
          />
        </span>
        <input type="hidden" name={name} value={hex} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink/60">
          {hex || 'Palette (default)'}
        </span>
        {hex ? (
          <button
            type="button"
            onClick={() => setHex('')}
            className="shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-[0.62rem] font-medium text-ink/55 hover:border-ink/30"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
