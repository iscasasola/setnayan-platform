import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { readScheduleSuppliers } from './schedule-suppliers-read';
import { ROLE_LABELS, fetchGuestsByEventMeasured, guestDisplayName, readEventGroupMemberships, guestRoleLabel, type GuestRole } from './guests';
import { isOnEveryChapter } from './supplier-where';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendors';
import { sanitizeRoleNames } from './role-names';
import { eventCoupleWebsiteProActive } from './couple-website-pro';
import { eventEntitlementClient } from './event-entitlement-client.server';
import { asViewed } from './view-as-free.server';
import { getIapGate } from './request-platform';
import type { TaskRow } from './schedule-chapters';
import type { ViewPerson, ViewSupplier } from './schedule-view-as';

/**
 * 👁 VIEW AS — the server half: what the Schedule's View as ▾ reads beyond what the page already holds, in ONE parallel
 * round (the pure half is `schedule-view-as.ts`). Every read runs on the caller's own client, so RLS decides: the couple
 * and a helper on the Schedule read the tasks; nobody else does.
 *
 *   · (the moments' tasks and rooms are the page's own reads — `readMomentTasks`, `readChapterBook` — never read twice);
 *   · the guest groups' names (a task may name a group);
 *   · the suppliers by shop name — only when the page has not already read them (the run-of-show switch off);
 *   · 💎 whether the event owns Pro — View as a guest, a role or a supplier is Pro (owner 2026-11-01, plan §3b:
 *     *"chapters Free · View as and Release Pro"*); Suppliers by time is FREE (owner 2026-11-02, "TEN OWNER YESES"
 *     item 3), so a Free event still gets the menu (`lensAllowed`). It is not an Event Hub part, so the question is the whole of Pro (`eventCoupleWebsiteProActive`,
 *     listed in `every-pro-gate-names-its-part.test.ts`), as this viewer is shown it (`asViewed` — the owner's "view
 *     as a free couple" switch takes Pro away, never grants it). A refused read answers Free: at worst it offers the
 *     upgrade to an event that has it, never opens a paid view for free.
 *
 * It never writes.
 */
export type ViewAsExtras = {
  groups: Record<string, string> | null;
  /** NULL when the caller already holds them. */
  suppliers: ViewSupplier[] | null;
  roleNames: Record<string, string>;
  pro: boolean;
  proHref: string | null;
  /** 👤 The guests for View as › a named guest (slice 6) — read on a Pro event only; NULL = refused (said). */
  people: ViewPerson[] | null;
  /** Released AND Pro — the guests' own `released` (`readYourSchedule`). */
  released: boolean;
  /** 📋 The booked coordinators — on every chapter (`isOnEveryChapter`); empty when the trades could not be read. */
  coordinatorIds: string[];
};

