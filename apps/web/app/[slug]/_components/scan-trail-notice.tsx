import { eventWordsForEvent } from '../_lib/event-words';
import { SubmitButton } from '@/app/_components/submit-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestScanTracking } from '../actions';

/**
 * THE HANDLE FOR `guests.scan_tracking_opt_out`.
 *
 * The column has existed since 2026-05-13 citing RA 10173 and had no writer and
 * no reader — a switch a guest could not reach, beside a trail nothing told them
 * about. `lib/scan-trail.ts` now honours it at the one door that writes
 * `scan_events`; this is where a guest actually moves it.
 *
 * ⚖ NOT PART OF `FaceDataNotice`, and not gated the same way. That notice is
 * about the guest's LIKENESS and renders only for guests with a stored selfie
 * (`photo_source === 'selfie'`). Every guest who opens an invitation leaves a
 * scan trail, selfie or not, so this control renders for every recognised guest.
 * Folding them together would have hidden this switch from most of the people
 * it exists for.
 */

/**
 * This guest's CURRENT setting, read here rather than threaded down — the same
 * reasoning as `readFaceBlock`: a value carried from a page rendered before the
 * guest flipped it shows a switch in the wrong position, which on a privacy
 * control is worse than no switch at all.
 *
 * ⚠ FAILS TOWARD "WE ARE KEEPING A RECORD". A read error returns false, so the
 * control offers the PROTECTIVE action. The alternative tells a guest they are
 * already untracked on the strength of a failed read. The gate itself is in
 * `recordScan`, which is unaffected by this: it fails the other way, toward
 * writing nothing, because there a wrong guess costs a greeting rather than a
 * record somebody asked us not to keep.
 */
async function readScanOptOut(eventId: string, guestId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('guests')
      .select('scan_tracking_opt_out')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (error) return false;
    return (data as { scan_tracking_opt_out?: boolean } | null)?.scan_tracking_opt_out === true;
  } catch {
    return false;
  }
}

export async function ScanTrailNotice({
  eventId,
  guestId,
}: {
  eventId: string;
  guestId: string;
}) {
  const [w, optedOut] = await Promise.all([
    eventWordsForEvent(eventId),
    readScanOptOut(eventId, guestId),
  ]);
  const toggle = setGuestScanTracking.bind(null, eventId, guestId, !optedOut);

  // The OFF sentence carries the cost, said plainly. A guest who turns this off
  // should not later wonder why the page stopped welcoming them on arrival —
  // that greeting is the trail's only reader anywhere in the product.
  const sentence = optedOut
    ? `We keep no record of when you open your invitation or scan your code at this ${w.eventWord}. This page will greet you the same way every time.`
    : `We keep a record of when you open your invitation or scan your code at this ${w.eventWord} — it is how this page knows to welcome you when you first arrive.`;

  return (
    <form
      action={toggle}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-xs text-ink/60"
    >
      <span className="min-w-0">{sentence}</span>
      <SubmitButton
        className="shrink-0 font-medium text-mulberry underline-offset-2 hover:underline"
        pendingLabel={optedOut ? 'Turning on…' : 'Turning off…'}
      >
        {optedOut ? 'Keep a record again' : 'Stop keeping a record'}
      </SubmitButton>
    </form>
  );
}
