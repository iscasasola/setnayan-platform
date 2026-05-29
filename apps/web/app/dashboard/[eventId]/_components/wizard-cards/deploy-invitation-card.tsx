'use client';

/**
 * Card 21 Deploy Invitation · Programming tier (T-3m).
 *
 * EXTERNAL_PROCESS card with an inline summary + single [Deploy] CTA.
 * The host's invitation widgets, monogram, palette, and slug were all set
 * upstream (Card 11 Monogram, Card 09 Mood Board, Card 16 Create Website,
 * plus the invitation editor's widget show/hide ordering). Card 21 is
 * the touchpoint where the host signals "ship the invitations" — every
 * guest gets a personalized QR-encoded landing-page URL routed through
 * the public landing.
 *
 * UX shape:
 *   - Calm summary block showing the public URL + monogram preview, so
 *     the host sees at a glance what's about to be deployed.
 *   - Single [Deploy invitation · share with guests] CTA that fires the
 *     generic markTaskDone action with task_id='deploy_invitation'. No
 *     branching · no in-flight state (deployment is instant from the
 *     host's perspective; QR codes were already generated at slug-claim
 *     time per iteration 0002 unified QR lifecycle).
 *   - Footer copy nudges the host toward the share affordances on the
 *     Website hub (download QR · open public URL) without making them
 *     mandatory · the wizard advances regardless.
 *
 * Per hard NO-LINKS constraint (CLAUDE.md Sixth 2026-05-23 row): the
 * primary CTA does NOT navigate the host to the invitation editor. The
 * deploy action stamps wizard_state and stays on event home. The
 * footer's mention of the Website tab is informational only.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: every
 * line reads as polite editorial Filipino · no engineering jargon ·
 * the share-with-guests framing carries the emotional weight.
 *
 * Cross-references:
 *   - Iteration 0002 unified QR lifecycle (CLAUDE.md 2026-05-22 eleventh
 *     row) · guest QRs minted from `guests.qr_token` at slug-claim time
 *   - Card 16 Create Website · sibling action that established the slug
 *   - Card 11 Monogram · sibling action that established the visual ID
 *   - markTaskDone server action · generic done-stamp
 */

import { useState, useTransition } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Public URL display string (e.g. "setnayan.com/maria-and-juan").
   *  NULL when the host hasn't picked a slug yet — UI surfaces a polite
   *  nudge back to Card 16 without auto-redirecting. */
  publicUrl: string | null;
  /** 1-2 letter monogram derived from display_name OR custom-set in
   *  events.monogram_text. */
  monogramText: string;
  /** Hex color for the monogram preview tile. Defaults to terracotta
   *  via lib/monogram.ts so this prop is always non-null. */
  monogramColor: string;
};

export function DeployInvitationCard({
  eventId,
  publicUrl,
  monogramText,
  monogramColor,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Host can technically reach Card 21 before Card 16 if they manually
  // skipped the slug step — guard so the deploy CTA stays disabled with
  // a polite explanation instead of crashing the form. The resolver
  // walks tasks in canonical order so this is a rare edge case, but the
  // guard keeps the card honest when it does happen.
  const slugReady = Boolean(publicUrl);

  function handleDeploy() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'deploy_invitation');
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't deploy your invitations. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Summary card · shows monogram + public URL so the host sees what
          their guests are about to receive. Read-only · pure visual
          summary, no inline edit affordances (those live on the Website
          tab and the upstream wizard cards). */}
      <div className="rounded-xl border border-ink/10 bg-cream/60 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Monogram preview tile · matches the QR-center monogram style
              from iteration 0002. Compact + branded. */}
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg shadow-sm sm:h-16 sm:w-16"
            style={{ backgroundColor: monogramColor, color: '#FAF6F0' }}
          >
            <span className="font-display text-xl italic sm:text-2xl">
              {monogramText}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Ready to send
            </p>
            {publicUrl ? (
              <p className="break-all font-mono text-sm text-ink">{publicUrl}</p>
            ) : (
              <p className="text-sm text-ink/65">
                Pick a slug on the Create Website step first — that&apos;s the
                URL your guests land on.
              </p>
            )}
            <p className="text-xs leading-relaxed text-ink/65">
              Each guest&apos;s personal QR points at this URL with their own
              token attached — they land straight on their RSVP, dress code,
              and the rest of your wedding details.
            </p>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={handleDeploy}
          disabled={!slugReady || isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Sending…'
          ) : (
            <>
              <Send aria-hidden className="h-4 w-4" strokeWidth={2} />
              Deploy invitation · share with guests
            </>
          )}
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-cream/40 px-3 py-2">
        <Sparkles
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta"
          strokeWidth={2}
        />
        <p className="text-xs leading-relaxed text-ink/60">
          Make sure your monogram, dress code, and the day-of schedule are
          locked before you deploy — once the QR is in your guests&apos;
          hands, future edits still flow through but the first impression
          carries weight.
        </p>
      </div>
    </div>
  );
}