export async function readViewAsExtras(supabase: SupabaseClient, eventId: string, opts: { readSuppliers: boolean; tasks: Promise<TaskRow[] | null> }): Promise<ViewAsExtras> {
  const [taskRows, groups, suppliers, pro, gate, eventHead] = await Promise.all([
    opts.tasks,
    supabase
      .from('guest_groups')
      .select('group_id, label')
      .eq('event_id', eventId)
      .then(
        ({ data, error }) => {
          if (error || !data) {
            if (error) logQueryError('readViewAsExtras.groups', error, { event_id: eventId }, 'graceful_degrade');
            return null;
          }
          return Object.fromEntries((data as Array<{ group_id: string; label: string }>).map((g) => [g.group_id, g.label]));
        },
        () => null,
      ),
    // 🔌 A refused read is `null` (unknown), never `[]` (none) — the page then says so (audit #16).
    opts.readSuppliers ? readScheduleSuppliers(supabase, eventId).catch(() => null) : Promise.resolve(null),
    asViewed((async () => eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId))().catch(() => false)),
    getIapGate().catch(() => ({ storeShell: false, iap: false })),
    // The couple's own word for a role (Bridesmaid → "Bride's Crew") — the word every screen shows.
    supabase
      .from('events')
      .select('role_names, schedule_released_at')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(
        ({ data }) => ({
          words: sanitizeRoleNames((data as { role_names?: unknown } | null)?.role_names ?? null),
          releasedAt: (data as { schedule_released_at?: string | null } | null)?.schedule_released_at ?? null,
        }),
        () => ({ words: sanitizeRoleNames(null), releasedAt: null }),
      ),
  ]);
  const roleWords = eventHead.words;
  // 📋 Which booked suppliers are coordinators (on every chapter) — their trade. A refused read lists none (logged).
  const tradesRes = await supabase.from('event_vendors').select('vendor_id, category').eq('event_id', eventId);
  if (tradesRes.error) logQueryError('readViewAsExtras.trades', tradesRes.error, { event_id: eventId }, 'graceful_degrade');
  const tradeRows = (tradesRes.data ?? []) as Array<{ vendor_id: string; category: string | null }>;
  const coordinatorIds = tradeRows.filter((t) => isOnEveryChapter(null, t.category)).map((t) => t.vendor_id);
  // 🧭 Side by side (slice 9): each supplier's trade under their name, and which one is the Host / MC.
  const tradeOf = new Map(tradeRows.map((t) => [t.vendor_id, t.category]));
  const people = pro ? await readViewPeople(supabase, eventId) : null;
  const roleNames: Record<string, string> = {};
  for (const t of taskRows ?? []) {
    const word = t.role?.trim().toLowerCase();
    if (word && word in ROLE_LABELS) roleNames[word] = guestRoleLabel(word as GuestRole, roleWords);
  }
  return {
    groups,
    suppliers: suppliers
      ? suppliers.map((s) => {
          const cat = tradeOf.get(s.vendor_id) ?? null;
          return {
            vendor_id: s.vendor_id,
            name: s.vendor_name,
            booked: s.standing === 'Booked',
            everyChapter: coordinatorIds.includes(s.vendor_id),
            host: cat === 'host_mc',
            trade: cat ? (VENDOR_CATEGORY_LABEL[cat as VendorCategory] ?? null) : null,
          };
        })
      : null,
    people,
    released: pro && eventHead.releasedAt !== null,
    coordinatorIds,
    roleNames,
    pro,
    // 🍎 Where Apple sells Pro, its page; any other store shell sells none — the door is absent there (shell rule).
    proHref: gate.iap ? `/dashboard/${eventId}/apple-pro` : gate.storeShell ? null : `/dashboard/${eventId}/studio/website-pro`,
  };
}

/**
 * 👤 THE GUESTS, AS THEIR OWN CARD READS THEM (slice 6) — for each living, accepted guest: their name, the roles they
 * hold (`role` + `extra_roles`), their groups and the chapters the hosts took them off — the same three facts
 * `readYourSchedule` reads for one guest, read once for the event on the host's own session. Any refusal = null.
 */
async function readViewPeople(supabase: SupabaseClient, eventId: string): Promise<ViewPerson[] | null> {
  const [guests, members, off] = await Promise.all([
    fetchGuestsByEventMeasured(supabase, eventId),
    readEventGroupMemberships(supabase, eventId),
    supabase.from('guest_chapter_not_invited').select('guest_id, block_id').eq('event_id', eventId),
  ]);
  if (!guests.measured || members.error || off.error) {
    const error = members.error ?? off.error;
    if (error) logQueryError('readViewAsExtras.people', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const groupsOf = new Map<string, string[]>();
  for (const m of members.data ?? []) groupsOf.set(m.guest_id, [...(groupsOf.get(m.guest_id) ?? []), m.group_id]);
  const offOf = new Map<string, string[]>();
  for (const o of (off.data ?? []) as Array<{ guest_id: string; block_id: string }>) offOf.set(o.guest_id, [...(offOf.get(o.guest_id) ?? []), o.block_id]);
  return guests.rows.map((g) => ({
    guest_id: g.guest_id,
    name: guestDisplayName(g),
    roles: [g.role as string | null, ...((g.extra_roles as string[] | null) ?? [])].filter((r): r is string => typeof r === 'string' && r.trim().length > 0),
    groupIds: groupsOf.get(g.guest_id) ?? [],
    notInvited: offOf.get(g.guest_id) ?? [],
  }));
}
