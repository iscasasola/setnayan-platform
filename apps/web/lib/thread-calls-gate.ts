import 'server-only';

/**
 * Is in-thread voice/video calling open for the thread whose vendor is `vendorProfileId`?
 *
 * ⚖ NO PLAN GATES IT ANY MORE (owner 2026-11-04, DECISION_LOG "SUPPLIER PLAN ALLOWANCES": the stale `calls`
 * capability is removed; Call/Video in chat is for BOOKED suppliers on EVERY plan). It was a paid-only capability
 * (2026-07-13, "a service for the paid") on its own `VENDOR_CALLS_PAID_ONLY` switch (2026-10-02); both the cap
 * (`TierCaps.calls`) and the rule file (`lib/thread-calls-rule.ts`) are gone.
 *
 * What still gates a call is the relationship, not the plan: `startThreadCall` (app/_actions/thread-call-actions.ts)
 * refuses until the inquiry is ACCEPTED, and the `thread_calls` member-insert RLS is the authoritative gate. The chat
 * mounts no call at all since 2026-10-28 ("remove both voice and video call" — `the-chat-has-no-calls.test.ts`); this
 * file stays, unused by the chat, for the owner to decide on.
 *
 * Kept async with the same signature so every caller keeps one place to ask.
 */
export async function resolveThreadCallsEnabled(_vendorProfileId: string): Promise<boolean> {
  return true;
}
