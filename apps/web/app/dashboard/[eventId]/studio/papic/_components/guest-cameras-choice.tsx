import { Users } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { setPapicGuestCaptureEarly } from '../guest-window-actions';
import { SettingRow } from './setting-row';

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
    .select('papic_guest_capture_early, event_date')
    .eq('event_id', eventId)
    .maybeSingle();

  // ⚠ Supabase resolves with { error } rather than throwing, and an RLS denial
  // reads as an empty result. Either way there is nothing trustworthy to render.
  if (error || !data) return null;

  // Nothing to schedule if guest cameras are not on for this event. Uses the
  // admin client because the pass/pool check reads rows the couple's own client
  // is not entitled to — the same call the guest camera page makes.
  const active = await eventPapicGuestActive(createAdminClient(), eventId);
  if (!active) return null;

  const row = data as {
    papic_guest_capture_early: boolean | null;
    event_date: string | null;
  };
  const early = row.papic_guest_capture_early === true;
  const day = row.event_date;

  const explanation = early ? (
    <>
      Open now. Your guests can take photos any time up to the end of
      your event day — good for the pre-nup shoot, the fitting, or the
      night before.
    </>
  ) : (
    <>
      Your guests&rsquo; cameras switch on
      {day ? ` on ${day}` : ' on your event day'} and stay on until the
      end of that day. Open them early if you want photos of the
      preparations too.
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
