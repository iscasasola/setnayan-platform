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
import { railToolsSignedOut, resolveRailAccount, toRailFolder } from './rail-data';
import { DemoOverlayHost } from './demo-overlay-host';

export async function FrontDoor({ chip }: { chip?: string }) {
  const [account, data] = await Promise.all([
    resolveRailAccount(),
    loadFrontDoorData(),
  ]);

  const activeChip: ChipKey = isChip(chip) ? chip : 'All';

  return (
    <FrontDoorShell
      account={account}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      /*
        THE DEMOS ARE OFFERED HERE, AND ONLY BECAUSE A HOST IS MOUNTED BELOW.
        `true` means "a demo row can actually open something on this route".
        `SiteChrome` — which mounts the overlays everywhere else — self-gates to
        NAV_ROUTES and `/` is deliberately not one, so without <DemoOverlayHost>
        these rows would be fake doors on the page every stranger lands on.
        Owner 2026-08-14: "the side menu when signed out, it will be able to
        show demo."
      */
      tools={railToolsSignedOut(true)}
    >
      <FrontDoorFeed data={data} chip={activeChip} />
      <DemoOverlayHost />
    </FrontDoorShell>
  );
}
