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
 * Auth: RLS on events does the heavy lifting. Non-host gets maybeSingle
 * = null → redirect to /dashboard.
 *
 * Per [[feedback_setnayan_orphan_prevention]] the page is reachable from
 * the event-home TILES grid via the new Event QR tile (see same-PR diff
 * to apps/web/app/dashboard/[eventId]/page.tsx).
 */

import { redirect } from 'next/navigation';
import { RefreshCcw, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { regenerateEventMasterQR } from './actions';

export const metadata = { title: 'Event QR' };

type Props = { params: Promise<{ eventId: string }> };

export default async function EventQrPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
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
    color: { dark: '#1E2229', light: '#FBFBFA' },
  });

  const tokenPrefix = (event.master_qr_token as string).slice(0, 8);
  const rotatedAt = event.master_qr_token_rotated_at
    ? new Date(event.master_qr_token_rotated_at as string)
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink/50">
          <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Event QR</span>
        </div>
        <h1 className="m-display-tight text-3xl text-ink sm:text-4xl">
          For your photography + livestream crew
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          Each crew member scans this QR with their capture device to pair it
          with your event. You can register up to 5 devices per vendor —
          enough for the lead photographer, second shooter, drone operator,
          and two backup phones. Need to swap a device? Ask your vendor to
          revoke the slot and re-pair.
        </p>
      </header>

      <div className="m-card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
          <div
            className="rounded-xl bg-[var(--m-paper)] p-3 shadow-inner"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.18em] text-ink/50">
                Token prefix
              </div>
              <div className="font-mono text-lg tracking-wider text-ink">
                {tokenPrefix}…
              </div>
              <p className="text-xs text-ink/55">
                Confirm this matches what your vendor&rsquo;s device shows after
                pairing — a quick sanity check that you handed them the
                right event&rsquo;s QR.
              </p>
            </div>

            {rotatedAt ? (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.18em] text-ink/50">
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
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-[var(--m-paper)] px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink/5"
              >
                <RefreshCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
                Regenerate QR
              </button>
              <p className="mt-2 text-xs text-ink/55">
                Rotating prints a new code. Crew devices already paired
                stay paired — only new pairings using the old code will
                stop working.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="m-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink/70">
          How vendors use this
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink/75">
          <li>
            <span className="font-medium text-ink">1.</span> Your vendor
            opens the Setnayan app on their capture device and taps
            <span className="m-mono mx-1 rounded bg-ink/5 px-1.5 py-0.5 text-xs">
              Pair to event
            </span>
            .
          </li>
          <li>
            <span className="font-medium text-ink">2.</span> They scan the QR
            above. The device registers itself with your event and your
            vendor&rsquo;s account.
          </li>
          <li>
            <span className="font-medium text-ink">3.</span> Each new vendor
            who pairs starts with 0 of their 5 device slots used. Your
            event&rsquo;s QR is the same for everyone — vendors are kept
            separate by their account.
          </li>
        </ol>
      </div>
    </div>
  );
}
