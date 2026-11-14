/**
 * V2 Phase D · Event QR page · /dashboard/[eventId]/event-qr.
 *
 * WHY (per CLAUDE.md third 2026-05-28 row · V2 publisher pivot):
 * the host displays this QR on a phone/laptop for the vendor's crew to
 * scan with their capture device. Scanning POSTs to /api/crew/register-
 * device with the master_qr_token + a device fingerprint. The 5-cap
 * trigger on registered_crew_devices enforces "max 5 crew devices per
 * vendor per event" at the DB layer (per Phase D migration 20260704000000).
 *
 * Token format: 32 lowercase hex chars (16 bytes entropy). We surface
 * the first 8 chars below the QR so the host can verbally confirm a
 * device they paired matches the expected event.
 *
 * Brand: v2.1 design tokens · --m-paper background · .m-card surface ·
 * .m-display-tight Saira Condensed headline. Per [[feedback_setnayan_no_dev_text_post_launch]]
 * all copy uses brand voice (polite + practical).
 *
 * Auth (SEC-2, 2026-07-26 — CHANGED): this page used to lean on events RLS
 * ("non-host gets maybeSingle = null"). That was never true for the token:
 * `event_member_can_read` is scoped on `current_event_ids()`, which has NO
 * member_type filter, so a plain GUEST is admitted as a full event member and
 * the row — master_qr_token included — was readable by anyone who had joined
 * the event. Only the parent layout's `member_type !== 'couple'` check stood
 * between a guest and this page.
 *
 * Migration 20271007100000 removes `master_qr_token` from the `authenticated`
 * SELECT grant entirely, so the cookie-scoped client can no longer read it at
 * all — by anyone, including the couple. The token is now read with the
 * service-role client behind an EXPLICIT host gate (requireHostMembership —
 * accepted moderator OR legacy couple, the same principals the parent layout
 * admits), so authorization is stated here rather than inherited from a layout.
 * Rotation is unchanged: event-qr/actions.ts UPDATEs the token and RETURNs only
 * `master_qr_token_rotated_at`, so it never needed SELECT on the token.
 *
 * Per [[feedback_setnayan_orphan_prevention]] the page is reachable via a
 * secondary "Event QR for your crew" link on the guest Invite stage
 * (apps/web/app/dashboard/[eventId]/guests/invite/page.tsx). It previously
 * hung off an event-home TILES grid tile, which the Home/Overview redesigns
 * dropped — the Invite-page link (2026-07-15) is now its findable home.
 */

import { InfoTip } from '@/app/_components/info-tip';
import { redirect } from 'next/navigation';
import { RefreshCcw } from 'lucide-react';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership } from '@/lib/host-gate';
import { regenerateEventMasterQR } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Event QR' };

type Props = { params: Promise<{ eventId: string }> };

export default async function EventQrPage({ params }: Props) {
  const { eventId } = await params;

  // Authorization FIRST, and stated here — the read below bypasses RLS.
  // requireHostMembership redirects to /login with no session and to /dashboard
  // for a non-host (guest, coordinator, stranger), which is the same outcome the
  // old RLS-shaped `if (!event) redirect('/dashboard')` produced for them.
  await requireHostMembership(eventId);

  // service-role: `master_qr_token` is not in the `authenticated` SELECT grant
  // (migration 20271007100000). Explicit column list — never `*`.
  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id, display_name, master_qr_token, master_qr_token_rotated_at')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event || !event.master_qr_token) {
    redirect('/dashboard');
  }

  // Crew pairs by scanning. Native + browser apps deep-link on this scheme.
  const pairingUrl = `setnayan://crew-pair?event_id=${encodeURIComponent(
    event.event_id as string,
  )}&token=${encodeURIComponent(event.master_qr_token as string)}`;

  // SVG QR — crisp on every screen size, ~3KB inline, no client JS needed.
  const qrSvg = await QRCode.toString(pairingUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#1B1A17', light: '#FBFBFA' },
  });

  const tokenPrefix = (event.master_qr_token as string).slice(0, 8);
  const rotatedAt = event.master_qr_token_rotated_at
    ? new Date(event.master_qr_token_rotated_at as string)
    : null;

  return (
    <div className="space-y-6">
      <PageMasthead
        title="For your photography + livestream crew"
      />

      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 7 · 13 · 14): the QR is the one thing on the warm surface; labels are
          grey capitals (the check-it line behind the ⓘ); the rotate press is the shared pill and its consequence stays on
          the page; the how-to is a plain section, not a second card. */}
      <div className="rounded-card bg-[var(--m-paper-2)] p-4 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
          <div
            className="rounded-xl bg-[var(--m-paper)] p-3 shadow-inner"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <InfoTip label="Token prefix" labelAs="span" labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70" align="start">
                Confirm this matches what your supplier&rsquo;s device shows after pairing — a quick sanity check that you
                handed them the right event&rsquo;s QR.
              </InfoTip>
              <div className="text-lg font-semibold tracking-wider tabular-nums text-ink">
                {tokenPrefix}…
              </div>
            </div>

            {rotatedAt ? (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Last rotated
                </div>
                <div className="text-sm text-ink">
                  {rotatedAt.toLocaleString('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
            ) : null}

            <form
              action={async (data: FormData) => {
                'use server';
                await regenerateEventMasterQR(data);
              }}
            >
              <input type="hidden" name="event_id" value={event.event_id as string} />
              <SubmitButton pendingLabel="Regenerating…" className="ab ab-neutral">
                <RefreshCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
                Regenerate QR
              </SubmitButton>
              <p className="mt-2 text-[13px] text-ink/75">
                Rotating prints a new code. Crew devices already paired
                stay paired — only new pairings using the old code will
                stop working.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="border-t border-ink/10 pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          How suppliers use this
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink/75">
          <li>
            <span className="font-medium text-ink">1.</span> Your supplier
            opens the Setnayan app on their capture device and taps
            <span className="mx-1 font-semibold text-ink">
              Pair to event
            </span>
            .
          </li>
          <li>
            <span className="font-medium text-ink">2.</span> They scan the QR
            above. The device registers itself with your event and your
            supplier&rsquo;s account.
          </li>
          <li>
            <span className="font-medium text-ink">3.</span> Each new supplier
            who pairs starts with 0 of their 5 device slots used. Your
            event&rsquo;s QR is the same for everyone — suppliers are kept
            separate by their account.
          </li>
        </ol>
      </div>
    </div>
  );
}
