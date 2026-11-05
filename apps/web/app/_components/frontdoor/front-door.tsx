/**
 * front-door.tsx — the server half of the public front door at `/`.
 *
 * Loads the four rails, resolves who is looking, and hands the shell a set of
 * plain serializable props. The FEED is rendered here (a server component) and
 * passed through the client shell as `children`, so the writing that carries
 * this page never enters the JS bundle.
 */
import 'server-only';

import { loadFrontDoorData } from './data';
import { FrontDoorShell } from './front-door-shell';
import { FrontDoorAnchor } from './front-door-anchor';
import { FrontDoorFeed } from './front-door-feed';
import { FrontDoorResults } from './front-door-results';
import { DiscoverEventShelves, PeopleToFollowShelf } from './front-door-discover';
import { loadDiscover, searchDiscoverEvents } from '@/lib/discover-events';
import { MiniTour } from '@/app/_components/mini-tour';
import { SignedInCluster } from './signed-in-cluster';
import { FrontDoorAccountBar } from './front-door-account-bar';
import { resolveCommandItems } from './command-data';
import { DiscoverThumbRow } from './shell-thumb-rows';
// The account resolver and the Studio group moved out 2026-08-13 so the
// signed-in surfaces render the SAME rail from the SAME source. Behaviour is
// byte-identical; see `rail-data.ts` for why one copy matters here.
import { resolveRailAccount } from './rail-data';
import { isStoreShellRequest } from '@/lib/request-platform';
import { resolveShellSearchContext, type ShellSearchContext } from './shell-search-context';
import { getCurrentUser } from '@/lib/auth';

