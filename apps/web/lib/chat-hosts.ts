/**
 * WHO THE HOSTS ARE, IN A SUPPLIER'S CHAT (THE ONE BUILD, 8 Nov 2026; spec plans/supplier_one_build_2026-11-08 §5.1).
 *
 * One source: `public.event_chat_hosts(event)` (migration 20271324946509) — every event_members row with
 * member_type = 'couple', keyed by the host's AUTH uid (the `sender_user_id` a chat message carries, so a bubble can
 * find its sender's first name). The supplier brief carries the same list as `hosts`; the thread page reads it through
 * the admin client (service_role only). PURE — no I/O here.
 */
export type ChatHost = {
  /** The host's auth uid — equal to `chat_messages.sender_user_id` for their messages. */
  userId: string;
  firstName: string | null;
  name: string | null;
  role: string | null;
  label: string | null;
};

/** Parse the RPC's JSONB. Anything not an array is NOT "no hosts" — it is unread, and comes back `null`. */
export function chatHostsFrom(raw: unknown): ChatHost[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatHost[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.user_id !== 'string' || o.user_id.length === 0) continue;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    out.push({ userId: o.user_id, firstName: str(o.first_name), name: str(o.name), role: str(o.role), label: str(o.label) });
  }
  return out;
}

/** The word a bubble and the strip show for a host: first name, else the full name, else "Host". */
export function hostFirstName(h: Pick<ChatHost, 'firstName' | 'name'>): string {
  return h.firstName ?? h.name?.split(/\s+/)[0] ?? 'Host';
}

/** Two initials for the circle (initials, never a photo — a profile photo is consent-gated, B1 drift #8). */
export function hostInitials(h: Pick<ChatHost, 'firstName' | 'name'>): string {
  const words = (h.name ?? h.firstName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * 🏪 WHICH FACE A BUBBLE WEARS (owner, 11 Nov 2026). A message carries its sender's uid AND the side it was sent for
 * (`sender_role`). One login can be both the shop's owner and a host of the event, so the uid alone names two faces —
 * the bubble picks the one on the message's OWN side: a shop message wears the shop's entry (role `supplier`), a
 * host's message the host's. Null when no face on that side matches (the caller falls back to the side's label).
 */
export function hostForMessage(
  m: { sender_role: string; sender_user_id?: string | null },
  hosts: readonly ChatHost[] | null | undefined,
): ChatHost | null {
  if (!m.sender_user_id || !hosts) return null;
  const shopSide = m.sender_role === 'vendor';
  return hosts.find((h) => h.userId === m.sender_user_id && (h.role === 'supplier') === shopSide) ?? null;
}
