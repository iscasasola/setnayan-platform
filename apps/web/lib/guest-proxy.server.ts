import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestDisplayName, guestFullName, type GuestRole } from '@/lib/guests';
import { ENTOURAGE_COLUMNS, type EntourageGuestRow } from '@/lib/entourage';
import type { NameStyle } from '@/lib/name-style';
import { namedAProxy, type GuestStandIn, type StandingInFor } from '@/lib/guest-proxy';

/**
 * 🧍‍♀️➡️🧍 THE GUEST'S OWN SIDE OF A PROXY — read for the guest reading their own invitation (owner 2026-10-27: *"so
 * catherine sacdalan's invitation will indicate they are proxying for XXX. giving them the role and dress code, call time,
 * etc"*). Both directions, from the reader's OWN row (the caller passes the verified session's guest id):
 *
 *   · `standingInFor` — the role holder whose `represented_by_guest_id` names THIS guest. Their role is what this guest
 *     dresses and arrives as (`effectiveRoleOf`), and their name is said: "Standing in for … · Principal Sponsor".
 *   · `representedBy` — this guest IS a role holder and someone stands in: "Maria Catherine Sacdalan is standing in for
 *     you" — no reply is asked of them.
 *   · `namedProxy`    — they named someone on their own reply and the host has not linked them yet.
 *
 * Only names and roles leave here — never a contact detail of the other guest. A refused read is `null` for that half
 * and the page simply draws the guest as themselves (an absence never claims a link that is there).
 */
export type { GuestStandIn };

export async function readGuestStandIn(
  admin: SupabaseClient,
  eventId: string,
  own: { guest_id: string; represented_by_guest_id?: string | null; proxy_named_by_guest?: string | null },
): Promise<GuestStandIn> {
  const [holderRead, proxyRead] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles')
      .eq('event_id', eventId)
      .eq('represented_by_guest_id', own.guest_id)
      .is('deleted_at', null)
      .maybeSingle(),
    own.represented_by_guest_id
      ? admin
          .from('guests')
          .select('guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles')
          .eq('event_id', eventId)
          .eq('guest_id', own.represented_by_guest_id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (holderRead.error) logQueryError('readGuestStandIn.holder', holderRead.error, { eventId }, 'graceful_degrade');
  if (proxyRead.error) logQueryError('readGuestStandIn.proxy', proxyRead.error, { eventId }, 'graceful_degrade');
  const holder = (holderRead.data ?? null) as
    | { guest_id: string; first_name: string; last_name: string; display_name: string | null; role: GuestRole; extra_roles: GuestRole[] | null }
    | null;
  const proxy = (proxyRead.data ?? null) as { guest_id: string; first_name: string; last_name: string; display_name: string | null } | null;
  return {
    standingInFor: holder
      ? { guestId: holder.guest_id, name: guestDisplayName(holder), role: holder.role, extra_roles: holder.extra_roles ?? [] }
      : null,
    representedBy: proxy ? { guestId: proxy.guest_id, name: guestDisplayName(proxy) } : null,
    namedProxy: namedAProxy(own),
  };
}

/**
 * 🖨 Who stands in for each represented role holder among `rows` — holder guest_id → the proxy's name, for
 * `entourageWithProxies`. A refused read is an empty map: the print names the role holder as before (never a guessed proxy).
 */
export async function entourageProxyNames(
  admin: SupabaseClient,
  eventId: string,
  rows: readonly { guest_id?: string | null; represented_by_guest_id?: string | null }[],
  /** The event's Name style — the proxy prints the way the holder beside them does. */
  style?: NameStyle,
): Promise<Map<string, string>> {
  const links = rows.filter((r): r is { guest_id: string; represented_by_guest_id: string } => Boolean(r.guest_id && r.represented_by_guest_id));
  if (links.length === 0) return new Map();
  const { data, error } = await admin
    .from('guests')
    // The entourage's own columns — the proxy is printed the way the holder is (`guestFullName`, the formal name).
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .in('guest_id', links.map((l) => l.represented_by_guest_id))
    .is('deleted_at', null);
  if (error) {
    logQueryError('entourageProxyNames', error, { eventId }, 'graceful_degrade');
    return new Map();
  }
  const nameOf = new Map(
    ((data ?? []) as unknown as (EntourageGuestRow & { guest_id: string })[]).map((p) => [p.guest_id, guestFullName(p, style) ?? guestDisplayName(p as never)] as const),
  );
  const out = new Map<string, string>();
  for (const l of links) {
    const n = nameOf.get(l.represented_by_guest_id);
    if (n) out.set(l.guest_id, n);
  }
  return out;
}
