/**
 * WHOSE BUBBLE IS IT — "mine" is the signed-in PERSON, not their side (chat gaps, owner 8 Nov 2026).
 *
 * ── WHAT WAS TRUE BEFORE ─────────────────────────────────────────────────────
 * The stream drew a bubble as "mine" when `m.sender_role === viewerRole`. On the HOST side every host speaks as
 * `couple` (tg_chat_messages_derive_sender), so in a chat with two or four co-hosts EVERY host's words were drawn on
 * the right, in your colour, unlabelled — the co-hosts could not tell each other apart, and "Seen" sat under a
 * co-host's message as if it were yours.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 *   · HOST viewer: mine = written on the hosts' side BY YOU (`sender_user_id === viewerUserId`). Another co-host's
 *     message is theirs: drawn on the left with their first name on the run, exactly the way the supplier's view
 *     already labels each host's run. A legacy row with no sender id stays yours (it cannot be anyone else's).
 *   · SUPPLIER viewer: unchanged — the shop speaks as one ("the vendor side either way"), so every shop-side bubble,
 *     the owner's, a team member's or the auto-reply's, stays on the right; each team member's run already carries
 *     their name on the host side (`readThreadReceipts`).
 *
 * Pure, so the stream and its guard read one rule.
 */

export type OwnerRow = { sender_role: string; sender_user_id?: string | null };

export function ownsBubble(m: OwnerRow, viewerRole: 'couple' | 'vendor', viewerUserId: string): boolean {
  if (m.sender_role !== viewerRole) return false;
  if (viewerRole !== 'couple') return true;
  const sender = m.sender_user_id ?? null;
  return sender === null || sender === viewerUserId;
}

/**
 * On the hosts' side, a message from ANOTHER co-host — the run that carries their name. False for your own words, for
 * the supplier's, and for every bubble on the supplier's side.
 */
export function isCoHostMessage(m: OwnerRow, viewerRole: 'couple' | 'vendor', viewerUserId: string): boolean {
  return viewerRole === 'couple' && m.sender_role === 'couple' && !ownsBubble(m, viewerRole, viewerUserId);
}
