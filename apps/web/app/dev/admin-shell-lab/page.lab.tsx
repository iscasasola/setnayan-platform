/**
 * /dev/admin-shell-lab — the admin's five-tab shell on fixtures: no sign-in, no database. DEV-ONLY: production builds
 * 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 13 Nov 2026, "admin has been ok'ed" (`Setnayan-specs/prototypes/admin_pub/`). Draws the REAL pieces the admin
 * layout mounts — the shared shell (`FrontDoorShell`), the five-tab rail (`AdminRailContext`), the pinned row and the
 * thumb row (`admin-tab-rows.tsx`), the bottom bar (`AdminBottomNav`) and the avatar sheet with its admin rows
 * (`AccountSwitcher`) — at any admin address, so a walk can screenshot each tab without a session:
 *
 *   ?at=/admin                         Work (default)
 *   ?at=/admin/payments                Money · To confirm
 *   ?at=/admin/accounts?tab=users      People · People
 *   ?at=/admin/categories              Catalogue · Categories
 *   ?at=/admin/app-performance         Insights · Overview
 *   ?at=/admin/secrets                 an avatar page (no tab lit)
 *   ?counts=fail                       every queue unread → "—", "Couldn't count — not the same as none"
 *   ?counts=empty                      every queue zero → "Nothing waiting", no badge
 *
 * The page body is a placeholder: this slice changes only the shell around each page, never the page — EXCEPT
 * Work › All (`?at=/admin`), which since slice 1b (13 Nov, "we do not want the old page") draws the REAL work list
 * (`QueuesTriageFeed`) on fixture counts, so the one Needs-action list can be walked busy / empty / failed.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AdminRailContext } from '@/app/admin/_components/admin-rail-context';
import { AdminBottomNav } from '@/app/admin/_components/admin-bottom-nav';
import { AdminPinnedRow, AdminThumbRow } from '@/app/admin/_components/admin-tab-rows';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ADMIN_AVATAR_ROWS, adminPlaceFor } from '@/lib/admin/admin-tabs';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';
import { ADMIN_QUEUE_META } from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { QueuesTriageFeed, type TriageItem } from '@/app/admin/queues/_components/queues-triage-feed';

const ACCOUNT = { signedIn: true, initials: 'SA', shopName: null, isAdmin: true } as const;

const SWITCHER: SwitcherData = {
  userId: 'lab-admin',
  displayName: 'Setnayan Admin',
  email: 'admin@example.com',
  isAnonymous: false,
  photoUrl: null,
  photoFrame: null,
  events: [],
  eventsMeasured: true,
  context: { hasVendor: false, vendorName: null, isAdmin: true, canOpenShop: false, shops: [] },
  otherAccounts: [],
  canAddAccount: false,
};

const BUSY: AdminQueueCounts = {
  payments: 3,
  verify: 2,
  disputes: 1,
  approvals: 0,
  help: 4,
  'booking-fees': 0,
  payouts: 0,
  subscriptions: 1,
  'payment-options': 0,
  'account-deletions': 0,
  'event-deletions': 0,
  'force-majeure': 0,
  reviews: 2,
  'concierge-abuse': 0,
  'vendor-partnerships': 0,
  'user-reports': 0,
  'integrity-watch': 0,
  completions: 0,
  corrections: 0,
  'chat-flags': 0,
};

export default async function AdminShellLab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const at = sp.at ?? '/admin';
  const counts: AdminQueueCounts =
    sp.counts === 'fail'
      ? Object.fromEntries(Object.keys(BUSY).map((k) => [k, null]))
      : sp.counts === 'empty'
        ? Object.fromEntries(Object.keys(BUSY).map((k) => [k, 0]))
        : BUSY;
  const unreadable = sp.counts === 'fail' ? Object.keys(BUSY).length : 0;
  const [path, q] = at.split('?');
  const place = adminPlaceFor(path!, new URLSearchParams(q ?? ''));
  const avatarRows = ADMIN_AVATAR_ROWS.flatMap((r) => (r.href ? [{ key: r.key, href: r.href, label: r.label }] : []));
  const overdue = sp.counts === 'fail' || sp.counts === 'empty' ? 0 : 1;

  return (
    <div className="app-surface sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        account={ACCOUNT}
        navLabels={{}}
        railContext={<AdminRailContext queueCounts={counts} overdue={overdue} unreadable={unreadable} at={at} />}
        topBarSlot={
          <div className="flex min-w-0 items-center gap-3">
            <AccountSwitcher data={SWITCHER} here="admin" adminRows={avatarRows} />
          </div>
        }
        createSlot={null}
      >
        <div className="sn-vt-page pb-[calc(env(safe-area-inset-bottom)+92px+var(--sn-thumb-room,0px))] lg:pb-0">
          <AdminPinnedRow queueCounts={counts} at={at} />
          {place?.kind === 'tab' && place.tab.key === 'work' && place.view.key === 'work' ? (
            <QueuesTriageFeed
              title="Work"
              items={labWorkItems(counts)}
              totalOpen={Object.entries(counts).reduce(
                (n, [k, c]) => (ADMIN_QUEUE_META[k]?.watchOnly ? n : n + Math.max(0, c ?? 0)),
                0,
              )}
              basePath="/admin"
            />
          ) : (
          <div className="space-y-3 px-4 pt-4 lg:px-6" data-lab-body="">
            <p className="text-[13px] text-ink/60">
              {place?.kind === 'tab'
                ? `${place.tab.label} › ${place.view.label} — the page's own content, unchanged by this slice.`
                : place?.kind === 'avatar'
                  ? `Avatar › ${place.row.label} — the page's own content, unchanged by this slice.`
                  : 'No home — the route guard would fail.'}
            </p>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[var(--m-paper-2)]" aria-hidden />
            ))}
          </div>
          )}
        </div>
      </FrontDoorShell>
      <AdminBottomNav queueCounts={counts} overdue={overdue} unreadable={unreadable} at={at} />
      <AdminThumbRow at={at} />
    </div>
  );
}

/** Fixture rows for Work › All — the shipped BASE_ROWS, with the lab's counts; payments + disputes are late. */
function labWorkItems(counts: AdminQueueCounts): TriageItem[] {
  const LATE = new Set(['disputes']);
  const SOON = new Set(['payments']);
  const AGE: Record<string, string> = { disputes: 'Oldest 3d · past SLA', payments: 'Oldest 20h · due soon', verify: 'Oldest 6h', help: 'Oldest 2h', subscriptions: 'Oldest 1h', reviews: 'Oldest 5h' };
  const rank = (k: string, c: number | null) => (LATE.has(k) && c ? 0 : SOON.has(k) && c ? 1 : c ? 2 : c === null ? 3 : 4);
  return BASE_ROWS.map((b) => {
    const c = b.key in counts ? (counts[b.key] ?? null) : 0;
    return {
      ...b,
      count: c,
      lane: ADMIN_QUEUE_META[b.key]?.lane,
      dueState: c === null ? 'unknown' : c === 0 ? 'clear' : LATE.has(b.key) ? 'overdue' : SOON.has(b.key) ? 'due-soon' : 'ok',
      ageLabel: c ? AGE[b.key] : undefined,
      watchOnly: ADMIN_QUEUE_META[b.key]?.watchOnly === true,
    } as TriageItem;
  }).sort((a, b) => rank(a.key, a.count) - rank(b.key, b.count));
}
