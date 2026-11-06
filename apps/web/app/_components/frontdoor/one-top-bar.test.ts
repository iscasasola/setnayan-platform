import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ONE TOP BAR — the shared one, on every signed-in surface.
 *
 * ─── WHAT THE OWNER SAW (2026-08-14, three screenshots) ──────────────────
 *   events board     wordmark + a search box, no "+ Create"
 *   Alaala           wordmark, NO search, no "+ Create"
 *   inside an event  NO wordmark, NO search — just chat, a bell, an avatar
 *
 * *"the issue is the top nav is not there?"* Three screens, three bars. A bar
 * that changes shape as you move is the same jumping-about that one shell
 * exists to remove, so the fix is structural: every signed-in tree hands its
 * own utility cluster to `FrontDoorShell` and renders no bar of its own.
 *
 * ─── WHY THIS FILE COUNTS INSTEAD OF TRUSTING THE DIFF ───────────────────
 * 🔑 THE FAILURE MODE HERE IS AN ABSENCE, AND AN ABSENCE HAS NO SYMPTOM. A
 * tree that stops passing `topBarSlot` still renders a perfectly good-looking
 * bar — this shell has a fallback bell and account menu for `/`. On the vendor
 * and admin doorways that fallback would point the bell at the WRONG INBOX and
 * offer a DIFFERENT sign-out from the one every other control leads to, and
 * nothing would throw, log, or look wrong in a screenshot. Same disease as the
 * phantom column, the phantom enum value and the phantom RPC argument: the
 * only symptom is something that isn't there.
 *
 * So each assertion below is anchored on the thing that would actually go
 * missing, not on a symbol that could be renamed while the regression stands.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');
const RAIL_SHELL = join(HERE, 'app-rail-shell.tsx');
const APP = join(HERE, '..', '..');

/** The five signed-in trees, with the doors each one's OLD bar carried. */
const TREES = [
  {
    name: 'launcher (the events board)',
    file: join(APP, 'dashboard', '(launcher)', 'layout.tsx'),
    doors: ['UnreadBellBadge', 'AccountSwitcher'],
  },
  {
    name: 'account spokes (Alaala, People, Profile…)',
    file: join(APP, 'dashboard', '(account)', 'layout.tsx'),
    doors: ['UnreadBellBadge', 'AccountSwitcher'],
  },
  {
    name: 'inside an event',
    file: join(APP, 'dashboard', '[eventId]', 'layout.tsx'),
    doors: ['UnreadMessagesBadge', 'UnreadBellBadge', 'AccountSwitcher'],
  },
  {
    name: 'the shop',
    file: join(APP, 'vendor-dashboard', 'layout.tsx'),
    // ✉ + the envelope (supplier redesign S-PR0, 2026-10-08): Messages is one
    // tap from every supplier page, the same live badge the event bar carries.
    doors: ['UnreadMessagesBadge', 'UnreadBellBadge', 'AccountSwitcher'],
  },
  {
    name: 'Setnayan HQ',
    file: join(APP, 'admin', 'layout.tsx'),
    doors: ['UnreadBellBadge', 'AccountSwitcher'],
  },
] as const;

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

/**
 * Source with comments removed.
 *
 * 🪤 EVERY FILE HERE TALKS AT LENGTH ABOUT THE THING BEING COUNTED — the
 * shell's docblock names `topBarSlot`, `SidebarShell` and `<main>` repeatedly,
 * and so do the layouts. A guard that counts a string counts it in the prose
 * too, and one that fires on correct code teaches you to skim past the one
 * time it is right. (`one-main-per-page.test.ts` learned this the hard way on
 * its first run; the stripper is copied from it deliberately rather than
 * re-invented, because a second comment-stripper is a second set of bugs.)
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

/** Occurrence count of an ANCHORED pattern. Never a bare substring: a
 *  sabotage that renames `<SidebarShell` to `<SidebarShellREMOVED` still
 *  CONTAINS the searched name, which is how two mutations once read as
 *  "guard passed" (`DECISION_LOG.md` 2026-08-14). */
function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

