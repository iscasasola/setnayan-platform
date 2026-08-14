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
import { FrontDoorFeed, isChip, type ChipKey } from './front-door-feed';
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

export async function FrontDoor({ chip }: { chip?: string }) {
  const [account, data, studioEvent] = await Promise.all([
    resolveRailAccount(),
    loadFrontDoorData(),
    /*
      `/` is already dynamic (measured live: MISS, private, no-store), and every
      read below is React cache()d and shared with the account resolver, so
      asking which event a signed-in visitor holds costs nothing here.
    */
    resolveRailStudioEvent(),
  ]);

  const activeChip: ChipKey = isChip(chip) ? chip : 'All';

  return (
    <FrontDoorShell
      account={account}
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
    >
      <FrontDoorFeed data={data} chip={activeChip} />
    </FrontDoorShell>
  );
}
