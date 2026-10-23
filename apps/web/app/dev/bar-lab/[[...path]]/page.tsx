/**
 * /dev/bar-lab — the phone's bottom bar across its THREE sets (an event · the
 * account · a shop), on fixtures: no sign-in, no database. DEV-ONLY: production
 * builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 22 Oct 2026: "Discover needs to show the bottom nav still" and "bottom
 * nav should not disappear when going to a different menu … pressing shop,
 * everything moves to the left and the shop icons enter from the right. when we
 * press an event, the account menus move to the right and the event icons
 * enter from the left." This lab draws each landing page the way its layout
 * does — the REAL shell (`FrontDoorShell`), the REAL tab lists
 * (`accountBarTabs` + `accountBarItems`, `vendorBarItems`,
 * `buildCustomerMenuTree`) in the REAL `<BottomDock>` + `<BottomNav>` — with
 * every address moved under `/dev/bar-lab`, so a walk can press through all of
 * them and watch the real `BarSetSlide` (`lib/bar-set.ts` reads the lab prefix
 * as the address it stands for):
 *
 *   /dev/bar-lab                         Discover (`/`), signed in
 *   /dev/bar-lab/dashboard               the Events board
 *   /dev/bar-lab/dashboard/library       Memories
 *   /dev/bar-lab/dashboard/people        People
 *   /dev/bar-lab/vendor-dashboard        the shop (Today)
 *   /dev/bar-lab/dashboard/ev-lab        an event (Home)
 *
 *   ?shop=0   an account that owns no shop (four tabs, no Shop)
 *   ?before=1 Discover as `main` drew it before 2026-10-22: signed in, no bar
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { LabBar } from '../lab-bar';
import { EventRailContext } from '@/app/dashboard/[eventId]/_components/event-rail-context';
import { VendorRailContext } from '@/app/vendor-dashboard/_components/vendor-rail-context';

export const dynamic = 'force-dynamic';

const P = '/dev/bar-lab';
const EVENT = 'ev-lab'; // = lab-bar.tsx LAB_EVENT

const ACCOUNT = { signedIn: true, initials: 'AM', shopName: 'Lab Florals', isAdmin: false } as const;

function Cards({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <ul className="mt-4 grid gap-3">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="block min-h-[88px] rounded-2xl bg-white/80 p-4 text-ink shadow-sm"
              data-lab-card=""
            >
              {l.label}
            </Link>
          </li>
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-24 rounded-2xl bg-white/50" aria-hidden="true" />
        ))}
      </ul>
    </div>
  );
}

export default async function BarLab({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const [{ path = [] }, sp] = await Promise.all([params, searchParams]);
  const ownsShop = sp.shop !== '0';
  const where = path.join('/');

  const accountBar = <LabBar kind="account" ownsShop={ownsShop} />;
  const toEvent = { href: `${P}/dashboard/${EVENT}`, label: 'Ana & Miguel — Wedding · 14 Feb 2027 (an event card)' };

  // Discover — the front door's own variant: the feed in `[data-fd-page]`, the bar OUTSIDE the shell.
  if (where === '') {
    return (
      <>
        <FrontDoorShell account={ACCOUNT} navLabels={{}} tools={[]}>
          <div
            data-fd-page=""
            className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0"
          >
            <Cards title="Discover" links={[toEvent]} />
          </div>
        </FrontDoorShell>
        {sp.before === '1' ? null : accountBar}
      </>
    );
  }

  // The account spokes — `(launcher)` / `(account)`: the layout's own <main> + the bar beside it.
  const spoke = { dashboard: 'Events', 'dashboard/library': 'Memories', 'dashboard/people': 'People' }[where];
  if (spoke) {
    return (
      <div className="sn-ambient min-h-dvh">
        <FrontDoorShell variant="app" account={ACCOUNT} navLabels={{}} tools={[]}>
          <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
            <Cards title={spoke} links={[toEvent, { href: `${P}/vendor-dashboard`, label: 'Switch to · Lab Florals (the shop)' }]} />
          </main>
          {accountBar}
        </FrontDoorShell>
      </div>
    );
  }

  // The shop and the event — their layouts' `.sn-ambient > main.sn-vt-page` and their own bar.
  const shop = where === 'vendor-dashboard' || where.startsWith('vendor-dashboard/');
  const event = where.startsWith(`dashboard/${EVENT}`);
  if (!shop && !event) notFound();
  return (
    <>
      <div className="sn-ambient min-h-screen">
        {/* ↔ The rail SWAPS here as it does in the shop and event layouts (`focus` + the section's own rows,
            owner 2026-09-21) — so a desktop walk sees the side menu change set and slide (owner 23 Oct, Q1). */}
        <FrontDoorShell
          variant="app"
          account={ACCOUNT}
          navLabels={{}}
          tools={[]}
          insideEvent={event}
          boundary={event ? 'tab' : 'lg'}
          focus={
            event
              ? { href: `${P}/dashboard`, label: 'Events', caption: 'Events', icon: 'events' }
              : { href: `${P}/dashboard`, label: 'My Home', caption: 'Home' }
          }
          railContext={
            event ? (
              <EventRailContext eventId={EVENT} guestCount={32} services={[]} websiteEnabled eventName="Ana & Miguel" />
            ) : (
              <VendorRailContext shopName="Lab Florals" role="owner" navSlots={{}} bookingsBadge={2} threadsBadge={1} planHref={null} tier={null} />
            )
          }
        >
          <div className="sn-ambient min-h-screen">
            <main className="sn-vt-page">
              <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">
                <Cards
                  title={shop ? 'Today — Lab Florals' : 'Ana & Miguel'}
                  links={[{ href: `${P}/dashboard?hub=1`, label: '← Events (the way back to your account)' }]}
                />
              </div>
            </main>
          </div>
        </FrontDoorShell>
      </div>
      <LabBar kind={shop ? 'shop' : 'event'} />
    </>
  );
}