test('the anchor: every file this guard reasons about exists', () => {
  for (const p of [SHELL, RAIL_SHELL, ...TREES.map((t) => t.file)]) {
    assert.ok(
      existsSync(p) && read(p).length > 500,
      `${p} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

/*
  ─── THE FALLBACK MUST NOT REACH A SIGNED-IN PERSON ───────────────────────
  🔴 THIS FILE ALREADY NAMED THIS HAZARD AND DID NOT COVER IT. Its own header
  says: "a tree that stops passing `topBarSlot` still renders a perfectly
  good-looking bar — this shell has a fallback bell and account menu for `/`."
  The five TREES above were checked. `/` and every `variant="doorway"` page
  were never in that list, so for a day they served a signed-in visitor a "🔔"
  EMOJI that can never show an unread count, while every page inside the app
  showed the live badge. Owner 2026-08-15, two screenshots: *"why does the top
  nav differ?"*

  🔑 THE GUARD WAS RIGHT ABOUT THE DISEASE AND WRONG ABOUT THE PATIENT LIST.
  Both surfaces now default to `SignedInCluster`, and these hold it.
*/
test('the two surfaces that hand in no cluster fall back to the real one', () => {
  const doorway = code(read(RAIL_SHELL));
  assert.match(
    doorway,
    /topBarSlot=\{topBarSlot \?\? \(account\.signedIn \? <SignedInCluster/,
    'A doorway page passes no topBarSlot. Signed in it must default to the ' +
      'real cluster, not the shell’s emoji-bell placeholder, which cannot ' +
      'carry an unread count.',
  );

  const frontDoor = code(read(join(HERE, 'front-door.tsx')));
  assert.match(
    frontDoor,
    /topBarSlot=\{account\.signedIn \? <SignedInCluster/,
    '`/` is the page in the owner’s screenshot. Signed in it must render ' +
      'the same bell and account switcher as every surface inside the app.',
  );
});

test('the shared cluster is the app\'s own two controls, not a second copy', () => {
  const src = code(read(join(HERE, 'signed-in-cluster.tsx')));
  /*
    🔑 REUSED, NOT REBUILT. A second bell or a second account menu would drift
    from the real one within a week — the exact failure one shared bar exists
    to prevent. Anchored on the RENDERED elements, not the imports: an import
    with the JSX deleted must not satisfy this.
  */
  assert.match(src, /<UnreadBellBadge\b/, 'Must render the live bell, not a static link.');
  assert.match(src, /<AccountSwitcher\b/, 'Must render the real account switcher.');
  assert.match(
    src,
    /if \(!user\) return null/,
    'Must render nothing for a signed-out visitor, so the public doorway is ' +
      'unchanged and the rail’s sign-in prompt still owns that corner.',
  );
});

/* ─── 1 · EXACTLY ONE TOP BAR, AND IT IS THE SHARED ONE ─────────────────── */

test('the shell renders its top bar in BOTH variants', () => {
  const src = code(read(SHELL));
  /*
    The app variant used to short-circuit the whole header with
    `{inApp ? null : (…)}`. Restoring that is the single edit that silently
    un-does this work, so it is asserted directly rather than inferred from
    something downstream.
  */
  assert.equal(
    count(src, /<header className="fd-topbar"/g),
    1,
    'The shared bar must be rendered exactly once, unconditionally. Two ' +
      'copies is a per-variant fork; zero means the app variant lost its bar.',
  );
  assert.ok(
    !/\{inApp \? null : \(\s*<>\s*<header/.test(src),
    'The top bar is gated on `inApp` again — the app variant renders no bar, ' +
      'which is the exact state the owner reported on 2026-08-14.',
  );
});

test('every signed-in tree hands its cluster to the shared bar', () => {
  for (const tree of TREES) {
    const src = code(read(tree.file));
    assert.equal(
      count(src, /\btopBarSlot=/g),
      1,
      `${tree.name} does not pass \`topBarSlot\`. It will render the shell's ` +
        'generic bell and account menu instead of its own — a bell pointed at ' +
        'the wrong inbox and a different Sign out, with nothing thrown.',
    );
  }
});

