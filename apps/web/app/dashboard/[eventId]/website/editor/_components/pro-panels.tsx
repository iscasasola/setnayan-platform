'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { Lock } from 'lucide-react';

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

/** The seven Pro items, named the way the couple sees them. */
export const WEBSITE_PRO_ITEMS = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Editorial editing',
  'Background color',
  'Button color',
] as const;

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
        {featureName} is part of Website Pro
      </p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink/60">
        One unlock covers all seven: {WEBSITE_PRO_ITEMS.join(' · ')}. It also removes the
        “Powered by Setnayan” mark from your page.
      </p>
      <Link
        href={unlockHref}
        className="mt-2 inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-300"
      >
        Unlock Website Pro · ₱3,500
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
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  rowKey: string;
  bgColor: string | null;
  buttonColor: string | null;
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
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.7rem] font-semibold text-ink/60">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-6 w-6 shrink-0 rounded-full border border-ink/15"
          style={defaultValue ? { background: defaultValue } : undefined}
        />
        <input
          id={id}
          name={name}
          type="text"
          inputMode="text"
          maxLength={7}
          placeholder="#A9834B"
          defaultValue={defaultValue ?? ''}
          pattern="^$|^#[0-9a-fA-F]{6}$"
          className="w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-terracotta"
        />
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
