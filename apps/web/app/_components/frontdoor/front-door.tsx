/**
 * front-door.tsx — the server half of the public front door at `/`.
 *
 * Loads the four rails, resolves who is looking, and hands the shell a set of
 * plain serializable props. The FEED is rendered here (a server component) and
 * passed through the client shell as `children`, so the writing that carries
 * this page never enters the JS bundle.
 */
import 'server-only';

import {
  FRONT_DOOR_VISIBLE_FOLDERS,
  FRONT_DOOR_MORE_FOLDERS,
} from '@/lib/taxonomy-folder-counts';

import { loadFrontDoorData } from './data';
import { FrontDoorShell } from './front-door-shell';
import { FrontDoorOpening } from './front-door-opening';
import { FrontDoorStory } from './front-door-story';
import { FrontDoorFeed, isChip, type ChipKey } from './front-door-feed';
import { FrontDoorResults } from './front-door-results';
import { SignedInCluster } from './signed-in-cluster';
import { resolveCommandItems } from './command-data';
import { HomeCommandBar } from '@/app/dashboard/(launcher)/_components/home-command-bar';
// The account resolver and the Studio group moved out 2026-08-13 so the
// signed-in surfaces render the SAME rail from the SAME source. Behaviour is
// byte-identical; see `rail-data.ts` for why one copy matters here.
import {
  railToolsSignedIn,
  railToolsSignedOut,
  resolveRailStudioEvent,
  resolveRailAccount,
  toRailFolder,
} from './rail-data';

export async function FrontDoor({ chip, q }: { chip?: string; q?: string }) {
  const [account, data, studioEvent, commandItems] = await Promise.all([
    resolveRailAccount(),
    loadFrontDoorData(),
    /*
      `/` is already dynamic (measured live: MISS, private, no-store), and every
      read below is React cache()d and shared with the account resolver, so
      asking which event a signed-in visitor holds costs nothing here.
    */
    resolveRailStudioEvent(),
    /*
      💸 NAMED COST, AND ONLY FOR SOMEBODY SIGNED IN. This returns `[]` on the
      first line without a session, so a stranger — which is every visitor to
      `/` in production today — pays one auth check it was already making.
      Signed in it is 4 small reads beyond what this page already loads (the
      organiser events are cache()d and shared with `resolveRailStudioEvent`
      above), the same price the other five trees have paid since 2026-08-14.
    */
    resolveCommandItems(),
  ]);

  const activeChip: ChipKey = isChip(chip) ? chip : 'All';

  /*
    A SEARCH REPLACES THE SHELF, IT DOES NOT FILTER IT. Owner 2026-08-20: the
    results belong in this page's own body. The chips are a filter over what
    the page already holds; a typed query reaches things the page never loaded
    (help pages, guides, shops, your own events), so it answers with its own
    list rather than narrowing this one.

    ⚠ THE QUERY WINS OVER THE CHIP, and a whitespace-only `?q=` is not a
    search. Both matter because the address bar is a real interface here: `?q=`
    arrives from the palette, from the public box, and from anybody's paste.
  */
  const searchQuery = (q ?? '').trim();

  return (
    <FrontDoorShell
      account={account}
      /*
        THE PAGE'S ONE VISIBLE HEADING. It REPLACES the shell's screen-reader-
        only <h1> rather than joining it — see the shell's `heading` prop. Shown
        to everybody, signed in or out: a returning person still benefits from
        the page saying what it is, and branching it would make two front doors
        to keep true.
      */
      heading={<FrontDoorOpening />}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      /*
        THE SAME BRANCH THE APP MOUNT MAKES — see the note there. This handed
        every visitor the signed-OUT rows, so a signed-in person on `/` was sent
        to the page that SELLS a product they already own, and the group then
        changed shape the moment they opened one.
      */
      tools={
        account.signedIn ? railToolsSignedIn(studioEvent) : railToolsSignedOut()
      }
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
      search={
        account.signedIn ? (
          <HomeCommandBar items={commandItems} variant="rail" />
        ) : undefined
      }
    >
      {/*
        WHO IS LOOKING DECIDES WHETHER THE "YOUR PEOPLE" CHIP IS OFFERED — the
        same one rule this file already settled for the Studio rows, the
        account cluster and the search box. A stranger has no people; showing
        them the button is a door onto a room that can never fill.
      */}
      {searchQuery ? (
        <FrontDoorResults
          query={searchQuery}
          data={data}
          commandItems={commandItems}
        />
      ) : (
        <>
          {/*
            THE STORY SITS ABOVE THE FEED AND ONLY ON THE FEED BRANCH. A person
            who has typed a query is looking for a specific thing; putting the
            marketing argument above their results would push the answer they
            asked for below the fold to sell them something they are already
            using. `/?q=` therefore renders results and nothing else, exactly as
            before this change.
          */}
          <FrontDoorStory />
          <FrontDoorFeed data={data} chip={activeChip} signedIn={account.signedIn} />
        </>
      )}
    </FrontDoorShell>
  );
}
