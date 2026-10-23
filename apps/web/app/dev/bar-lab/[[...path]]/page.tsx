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
 *   /dev/bar-lab/dashboard/ev-lab/memories  the event's Memories tab (owner 2026-10-23) — the REAL
 *                                        `EventMemoriesGallery` on fixture photos (inline pictures, nothing fetched):
 *                                        ?n=<count> (default 60) · ?empty=1 · ?fail=1
 *
 *   ?shop=0   an account that owns no shop (four tabs, no Shop)
 *
 * An event of ANY type (owner 22 Oct 2026, "this might be an issue on other events as well") — the
 * event layout's OWN gates (`eventMenuGates`) for that type's profile and needs:
 *   ?type=<event_type>                 wedding (default) · simple_event · hangout · birthday · wake · …
 *   ?needs=simple|open|list|full       the needs preset (default: the type's own, `DEFAULT_PRESET_BY_TYPE`)
 *   ?phase=plan|dayof|after            the lifecycle phase (default plan)
 *   ?store=1                           the App Store / Play shell
 *   ?was=1                             BEFORE: main's rule until 22 Oct 2026 (the type's needs drop tabs)
 *   ?before=1 Discover as `main` drew it before 2026-10-22: signed in, no bar
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { LabBar } from '../lab-bar';
import { labEventBar } from '../lab-event';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import type { GalleryPhoto } from '@/lib/papic-gallery';

export const dynamic = 'force-dynamic';

const P = '/dev/bar-lab';
const EVENT = 'ev-lab'; // = lab-bar.tsx LAB_EVENT

const ACCOUNT = { signedIn: true, initials: 'AM', shopName: 'Lab Florals', isAdmin: false } as const;

const TONES = [
  ['#D7B77C', '#9A7A3C'], ['#B9856A', '#6F4A33'], ['#E2D59C', '#A7A14B'], ['#6E8296', '#2E3F50'],
  ['#B8788D', '#6D3F50'], ['#C8D27F', '#7E9A3E'], ['#E8C7A3', '#B67E57'], ['#9FB7B0', '#4E6E67'],
  ['#c9d3b8', '#5f7a53'], ['#e7cfc1', '#a8614b'], ['#d6cbe7', '#6a5a8c'], ['#bcd3dc', '#3f6e82'],
];
const WHO = ['Bea', 'Tito Boy', 'Ate Claire', 'Lumen Studio', 'Marco', 'Kuya Dan', null, 'Lola Nena', 'Reel & Co'];
/** A fixture photo — a numbered gradient, so a walk can see which tile stayed under the fingers. */
function labPhoto(i: number): GalleryPhoto {
  const [a, b] = TONES[i % TONES.length]!;
  const url =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="320" fill="url(#g)"/><text x="160" y="190" font-family="Helvetica" font-size="110" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,0.55)">${i + 1}</text></svg>`,
    );
  return {
    id: `lab-${i}`,
    url,
    viewUrl: url,
    kind: i % 11 === 4 ? 'clip' : 'photo',
    playUrl: null,
    source: i % 9 === 3 || i % 9 === 8 ? 'vendor' : 'guest',
    tagged: false,
    tagSource: 'untagged',
    capturedAt: new Date(Date.UTC(2026, 11, 12, 12, 0) - i * 240_000).toISOString(),
    capturedBy: WHO[i % WHO.length] ?? null,
  };
}

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
        <FrontDoorShell account={ACCOUNT} navLabels={{}}>
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
        <FrontDoorShell variant="app" account={ACCOUNT} navLabels={{}}>
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
  // THE EVENT'S MEMORIES TAB (owner 2026-10-23) — the real gallery inside the event layout's own gutter.
  if (where === `dashboard/${EVENT}/memories`) {
    const n = sp.empty === '1' ? 0 : Math.max(0, Math.min(400, Number(sp.n ?? 60) || 60));
    const photos = sp.fail === '1' ? [] : Array.from({ length: n }, (_, i) => labPhoto(i));
    return (
      <>
        <div className="sn-ambient min-h-screen">
          <FrontDoorShell variant="app" account={ACCOUNT} navLabels={{}} tools={[]} insideEvent>
            <div className="sn-ambient min-h-screen">
              <main className="sn-vt-page">
                <div data-shell-main="" className="px-4 pt-3 sm:px-6 sm:pt-6 lg:px-8">
                  <EventMemoriesGallery
                    photos={photos}
                    countLine={sp.fail === '1' ? null : `${n.toLocaleString('en-PH')} ${n === 1 ? 'photo' : 'photos'}`}
                    footLine="opens in 51 days"
                    cappedLine={null}
                    emptyLine="Your photos land here as your guests and suppliers shoot."
                    unreadable={sp.fail === '1'}
                    timeZone="Asia/Manila"
                  />
                </div>
              </main>
            </div>
          </FrontDoorShell>
        </div>
        <LabBar kind="event" event={labEventBar(sp)} />
      </>
    );
  }

  return (
    <>
      <div className="sn-ambient min-h-screen">
        <FrontDoorShell variant="app" account={ACCOUNT} navLabels={{}}>
          <div className="sn-ambient min-h-screen">
            <main className="sn-vt-page">
              <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">
                <Cards
                  title={shop ? 'Today — Lab Florals' : `Ana & Miguel · ${sp.type || 'wedding'}${sp.phase ? ` · ${sp.phase}` : ''}`}
                  links={[{ href: `${P}/dashboard?hub=1`, label: '← Events (the way back to your account)' }]}
                />
              </div>
            </main>
          </div>
        </FrontDoorShell>
      </div>
      <LabBar kind={shop ? 'shop' : 'event'} event={event ? labEventBar(sp) : undefined} />
    </>
  );
}
