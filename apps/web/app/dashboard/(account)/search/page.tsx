/**
 * /dashboard/search — what the signed-in search answers with, INSIDE the shell.
 *
 * Owner, 22 Oct 2026, iPhone, signed in, after searching "seda" (Seda Vertis
 * North, a supplier he booked on his own event): *"I tried to search for seda
 * and brought me here away from our shell"*. "Here" was `/explore?q=seda` —
 * the old top bar with "+ Create event", a second search box, an
 * "Off-season savings" pill, "No suppliers match exactly… Clear all filters",
 * and no account bar. He had been handed out of the app twice: the palette's
 * row opened the public front door (`/?q=`), and its results handed the words
 * on to the marketplace.
 *
 * 🔑 THIS PAGE IS IN THE `(account)` GROUP, so its layout draws the shell he
 * was standing in — the Setnayan mark, the bell, the account, and the account
 * bar at the bottom — and it renders the SAME results view the front door does
 * (`FrontDoorResults`), in its `shell` form:
 *   · your own things first — your events and spaces, and now the SUPPLIERS ON
 *     YOUR EVENTS (booked or hand-added, published or not), tagged "On your
 *     event" (`lib/own-supplier-items.ts`);
 *   · the shops we publish (`searchLiveShops`, one publish gate);
 *   · our stories and guides;
 *   · no row out to `/explore`. The in-shell way to look for a NEW supplier is
 *     the Suppliers page of the event you host, drawn on the web only — the
 *     store app shows no marketplace.
 *
 * It is the Discover-wide answer ("the search searches the place you are
 * standing in", DECISION_LOG 2026-09-23 — Discover is everything you may
 * reach), which is why the palette's narrowed boxes step OUT to it.
 */
import { redirect } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FrontDoorResults } from '@/app/_components/frontdoor/front-door-results';
import { loadFrontDoorArticles } from '@/app/_components/frontdoor/data';
import { resolveCommandItems } from '@/app/_components/frontdoor/command-data';
import { resolveRailStudioEvent } from '@/app/_components/frontdoor/rail-data';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { isStoreShellRequest } from '@/lib/request-platform';
import { SHELL_SEARCH_PATH } from '@/lib/shell-search';

export const metadata = { title: 'Search' };

export default async function ShellSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const query = (raw ?? '').trim();

  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectPath(query ? `${SHELL_SEARCH_PATH}?q=${encodeURIComponent(query)}` : SHELL_SEARCH_PATH));
  }

  if (!query) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageMasthead title="Search" />
        <p className="text-sm text-ink/60">
          Type what you&rsquo;re looking for in the search at the top.
        </p>
      </div>
    );
  }

  const [commandItems, studioEvent, storeShell] = await Promise.all([
    resolveCommandItems(),
    resolveRailStudioEvent(),
    isStoreShellRequest(),
  ]);

  /*
    The find row — only for somebody hosting exactly ONE event (the rail's own
    "which event" answer, checked against their organiser events), and never in
    the store app, which shows no marketplace. Several events: no guess.
  */
  const hosted = studioEvent.eventId
    ? commandItems.find((i) => i.id === `event-${studioEvent.eventId}`)
    : undefined;
  const findSuppliers =
    !storeShell && studioEvent.eventId && hosted
      ? { href: `/dashboard/${studioEvent.eventId}/vendors`, eventName: hosted.label }
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8" data-shell-search="">
      <PageMasthead title="Search" />
      <FrontDoorResults
        query={query}
        data={{ articles: loadFrontDoorArticles() }}
        commandItems={commandItems}
        place="shell"
        findSuppliers={findSuppliers}
      />
    </div>
  );
}
