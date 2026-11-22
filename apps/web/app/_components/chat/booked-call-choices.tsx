// ============================================================================
// 📞 CALL · VIBER UNDER ⋯ (Unichat, approved drawing `unichat_live_v3_2026-11-20.html`: "The phone icon in the header.
// Call · Viber moved under ⋯ to make room for search"; "Phone · Viber — only once booked. No in-app calls.").
//
// The ⋯ row's page: the two hand-offs, said in words. Both links are made ONLY by `lib/booked-handoff.ts`, which
// returns null without the booking — so an unbooked shop, or no saved number, draws nothing here, and
// `bookedCallReachable` tells the page not to add the ⋯ row at all (never a dead row). Same gate as the chat head's
// `BookedCallButtons`; no new rule (`lib/no-door-out-of-the-app.test.ts`, BOOKED_HANDOFF_BILL).
// ============================================================================
import { Phone, Video } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { bookedTelHref, bookedViberHref } from '@/lib/booked-handoff';

/** True when at least one hand-off exists — the ⋯ row is drawn only then. */
export function bookedCallReachable(booked: boolean, phone: string | null): boolean {
  return Boolean(bookedTelHref(booked, phone) || bookedViberHref(booked, phone));
}

export function BookedCallChoices({ booked, phone, who }: { booked: boolean; phone: string | null; who: string }) {
  const tel = bookedTelHref(booked, phone);
  const viber = bookedViberHref(booked, phone);
  if (!tel && !viber) return null;
  return (
    <div className="grid gap-3 p-4" data-booked-call-choices="">
      <p className="text-[15px] text-ink/70">Opens your phone or Viber — you are booked, so you can talk directly.</p>
      {tel ? <ActionButton href={tel} tone="neutral" icon={<Phone aria-hidden strokeWidth={1.75} />} label="Call" name={`Call ${who}`} /> : null}
      {viber ? (
        <ActionButton href={viber} tone="neutral" icon={<Video aria-hidden strokeWidth={1.75} />} label="Video call on Viber" name={`Video call ${who} on Viber`} />
      ) : null}
    </div>
  );
}
