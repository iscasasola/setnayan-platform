/**
 * 🔕 TABLE-CHANGE ALERTS ARE NOT SENT YET (owner ruling, final check Add 34 · A4-52, 25 Nov 2026).
 *
 * The guest seat pass used to ask "We'll let you know on this device if your table changes". The ask saved a
 * subscription (`guest_push_subscriptions`, `app/[slug]/seat/actions/guest-push-actions.ts`), but nothing reads that
 * table or sends anything, so the promise was never kept. The owner's ruling: hide the ask until a real sender
 * exists — no new look, no sender this round (the sender is later work, after launch).
 *
 * Turn this on in the same change that ships the sender. `notifications-finally-have-a-subscriber.test.ts` fails
 * if it is on while nothing outside the writer reads `guest_push_subscriptions`.
 */
export const TABLE_CHANGE_ALERTS_SEND = false;
