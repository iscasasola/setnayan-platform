import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { ScanFace } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { SettingRow } from './setting-row';
import { createClient } from '@/lib/supabase/server';
import { resolveFaceTagging } from '@/lib/face-tagging-gate';
import { setCoupleFaceTaggingDeclined } from '../face-tagging-actions';

/**
 * "Finding people in photos" — the couple's own say over face tagging.
 *
 * ── WHY THIS CARD EXISTS ────────────────────────────────────────────────────
 * Face tagging was optional at every level except the one that matters most.
 * The guest chooses (the enrolment block is skippable and stores nothing
 * without two ticks). An admin chooses, per event. The couple — whose wedding
 * it is, and whose guests they are — had no lever at all.
 *
 * ── IT ONLY EVER SAYS NO ────────────────────────────────────────────────────
 * The card renders nothing when face tagging is not available for this event,
 * because "turn it on" is not a thing a couple can do. Offering a control that
 * silently cannot enable anything is the empty-promise shape this project keeps
 * getting caught by; an absent card is the honest version.
 *
 * ⚠ `variant="row"` IS THE SAME CONTROL BEHIND A DIFFERENT DOOR. The approved
 * control-centre drawing files this under "Set once, change any time" as a row
 * showing its current answer, with the full explanation and the switch in the
 * sheet behind it. The form is passed through untouched — a redraw here would
 * be a second copy of a control, which is the thing this codebase pays for.
 *
 * 🔑 AND THE ABSENCE LOGIC STAYS INSIDE THIS COMPONENT, deliberately. If the
 * page decided whether to draw the row, a row would exist for events where the
 * control renders nothing — a gate with no handle, in a new costume.
 */
export async function FaceTaggingChoice({
  eventId,
  variant = 'card',
}: {
  eventId: string;
  variant?: 'card' | 'row';
}) {
  // The caller's own client checks the row is theirs to read (RLS)…
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('event_id, face_tagging_declined_by_couple')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) console.error('[supabase-error] app/dashboard/[eventId]/studio/papic/_components/face-tagging-choice.tsx · from:events.select', error);

  // 🔑 A REFUSED READ IS NOT "NOT AVAILABLE". Returning null here removed the
  // couple's only switch for face tagging on an event where it may be ON — the
  // same absence as "nothing to decline". Say we could not check (S41b).
  if (error) {
    const unreadable = (
      <>We couldn&rsquo;t check this setting just now. Refresh the page to see it and change it.</>
    );
    if (variant === 'row') {
      return (
        <SettingRow
          icon={<ScanFace aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          label="Finding people in photos"
          value="Couldn't load"
          sheetTitle="Finding people in photos"
        >
          <p className="mb-4 text-sm text-ink/65">{unreadable}</p>
        </SettingRow>
      );
    }
    return (
      <section className="space-y-1 sn-tile p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ScanFace aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          Finding people in photos
        </h2>
        <p className="max-w-prose text-sm text-terracotta-700">{unreadable}</p>
      </section>
    );
  }
  if (!data) return null;

  // …and the ONE gate answers what runs (lib/face-tagging-gate.ts). ⚖ Owner
  // 2026-09-30 ("automatic"): face tagging is ON by itself wherever the event's
  // Papic is active — no admin step — so this card now shows on every such
  // event, not only where an admin once chose mode_a. Christening/debut stay
  // off until an admin turns them on; with nothing running there is nothing to
  // switch off, and the card is absent.
  const tagging = await resolveFaceTagging(await eventEntitlementClient(eventId), eventId);
  if (!tagging.available) return null;

  // The couple's own answer, read through THEIR client (RLS) — the same value
  // the gate read, so the button can never say the opposite of what runs.
  const declined = (data as { face_tagging_declined_by_couple?: boolean | null }).face_tagging_declined_by_couple === true;

  const explanation = declined ? (
    <>
      Off for your event. Guests get their photos when someone scans their QR
      or tags them — nobody&rsquo;s face is measured.
    </>
  ) : (
    <>
      On automatically because your event has Papic. Guests who say
      &ldquo;Yes, tag me&rdquo; take one selfie on the day and get their photos
      found for them. It is always their choice — nothing is stored unless
      they agree — and you can switch it off for your whole event. Switching
      it off erases every guest&rsquo;s selfie; photos already tagged stay
      tagged.
    </>
  );

  const control = (
    <form action={setCoupleFaceTaggingDeclined}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="declined" value={declined ? '0' : '1'} />
      <SubmitButton
        pendingLabel="Saving…"
        className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
      >
        {declined ? 'Turn it back on' : 'Turn it off for my event'}
      </SubmitButton>
    </form>
  );

  if (variant === 'row') {
    return (
      /*
        ⚖ THE SWITCH IS ON THE ROW (owner 2026-09-22: *"set the toggles here if
        it only needs toggle switches"*). This sheet held exactly one control,
        so opening it was two taps to do what one could — and the row already
        showed the answer.

        🔑 THE ROW IS STILL A DOOR, and that is not a hedge. The sheet holds the
        EXPLANATION — that guests choose this for themselves, that nothing is
        stored unless they agree, and what turning it off does to them. A switch
        about somebody else's face with no way to read what it means is a worse
        control than a sheet, so the switch is ADDED to the row and the door is
        kept.
      */
      <SettingRow
        icon={<ScanFace aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="Finding people in photos"
        value={declined ? 'Off' : 'On'}
        sheetTitle="Finding people in photos"
        switchControl={control}
      >
        <p className="mb-4 text-sm text-ink/65">{explanation}</p>
      </SettingRow>
    );
  }

  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ScanFace aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          Finding people in photos
        </h2>
        <p className="max-w-prose text-sm text-ink/60">{explanation}</p>
      </div>

      {control}
    </section>
  );
}
