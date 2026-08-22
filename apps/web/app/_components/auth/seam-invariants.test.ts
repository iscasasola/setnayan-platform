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
  const intercepted = src.match(/onClick=\{onSignInPress\}/g) ?? [];
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
  /*
    🪤 THIS USED TO COUNT `aria-haspopup="dialog"` ACROSS THE WHOLE FILE and
    require the total to equal the number of sign-in links. That is a file-level
    count, and it cannot localise: it went red on 2026-08-14 the moment a
    DIFFERENT control — the rail's Studio demo row, which genuinely opens a
    dialog and is genuinely right to say so — added a third. Correct code, red
    guard, and the tempting "fix" is to strip a true accessibility attribute
    from an unrelated button.

    It now checks the attribute ON each sign-in control, which is what the
    sentence above always meant and is strictly stronger: adding a third
    dialog-opening control elsewhere is silent, while a sign-in link that drops
    the attribute still fails.
  */
  const signInControls = src.match(/<Link[^>]*href="\/login"[\s\S]*?>/g) ?? [];
  assert.equal(
    signInControls.length,
    links.length,
    'A /login href was found outside a <Link> — this guard can no longer see it.',
  );
  for (const [i, control] of signInControls.entries()) {
    assert.match(
      control,
      /aria-haspopup="dialog"/,
      `Sign-in control #${i + 1} does not carry aria-haspopup="dialog". It is a ` +
        'link that hands the reader a dialog without saying so.',
    );
  }
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
  // The rules live in home-reskin.css, not a file of their own: a separate
  // stylesheet is one more module for the chunk manifest, and that manifest
  // ships in the SHARED runtime every page downloads.
  const css = readFileSync(join(APP, '_components/home/home-reskin.css'), 'utf8');
  assert.match(
    css.replace(/\/\*[\s\S]*?\*\//g, ''),
    /#c24e25/i,
    'The sign-in panel is the one place the two palettes meet, and it belongs to the app side: #C24E25 (palette lock 2026-08-01).',
  );
  // Scoped check: the GOLD must not appear inside the panel's own block.
  // (home-reskin.css is the marketing stylesheet — it is full of gold
  // legitimately, so the whole-file check that worked on a dedicated file
  // would now be a guard that cries wolf on every line it does not own.)
  const block = css.slice(css.indexOf('.sn-signin-terra'));
  assert.doesNotMatch(
    block.replace(/\/\*[\s\S]*?\*\//g, ''),
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

test('the sign-in never enters the shared client bundle', () => {
  /*
    🚨 THE SHARED BUNDLE IS FULL. `main` measures 199.8 KB gzipped against the
    200 KB ceiling locked in DECISION_LOG 2026-05-22 — 0.2 KB of headroom for
    the entire product. A revision of this change mounted a context provider in
    the ROOT LAYOUT and measured 200.4 KB: OVER BUDGET, on a feature most
    visitors never use, because everything the root layout's client tree
    touches lands in that chunk.

    Three rules keep it out, and all three are checked below.
  */
  const layout = code(read('layout.tsx'));
  assert.doesNotMatch(
    layout,
    /SignInHere|useSignInPanel/,
    'The root layout must not mount the sign-in — it would put the feature in every page\'s first-load JS.',
  );

  /*
    ⚠ AND NO NEW ASYNC CHUNK EITHER. Removing the provider was not enough: with
    the panel behind a lazy `import()` the build STILL measured 200.4 KB, and
    diffing the per-chunk breakdown against a passing run put the whole overage
    in `webpack-*.js` — the runtime carrying the CHUNK MANIFEST — which grew
    3.2 → 3.8 KB gz because a new async chunk existed to be indexed. Splitting
    is not free. Every consumer here is already a route chunk or the
    already-lazy HomeOverlays chunk, so the panel needs no chunk of its own.
  */
  const hook = code(read('_components/auth/sign-in-here.tsx'));
  assert.doesNotMatch(
    hook,
    /import\(/,
    'The panel must NOT get its own async chunk — the chunk manifest it adds to webpack-*.js costs more shared bytes than the budget has.',
  );

  /*
    The rule this all protects: nothing in the ROOT-LAYOUT-mounted tree may
    reach the sign-in. These two are mounted from the root layout on every
    route, so an import here would put the login form in the shared bundle just
    as surely as the provider did.
  */
  for (const rel of ['_components/marketing/site-chrome.tsx', '_components/marketing/site-nav.tsx']) {
    assert.doesNotMatch(
      code(read(rel)),
      /auth\/sign-in-here/,
      `${rel} is mounted by the root layout on every route — it must not import the sign-in.`,
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
  /*
    🪤 A BARE COUNT FLOOR IS THE WRONG NON-VACUITY CHECK, and this proved it:
    nine routes legitimately LEFT this set on 2026-08-15 (they wear the shared
    shell now), the count fell 25 → 16, and the guard failed saying "Expected
    the marketing route set" — against a correct file. A floor tuned to today's
    size fails every time the set shrinks on purpose, which teaches you to lower
    it, which is how it ends up at 0 and stops guarding anything.

    A POSITIVE CONTROL is strictly stronger: a broken parser cannot produce a
    route it never saw.

    ⚠ THIS NAMED `/help` AND ASSERTED IT WAS "not a conversion candidate".
    That premise was falsified on 2026-08-15 when /help joined the shared shell.
    Repointed to `/download`, which is a pure marketing endpoint with no product
    surface behind it — the property that actually makes a route a safe control.
  */
  assert.ok(
    routes.includes('/download'),
    `The marketing route parser did not find /download, a stable member — it ` +
      `is broken and every assertion below would pass vacuously. Found ${routes.length}: ` +
      routes.slice(0, 6).join(', '),
  );
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

/* ── THE SIGN-IN CARD'S OWN COLOURS CLEAR AA ─────────────────────────────────
   Added 2026-08-21, when /login was finally given the terracotta card the seam
   panel has worn since 2026-08-13 ("switch it on").

   🚨 SWITCHING IT ON WOULD HAVE PROPAGATED A SUB-AA COLOUR TO A SECOND SURFACE.
   The locked action colour #C24E25 measures 4.25:1 on THIS card's greige
   (#f2f2f0) — under the 4.5:1 floor for normal text. It had been shipping on
   the seam panel's links and eyebrow for over a week.

   🔑 AND NEITHER EXISTING CONTRAST GUARD COULD SEE IT — neither was broken.
   `doorway-palette.test.ts` reads `globals.css` and the `(shell)` doorways;
   this card lives in `home-reskin.css`. `lint-label-on-fill-contrast.mjs`
   judges a LABEL sitting on a FILL declared with it, and a link colour over a
   card background is not that shape — it passes 1368 pairings and never
   examined this one. The defect lived in the seam between two correct guards,
   exactly as that lesson is already written down.

   ⚠ EVERY VALUE BELOW IS PARSED OUT OF THE STYLESHEET, never re-typed here. A
   guard comparing two hand-typed things is not a guard: change the CSS and this
   follows it, which is the only way it can still be true next month. */
test('the terracotta sign-in card clears AA on its own greige', () => {
  const css = readFileSync(
    join(APP, '_components/home/home-reskin.css'),
    'utf8',
  );

  // The card background, read from the token rather than assumed.
  const bg = css.match(/--hr-bg:\s*(#[0-9a-f]{6})/i)?.[1];
  if (!bg) throw new Error('--hr-bg must be readable — the whole check hangs off it');

  const start = css.indexOf('.home-reskin-ov .hr-ov-card.sn-signin-terra');
  assert.ok(start > -1, 'the terracotta block must exist');
  // Stop before the next top-level block that is not part of this card.
  const block = css.slice(start).split('\n.home-reskin-ov .hr-si-')[0] ?? '';
  assert.ok(block.length > 0, 'the terracotta block must not be empty');

  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const ratio = (a: string, b: string) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /* Pull each declaration by the PROPERTY that decides which bar it takes.
     `color:` is text (4.5). `border-top`/`accent-color` are non-text UI (3.0).
     The button is white ON its own fill, so it is checked against that fill,
     not against the card. */
  const textColours = [...block.matchAll(/\n\s*color:\s*(#[0-9a-f]{6})/gi)]
    .map((m) => m[1])
    .filter((c): c is string => typeof c === 'string');
  assert.ok(
    textColours.length >= 2,
    `expected the link + eyebrow text colours, found ${textColours.length} — ` +
      'if the block was restructured this guard is reading the wrong thing',
  );
  for (const c of textColours) {
    const r = ratio(c, bg);
    assert.ok(
      r >= 4.5,
      `${c} on the card's ${bg} is ${r.toFixed(2)}:1 — below the 4.5:1 AA ` +
        'floor for normal text. The locked #C24E25 measures 4.25:1 here; the ' +
        'text shade is #B04722 (4.97:1), which is this same button\'s hover.',
    );
  }

  const fill = block.match(/hr-si-submit\s*\{[^}]*background:\s*(#[0-9a-f]{6})/i)?.[1];
  if (!fill) throw new Error('the submit fill must be readable');
  const onFill = ratio('#ffffff', fill);
  assert.ok(
    onFill >= 4.5,
    `the button's white label on ${fill} is ${onFill.toFixed(2)}:1, below 4.5:1`,
  );

  const edge = block.match(/border-top:\s*3px solid\s*(#[0-9a-f]{6})/i)?.[1];
  if (!edge) throw new Error('the top edge must be readable');
  const onEdge = ratio(edge, bg);
  assert.ok(
    onEdge >= 3,
    `the 3px top edge ${edge} is ${onEdge.toFixed(2)}:1 on ${bg}, below the ` +
      '3:1 bar for non-text',
  );
});

test('/login wears the same card as the rest of the public site', () => {
  /* "One login everywhere" is owner-locked (2026-07-18). It was true of the
     FORM — both surfaces render the same <SignInCard> — and false of the
     SHELL: the seam panel wore the terracotta card and /login wore the plain
     greige one, so a person redirected or deep-linked to /login met a
     different-looking door from the one the site shows everywhere else.

     🔑 A SHARED INNER COMPONENT IS NOT A SHARED LOOK. Pin the wrapper too. */
  const modal = code(read('login', '_components', 'sign-in-card-modal.tsx'));
  assert.match(
    modal,
    /className="hr-ov-card sn-signin-terra"/,
    '/login must wear the same terracotta card as the seam panel',
  );
});
