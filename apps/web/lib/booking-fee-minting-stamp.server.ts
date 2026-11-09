import 'server-only';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMintingStampScheduler, stampBookingFeeMinting } from '@/lib/booking-fee-minting-stamp';
import { stampChatLive, worseOutcome } from '@/lib/chat-live-stamp';

/**
 * The production stamps, ONCE PER INSTANCE, AFTER A RESPONSE — called by the root layout (`app/layout.tsx`). Why not
 * at server start, and why not on the request path: the docblock above `STAMP_CEILING_MS` in
 * `lib/booking-fee-minting-stamp.ts`.
 *
 * Two env flags SQL needs to know about ride the one scheduler: the booking-fee minting stamp, and (2026-11-08) the
 * chat-live stamp (`lib/chat-live-stamp.ts`). They are written separately — one failing never blocks the other — and
 * a later request retries while either has not landed.
 */
export const scheduleBookingFeeMintingStamp = createMintingStampScheduler({
  env: process.env,
  after,
  client: createAdminClient,
  stamp: async (admin) => {
    const [fee, chat] = await Promise.all([stampBookingFeeMinting(admin), stampChatLive(admin)]);
    return worseOutcome(fee, chat);
  },
});
