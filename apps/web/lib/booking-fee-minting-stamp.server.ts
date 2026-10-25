import 'server-only';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMintingStampScheduler } from '@/lib/booking-fee-minting-stamp';

/**
 * The booking-fee minting stamp, ONCE PER INSTANCE, AFTER A RESPONSE — called by the root layout
 * (`app/layout.tsx`). Why not at server start, and why not on the request path: the docblock above
 * `STAMP_CEILING_MS` in `lib/booking-fee-minting-stamp.ts`.
 */
export const scheduleBookingFeeMintingStamp = createMintingStampScheduler({
  env: process.env,
  after,
  client: createAdminClient,
});
