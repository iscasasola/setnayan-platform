/**
 * 🤝 A BOOKED COORDINATOR IS TOLD THEIR INVITE IS WAITING (supplier gate audit 2026-11-02, row E1). The pure half of
 * `autoInviteCoordinator`'s notice (lib/coordinator-grant.ts).
 *
 * Since 2026-06-22 a paid planner_coordinator booking makes a 7-day `/host/accept/<token>` invite for the booking's
 * contact email — and told nobody: the couple had to copy the link by hand. Now the ACCOUNT that invite is for is told
 * in the app (`coordinator_invited`), and the notice opens the link.
 *
 * WHICH ACCOUNT: the one whose email IS the invite's email (case-insensitive). The accept page refuses another email
 * (`email_mismatch`), so a notice to any other account would open a door that says no. The booked shop's owner is
 * preferred when it is that account (the same person, found by the booking rather than by a search); an account found
 * only by a near-match is never told. No account → nobody is told here (the couple's Promote card still shows the link).
 *
 * 🔒 lib/a-booked-coordinator-is-told.test.ts
 */

export type AccountRow = { user_id: string; email: string | null };

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase();

/** The account to tell, or null when no account's email is the invite's. */
export function coordinatorInviteRecipient(input: {
  inviteEmail: string;
  shopOwner: AccountRow | null;
  byEmail: readonly AccountRow[];
}): string | null {
  const want = norm(input.inviteEmail);
  if (!want) return null;
  if (input.shopOwner && norm(input.shopOwner.email) === want) return input.shopOwner.user_id;
  return input.byEmail.find((a) => norm(a.email) === want)?.user_id ?? null;
}

/** The notice itself: where it opens, and its words. */
export function coordinatorInviteNotice(input: { token: string; eventName: string | null; days: number }): {
  title: string;
  body: string;
  relatedUrl: string;
} {
  const event = input.eventName?.trim() || 'A couple’s event';
  return {
    title: `${event} invites you to coordinate`,
    body: `You’re booked as their coordinator. Accept to run their schedule and day-of requests — the invite lasts ${input.days} days.`,
    relatedUrl: `/host/accept/${input.token}`,
  };
}
