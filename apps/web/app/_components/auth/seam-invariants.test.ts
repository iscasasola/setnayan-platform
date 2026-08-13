/**
 * seam-invariants.test.ts — the round trip, pinned.
 *
 * Redesign Session 6 ("the seam", 2026-08-13). The rules here are the ones the
 * owner stated as sentences, and every one of them fails SILENTLY if it
 * regresses: a sign-in that navigates still signs you in, a second Sign out
 * still signs you out, a wordmark pointing the old way still goes somewhere
 * real. Nothing errors, nothing logs — the product just quietly stops being one
 * product again.
 *
 * ⚠ THIS TEST IS NOT THE DESIGN. It says nothing about layout, wording or
 * colour beyond the one locked hex. If a change needs this file edited to go
 * green, that is the signal to stop and look.
 *
 * 🛡 EVERY ASSERTION WAS MUTATION-CHECKED — each rule was broken on purpose and
 * the test confirmed RED, by OCCURRENCE COUNT before and after, before being
 * trusted. This project has had five guards in one week pass while the thing
 * they guard was gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');

function read(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

/**
 * Strip comments before matching.
 *
 * 🔑 NOT COSMETIC. Every file touched by this change carries a long comment
 * explaining what was REMOVED — including the literal strings being removed.
 * A guard reading raw source would find `action="/auth/sign-out"` inside the
 * note that says it was retired, and pass forever. That is the exact
 * "a removal comment blinds the guard" failure already recorded in this repo.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const TSX_FILES = walk(APP);

/* ══════════════════════════════════════════════════════════════════════════
   1 · SIGN OUT LIVES UNDER THE AVATAR AND NOWHERE ELSE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The three account menus. All three are the SAME gesture — press your picture
 * (or your plaque, which is your picture with your name on it), the panel
 * opens, Sign out is in it. Three files because three shells render that panel
 * on different surfaces, not three places to look.
 */
const ACCOUNT_MENUS = [
  '_components/profile-menu.tsx',
  '_components/account-switcher/account-switcher.tsx',
  '_components/frontdoor/front-door-shell.tsx',
];

