// ============================================================================
// lib/guest-call-links.ts — Call and Viber call a GUEST, from the couple's own guest card.
//
// Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS"), verbatim: *"Guest card 1. Yes."* — a Call (tel:) and a Viber
// call (viber://chat?number=) next to the guest's saved mobile. The 2026-09-14 scope still governs: *"only for the
// couple and if coordinator is given access"* — so this file is imported ONLY by the couple's guest card
// (`guest-call-buttons.tsx`), never by a guest-facing or public surface. It is a line of `GUEST_CONTACT_BILL` in
// `lib/no-door-out-of-the-app.test.ts` (count 2), which also holds that only the guest card imports it.
//
// A guest is not a shop: no booking fee, no in-app booking to protect, and the couple typed the number in themselves.
// ============================================================================

import { phPhoneToE164 } from './ph-dial';

/** tel:+63… for a guest's saved mobile; null when none is saved or it is not a PH number. */
export function guestTelHref(mobile: string | null | undefined): string | null {
  const e164 = mobile ? phPhoneToE164(mobile) : null;
  return e164 ? `tel:${e164}` : null;
}

/** viber://chat?number=%2B639… — only a PH MOBILE (Viber needs one); null otherwise. */
export function guestViberHref(mobile: string | null | undefined): string | null {
  const e164 = mobile ? phPhoneToE164(mobile) : null;
  if (!e164 || !/^\+639\d{9}$/.test(e164)) return null;
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}
