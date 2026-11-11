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
 *   · 💬 A GROUP LINE (owner 12 Nov, event group chats — a line with NO supplier, `vendor_profile_id` null): mine = BY
 *     YOU, whatever your side. A group holds several suppliers, guests and the coordinator, so a side never says who
 *     wrote it (Rosa's words are not Jake's). Supplier lines keep the two rules above, untouched.
 *
 * Pure, so the stream and its guard read one rule.
 */

export type OwnerRow = { sender_role: string; sender_user_id?: string | null; vendor_profile_id?: string | null };

/** A line in an event GROUP chat — it names no supplier (`chat_threads.kind = 'group'`, migration 20271340374819). */
function isGroupLine(m: OwnerRow): boolean {
  return m.vendor_profile_id === null && m.sender_role !== 'system';
}

export function ownsBubble(m: OwnerRow, viewerRole: 'couple' | 'vendor', viewerUserId: string): boolean {
  if (isGroupLine(m)) return m.sender_user_id === viewerUserId;
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
  // 💬 In a group, every other person's run carries their name (the page hands every member's name in).
  if (isGroupLine(m)) return m.sender_role !== 'system' && !ownsBubble(m, viewerRole, viewerUserId);
  return viewerRole === 'couple' && m.sender_role === 'couple' && !ownsBubble(m, viewerRole, viewerUserId);
}
