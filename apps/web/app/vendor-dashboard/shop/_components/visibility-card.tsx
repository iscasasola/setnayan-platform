'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';

import { ActionButton } from '@/components/action-button';

import { useToast } from '@/app/_components/toast/toast-provider';
import { updateVisibilityPreferences } from '../visibility-actions';

/**
 * My Shop → Business Profile → "Where else you show up".
 *
 * The missing writer for `same_day_available` and `social_feature_opt_out`.
 * Both columns are filtered on in production — the Day-of "Get help" shortlist
 * and the Facebook/Instagram verification post — and neither had a control, so
 * every shop sat on the column default: no shop could ever appear in the
 * shortlist, and no shop could decline the post.
 *
 * ── THE CARD TELLS THE TRUTH ABOUT THE GATES ────────────────────────────────
 * Both settings only take effect for a VERIFIED shop, and the same-day
 * shortlist additionally requires a paid plan (`findSameDayVendors` filters
 * `verification_state='verified'` AND `tier_state <> 'free'`). A toggle that
 * silently does nothing is the same class of bug as a column with no writer, so
 * the gate is stated inline rather than hidden — and the control stays usable,
 * so a vendor can set their preference BEFORE they qualify rather than being
 * asked to come back later.
 *
 * The opt-out is likewise honest about being forward-looking: once the team has
 * marked a feature posted, `social_featured_at` is stamped and the sweep skips
 * that shop forever. Ticking the box afterwards cannot unpublish a post that
 * already went out, and the card says so instead of implying a takedown.
 *
 * ── THE HIDDEN MARKER ───────────────────────────────────────────────────────
 * `visibility_fields_present` is posted because both controls are checkboxes:
 * an unticked box posts nothing, so without the marker the action cannot tell
 * "the vendor cleared both" from "a form that never asked". See
 * `visibility-actions.ts`.
 */
export function VisibilityCard({
  initialSameDayAvailable,
  initialSocialFeatureOptOut,
  isVerified,
  isPaidTier,
  alreadyFeatured,
}: {
  initialSameDayAvailable: boolean;
  initialSocialFeatureOptOut: boolean;
  isVerified: boolean;
  isPaidTier: boolean;
  alreadyFeatured: boolean;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [sameDay, setSameDay] = useState(initialSameDayAvailable);
  const [optOut, setOptOut] = useState(initialSocialFeatureOptOut);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function save() {
    const fd = new FormData();
    fd.set('visibility_fields_present', '1');
    if (sameDay) fd.set('same_day_available', 'on');
    if (optOut) fd.set('social_feature_opt_out', 'on');
    setPending(true);
    setJustSaved(false);
    startTransition(async () => {
      const res = await updateVisibilityPreferences(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSameDay(res.sameDayAvailable);
      setOptOut(res.socialFeatureOptOut);
      setJustSaved(true);
    });
  }

  return (
    <section className="mt-5" data-visibility-card>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        Where else you show up (optional)
      </h3>
      <p className="mt-1 text-sm text-[color:var(--m-slate-2)]">
        Two places Setnayan can put your shop in front of people, beyond your own page.
      </p>
      <div className="mt-1 divide-y divide-[color:var(--m-line)]">

        <ToggleRow
          id="same-day-available"
          label="Take same-day and day-of jobs"
          checked={sameDay}
          onChange={(on) => {
            setSameDay(on);
            setJustSaved(false);
          }}
          body="When something goes wrong on a wedding day, the couple sees a short list of nearby suppliers who can step in. Tick this to be on it."
          note={
            isVerified && isPaidTier
              ? null
              : !isVerified
                ? 'You’ll appear here once your shop is verified and on a paid plan. You can set it now.'
                : 'You’ll appear here once you’re on a paid plan. You can set it now.'
          }
        />

        <ToggleRow
          id="social-feature-opt-out"
          label="Don’t feature my business on Setnayan’s social pages"
          checked={optOut}
          onChange={(on) => {
            setOptOut(on);
            setJustSaved(false);
          }}
          body="When a shop gets verified we post a short congratulations on Setnayan’s Facebook and Instagram. Leave this unticked and yours may be featured; tick it and we’ll skip you."
          note={
            alreadyFeatured
              ? 'Your feature has already been posted. Ticking this stops any future one — it doesn’t remove the post that went out.'
              : isVerified
                ? null
                : 'Features only go out after verification, so nothing is posted yet.'
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ActionButton tone="brand" icon={Check} label={pending ? 'Saving…' : 'Save'} onClick={save} waiting={pending} />
        {justSaved && !pending ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--m-slate-2)]" role="status">
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One labelled switch with its explanation and, where a gate applies, a plain
 * statement of it. The body text is tied to the input with `aria-describedby`
 * so a screen reader hears what the toggle actually does — the labels alone
 * ("Take same-day and day-of jobs") do not convey the consequence.
 */
function ToggleRow({
  id,
  label,
  body,
  note,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  body: string;
  note: string | null;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="min-h-14 py-3">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={`${id}-body`}
          onChange={(e) => onChange(e.currentTarget.checked)}
          className="h-4 w-4 shrink-0 accent-[var(--m-accent-deep)]"
        />
        <span className="text-sm font-semibold text-ink">
          {label}
        </span>
      </label>
      <p id={`${id}-body`} className="pl-6 text-sm text-[color:var(--m-slate-2)]">
        {body}
      </p>
      {note ? (
        <p className="mt-1 pl-6 text-sm italic text-[color:var(--m-slate-3)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
