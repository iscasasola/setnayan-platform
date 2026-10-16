/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/
import { DARK_READY, THEME_COLOR } from '@/lib/appearance';
import { ROUTE_RESERVED_SLUGS } from '@/lib/reserved-slugs';

/**
 * The inline <head> script that sets the theme BEFORE THE FIRST PAINT (dark mode PR 3, 2026-10-13).
 *
 * The light lock (owner 2026-06-04) is lifted: Appearance = Light · Dark is the person's choice
 * (DECISION_LOG 2026-10-13, "approve all"). This script follows `darkApplies` in `lib/appearance.ts`
 * to the letter — `lib/appearance.test.ts` runs THIS string against the same table of cases:
 *
 *   dark is painted only when ALL hold —
 *     · the `sn-theme` cookie says `dark` (the person picked it);
 *     · a Supabase session cookie is present (signed-out visitors are always Light — call 4);
 *     · the first path segment is one of the APP's routes (a couple's guest pages at `/[slug]` keep
 *       the couple's design — call 5);
 *     · the path is under a READY-LIST prefix (`DARK_READY`) — EMPTY today, so nobody sees dark yet
 *       (call 3). An area PR adds its prefix once its screens are swept.
 *
 * Otherwise it does exactly what the light-locked script did: removes any stale `.dark`.
 *
 * WHY A COOKIE AND NOT THE SERVER. Reading `cookies()` in the root layout would make ~20
 * static / ISR routes dynamic (see the `(shell)` layout's note). The cookie is readable here, costs
 * no request and no server read, and is read synchronously before the first frame — no flash.
 *
 * The browser bar: in dark the script also sets `<meta name="theme-color">` to the dark page,
 * keeping the light value it found (`data-sn-light`) so going back restores exactly the layout's own
 * colour. In Light it never touches the tag.
 *
 * It exposes `window.__snTheme = { decide, paint }`, so the provider re-applies the SAME rule on a
 * client navigation and on a change of choice, without shipping the route list in the client bundle.
 * Wrapped in try/catch so a missing API never blanks the page.
 */
export function buildThemeBootstrapScript(
  ready: readonly string[] = DARK_READY,
  appRoutes: ReadonlySet<string> = ROUTE_RESERVED_SLUGS,
): string {
  const R = JSON.stringify([...ready]);
  const A = JSON.stringify([...appRoutes]);
  const C = JSON.stringify(THEME_COLOR.dark);
  return `
(function() {
  var R = ${R}, A = ${A}, DARK_BAR = ${C};
  function decide(p, c) {
    if (c == null) c = document.cookie;
    if (!/(?:^|;\\s*)sn-theme=dark(?:;|$)/.test(c)) return false;
    if (!/(?:^|;\\s*)sb-[A-Za-z0-9]+-auth-token(?:\\.\\d+)?=/.test(c)) return false;
    var f = p.split('/')[1] || '';
    if (f !== '' && A.indexOf(f) < 0) return false;
    for (var i = 0; i < R.length; i++) {
      var r = R[i], pre = r.charAt(r.length - 1) === '/' ? r : r + '/';
      if (p === r || p.indexOf(pre) === 0) return true;
    }
    return false;
  }
  function paint(dark) {
    var d = document.documentElement;
    if (dark) d.classList.add('dark'); else d.classList.remove('dark');
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) return;
    if (dark) {
      if (!m.hasAttribute('data-sn-light')) m.setAttribute('data-sn-light', m.getAttribute('content') || '');
      m.setAttribute('content', DARK_BAR);
    } else if (m.hasAttribute('data-sn-light')) {
      m.setAttribute('content', m.getAttribute('data-sn-light'));
    }
  }
  try {
    window.__snTheme = { decide: decide, paint: paint };
    paint(decide(location.pathname));
  } catch (_e) {}
})();
`;
}

export const themeBootstrapScript = buildThemeBootstrapScript();
