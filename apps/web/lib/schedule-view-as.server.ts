import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { readScheduleSuppliers } from './schedule-suppliers-read';
import { ROLE_LABELS, guestRoleLabel, type GuestRole } from './guests';
import { sanitizeRoleNames } from './role-names';
import { eventCoupleWebsiteProActive } from './couple-website-pro';
import { eventEntitlementClient } from './event-entitlement-client.server';
import { asViewed } from './view-as-free.server';
import { getIapGate } from './request-platform';
import type { TaskRow } from './schedule-chapters';
import type { ViewSupplier } from './schedule-view-as';

/**
 * 👁 VIEW AS — the server half: what the Schedule's View as ▾ reads beyond what the page already holds, in ONE parallel
 * round (the pure half is `schedule-view-as.ts`). Every read runs on the caller's own client, so RLS decides: the couple
 * and a helper on the Schedule read the tasks; nobody else does.
 *
 *   · (the moments' tasks and rooms are the page's own reads — `readMomentTasks`, `readChapterBook` — never read twice);
 *   · the guest groups' names (a task may name a group);
 *   · the suppliers by shop name — only when the page has not already read them (the run-of-show switch off);
 *   · 💎 whether the event owns Pro — View as is Pro (owner 2026-11-01, plan §3b: *"chapters Free · View as and
 *     Release Pro"*). It is not an Event Hub part, so the question is the whole of Pro (`eventCoupleWebsiteProActive`,
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
};

export async function readViewAsExtras(supabase: SupabaseClient, eventId: string, opts: { readSuppliers: boolean; tasks: Promise<TaskRow[] | null> }): Promise<ViewAsExtras> {
  const [taskRows, groups, suppliers, pro, gate, roleWords] = await Promise.all([
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
    opts.readSuppliers ? readScheduleSuppliers(supabase, eventId).catch(() => []) : Promise.resolve(null),
    asViewed((async () => eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId))().catch(() => false)),
    getIapGate().catch(() => ({ storeShell: false, iap: false })),
    // The couple's own word for a role (Bridesmaid → "Bride's Crew") — the word every screen shows.
    supabase
      .from('events')
      .select('role_names')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(
        ({ data }) => sanitizeRoleNames((data as { role_names?: unknown } | null)?.role_names ?? null),
        () => sanitizeRoleNames(null),
      ),
  ]);
  const roleNames: Record<string, string> = {};
  for (const t of taskRows ?? []) {
    const word = t.role?.trim().toLowerCase();
    if (word && word in ROLE_LABELS) roleNames[word] = guestRoleLabel(word as GuestRole, roleWords);
  }
  return {
    groups,
    suppliers: suppliers ? suppliers.map((s) => ({ vendor_id: s.vendor_id, name: s.vendor_name, booked: s.standing === 'Booked' })) : null,
    roleNames,
    pro,
    // 🍎 Where Apple sells Pro, its page; any other store shell sells none — the door is absent there (shell rule).
    proHref: gate.iap ? `/dashboard/${eventId}/apple-pro` : gate.storeShell ? null : `/dashboard/${eventId}/studio/website-pro`,
  };
}
