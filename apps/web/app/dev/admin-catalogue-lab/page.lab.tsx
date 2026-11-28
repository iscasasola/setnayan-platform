/**
 * /dev/admin-catalogue-lab — the admin's Catalogue tab on fixtures: no sign-in, no database. DEV-ONLY: production
 * builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 14 Nov 2026, "Yes, queue the builds" (`Setnayan-specs/prototypes/admin_pub/catalogue.html`). Draws the REAL
 * shell pieces (`FrontDoorShell`, `AdminPinnedRow`, `AdminBottomNav`, `AdminThumbRow`) around the REAL Catalogue
 * Home — the shared `TabLanding` every tab lands on (admin reorg v7) — and the one New category form (`AskPrefill`),
 * so a walk can screenshot each at 390 and 1280:
 *
 *   ?at=/admin/catalogue                  Home (busy — 3 shops asking)
 *   ?at=/admin/catalogue&state=empty      Home, nothing waiting
 *   ?at=/admin/catalogue&state=fail       Home, a read refused — "—", never 0
 *   ?at=/admin/catalogue&state=stale      Home beside an old Social queue item — Oldest stays the requests' (L7 · D4)
 *   ?at=/admin/categories&new=category    the one New category form, opened empty by the tab's ＋
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AdminRailContext } from '@/app/admin/_components/admin-rail-context';
import { AdminBottomNav } from '@/app/admin/_components/admin-bottom-nav';
import { AdminPinnedRow, AdminThumbRow } from '@/app/admin/_components/admin-tab-rows';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { TabLanding, type CatalogueHeadFacts } from '@/app/admin/_components/tab-landing';
import { AskPrefill } from '@/app/admin/categories/_components/ask-prefill';
import type { AdminQueueCounts, AdminQueueDigest } from '@/lib/admin/queue-counts';

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

const COUNTS: AdminQueueCounts = { 'service-requests': 3, 'social-queue': 0 };

/** The head's taxonomy counts and the digest's `service-requests` row, per state — "—" (null) never 0 on a refusal. */
const FACTS: Record<string, { catalogue: CatalogueHeadFacts; asking: number | null }> = {
  busy: { catalogue: { categories: 58, services: 412 }, asking: 3 },
  empty: { catalogue: { categories: 58, services: 412 }, asking: 0 },
  fail: { catalogue: { categories: 58, services: null }, asking: null },
  stale: { catalogue: { categories: 58, services: 412 }, asking: 3 },
};

function digestFor(asking: number | null, staleSocial = false): AdminQueueDigest {
  // A refused queue read is `count: null` (→ "—"), the same as the real digest.
  return {
    'service-requests': { count: asking, oldestAt: asking ? new Date(Date.now() - 52 * 3_600_000).toISOString() : null },
    // `stale`: the 27 Nov walk's shape — a Social queue item 163 days old, which the head once called "Oldest".
    'social-queue': staleSocial
      ? { count: 8, oldestAt: new Date(Date.now() - 163 * 86_400_000).toISOString() }
      : { count: 0, oldestAt: null },
  };
}

const GROUPS = [
  { id: 'g-venues', label: 'Venues & places' },
  { id: 'g-food', label: 'Food & drink' },
  { id: 'g-booths', label: 'Booths, carts & bars' },
];
const TILES = [
  { id: 't-food-carts', label: 'Food Carts' },
  { id: 't-ceremony', label: 'Ceremony' },
  { id: 't-catering', label: 'Catering' },
];

export default async function AdminCatalogueLab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const at = sp.at ?? '/admin/catalogue';
  const path = at.split('?')[0];

  let body;
  if (path === '/admin/categories')
    body = (
      <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6">
        <AskPrefill
          groups={GROUPS}
          tiles={TILES}
          catalogs={{ eventType: [], faith: [], tile: [], node: [], service: [], request: [], icon: [] }}
        />
      </div>
    );
  else {
    const f = FACTS[sp.state ?? 'busy'] ?? FACTS.busy!;
    body = <TabLanding tab="catalogue" catalogue={f.catalogue} digest={digestFor(f.asking, sp.state === 'stale')} />;
  }

  return (
    <div className="app-surface sn-ambient min-h-dvh">
      <FrontDoorShell
        variant="app"
        account={ACCOUNT}
        navLabels={{}}
        railContext={<AdminRailContext queueCounts={COUNTS} at={at} />}
        topBarSlot={
          <div className="flex min-w-0 items-center gap-3">
            <AccountSwitcher data={SWITCHER} here="admin" adminRows={[]} />
          </div>
        }
        createSlot={null}
      >
        <div className="sn-vt-page pb-[calc(env(safe-area-inset-bottom)+92px+var(--sn-thumb-room,0px))] lg:pb-0">
          <AdminPinnedRow queueCounts={COUNTS} at={at} />
          {body}
        </div>
      </FrontDoorShell>
      <AdminBottomNav queueCounts={COUNTS} at={at} />
      <AdminThumbRow at={at} />
    </div>
  );
}
