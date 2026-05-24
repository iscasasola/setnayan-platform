/**
 * Card 38 Create Editorial · Phase 5 · Post-event tier.
 *
 * Per iteration 0046 (CLAUDE.md 2026-05-19 architectural lock): every
 * wedding's personal landing page transitions into a Phase 4 public
 * editorial at T+30 days, opt-in for cross-wedding browse at
 * `/weddings`. This card surfaces the consent choice as the final step
 * of the wizard.
 *
 * Two CTAs:
 *   [Publish my editorial · share inspiration] → marks done + sets a
 *     wizard_state.create_editorial.opt_in='public' flag that the Phase
 *     4 broadcast pipeline reads to flip the editorial to public.
 *   [Keep it private]                          → marks done + sets
 *     opt_in='private'. The host's landing page stays accessible via
 *     their slug URL but isn't indexed in /weddings.
 *
 * Both paths advance the wizard · the choice is preserved in
 * wizard_state for the editorial-broadcast cron / admin surface.
 */

import { CreateEditorialChoiceButtons } from './create-editorial-choice-buttons';

type Props = { eventId: string };

export function CreateEditorialCard({ eventId }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">
        <p>
          Your personal landing page becomes a permanent public editorial
          thirty days after your wedding. Choose how visible you want it to
          be.
        </p>
        <ul className="space-y-2 text-ink/70">
          <li>
            <strong>Public</strong> — your story shows up on
            setnayan.com/weddings + Google. Future couples planning their
            weddings find inspiration in yours.
          </li>
          <li>
            <strong>Private</strong> — your landing page stays accessible to
            anyone with your slug URL, but doesn&apos;t appear on the public
            index. Same content, no broader audience.
          </li>
        </ul>
        <p className="text-ink/60">
          You can change this anytime under Settings · Privacy on your
          dashboard. Public editorials follow our RA 10173 safeguards —
          pseudonymization, one-click opt-out, and privacy controls per the
          consent disclosed at signup.
        </p>
      </div>

      <CreateEditorialChoiceButtons eventId={eventId} />
    </div>
  );
}
