import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';

/**
 * `app/(shell)/layout.tsx` — the shared shell, mounted ONCE.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * Owner, 2026-08-15: *"navigation should not reload. it should only load the
 * screen that changes."*
 *
 * Measured on the live site before changing anything — stamp the document,
 * tag `.fd-topbar` and `.fd-rail`, click a rail link from /explore to /alaala:
 *   documentSurvived: true   ← not a browser reload; client nav was fine
 *   barSurvived:      false  ← the bar was torn down and rebuilt
 *   railSurvived:     false  ← so was the rail
 * Twenty public pages each mounted `<AppRailShell>` INSIDE `page.tsx`, so the
 * shell was part of the subtree Next swaps. Every one of them also has a
 * `loading.tsx` that returns null, so the transition blanked the chrome too.
 * The result read as a full reload.
 *
 * 🔑 IN APP ROUTER ONLY A LAYOUT PERSISTS ACROSS NAVIGATION. A page does not.
 * There is no third mechanism: the only shared ancestor of two sibling
 * top-level routes is the root layout or a route-group layout. The root layout
 * is disqualified — it wraps EVERY route, so a session-reading shell there
 * would de-opt ~20 static/ISR routes (`app/[slug]` at revalidate 60,
 * `app/realstories/[slug]` at revalidate false), and it cannot receive the five
 * signed-in trees' own `topBarSlot`.
 *
 * ─── WHAT A ROUTE GROUP DOES AND DOES NOT DO ─────────────────────────────
 * `(shell)` is INVISIBLE in the URL and PRESENT in the filesystem path. That
 * asymmetry is the whole point and the whole hazard: `/explore` still serves
 * from `app/(shell)/explore/page.tsx`, but every guard that builds a path with
 * `join(APP, route, 'page.tsx')` now needs the group segment.
 *
 * 🔑 AND IT IS WHY THE CHROME-HOSTILE SCREENS ARE SAFE BY CONSTRUCTION. Only
 * `page.tsx` + `loading.tsx` moved for papic / panood / help / realstories;
 * everything beneath them stayed outside the group. So the paparazzo camera
 * (`/papic/seat/[token]`), the bearer-credential guest gallery
 * (`/papic/me/[token]`), the owner-locked control room
 * (`/panood/control/[eventId]`) and the OBS-captured broadcast
 * (`/panood/program/[eventId]`) inherit NOTHING from here. Measured in a
 * scratch Next 15.5.21 build from this repo's own node_modules:
 * `/explore` and `/help` carried the layout's marker, `/papic/seat/abc`
 * carried ZERO. A rule nobody has to remember.
 *
 * ─── force-dynamic BELONGS HERE, NOT ON TWENTY PAGES ─────────────────────
 * 🔴 THE SHELL READS THE SESSION, and `next/dist/server/request/cookies.js`
 * returns an EMPTY cookie jar when `workStore.forceStatic` is set — before the
 * `dynamicShouldError` throw and before every bailout. A cached build would be
 * green, silent, and permanently signed-out.
 *
 * 🚨 THIS REPO ASSERTED, IN ELEVEN FILES, THAT "A LAYOUT CANNOT SET THIS —
 * `dynamic` resolves nested-most-wins and the children traversal completes
 * before a parent layout's component is created." THAT IS FALSE, and it was
 * never tested. MEASURED, twice, in a scratch build: with the pages declaring
 * nothing and `force-dynamic` on this layout alone, `/explore` and `/help`
 * moved from `○ (Static)` to `ƒ (Dynamic)` in the build table. The false claim
 * confuses the layout's ELEMENT (created after the children traversal) with its
 * CONFIG — `create-component-tree.js` reads `layoutOrPageMod.dynamic` at :134
 * and sets `workStore.forceDynamic` at :154, roughly 160 lines BEFORE it
 * traverses children at :298.
 *
 * ⚠ So the twenty per-page directives are deleted and this one replaces them.
 * Do not re-add them "to be safe": twenty copies of a rule is twenty places for
 * it to disagree with itself, which is how /privacy ended up the one shelled
 * page carrying `revalidate = 3600` under a session-reading shell.
 *
 * ─── THIS LAYOUT RENDERS NOTHING OF ITS OWN ──────────────────────────────
 * No `<main>`, no heading, no footer. The shell renders a `<div>` for the
 * doorway variant (`MainEl = ownsMain ? 'div' : 'main'`), and each page keeps
 * its own `<main>` and its own single `<h1>`. Adding anything here would give
 * every one of the twenty a second landmark.
 */
export const dynamic = 'force-dynamic';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppRailShell variant="doorway">{children}</AppRailShell>;
}
