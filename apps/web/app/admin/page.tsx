/**
 * /admin — Work › All. THE ONE NEEDS-ACTION LIST, and nothing else.
 *
 * Owner, 13 Nov 2026, on a screenshot of this page wearing the new five-tab bar
 * over the old body: *"fix that. we do not want the old page"*. The approved
 * drawing (`prototypes/admin_five_tabs_2026-11-13/work.html`, DECISION_LOG
 * "ADMIN WORK PAGE — THE OLD EXCEPTION DESK GOES") draws `/admin`,
 * `/admin/work` and `/admin/queues` as ONE screen: every shipped queue is a row
 * of one list, the row's action is in the row, a failed source says
 * "Couldn't load" — never 0 — and an empty day says "Nothing needs you".
 *
 * So this address renders the work list itself — the SAME component
 * `/admin/work` renders, not a copy of it. Two copies of one list is how the
 * old Overview came to disagree with the work list about which queue was most
 * urgent (see `lib/admin/queue-counts.ts` → compareQueuePriority).
 *
 * WHERE THE OLD BODY WENT (nothing was dropped — the PR body has the table):
 *  - Secrets & Rotation / Integrations pills → the avatar's Admin screens
 *    (`ADMIN_AVATAR_ROWS` › "Secrets & integrations"); both addresses answer.
 *  - Exception desk count · past SLA · due soon · ring → the list's own
 *    Next card, the late / due-soon / on-pace strip, and the Work badge.
 *  - Lane tiles + "More queues" → rows of the list (BASE_ROWS covers every
 *    counted queue, pinned by `lib/admin/work-rows.test.ts`); Data Privacy →
 *    Insights › Privacy & NPC.
 *  - KPI strip · What you change · Recent admin activity → Insights › Overview
 *    (`app-performance/_surfaces/admin-totals-surface.tsx`), as the drawing's
 *    insights.html draws them.
 *  - Apple-secret reminder + email-delivery strip → the list's lead, so they
 *    show at both addresses ("Also waiting" in the drawing).
 *  - The directory tiles → each one's tab › View ▾ (`lib/admin/admin-tabs.ts`).
 */
import { cookies } from 'next/headers';
import AdminWorkLanding from './work/page';
import { FocusHome } from './_components/focus-home';
import { ADMIN_MODE_COOKIE, readAdminMode } from '@/lib/admin/admin-mode';
import { requireAdmin } from '@/lib/admin/require-admin';

export const metadata = { title: 'Work · Admin' };

/**
 * ➕ FOCUS | FULL (owner approved 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)"): in FOCUS — where the
 * admin opens — this address is the decide list (`FocusHome`); in FULL it is the work list, exactly as above.
 */
export default async function AdminHome(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The gate first, before any service-role read — the same rule the work list follows.
  const { userId } = await requireAdmin();
  const mode = readAdminMode((await cookies()).get(ADMIN_MODE_COOKIE)?.value);
  if (mode === 'full') return AdminWorkLanding(props);
  const sp = (await props.searchParams) ?? {};
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <FocusHome viewerUserId={userId} cardKey={one(sp.card)} settle={one(sp.settle)} why={one(sp.why)} />;
}