test('signing out is reachable from the account menu and nowhere else', () => {
  const offenders: string[] = [];
  for (const file of TSX_FILES) {
    const rel = file.slice(APP.length + 1);
    if (ACCOUNT_MENUS.includes(rel)) continue;
    if (/action=["']\/auth\/sign-out["']/.test(code(readFileSync(file, 'utf8')))) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Sign out may only live in an account menu (${ACCOUNT_MENUS.join(', ')}). ` +
      `Owner 2026-08-13: "sign out lives under the avatar and nowhere else." ` +
      `Found it loose in: ${offenders.join(', ')}`,
  );
});

test('all three account menus still carry it — the rule removed FOUR, not five', () => {
  // The counterpart of the check above. Narrowing "exactly one place" until
  // there is NO place is the failure mode that check cannot see, and it would
  // strand every signed-in person in the product.
  for (const rel of ACCOUNT_MENUS) {
    const src = code(read(rel));
    assert.match(
      src,
      /action=["']\/auth\/sign-out["']/,
      `${rel} is an account menu and must still offer Sign out.`,
    );
  }
});

test('sign out is a POST form, never a link', () => {
  // `/auth/sign-out` is POST-only: a <Link> renders a row that answers 405, and
  // Next would PREFETCH it — a control that can sign you out by being near the
  // pointer.
  for (const rel of ACCOUNT_MENUS) {
    const src = code(read(rel));
    assert.doesNotMatch(
      src,
      /href=["']\/auth\/sign-out["']/,
      `${rel} must POST to /auth/sign-out, not link to it.`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE WORDMARK IS THE WAY OUT OF THE APP
   ══════════════════════════════════════════════════════════════════════════ */

test('the app rail wordmark leaves the app, and both variants agree', () => {
  const src = code(read('_components/nav/doorway-sidebar-header.tsx'));
  // Two links: the expanded wordmark and the collapsed 64px mark. They live in
  // one file precisely so they can never point different ways.
  const outbound = src.match(/href="\/"/g) ?? [];
  assert.equal(
    outbound.length,
    2,
    'Both the expanded wordmark and the collapsed mark must go to the public front door (owner 2026-08-13: "the wordmark is the way out of the app").',
  );
  assert.doesNotMatch(
    src,
    /href="\/dashboard"/,
    'The wordmark no longer goes to /dashboard — that is what "← All your events" and the account panel are for.',
  );
});

test('losing the wordmark did not lose 1-click home', () => {
  // The 2026-07-16 council verdict's real concern. The wordmark moved; the
  // one-press route back to the board did not disappear, it moved down a level
  // into the in-event rail — exactly where the prototype draws it.
  const src = code(read('dashboard/[eventId]/_components/customer-sidebar.tsx'));
  assert.match(
    src,
    /href="\/dashboard"/,
    'The in-event rail must carry a one-press route back to the board.',
  );
  assert.match(
    src,
    /All your events/,
    'That row is labelled "All your events" — the level above, named.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · SIGNING IN OPENS OVER THE PAGE
   ══════════════════════════════════════════════════════════════════════════ */

test('the front door signs you in without leaving', () => {
  const src = code(read('_components/frontdoor/front-door-shell.tsx'));
  /*
    EVERY /login control here must be INTERCEPTED — counted, not spot-checked.
    The link itself is correct and deliberate (it is the no-JavaScript
    fallback, and it keeps middle-click working); what must never come back is
    a link that merely navigates, replacing the front door with a login screen.
    So the two counts have to agree: a third Sign-in added later without a
    handler is exactly the regression, and it fails here.
  */
  const links = src.match(/href="\/login"/g) ?? [];
  const intercepted = src.match(/onClick=\{openSignIn\}/g) ?? [];
  assert.equal(
    links.length,
    2,
    'The front door has two Sign-in controls: the top bar and the rail prompt.',
  );
  assert.equal(
    intercepted.length,
    links.length,
    `Every /login control on the front door must open the in-place panel. ${links.length} link(s), ${intercepted.length} intercepted.`,
  );
  /*
    A LINK THAT OPENS A DIALOG MUST SAY SO. Keeping these as real links is
    deliberate — they work before hydration and with JavaScript off, and
    middle-click still opens /login — but a screen reader would otherwise
    announce "link" and then be handed a dialog. `aria-haspopup="dialog"` is
    what makes both halves true at once, and it is the attribute the e2e test
    now keys on instead of the element type.
  */
  const announced = src.match(/aria-haspopup="dialog"/g) ?? [];
  assert.equal(
    announced.length,
    links.length,
    'Every intercepted sign-in link must carry aria-haspopup="dialog".',
  );
});

test('the sign-in panel can actually trap focus, close on Escape and lock scroll', () => {
  /*
    🚨 A DEFECT THIS GUARD WAS WRITTEN FOR, FOUND IN MY OWN FIRST CUT.
    `useModalA11y` reads `containerRef.current` inside an effect whose deps are
    `open`, the ref OBJECT and an id — none of which change when a `mounted`
    state flag flips. So a panel that renders `null` on its first pass gives the
    effect a NULL ref, it early-returns, and IT NEVER RUNS AGAIN. Escape stops
    closing, Tab walks into the page behind, the body never locks. Nothing
    throws; the dialog just quietly is not one.

    The panel is rendered only from a click, so `document` always exists by
    then — the render-time `typeof document` bail is the SSR safety net and
    cannot delay the first real render the way state does.
  */
  const src = code(read('_components/auth/sign-in-here-panel.tsx'));
  assert.match(
    src,
    /useModalA11y\(/,
    'The panel is a dialog: it must trap focus and close on Escape.',
  );
  assert.doesNotMatch(
    src,
    /if\s*\(\s*!\s*mounted\s*\)\s*return\s+null/,
    'A mount-state gate in front of the portal silently kills the focus trap, Escape and the scroll lock — the effect sees a null ref once and never re-runs.',
  );
  assert.doesNotMatch(
    src,
    /useState\(false\)/,
    'No mount flag. If one is genuinely needed later, the dialog hook must be given a dep that changes with it.',
  );
});

test('the panel stays put on success — refresh, never push', () => {
  const src = code(read('_components/auth/sign-in-here-panel.tsx'));
  assert.match(
    src,
    /router\.refresh\(\)/,
    'A successful in-place sign-in must router.refresh() — it re-renders the server half while every client component stays mounted, which is what keeps a half-written enquiry in its box.',
  );
  assert.doesNotMatch(
    src,
    /router\.push\(/,
    'router.push() would look identical in the address bar and throw the typing away.',
  );
});

test('the in-place action returns its error instead of redirecting', () => {
  const src = code(read('login/actions.ts'));
  const fn = src.slice(src.indexOf('export async function signInInPlace'));
  assert.ok(fn.length > 0, 'signInInPlace must exist.');
  assert.doesNotMatch(
    fn,
    /redirect\(/,
    'signInInPlace must never redirect — a wrong password would take the page away for a typo.',
  );
});

test("the server-action file exports only async functions", () => {
  /*
    🪤 A `'use server'` module may export ONLY async functions. A plain
    `export const` there fails the PRODUCTION BUILD — "Only async functions are
    allowed to be exported in a 'use server' file" — while `tsc` stays
    perfectly green, so it is invisible until a deploy. The first cut of this
    change did exactly that with the in-place form's initial state.
  */
  const src = code(read('login/actions.ts'));
  assert.match(src.trimStart(), /^'use server'/, 'This check assumes a server-action module.');
  const bad = [...src.matchAll(/^export\s+(?!type\b|async\s+function\b)(\S+)/gm)].map(
    (m) => m[0].trim(),
  );
  assert.deepEqual(
    bad,
    [],
    `A 'use server' file may export only async functions (and erased types). Found: ${bad.join(', ')}`,
  );
});

test('there is exactly one sign-in panel', () => {
  // "One login everywhere" is owner-locked (2026-07-18). The marketing nav used
  // to render its own copy, which is how it drifted to next='/' and started
  // dropping everyone on the account board.
  const offenders = TSX_FILES.filter((f) => {
    const rel = f.slice(APP.length + 1);
    if (rel === '_components/auth/sign-in-here-panel.tsx') return false;
    if (rel === 'login/_components/sign-in-card-modal.tsx') return false;
    return /<SignInCard\b/.test(code(readFileSync(f, 'utf8')));
  }).map((f) => f.slice(APP.length + 1));
  assert.deepEqual(
    offenders,
    [],
    `Only the /login route shell and the one in-place panel may render <SignInCard>. Found: ${offenders.join(', ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE PANEL WEARS THE APP'S TERRACOTTA
   ══════════════════════════════════════════════════════════════════════════ */

test('the sign-in panel wears the locked terracotta, not the front door gold', () => {
  const css = readFileSync(join(HERE, 'sign-in-here.css'), 'utf8');
  assert.match(
    css.replace(/\/\*[\s\S]*?\*\//g, ''),
    /#c24e25/i,
    'The sign-in panel is the one place the two palettes meet, and it belongs to the app side: #C24E25 (palette lock 2026-08-01).',
  );
  assert.doesNotMatch(
    css.replace(/\/\*[\s\S]*?\*\//g, ''),
    /#8c6932|#a9834b/i,
    'The front door\'s gold must not appear on the panel — it is the first room inside, not the last step outside.',
  );
  const panel = code(read('_components/auth/sign-in-here-panel.tsx'));
  assert.match(
    panel,
    /sn-signin-terra/,
    'The panel must actually wear the class — a stylesheet nothing references is decoration.',
  );
});

test('the root-layout provider costs a visitor who never signs in nothing', () => {
  /*
    🚨 THE PROVIDER IS IN THE ROOT LAYOUT, so anything it imports STATICALLY
    ships in the first-load JS of every page in the product. The first cut of
    this change pulled <SignInCard> — plus the OAuth row, Turnstile and two
    stylesheets — into it, which is the same defect the 2026-07-02 perf sweep
    already fixed for the homepage overlays (finding #7), at a larger blast
    radius. Rendering nothing and COSTING nothing are different claims.
  */
  const src = code(read('_components/auth/sign-in-here.tsx'));
  assert.match(
    src,
    /dynamic\(\s*\(\)\s*=>\s*import\('\.\/sign-in-here-panel'\)/,
    'The panel must be a dynamic() import so it is fetched on the first press, not on every page load.',
  );
  const heavy = [/SignInCard/, /home-reskin\.css/, /sign-in-here\.css/, /detect-oauth-shell/];
  for (const re of heavy) {
    assert.doesNotMatch(
      src,
      new RegExp(`import[^;]*${re.source}`),
      `The root-layout provider must not statically import ${re.source} — it would ship on every page.`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · PHONE — PUBLIC IS A TOP BAR, THE APP IS A BOTTOM BAR, NEVER BOTH
   ══════════════════════════════════════════════════════════════════════════ */

const APP_TREES = ['dashboard/', 'admin/', 'vendor-dashboard/'];

test('the marketing top nav never appears inside the app', () => {
  const chrome = read('_components/marketing/site-chrome.tsx');
  /*
    ⚠ `.filter(Boolean)` IS REQUIRED, not tidiness. `noUncheckedIndexedAccess`
    types a capture group as `string | undefined`, so the array is
    `(string | undefined)[]` and `r.startsWith(...)` below does not compile.
    CI caught this; a local typecheck on this machine never finished (three
    sessions competing for 16 GB, killed at 137 — which is a KILL, not a pass).
  */
  const routes = [...chrome.matchAll(/^\s*'(\/[^']*)',/gm)]
    .map((m) => m[1])
    .filter((r): r is string => typeof r === 'string');
  assert.ok(routes.length > 20, `Expected the marketing route set, found ${routes.length}.`);
  const crossed = routes.filter((r) =>
    APP_TREES.some((tree) => r === `/${tree.slice(0, -1)}` || r.startsWith(`/${tree}`)),
  );
  assert.deepEqual(
    crossed,
    [],
    `The public top bar must never mount on an app route — the app says "you are inside" with a bottom bar. Crossed: ${crossed.join(', ')}`,
  );
});

test('the app bottom bar never appears on a public page', () => {
  const offenders: string[] = [];
  for (const file of TSX_FILES) {
    const rel = file.slice(APP.length + 1);
    if (APP_TREES.some((tree) => rel.startsWith(tree))) continue;
    if (rel.startsWith('_components/nav/')) continue; // the primitive itself
    if (/<(Customer|Admin|Vendor)BottomNav\b/.test(code(readFileSync(file, 'utf8')))) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `A bottom bar outside the app tree would tell a signed-out visitor they are inside. Found: ${offenders.join(', ')}`,
  );
});

test('the front door mounts no bottom bar', () => {
  const shell = code(read('_components/frontdoor/front-door-shell.tsx'));
  assert.match(shell, /className="fd-topbar"/, 'The public front door is a TOP bar.');
  assert.doesNotMatch(
    shell,
    /BottomNav/,
    'The front door is the public site: top bar only. The bottom bar arriving is how a phone says you are inside.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · THE RETURN ROW
   ══════════════════════════════════════════════════════════════════════════ */

test('the front door welcomes a signed-in visitor back rather than listing', () => {
  const src = code(read('_components/frontdoor/front-door-shell.tsx'));
  assert.match(
    src,
    /Back to your events/,
    'A signed-in person on the public site is a visitor here, not an ex-member (FRONT_DOOR_AND_SEAM_FINAL §3.6).',
  );
});
