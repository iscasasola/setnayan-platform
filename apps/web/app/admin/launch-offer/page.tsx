import { AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
import { readLaunchOffer } from '@/lib/launch-offer.server';
import {
  formatLaunchCap,
  formatLaunchDate,
  isoToManilaLocal,
  launchOfferIsOpen,
  launchProEndsAtNow,
} from '@/lib/launch-offer';
import { FreeFeeWindowForm, LaunchOfferNumbersForm } from './launch-offer-form';

export const dynamic = 'force-dynamic';

/**
 * THE LAUNCH OFFER — the one admin page the owner asked for.
 *
 * ⚖ OWNER, 2026-10-08: the first 2,000 platform bookings are fee-free; Pro is
 * free until then and ends at the end of that 4-week cycle; 50 free Papic
 * credits per booked event; *"ONE admin page, admin-editable, never
 * hard-coded."* ⚖ 2026-10-12 #3–#6: the 2,000 counts Setnayan-sourced bookings
 * at fee creation; launch bookings do not use up a supplier's free five; free
 * Pro's end is ONE platform-wide date, shown here; the credits are granted once
 * per launch-waived charge.
 *
 * What it shows, every number read live (migration 20271268832636):
 *   · on / off, and when it started and ended;
 *   · the HONEST count — ledger rows that took a place, not a guess;
 *   · the date free Pro ends (the stamped one once closed; while open, the end
 *     of the cycle running now, which rolls forward);
 *   · the three numbers, editable;
 *   · the free-fee window (`booking_fee_free_from/until`) — it worked in SQL
 *     and had no screen (audit 2026-10-12, C9).
 *
 * ⚠ A FAILED READ SAYS SO. It never renders as "off" or "0 used".
 */
export default async function AdminLaunchOfferPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const offer = await readLaunchOffer(admin);
  const { data: win, error: winErr } = await admin
    .from('platform_settings')
    .select('booking_fee_free_from, booking_fee_free_until')
    .eq('id', 1)
    .maybeSingle();
  if (winErr) logQueryError('admin/launch-offer.window', winErr);
  const w = (win ?? {}) as { booking_fee_free_from?: string | null; booking_fee_free_until?: string | null };

  const now = Date.now();
  const open = offer ? launchOfferIsOpen(offer, now) : false;
  const proEnds = offer ? formatLaunchDate(launchProEndsAtNow(offer, now)) : null;
  const state = !offer
    ? null
    : offer.closedAt
      ? `Ended ${formatLaunchDate(offer.closedAt) ?? ''}`.trim()
      : open
        ? 'On — taking bookings'
        : offer.enabled
          ? 'On — not taking bookings yet'
          : 'Off';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl lg:py-8">
      <PageMasthead title="Launch offer" />

      {!offer ? (
        <div className="sn-tile mb-4 flex items-start gap-3 p-4">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0"
            strokeWidth={1.75}
            style={{ color: '#B54708' }}
          />
          <p className="text-sm" style={{ color: '#B54708' }}>
            Could not load the launch offer right now — this is <strong>not</strong> the same as
            it being off. Refresh to try again.
          </p>
        </div>
      ) : (
        <>
          <div className="sn-tile mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Status</p>
              <p className="mt-1 text-sm font-semibold text-ink">{state}</p>
              {offer.startedAt ? (
                <p className="text-xs text-ink/60">Started {formatLaunchDate(offer.startedAt)}</p>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Fee-free bookings used
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                {formatLaunchCap(offer.used)}
                {offer.cap ? ` of ${formatLaunchCap(offer.cap)}` : ''}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Free Pro ends</p>
              <p className="mt-1 text-sm font-semibold text-ink">{proEnds ?? '—'}</p>
              <p className="text-xs text-ink/60">
                {offer.closedAt
                  ? 'The end of the cycle running when the offer ended.'
                  : offer.enabled
                    ? 'Moves forward each cycle until the offer ends.'
                    : 'Set when the offer is on.'}
              </p>
            </div>
          </div>

          <h2 className="mb-2 mt-6 font-serif text-lg text-ink">The offer</h2>
          <LaunchOfferNumbersForm
            cap={offer.cap}
            papicCredits={offer.papicCredits}
            cycleDays={offer.cycleDays}
            enabled={offer.enabled}
            closed={Boolean(offer.closedAt)}
          />
        </>
      )}

      <h2 className="mb-2 mt-6 font-serif text-lg text-ink">Free-fee window</h2>
      {winErr ? (
        <p className="sn-tile p-4 text-sm" style={{ color: '#B54708' }}>
          Could not load the free-fee window right now — refresh to try again.
        </p>
      ) : (
        <FreeFeeWindowForm
          from={isoToManilaLocal(w.booking_fee_free_from ?? null)}
          until={isoToManilaLocal(w.booking_fee_free_until ?? null)}
        />
      )}
    </div>
  );
}
