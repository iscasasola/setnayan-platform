import 'server-only';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';

import { toggleVendorServiceActive } from '@/app/vendor-dashboard/services/actions';
import { FIRST_CARD_NOT_LIVE, firstCardLiveFrom } from '@/lib/supplier-onboarding';

export { FIRST_CARD_NOT_LIVE };

/**
 * 🃏 PUT THE ONBOARDING'S FIRST CARD ON THE PAGE — through the SHIPPED switch (`toggleVendorServiceActive`), never a
 * write of our own. The shipped maker makes every card as a draft (`is_active: false`); the switch asks the whole
 * question — the publish gate (a cover, a price, what's included) and the plan's live-cards cap — and answers with a
 * redirect, which is READ here, never followed: `?error=` is ITS sentence (returned as `why`), `?saved=1` is live.
 * Anything else is not taken as a yes. Needs the signed-in owner's session (the switch resolves the shop itself).
 * 🔒 lib/supplier-onboarding.test.ts
 */
export async function putFirstCardLive(cardId: string): Promise<{ live: true } | { live: false; why: string }> {
  const fd = new FormData();
  fd.set('vendor_service_id', cardId);
  fd.set('is_active', 'true');
  try {
    await toggleVendorServiceActive(fd);
  } catch (e) {
    if (!isRedirectError(e)) {
      console.error('[open-shop] the first card could not be switched on:', e instanceof Error ? e.message : e);
      return { live: false, why: FIRST_CARD_NOT_LIVE };
    }
    return firstCardLiveFrom(getURLFromRedirectError(e));
  }
  // The switch always answers with a redirect; returning without one is not a yes.
  return { live: false, why: FIRST_CARD_NOT_LIVE };
}