test('no tree still renders a top bar of its own', () => {
  /*
    The two ways a second bar comes back: a `<header>` drawn by the layout
    (what `(account)` did), or `topBar={…}` handed to SidebarShell (what the
    event and vendor trees did). Either produces TWO bars — and, because both
    carry a live `UnreadBellBadge`, a SECOND Supabase Realtime channel per
    page. `unread-bell-badge.tsx` carries a dated comment about the crash that
    double-mount already caused once.
  */
  for (const tree of TREES) {
    const src = code(read(tree.file));
    assert.equal(
      count(src, /<header\b/g),
      0,
      `${tree.name} draws its own <header>. That is a second top bar beside ` +
        'the shared one.',
    );
    assert.equal(
      count(src, /\btopBar=\{/g),
      0,
      `${tree.name} still passes \`topBar\` to SidebarShell. Its cluster ` +
        'would render twice — including a second live bell.',
    );
  }
});

test('the retired per-surface bars are gone, not merely unused', () => {
  /*
    A component nobody renders is a loaded gun for the next session, which
    will reasonably assume it is the way this surface gets a bar. Both of
    these OWNED behaviour (sticky, frost, hide-on-scroll) that the shared bar
    now owns, so leaving them would leave two answers to one question.
  */
  assert.ok(
    !existsSync(join(APP, 'admin', '_components', 'admin-sticky-top-bar.tsx')),
    'AdminStickyTopBar still exists. The shared bar took its job; a second ' +
      'sticky-bar implementation is the drift this work exists to end.',
  );
  assert.ok(
    !existsSync(join(APP, 'dashboard', '(launcher)', '_components', 'home-rail.tsx')),
    'HomeRail still exists. It is the launcher\'s old one-line bar and the ' +
      'shared bar now renders that same line on all five trees.',
  );
});

/* ─── 2 · EVERY DOOR THE OLD BARS CARRIED IS STILL THERE ────────────────── */

/**
 * The JSX that actually reaches the shared bar, and nothing else in the file.
 *
 * 🪤 A FILE-LEVEL MATCH CANNOT SAY WHICH ELEMENT STILL RENDERS. Measured
 * 2026-08-14: deleting the vendor bar's `<AccountSwitcher>` left the guard
 * GREEN, because the vendor layout mounts one elsewhere too — a file-wide
 * `<AccountSwitcher\b` is satisfied by any of them. Same shape as the
 * three-call-site helper that survived one deletion in #4415. So the source is
 * narrowed to the cluster first, by balancing delimiters from either the
 * `const topBar = (…)` binding or the inline `topBarSlot={…}` prop.
 */
function cluster(src: string): string {
  const named = src.indexOf('const topBar = (');
  const start =
    named > -1 ? src.indexOf('(', named) : src.indexOf('topBarSlot={');
  assert.ok(
    start > -1,
    'This layout neither binds `const topBar = (` nor passes an inline ' +
      '`topBarSlot={`, so its cluster cannot be located — and a guard that ' +
      'cannot find its subject passes vacuously.',
  );
  const open = named > -1 ? '(' : '{';
  const close = named > -1 ? ')' : '}';
  const from = named > -1 ? start : src.indexOf('{', start + 'topBarSlot'.length);
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  assert.fail('unbalanced cluster delimiters — the slice would be the whole file');
}

test('every door each surface had is still IN that surface\'s cluster', () => {
  /*
    🔑 THE DOORS ARE PASSED, NOT REBUILT, AND THIS IS WHAT MAKES THAT A FACT.
    The shell knows nothing about an admin's SLA pill or an event's unread
    chat, so the only way they survive is for the layout to keep rendering
    them AND handing them over. A door that exists on exactly ONE surface is
    the one that gets dropped, so each is named per tree rather than checked
    in aggregate — and each is checked INSIDE the cluster, because a door that
    is still somewhere in the file but no longer in the bar is exactly the
    regression this is here to catch.
  */
  for (const tree of TREES) {
    const slot = cluster(code(read(tree.file)));
    for (const door of tree.doors) {
      assert.ok(
        new RegExp(`<${door}\\b`).test(slot),
        `${tree.name}: <${door}> is no longer inside the cluster handed to ` +
          'the shared bar. Its old bar carried it; the shared bar does not ' +
          'rebuild it, so it is gone from the bar.',
      );
    }
  }
});

test('the admin keeps the two controls that exist on no other surface', () => {
  const src = cluster(code(read(TREES[4].file)));
  // The SLA escalation pill — three states, all linking to the work list.
  assert.ok(
    count(src, /href="\/admin\/work"/g) >= 3,
    'The admin SLA escalation pill lost one or more of its three states ' +
      '(overdue / due soon / counts unavailable). It exists on this surface ' +
      'alone, so nothing else would show its absence.',
  );
  // The environment badge — `badge.label` inside the bar's own markup.
  assert.ok(
    /\{badge\.label\}/.test(src),
    'The admin environment badge is gone. It exists on this surface alone.',
  );
});

test('sign-out still has exactly one home on every surface', () => {
  /*
    🔒 Owner 2026-08-13: "sign out lives under the avatar and nowhere else."
    Every tree reaches it through <AccountSwitcher>, asserted above. What this
    adds is the other half: the shell must NOT render its own account menu
    beside a surface's switcher, or a person has two avatars offering two
    different panels in one bar.
  */
  const src = code(read(SHELL));
  assert.ok(
    /\{topBarSlot \?\? \(/.test(src),
    'The shell no longer falls back to its own bell + account menu ONLY when ' +
      'a surface passes none. Rendering both puts two account menus in one bar.',
  );
});

test('the `shell-topbar` hide hook survived the move', () => {
  /*
    The hook was SidebarShell's, then AdminStickyTopBar's, and it is still the
    one stable name for the shared bar's wrapper. (No event page hides the
    bar any more: the Vendors takeover's phone-only hide was removed on the
    owner's word 2026-10-05 — `suppliers-keeps-the-shell-bar.test.ts`.)

    ⚠ THE GUESTS PAGE USED TO BE THE SECOND, AND WAS THE REASON THIS HOOK LOOKED
    HARMLESS. Its rule carried no media query, so once the one-shell move gave
    this class the product's ONLY top bar, Guests had no identity, no ⌘K, no
    bell and no account menu at any width. Removed 2026-08-21 on the owner's
    word; `guests-keeps-the-shell-bar.test.ts` is what stops it coming back.
  */
  const src = code(read(SHELL));
  assert.ok(
    /shell-topbar/.test(src),
    'The shared bar dropped the `shell-topbar` class — the one stable name ' +
      'every surface finds the shared bar by.',
  );
  /*
    And it must be on a WRAPPER, not on `.fd-topbar` itself: `.fd-topbar` sets
    `display: grid`, so a same-specificity `display:none` would win or lose
    depending on whether the page's injected <style> happens to come after the
    stylesheet. A wrapper sets no display, so there is no tie to break.
  */
  /*
    🪤 THIS PINNED THE QUOTE STYLE, NOT THE ACT. It required the literal
    `'shell-topbar fd-topwrap'` in single quotes, which only held while the
    class was built by a ternary. When the wrapper became app-variant-only the
    className turned into a plain attribute — `className="shell-topbar
    fd-topwrap"` — and the guard went red against code that was MORE correct
    than before. It now asks the two questions it always meant.
  */
  assert.match(
    src,
    /shell-topbar fd-topwrap/,
    'The wrapper lost the `shell-topbar` hide hook.',
  );
  assert.ok(
    !/className=["']shell-topbar fd-topbar/.test(src),
    'The hide hook must sit on the wrapper (`fd-topwrap`), never on ' +
      '`.fd-topbar` — which sets `display:grid` and would fight the page rule.',
  );
  /*
    AND THE FRONT DOOR MUST NOT BE WRAPPED AT ALL. `.fd-topbar` is
    `position: sticky`, and sticky is constrained by its PARENT — inside a bare
    wrapper its own height it has zero travel and scrolls away with the page.
    That shipped live on 2026-08-14 and the owner reported it: "top nav moves up
    with the main body." The wrapper is app-variant only.
  */
  assert.match(
    src,
    /\{inApp \? \(\s*<div\s+className="shell-topbar fd-topwrap"/,
    'The sticky wrapper is not gated on the app variant. On the front door it ' +
      'gives `.fd-topbar` zero travel room and the bar scrolls away.',
  );
});

/* ─── 3 · BELOW 1024 THE APP VARIANT ADDS NO NEW CHROME ─────────────────── */

test('the app rail below 1024 is off-canvas, and shut it is out of the tab order', () => {
  /*
    🔴 SUPERSEDED PREMISE, KEPT IN WRITING. This test asserted an
    UNCONDITIONAL `.fd[data-chrome='app'] .fd-rail {display:none}` under the
    heading "the rail still paints nothing below 1024", on the locked ground
    that "a rail plus a bottom bar is the double render". Owner 2026-08-29:
    *"hamburger menu disappeared on other parts of the shell. keep it visible
    across."* The rail is now the same off-canvas drawer the public pages have
    always had — it paints only while somebody has pressed the button, so it is
    a drawer over the page, not a second permanent rail beside the bottom bar.

    The half that survives is the accessibility one: SHUT, it must be gone.
  */
  const css = readFileSync(join(HERE, 'front-door.css'), 'utf8');
  const block = css.slice(css.indexOf('@media (max-width: 1023.98px)'));
  assert.ok(
    /\.fd\[data-chrome='app'\] \.fd-rail\[data-open='false'\] \{[^}]*display: none/.test(block),
    "A shut app rail must be `display:none` below 1024 — otherwise its rows " +
      'stay focusable behind a closed drawer.',
  );
  assert.ok(
    !/\.fd\[data-chrome='app'\] \.fd-rail \{[^}]*display: none/.test(block),
    'The app rail is hidden below 1024 regardless of `data-open`, so the ' +
      'hamburger the owner asked for opens nothing.',
  );
});

test('"+ Create" is desktop-only inside the app', () => {
  const css = readFileSync(join(HERE, 'front-door.css'), 'utf8');
  assert.ok(
    /@media \(max-width: 1023\.98px\)[\s\S]*?\.fd\[data-chrome='app'\] \.fd-btn-gold \{\s*display: none/.test(
      css,
    ),
    'The gold "+ Create" must be hidden below 1024 in the app variant — a ' +
      '360px row already carries identity, the search and the account cluster.',
  );
});

/*
  🔴 THE BAR'S "+ CREATE EVENT" IS GONE AT EVERY WIDTH (owner 2026-10-22,
  "follow your recommendation"). This test used to pin the opposite — the
  button existed and said "Create" (2026-08-15, "create button is gone"). The
  account-bar ruling of 2026-10-22 moved Create to the Events board (the
  Planning (+) and "Create an event"), the phone had already lost the bar's
  copy, and the desktop's copy was the one left. Anchored inside `code()` so
  the history in the docblock cannot satisfy or fail it.
*/
test('the bar draws no "+ Create event" of its own', () => {
  const src = code(read(SHELL));
  assert.ok(
    !/href="\/dashboard\/create-event"/.test(src),
    'The shared bar links at /dashboard/create-event again — Create lives on the Events board (owner 2026-10-22).',
  );
  assert.ok(!/\+ Create event/.test(src), 'The shared bar says "+ Create event" again.');
});

test('the app variant renders no second search row', () => {
  const src = code(read(SHELL));
  /*
    The front door drops its search to its own row on a phone. Inside the app
    a second chrome row is exactly what the owner struck down on 2026-07-30
    ("the search bar is still on top"), so `.fd-searchrow` must be gated.
  */
  assert.ok(
    /\{inApp \|\| search === false \? null : \(\s*<div className="fd-searchrow">/.test(src),
    'The phone search ROW must be front-door only. Inside the app everything ' +
      'stays on one line — the 2026-07-30 ruling.',
  );
});

/* ─── 4 · EXACTLY ONE <main> PER PAGE ───────────────────────────────────── */

test('the shared bar brings no landmark and no heading with it', () => {
  /*
    Slice 0 + slice 1 shipped TWO nested <main> landmarks on ~125 screens and
    it took a follow-up PR (#4434) to catch, because a duplicate landmark has
    no visible symptom. `one-main-per-page.test.ts` holds the shell's half;
    this holds the half THIS change could break — the bar is new markup inside
    the same component, and a <header> is not a landmark that duplicates, but
    a stray <main> or <h1> in it would be.
  */
  const src = code(read(SHELL));
  assert.equal(
    count(src, /<main\b/g),
    0,
    'front-door-shell.tsx hardcodes a literal <main>; the column tag must ' +
      'come from the variant (see one-main-per-page.test.ts).',
  );
  assert.equal(
    count(src, /<h1\b/g),
    1,
    'The shell must render exactly one <h1>, and it is gated to the front ' +
      'door. A shared shell must not bring the host page a second heading.',
  );
});

test('each tree still renders exactly one landmark of its own', () => {
  /*
    ⚠ THE `<SidebarShell>` ESCAPE HATCH IS GONE (2026-08-15) — the component is
    deleted, so "delegates to the shell" is no longer an answer any tree can
    give. Four of the five now render the <main> themselves; the admin console
    is the one that carries `.sn-vt-page` on a plain <div> and has NO landmark
    of its own, which is a real gap kept visible here rather than asserted away.
  */
  for (const tree of TREES) {
    const src = read(tree.file);
    const opens = count(code(src), /<main\b/g);
    const viaVtPage = /sn-vt-page/.test(code(src));
    assert.ok(
      opens === 1 || viaVtPage,
      `${tree.name} renders ${opens} <main> element(s) and has no ` +
        '`.sn-vt-page` wrapper either. With the shell yielding its landmark ' +
        'in the app variant, this page would have NO main landmark at all.',
    );
    assert.ok(
      opens <= 1,
      `${tree.name} renders ${opens} <main> elements. One landmark per page.`,
    );
  }
});

/* ─── THE SEARCH: ONE QUESTION, ONE ANSWER ──────────────────────────────── */

test('signed in, the shared bar carries NO search — it moved to the thumb row (owner 2026-10-22)', () => {
  /*
    SUPERSEDES the 2026-08-14 "the palette is the app's search" pin. Owner, 22 Oct ("One thumb row", "Yes to all"):
    the top bar is wordmark · ✉ · 🔔 · avatar on every shell; each list's thumb row searches the place you stand in
    (`components/thumb-row.tsx`, `lib/every-thumb-row-is-the-one-row.test.ts`). The shell is handed `false` — not
    `undefined`, which would fall back to the MARKETPLACE box: that is still what a signed-out visitor gets.
  */
  const src = code(read(RAIL_SHELL));
  assert.match(src, /search=\{searchSlot \?\? \(account\.signedIn \? false : undefined\)\}/, 'the signed-in app bar has a search again');
  assert.doesNotMatch(src, /<HomeCommandBar\b/, 'the top-bar palette is mounted again');
  assert.doesNotMatch(src, /resolveCommandItems\(\)/, 'the shell builds an index for a palette it no longer draws');
});

test('the search keeps its way out — the thumb rows go where the escape row went (2026-10-22)', () => {
  /*
    RE-AIMED 2026-10-22, NOT LOOSENED. The property was "choosing the palette is lossless: one search answers both
    questions, and a narrowed box always has a way out". The palette retired with the top bar's 🔍 (owner, "One thumb
    row"); the account rows that took over its search hand Enter to the SAME step-out row builder, with their place's
    scope — so the widest answer is one press away, as before.
  */
  const rows = code(read(join(APP, '_components', 'frontdoor', 'shell-thumb-rows.tsx')));
  assert.match(rows, /marketplaceEscapeItem\(q, SEARCH_SCOPES\[scope\]\)\?\.href/, 'the account rows lost the way out');
  assert.match(rows, /useEnterSearches\('events'\)/);
  // Discover IS the widest place (owner 2026-10-24: "we will show the result on the page itself. not a new screen"):
  // its row answers on Discover itself, in the shell's results form — held by `discover-search-stays-on-page.test.ts`.
  assert.match(rows, /router\.push\(stayOnPageSearchHref\(window\.location\.href, words\)/, 'Discover’s row lost its answer');
});

test('the launcher no longer builds a second command index', () => {
  const page = read(join(APP, 'dashboard', '(launcher)', 'page.tsx'));
  assert.ok(
    !/const commandItems: HomeCommandItem\[\]/.test(code(page)),
    'The launcher builds its own palette index again. Two builders is two ' +
      'answers: the same person would see different things listed on ' +
      '/dashboard than inside their own wedding.',
  );
});

test('⌘K cannot be bound by two palettes at once', () => {
  /*
    🚨 THE SHARED BAR MADE A TRUE SENTENCE FALSE ON ~300 SCREENS. The palette's
    docblock said it "only ever mounts on the launcher route, so the two
    listeners never coexist" — correct until it became the shared search.
    Three other components bind ⌘K; two listeners on one keystroke stack two
    dialogs and nothing throws.
  */
  const OWNERS = [
    join(APP, 'admin', '_components', 'admin-command-palette.tsx'),
    join(APP, 'admin', 'ugat', '_components', 'ugat-console.tsx'),
    // ⤷ 2026-10-22: the top bar's guest search and the shared palette retired with the top bar's 🔍 ("One thumb
    // row") — the two console palettes are the only ⌘K owners left, and each still claims it.
  ];
  for (const p of OWNERS) {
    assert.ok(
      /useEffect\(\(\) => claimCommandKey\(\), \[\]\)/.test(code(read(p))),
      `${p} binds ⌘K but does not claim it. The shared palette will open a ` +
        'dialog over it on the same keystroke.',
    );
  }
});

/* ─── 6 · ONE SEARCH PER PERSON, NOT PER PAGE ───────────────────────────── */

/*
  🔴 WHAT THE OWNER SAW, 2026-08-16, two screenshots of two PUBLIC pages:
  *"i think the top nav is still not fixed. the search tab looks different. i
  thought this was already fixed?"* He had — the 2026-08-14 ruling settled that
  one bar means one search. What it settled it ON was five signed-in trees:
  "the palette wins, because every surface this bar mounts on is INSIDE the
  person's own app."

  🔑 THEN THE PREMISE MOVED AND NOBODY RE-ASKED THE QUESTION. On 2026-08-15 the
  eight product doorways, About, Explore, Pricing, Real Stories and the legal
  chrome mounted the same shell with `variant="doorway"` — thirteen PUBLIC
  pages, where the visitor is a stranger with no events, no people and no
  vendors. Measured live on all thirteen before this change:

    /                 the marketplace box
    the other twelve  a palette labelled "Search events, people, vendors"

  and `resolveCommandItems` returns `[]` without a session, so that palette
  opened EMPTY and, once typed into, offered exactly one row — the marketplace
  escape. Two presses for what `/` answers with Enter, under a label naming two
  things it could not search.

  These guards hold the rule that replaced it: the search follows WHO IS
  LOOKING, not which page they are on — the same answer this file family
  already gave for the Studio rows and the account cluster.
*/

const FRONT_DOOR = join(HERE, 'front-door.tsx');

test('the anchor: the front-door mount exists and is not a stub', () => {
  assert.ok(
    existsSync(FRONT_DOOR) && read(FRONT_DOOR).length > 500,
    `${FRONT_DOOR} is missing or a stub — the assertions below would pass ` +
      'vacuously, which is how a guard becomes decoration.',
  );
});

/**
 * The two places a `search` is handed to the shared shell. If a third ever
 * appears it must join this list, or it will decide the question on its own.
 */
const SEARCH_MOUNTS = [
  { name: 'the public front door (/)', file: FRONT_DOOR },
  { name: 'the shared rail (app trees + the 13 doorway pages)', file: RAIL_SHELL },
] as const;

test('neither mount hands out the palette without asking who is looking', () => {
  for (const m of SEARCH_MOUNTS) {
    const src = code(read(m.file));
    /*
      🪤 ANCHORED ON THE WHOLE TERNARY, NOT ON `account.signedIn` ANYWHERE IN
      THE FILE. Both files already branch on `account.signedIn` for the Studio
      rows and the cluster, so a guard that merely finds that string passes
      while the search goes back to unconditional — it would be measuring the
      wrong two lines and reporting green.
    */
    /*
      🔧 WIDENED 2026-08-26 FOR ONE SHAPE, NOT LOOSENED. The rail gained an
      optional `searchSlot` so the admin can hand in its own box — the palette
      that knows the admin's own pages, which is not the one this line mounts.
      The branch it guards is unchanged and still required; it now sits inside
      the fallback: `searchSlot ?? (account.signedIn ? … : undefined)`.
      The `undefined` arm is still pinned, because THAT is what makes a
      signed-out visitor get the marketplace box instead of an empty palette.
    */
    assert.match(
      src,
      // 2026-10-22: signed in → `false` (no top-bar search; the thumb row has it). Signed out → `undefined`.
      /search=\{\s*(searchSlot \?\? \()?\s*account\.signedIn \? false : undefined\)?\s*\}/,
      `${m.name} no longer branches its search on whether anybody is signed ` +
        'in. Signed out, the palette searches events, people and vendors the ' +
        'visitor does not have: the index is empty without a session, so it ' +
        'opens a blank list. The shell falls back to the marketplace box, ' +
        'which is the box `/` has always shown — that fallback is the point.',
    );
  }
});

test('both mounts answer it the same way', () => {
  /*
    🔑 THE SPLIT THE OWNER PHOTOGRAPHED WAS TWO CORRECT FILES DISAGREEING.
    Neither was broken on its own; `/` had a comment explaining why its search
    was the marketplace form "deliberately", and the rail had one explaining
    why its search was the palette. Both were written before the doorways
    joined, and holding both is what put two answers on the public web. So the
    expression is compared BETWEEN the files, not just checked within each.
  */
  /*
    🔧 THE COMPARISON IS OF THE FALLBACK, NOT THE WRAPPER — 2026-08-26.
    The rail gained an optional `searchSlot` so a host can hand in its own box;
    only the admin does, and the admin is not a surface a public visitor crosses
    into. The question this test exists to ask is unchanged: what does a person
    get when NOBODY overrides it — and both mounts must still answer identically.
    So strip a `searchSlot ?? ( … )` wrapper before comparing, and nothing else.
    Widening it to "both contain HomeCommandBar somewhere" would have passed the
    exact divergence the owner photographed.
  */
  const expr = (src: string) =>
    (code(src).match(/search=\{[^\n]*\}/) ?? [''])[0]
      .replace(/\s+/g, ' ')
      .replace(/^search=\{ ?searchSlot \?\? \((.*)\) ?\}$/, 'search={$1}');
  const [a, b] = SEARCH_MOUNTS.map((m) => expr(read(m.file)));
  assert.ok(a && a.length > 30, 'The front door mount matched no search expression at all.');
  assert.equal(
    a,
    b,
    'The two mounts hand the shell DIFFERENT search controls. One bar means ' +
      'one search; a visitor who crosses from / to /papic — or from their ' +
      'dashboard to /pricing — must not watch the box change shape.',
  );
});

test('the phone row shows the same search as the desktop row', () => {
  const src = code(read(SHELL));
  /*
    🚨 THIS IS THE HALF THAT WAS LIVE AND INVISIBLE ON A LAPTOP. `.fd-searchwrap`
    is `display:none` below 701px and `.fd-searchrow` takes over, and that row
    rendered `<SearchBox />` outright — so every doorway page showed the palette
    at 701px and the marketplace form at 700px. One page, two searches, decided
    by the width of the window. Nothing errors, and you cannot see it without
    resizing.
  */
  assert.match(
    src,
    /\{inApp \|\| search === false \? null : \(\s*<div className="fd-searchrow">\s*\{search \?\? <SearchBox \/>\}/,
    'The phone search row must render the SAME control the desktop row does ' +
      '(`search ?? <SearchBox />`). Hardcoding <SearchBox /> here gives one ' +
      'page two different searches depending on how wide the window is.',
  );
});
