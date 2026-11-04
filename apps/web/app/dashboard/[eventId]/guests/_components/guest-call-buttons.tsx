// 📞 Call · Viber call a guest — right under their saved mobile on the couple's guest card (owner 2026-11-04,
// "Guest card 1. Yes."). Nothing renders without a saved number. Hand-offs to the phone's own dialer and to Viber; the
// card is gated to the couple and coordinators with guest_list access, and this is the only importer of
// `lib/guest-call-links.ts` (guard: `lib/no-door-out-of-the-app.test.ts`, GUEST_CONTACT_BILL).

import { Phone, Video } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { guestTelHref, guestViberHref } from '@/lib/guest-call-links';

export function GuestCallButtons({ mobile, name }: { mobile: string | null | undefined; name: string }) {
  const tel = guestTelHref(mobile);
  const viber = guestViberHref(mobile);
  if (!tel && !viber) return null;
  return (
    <div className="flex items-center gap-2 px-3.5 pb-2" data-guest-call>
      {tel ? <ActionButton href={tel} tone="neutral" iconOnly icon={<Phone aria-hidden strokeWidth={1.75} />} label="Call" name={`Call ${name}`} /> : null}
      {viber ? <ActionButton href={viber} tone="neutral" iconOnly icon={<Video aria-hidden strokeWidth={1.75} />} label="Viber call" name={`Viber call ${name}`} /> : null}
    </div>
  );
}
