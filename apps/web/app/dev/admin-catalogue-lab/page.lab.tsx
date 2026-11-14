/**
 * /dev/admin-catalogue-lab — the admin's Catalogue tab on fixtures: no sign-in, no database. DEV-ONLY: production
 * builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 14 Nov 2026, "Yes, queue the builds" (`Setnayan-specs/prototypes/admin_pub/catalogue.html`). Draws the REAL
 * shell pieces (`FrontDoorShell`, `AdminPinnedRow`, `AdminBottomNav`, `AdminThumbRow`) around the REAL Catalogue
 * views — `CatalogueHomeView`, the three hubs, and the one New category form (`AskPrefill`) — so a walk can
 * screenshot each at 390 and 1280:
 *
 *   ?at=/admin/catalogue                  Home (busy — 3 shops asking)
 *   ?at=/admin/catalogue&state=empty      Home, nothing waiting
 *   ?at=/admin/catalogue&state=fail       Home, a read refused — "—", never 0
 *   ?at=/admin/catalogue/templates        Templates hub
 *   ?at=/admin/catalogue/media            Media hub
 *   ?at=/admin/catalogue/design-kit       Design kit hub
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
import { CatalogueHomeView, type CatalogueHomeFacts } from '@/app/admin/catalogue/_components/catalogue-home-view';
import { DesignKitView, MediaView, TemplatesView } from '@/app/admin/catalogue/_components/hub-views';
import { AskPrefill } from '@/app/admin/categories/_components/ask-prefill';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';

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

const LINES = {
  categoriesLine: '12 groups · 58 categories · 412 services',
  typesLine: '14 · 11 in the picker',
  religionsLine: '9 · 6 live for couples',
  pricesLine: '46 on sale · 9 switched off',
};

const FACTS: Record<string, CatalogueHomeFacts> = {
  busy: {
    anyFailed: false,
    categories: 58,
    services: 412,
    asking: 3,
    next: { requestId: 'lab-1', label: 'Kakanin bilao', supplier: 'Lola Nena’s Bilao' },
    ...LINES,
  },
  empty: { anyFailed: false, categories: 58, services: 412, asking: 0, next: null, ...LINES },
  fail: {
    anyFailed: true,
    categories: 58,
    services: null,
    asking: 3,
    next: null,
    ...LINES,
    categoriesLine: '12 groups · 58 categories · — services',
    pricesLine: 'Couldn’t read the price list — not the same as none',
  },
};

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
  if (path === '/admin/catalogue/templates') body = <TemplatesView />;
  else if (path === '/admin/catalogue/media') body = <MediaView />;
  else if (path === '/admin/catalogue/design-kit') body = <DesignKitView />;
  else if (path === '/admin/categories')
    body = (
      <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6">
        <AskPrefill
          groups={GROUPS}
          tiles={TILES}
          catalogs={{ eventType: [], faith: [], tile: [], node: [], service: [], request: [], icon: [] }}
        />
      </div>
    );
  else body = <CatalogueHomeView facts={FACTS[sp.state ?? 'busy'] ?? FACTS.busy!} />;

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
