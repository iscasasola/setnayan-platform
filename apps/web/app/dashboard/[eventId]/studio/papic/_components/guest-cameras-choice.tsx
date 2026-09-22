import { Users } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestAccess } from '@/lib/papic-guest';
import { setPapicGuestCaptureEarly } from '../guest-window-actions';
import { SettingRow } from './setting-row';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  PAPIC_CAPTURE_GRACE_HOURS,
  formatCaptureCloseLabel,
  manilaCaptureCloseIso,
  manilaDate,
} from '@/lib/papic-window';

/**
 * "When guests can shoot" — the host's button over everyone else's phone.
 *
 * Owner, 2026-08-07: *"The guests can have the option to use the app on the exact
 * event or when the host allows it"* → *"there should be a button for the host of
 * the event to allow guests to use the papic."*
 *
 * ── WHY THIS CARD EXISTS ────────────────────────────────────────────────────
 * Guests had NO time gate of any kind. The only question ever asked was whether
 * the event holds a guest-camera pass; nothing asked WHEN. A guest who redeemed
 * their invite six months out could shoot into the couple's gallery on any
 * random Tuesday, and the couple had no way to say no.
 *
 * ── THE CARD IS ABSENT WHEN THERE IS NOTHING TO DECIDE ──────────────────────
 * If the event has no guest cameras at all, this button governs nothing.
 * Rendering it anyway would be a control that cannot change what the guest sees
 * — the empty-promise shape this project keeps getting caught by. An absent card
 * is the honest version, exactly as with the face-tagging choice.
 *
 * ⚠ `variant="row"` IS THE SAME CONTROL BEHIND A DIFFERENT DOOR — the approved
 * control-centre drawing files this under "Set once, change any time" as a row
 * reading "Event day" or "Live now". The form is passed through untouched, and
 * the absence rule above stays in here, so an event with no guest cameras grows
 * no row rather than a row that opens onto nothing.
 */
export async function GuestCamerasChoice({
  eventId,
  variant = 'card',
}: {
  eventId: string;
  variant?: 'card' | 'row';
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('events')
    .select('papic_guest_capture_early, event_date, papic_window_end')
    .eq('event_id', eventId)
    .maybeSingle();

  // ⚠ Supabase resolves with { error } rather than throwing, and an RLS denial
  // reads as an empty result. Either way there is nothing trustworthy to render.
  //
  // 🚨 AND FOR WEEKS THAT WAS A LIE OF OMISSION. `papic_guest_capture_early`
  // carried no SELECT grant, so PostgREST refused the WHOLE query with 42501 and
  // this returned null on every render — the host's own switch was never once on
  // screen, and nothing anywhere said so. The grant is fixed (20271179873885);
  // the log is so the NEXT refusal leaves a trail instead of a blank space.
  if (error) {
    logQueryError('GuestCamerasChoice.event', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;

  // Nothing to schedule if guest cameras are not on for this event. Uses the
  // admin client because the pass/pool check reads rows the couple's own client
  // is not entitled to — the same call the guest camera page makes.
  //
  // 🔴 THREE STATES. 'off' hides the row. 'unknown' is a failed check, and it
  // says so: hiding the switch on a failed read looks exactly like a
  // celebration with no guest cameras, and the couple loses the control with
  // no sign that anything went wrong.
  const access = await eventPapicGuestAccess(createAdminClient(), eventId);
  if (access === 'off') return null;
  if (access !== 'on') {
    const body = (
      <p className="text-sm text-ink/65">
        We couldn&rsquo;t check your guest cameras just now, so we can&rsquo;t show this
        setting. Nothing you set before has changed. Reload the page to try again.
      </p>
    );
    return variant === 'row' ? (
      <SettingRow
        icon={<Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="When guests can shoot"
        value="Couldn’t check"
        sheetTitle="When guests can shoot"
      >
        {body}
      </SettingRow>
    ) : (
      <section className="space-y-3 sn-tile p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          When guests can shoot
        </h2>
        {body}
      </section>
    );
  }

  const row = data as {
    papic_guest_capture_early: boolean | null;
    event_date: string | null;
    papic_window_end: string | null;
  };
  const early = row.papic_guest_capture_early === true;
  const day = row.event_date;

  // ⏰ THE SENTENCE IS BUILT FROM THE GATE'S OWN NUMBERS (owner 2026-09-22).
  // Both branches used to end "until the end of that day", and capture now runs
  // twelve hours past it — so the card told a couple their guests' phones were
  // dead while the shutter still worked. Each label is formatted from the exact
  // instant `guestCaptureGate` compares against: the stored window end when the
  // switch is ON, and `manilaCaptureCloseIso(event day)` when it is OFF, which
  // is literally the expression in that resolver's switch-OFF branch.
  const eventDay = manilaDate(day);
  const openCloseLabel = formatCaptureCloseLabel(row.papic_window_end);
  const dayCloseLabel = eventDay
    ? formatCaptureCloseLabel(manilaCaptureCloseIso(eventDay))
    : null;

  const explanation = early ? (
    <>
      Open now. Your guests can take photos any time through your capture
      window
      {openCloseLabel ? `, which closes ${openCloseLabel}` : ''} — good for
      the pre-nup shoot, the fitting, or the night before.
    </>
  ) : (
    <>
      {/* “open”, not “switch on” — the interpolation already supplies its own
          “on”, so this rendered “switch on on 2026-09-11”. Deleting one “on”
          instead would make the date the object of “switch on”, and the null
          branch would then need a second, different edit. open/close is this
          picker's own vocabulary already. */}
      Your guests&rsquo; cameras open
      {day ? ` on ${day}` : ' on your event day'} and stay on
      {dayCloseLabel
        ? ` until ${dayCloseLabel} — ${PAPIC_CAPTURE_GRACE_HOURS} hours past the end of the day`
        : ` until ${PAPIC_CAPTURE_GRACE_HOURS} hours after your event day ends`}
      . Open them early if you want photos of the preparations too.
    </>
  );

  const control = (
    <form action={setPapicGuestCaptureEarly}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="early" value={early ? '0' : '1'} />
      <SubmitButton
        pendingLabel="Saving…"
        className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
      >
        {early ? 'Only on my event day' : 'Let guests shoot now'}
      </SubmitButton>
    </form>
  );

  if (variant === 'row') {
    return (
      <SettingRow
        icon={<Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="When guests can shoot"
        value={early ? 'Open now' : 'Event day'}
        sheetTitle="When guests can shoot"
      >
        <p className="mb-4 text-sm text-ink/65">{explanation}</p>
        {control}
      </SettingRow>
    );
  }

  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          When guests can shoot
        </h2>
        <p className="max-w-prose text-sm text-ink/60">{explanation}</p>
      </div>

      {control}
    </section>
  );
}
