'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Lock } from 'lucide-react';
import { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';

/**
 * Website Pro panels for the unified editor (PR-4).
 *
 * `ProLockPanel` is the LOCKED state of any Pro row: one honest line about what
 * the row is part of, plus the single umbrella CTA. There is deliberately no
 * per-feature buy button — the seven Pro items are ONE ₱3,500 unlock (owner
 * 2026-07-24), so seven separate purchase affordances would misrepresent it.
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
 * The seven Pro items, named the way the couple sees them.
 *
 * 🔑 THE LIST NOW LIVES IN `lib/website-pro-items.ts` AND IS RE-EXPORTED HERE
 * UNDER ITS OWN NAME — the Event Hub controller offers the same one unlock on
 * whichever channel the couple is standing on, and it needs these seven names on
 * the server. Copying them would have made two lists of one fact, each passing
 * its own suite. Nothing that imports `WEBSITE_PRO_ITEMS` from this file moves.
 */
export { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';

export function ProLockPanel({
  featureName,
  unlockHref,
}: {
  featureName: string;
  unlockHref: string;
}) {
  return (
    <div className="border-t border-dashed border-amber-300/60 bg-amber-50/60 p-3">
      <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-amber-900">
        <Lock aria-hidden className="h-3 w-3" strokeWidth={2.5} />
        {featureName} is part of Event Hub PRO
      </p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink/60">
        One unlock covers all seven: {WEBSITE_PRO_ITEMS.join(' · ')}. It also removes the
        “Powered by Setnayan” mark from your page.
      </p>
      <Link
        href={unlockHref}
        className="mt-2 inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-300"
      >
        Unlock Event Hub PRO · ₱3,500
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
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  rowKey: string;
  bgColor: string | null;
  buttonColor: string | null;
  /** Pahina art direction (PR-5b) — 'candlelight' is the dark direction. */
  artDirection: 'daylight' | 'candlelight' | null;
}) {
  return (
    <form action={action} className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
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
        <HexField
          id={`${rowKey}-button`}
          name="button_color"
          label="Buttons"
          defaultValue={buttonColor}
        />
      </div>
      <p className="mt-1.5 text-[0.7rem] text-ink/45">
        Leave blank to use your Mood Board palette.
      </p>

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

      <SaveButton />
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
