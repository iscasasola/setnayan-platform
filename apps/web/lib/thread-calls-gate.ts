import 'server-only';
import { createAdminClient } from './supabase/admin';
import { resolveVendorTier } from './vendor-feature-gate';
import { callsArePaidOnly, threadCallsAllowed } from './thread-calls-rule';

/**
 * Is in-thread voice/video calling unlocked for the thread whose vendor is
 * `vendorProfileId`?
 *
 * Calls became a PAID-vendor capability on 2026-07-13 (owner: "a service for
 * the paid") — any paid plan (Solo+), NOT Free/Verified.
 *
 * ⚖ ITS OWN SWITCH SINCE 2026-10-02 (owner, tracker d10: "paid suppliers only,
 * starting now"). It used to ride the shared VENDOR_TIER_FEATURE_GATE, which is
 * off in production and turns on every other plan limit with it. Now the rule
 * is `threadCallsAllowed` (lib/thread-calls-rule.ts): paid only by default;
 * `VENDOR_CALLS_PAID_ONLY=0/false/off` reopens calls for every supplier. The
 * shared switch is untouched and no longer consulted here.
 *
 * The vendor tier is read with the ADMIN client — a read-only capability probe
 * on the thread's OWN vendor, so a couple-initiated call resolves it reliably
 * regardless of vendor_profiles read policies. It is NOT an authorization
 * bypass: the actual call insert (thread-call-actions.ts) still rides the
 * caller's RLS-scoped session.
 *
 * The single source of truth for this gate, shared by the authoritative server
 * action AND the four thread surfaces that render the call launcher (so the UI
 * lock and the server refusal can never disagree).
 */
export async function resolveThreadCallsEnabled(vendorProfileId: string): Promise<boolean> {
  // Kill switch first: reopened calls cost no tier read.
  if (!callsArePaidOnly()) return true;
  const tier = await resolveVendorTier(createAdminClient(), vendorProfileId);
  return threadCallsAllowed(tier);
}
