'use client';

/**
 * Officiant auto-resolved panel · paid Today's Focus wizard surface (Card
 * 04). Renders when the host's locked ceremony venue implicitly handles
 * the officiant role · per CLAUDE.md 2026-05-29 "Vendor Discovery
 * Architecture" row item (1).
 *
 * Three framings:
 *
 *   - 'catholic_parish' · Catholic ceremony at a parish church · the
 *     priest from the parish officiates · confirmed via Pre-Cana.
 *   - 'civil_registrar' · Civil ceremony at a city hall / municipal
 *     registrar · the judge or registrar officiates as part of the
 *     venue commitment.
 *   - 'inc_chapel' · INC ceremony at an INC chapel · an INC minister
 *     from the chapel officiates.
 *
 * Detection lives in OfficiantCard (the server component sibling) ·
 * this panel is the render path when conditions match.
 *
 * Two CTAs:
 *
 *   - **Mark officiant done** · mulberry primary · stamps
 *     `wizard_state.officiant.completed_at` via the generic
 *     `markTaskDone` server action (PR #472 lineage · same pattern as
 *     EventMarkDoneRow + sibling Mark-Done flows). Passes meta fields
 *     `resolution=auto_resolved_via_venue` + `framing` + `provider_name`
 *     so the audit trail records HOW the card was settled (vs an
 *     explicit vendor pick).
 *   - **Use a different officiant** · champagne outline · routes to
 *     `/vendors?folder=ceremony` (same standard picker as the DIY
 *     tier · per the 2026-05-29 lock's "always-available override
 *     affordance" rule for PH edge cases: interfaith · destination ·
 *     family priest with permission letter · retired pastor · hired
 *     celebrant for civil). When the host adds a custom officiant
 *     OR picks one from the marketplace, the resulting event_vendors
 *     row trips the gate in OfficiantCard (status !== 'empty') so the
 *     full VendorPickGridCard renders on the next visit instead of
 *     this panel.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] ·
 * Filipino-aware, concrete, no engineering jargon. Clean Editorial
 * palette per CLAUDE.md 2026-05-29 + 2026-05-30 unification rows ·
 * bg-paper · text-ink · bg-mulberry CTA · champagne-orange accent.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, Church, Scale } from 'lucide-react';
import {
  getOfficiantAutoResolvedHint,
  type OfficiantAutoResolutionFraming,
} from '@/lib/officiant-auto-resolve';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  framing: OfficiantAutoResolutionFraming;
  /** Display name of the venue that implicitly handles the officiant
   *  (e.g. "Manila Cathedral" · "Quezon City Hall" · "INC Central
   *  Chapel"). Sourced from venue_directory.name OR
   *  vendor_profiles.business_name by the parent detection logic. */
  providerName: string;
  /** Marketplace URL for the override CTA · routes to the standard
   *  officiant picker. Always `/vendors?folder=ceremony` today · accept
   *  as prop for API symmetry with other wizard cards' search hrefs. */
  overrideHref: string;
};

// Panel-specific chrome per framing · eyebrow label + icon. Hint copy
// sourced from `getOfficiantAutoResolvedHint(framing)` in the shared
// lib · single source of truth across DIY + paid surfaces.
type FramingCopy = {
  eyebrow: string;
  icon: typeof Church;
};

const FRAMING_COPY: Record<OfficiantAutoResolutionFraming, FramingCopy> = {
  catholic_parish: {
    eyebrow: 'OFFICIANT · YOUR PARISH PRIEST',
    icon: Church,
  },
  civil_registrar: {
    eyebrow: 'OFFICIANT · YOUR CIVIL REGISTRAR',
    icon: Scale,
  },
  inc_chapel: {
    eyebrow: 'OFFICIANT · YOUR INC MINISTER',
    icon: Building2,
  },
};

export function OfficiantAutoResolvedPanel({
  eventId,
  framing,
  providerName,
  overrideHref,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copy = FRAMING_COPY[framing];
  const Icon = copy.icon;

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'officiant');
    // Meta fields stored on wizard_state.officiant for audit trail ·
    // distinguishes auto-resolved completion from explicit picks.
    formData.set('meta_resolution', 'auto_resolved_via_venue');
    formData.set('meta_framing', framing);
    formData.set('meta_provider_name', providerName);
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark this done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <article className="rounded-2xl border border-ink/10 bg-paper p-6 sm:p-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink/60">
          <Icon
            aria-hidden
            className="h-3.5 w-3.5 text-[var(--m-orange-2)]"
            strokeWidth={2}
          />
          <span className="m-label-mono">{copy.eyebrow}</span>
        </div>
        <h3 className="m-serif text-2xl italic text-ink sm:text-3xl">
          Provided by {providerName}
        </h3>
        <p className="max-w-prose text-sm text-ink/70 sm:text-base">
          {getOfficiantAutoResolvedHint(framing)}
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          <span>{isPending ? 'Saving…' : 'Mark officiant done'}</span>
        </button>
        <Link
          href={overrideHref}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--m-orange)] px-5 py-3 text-sm text-ink hover:bg-[var(--m-orange-4)] focus:outline-none focus:ring-2 focus:ring-[var(--m-orange)] focus:ring-offset-2 focus:ring-offset-cream"
        >
          <span>Use a different officiant</span>
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </footer>

      <p className="mt-4 text-xs text-ink/55">
        Marking done records the venue as your officiant in your wedding
        plan. You can change this anytime by picking a different officiant.
      </p>
    </article>
  );
}