export async function FrontDoor({ q }: { q?: string }) {
  /*
    A SEARCH REPLACES THE FEED (below), so Discover's shelves are read only
    when the feed is what renders — a typed query pays nothing for them.
  */
  const searchQuery = (q ?? '').trim();
  const [account, data, commandItems, discover] = await Promise.all([
    resolveRailAccount(),
    loadFrontDoorData(),
    /*
      💸 NAMED COST, AND ONLY FOR SOMEBODY SIGNED IN. This returns `[]` on the
      first line without a session, so a stranger — which is every visitor to
      `/` in production today — pays one auth check it was already making.
      Signed in it is 4 small reads beyond what this page already loads (the
      organiser events are cache()d and shared with `resolveRailStudioEvent`
      above), the same price the other five trees have paid since 2026-08-14.
    */
    resolveCommandItems(),
    /*
      DISCOVER'S NEW SHELVES (DECISION_LOG 2026-09-29). Each degrades on its
      own and says "couldn't load" rather than "none" — see the module. Signed
      out it is the world layer and People to follow; signed in, the viewer's
      own people come first.
    */
    searchQuery ? null : loadDiscover(),
  ]);

  /*
    A SEARCH REPLACES THE FEED, IT DOES NOT FILTER IT. Owner 2026-08-20: the
    results belong in this page's own body. A typed query reaches things the
    page never loaded (help pages, guides, shops, your own events), so it
    answers with its own list rather than narrowing New uploads/Trending.

    ⚠ A whitespace-only `?q=` is not a search. The address bar is a real
    interface here: `?q=` arrives from the palette, from the public box, and
    from anybody's paste. (`searchQuery` is trimmed once, at the top, because
    the Discover read there is skipped on the same test.)
  */

  /*
    🔎 SIGNED IN, DISCOVER ANSWERS IN PLACE (owner 2026-10-24, on the old hop to `/dashboard/search`: *"it went to a
    different page?"*). The words stay in this page's `?q=`, the results take the sections' place under the same
    search row, and Clear brings the sections back — the shell's results form (people, your own suppliers, no door
    out to the marketplace), read only when there are words.
  */
  const user = account.signedIn && searchQuery ? await getCurrentUser().catch(() => null) : null;
  /* 🔎 …and its EVENTS (owner 2026-10-25): your people's, then anybody's public event — read beside the rest. */
  const [shellSearch, discoverEvents]: [ShellSearchContext | null, Awaited<ReturnType<typeof searchDiscoverEvents>> | null] = user
    ? await Promise.all([resolveShellSearchContext(searchQuery, user.id, commandItems), searchDiscoverEvents(searchQuery)])
    : [null, null];

  return (
    <>
    <FrontDoorShell
      account={account}
      /*
        THE PAGE'S ONE VISIBLE HEADING — SIGNED-OUT ONLY, owner-confirmed this
        session. A stranger needs the five-second "what is this"; a signed-in
        visitor who lands back on `/` already knows, so pitching them again is
        the wrong sentence for that reader. Signed in, `heading` is left
        unset and the shell falls back to its screen-reader-only <h1>, same as
        every other converted app surface — see `front-door-anchor.tsx`'s own
        docblock for the fuller reasoning behind dropping the old always-on
        opening.
      */
      heading={account.signedIn ? undefined : <FrontDoorAnchor />}
      /*
        🧭 NO TOOL LISTS ON `/` (owner 2026-10-01, built 2026-10-23): the rail
        is Discover · Find suppliers · Features · How it works · Sign in signed
        out, and your own rows + Features signed in. /features lists the tools.
      */
      /*
        🔴 THE SAME FALLBACK LEAK THE DOORWAY PAGES HAD — this is the page in
        the owner's second screenshot. `/` handed in no cluster, so a signed-in
        visitor got the shell's stranger-facing "🔔" emoji and a plain initials
        circle, while every page inside the app showed the live bell and the
        account switcher. Owner 2026-08-15: *"why does the top nav differ?"*

        This page is ALREADY dynamic (its own note above: "measured live: MISS,
        private, no-store") and already resolves the account, so the cluster's
        two reads cost nothing new here.
      */
      topBarSlot={account.signedIn ? <SignedInCluster /> : undefined}
      /*
        ⚠ THIS COMMENT USED TO SAY THE SEARCH STAYS THE MARKETPLACE FORM HERE
        "deliberately — this is the public shopfront". That reading made the
        bar depend on WHICH PAGE, and the very next paragraph of this file
        (the Studio rows) and the one above it (the cluster) had both already
        been corrected to depend on WHO IS LOOKING. Holding both rules at once
        is what produced the split the owner photographed on 2026-08-16: `/`
        showed the marketplace box while every other public page showed the
        palette.

        One rule now, both mounts:
          signed out → the marketplace box (the shell's fallback)
          signed in  → the palette over their own things

        Nothing is lost either way: the palette carries the marketplace as an
        escape row (`command-escape.ts`), which is the whole reason it was
        allowed to win the 2026-08-14 ruling. What that ruling settled — that
        one bar means one search — is finally true across every surface rather
        than on five of them.
      */
      search={account.signedIn ? false : undefined}
    >
      {/* 🔍 Signed in, Discover's search is its thumb row (owner 2026-10-22, "One thumb row") — the top bar has none. */}
      {account.signedIn ? <DiscoverThumbRow key={searchQuery} q={searchQuery} /> : null}
      {/*
        `data-fd-page` is the content the bar's slide moves — Discover is an
        account tab: `.sn-vt-page` + `while-sliding` (signed in, where the bar
        is), the same slide as every other tab (owner 2026-10-24; globals.css). Signed in, it also
        reserves the account bar's MEASURED height below 1024, the launcher's own
        rule, so the last row of the feed clears the dock — and the thumb row on it: since 2026-10-25 by the row's own
        measured room (`--sn-thumb-room`, lib/thumb-room.ts) at every width, not a hand-added +4rem that a computer
        never got.
      */}
      <div
        data-fd-page=""
        data-sn-slide="while-sliding"
        className={
          account.signedIn
            ? 'sn-vt-page pb-[max(calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem),var(--sn-thumb-room,0px))] lg:pb-[var(--sn-thumb-room,0px)]'
            : undefined
        }
      >
      {searchQuery ? (
        shellSearch ? (
          // 📌 Where a search's results draw — pinned under the chrome (lib/search-pin.ts).
          <div data-discover-results="" data-search-results="">
            <FrontDoorResults
              query={searchQuery}
              data={data}
              commandItems={commandItems}
              place="discover"
              people={shellSearch.people}
              findSuppliers={shellSearch.findSuppliers}
              addOwnEvent={shellSearch.addOwnEvent}
              events={discoverEvents}
            />
          </div>
        ) : (
          <FrontDoorResults
            query={searchQuery}
            data={data}
            commandItems={commandItems}
          />
        )
      ) : (
        <>
          <FrontDoorFeed
            data={data}
            storeShell={await isStoreShellRequest()}
            beforeShops={discover ? <DiscoverEventShelves discover={discover} /> : null}
            afterShops={discover ? <PeopleToFollowShelf discover={discover} /> : null}
          />
          {/* First visit only — the shipped MiniTour (owner rule 2026-09-25:
              every feature gets a first-visit tour). It renders nothing for a
              stranger or for anyone who has seen it. */}
          {account.signedIn ? <MiniTour tourKey="discover_upcoming_v1" /> : null}
        </>
      )}
      </div>
    </FrontDoorShell>
    {/*
      THE ACCOUNT BAR, SIGNED IN (owner 2026-10-22, "Discover needs to show the
      bottom nav still"). Outside the shell's <main> on purpose — see the
      component. Signed out it is not rendered: the public front door is as it was.
    */}
    {account.signedIn ? <FrontDoorAccountBar /> : null}
    </>
  );
}
