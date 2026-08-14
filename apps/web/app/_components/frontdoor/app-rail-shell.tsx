/**
 * app-rail-shell.tsx — the shared rail, mounted on a signed-in surface.
 *
 * One Shell slice 0. Owner, 2026-08-13, over three YouTube screenshots in
 * which the left rail never leaves: *"the sidebar should stay. look at here as
 * we navigate around. what you did was jumping back to the old dashboards. so
 * what we want to see the dashboards converted for this desktop view."*
 * `DECISION_LOG.md` 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md`.
 *
 * ─── THIS IS NOT A SECOND SHELL ──────────────────────────────────────────
 * It is the server half — the same role `front-door.tsx` plays for `/`. It
 * gathers the account, the tools and the folders from the ONE shared source
 * and renders the ONE shared `<FrontDoorShell>` in its app variant. Every
 * rendering decision lives in that component; nothing about the rail's shape
 * is decided twice.
 *
 * ─── MOUNTED PER TREE, NEVER "ROUTED THROUGH /" ──────────────────────────
 * 🪤 The native apps can never reach `/` — middleware bounces Capacitor and
 * Tauri off the marketing paths (owner-locked 2026-06-10, login-first). Any
 * design that sends signed-in people through the homepage to pick up its
 * chrome would work on the web and strand every desktop and mobile app user.
 * So this mounts INSIDE the dashboard layouts, exactly as `SidebarShell` does
 * in the other three trees.
 *
 * ⚠ AND NOT ON PUBLIC PAGES. It reads the session, so mounting it on the blog,
 * Real Stories or the eight doorways would silently DE-CACHE them — they are
 * ISR today and would quietly become per-request renders, with no error and a
 * bill attached.
 */
import 'server-only';

import { getNavSlotMap } from '@/lib/nav-registry';
import {
  FRONT_DOOR_VISIBLE_FOLDERS,
  FRONT_DOOR_MORE_FOLDERS,
} from '@/lib/taxonomy-folder-counts';

import './front-door.css';
import { FrontDoorShell, type RailNavLabels } from './front-door-shell';
import { RAIL_TOOLS, resolveRailAccount, toRailFolder } from './rail-data';

export async function AppRailShell({
  children,
  railContext,
}: {
  children: React.ReactNode;
  /**
   * The per-surface group that PUSHES in below the account rows. Slice 0 (the
   * events board and the account spokes) has no sub-navigation and passes
   * nothing; slice 1 mounts "In this event — {name}" here.
   */
  railContext?: React.ReactNode;
}) {
  const [account, navLabels] = await Promise.all([
    resolveRailAccount(),
    /*
      🔑 LABELS COME FROM THE NAV REGISTRY, which is where an admin renames
      them. The mobile navs already read these slots; if the rail hard-coded
      its own words instead, an admin rename would apply on the phone and not
      on the desktop — two answers to one question, and no error to notice.

      A FAILED READ FALLS BACK TO THE IN-CODE WORDS, never to a blank rail.
      `getNavSlotMap` is cached, so this is one read per request at most.
    */
    getNavSlotMap().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[AppRailShell] nav slot read failed:', err);
      return {} as RailNavLabels;
    }),
  ]);

  return (
    <FrontDoorShell
      variant="app"
      account={account}
      navLabels={navLabels}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      tools={RAIL_TOOLS}
      railContext={railContext}
    >
      {children}
    </FrontDoorShell>
  );
}
