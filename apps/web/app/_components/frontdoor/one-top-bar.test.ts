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
    doors: ['UnreadBellBadge', 'AccountSwitcher'],
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
    ONE shipped event page still injects `.shell-topbar{display:none}` — the
    Vendors takeover, and only `@media (max-width:1023px)`. The hook was
    SidebarShell's, then AdminStickyTopBar's. If the shared bar does not carry
    it, that page silently grows back a bar it deliberately removed.

    ⚠ THE GUESTS PAGE USED TO BE THE SECOND, AND WAS THE REASON THIS HOOK LOOKED
    HARMLESS. Its rule carried no media query, so once the one-shell move gave
    this class the product's ONLY top bar, Guests had no identity, no ⌘K, no
    bell and no account menu at any width. Removed 2026-08-21 on the owner's
    word; `guests-keeps-the-shell-bar.test.ts` is what stops it coming back.
  */
  const src = code(read(SHELL));
  assert.ok(
    /shell-topbar/.test(src),
    'The shared bar dropped the `shell-topbar` class. The Vendors takeover ' +
      'hides the strip by naming exactly that word.',
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

test('the rail still paints nothing below 1024', () => {
  const css = readFileSync(join(HERE, 'front-door.css'), 'utf8');
  const block = css.slice(css.indexOf("@media (max-width: 1023.98px)"));
  assert.ok(
    /\.fd\[data-chrome='app'\] \.fd-rail \{[^}]*display: none/.test(block),
    "The app variant's rail must be `display:none` below 1024 — the phone's " +
      'bottom-bar grammar is locked, and a rail plus a bottom bar is the ' +
      'double render.',
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
  🔴 THE OWNER LOOKS FOR A WORD, NOT A POSITION. On 2026-08-15 the button was
  repointed at the create flow and RENAMED "+ New event" in the same commit.
  Hours later: *"create button is gone."* It was not gone — it sat in the same
  place, in the same gold, one link away from where he was standing. He scanned
  the bar for "Create" and the scan came back empty, which is indistinguishable
  from a deleted button.

  🔑 A RENAME IS A REMOVAL TO WHOEVER WAS LOOKING FOR THE OLD NAME — and the
  rename was never asked for. This holds BOTH halves: the button still exists
  (href + gold class, the ACT) and it still says the word.

  🪤 Anchored inside `code()` on purpose. The docblock above the JSX says
  "Create event" four times; a file-level substring match would pass with the
  button deleted outright.
*/
test('the bar\'s create button exists and still says "Create"', () => {
  const src = code(read(SHELL));
  const button = src.match(
    /<Link href="\/dashboard\/create-event" className="fd-btn-gold">([\s\S]*?)<\/Link>/,
  );
  assert.ok(
    button,
    'The shared bar must render a gold Link to /dashboard/create-event. ' +
      'Deleting it removes the only create door a signed-in person meets ' +
      'above 1024 on every surface that is not the events board.',
  );
  /* `noUncheckedIndexedAccess` is on repo-wide, so the capture group is
     `string | undefined`. Defaulting to '' keeps the assertion honest: an
     empty label fails the match, which is the correct verdict anyway. */
  assert.match(
    button[1] ?? '',
    /\bCreate\b/,
    'The create button must carry the word "Create". It was renamed ' +
      '"+ New event" on 2026-08-15 and the owner reported it GONE the same ' +
      'day — a label he does not scan for is a button he cannot find.',
  );
});

test('the app variant renders no second search row', () => {
  const src = code(read(SHELL));
  /*
    The front door drops its search to its own row on a phone. Inside the app
    a second chrome row is exactly what the owner struck down on 2026-07-30
    ("the search bar is still on top"), so `.fd-searchrow` must be gated.
  */
  assert.ok(
    /\{inApp \? null : \(\s*<div className="fd-searchrow">/.test(src),
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

test('the app variant searches the person\'s own things, not the marketplace', () => {
  const src = code(read(RAIL_SHELL));
  assert.ok(
    /<HomeCommandBar items=\{commandItems\}/.test(src),
    'The shared bar must pass the command palette as its search inside the ' +
      'app. A marketplace GET form cannot reach your own wedding, which is ' +
      'the question every one of these five surfaces is actually asking.',
  );
  assert.ok(
    /resolveCommandItems\(\)/.test(src),
    'The palette must be fed by the ONE shared index. The launcher used to ' +
      'build its own inline, which would list different things on /dashboard ' +
      'than inside a wedding, with nothing to notice.',
  );
});

test('the palette carries the marketplace as an escape row', () => {
  /*
    This is what makes choosing the palette lossless. Without it, replacing
    the front door's box on four surfaces would DELETE the marketplace search
    for anyone standing inside the app.
  */
  const bar = code(
    read(join(APP, 'dashboard', '(launcher)', '_components', 'home-command-bar.tsx')),
  );
  assert.ok(
    /marketplaceEscapeItem\(query\)/.test(bar),
    'The palette no longer offers the marketplace escape row. One search now ' +
      'has to answer both questions.',
  );
  assert.ok(
    /const escape = marketplaceEscapeItem\(query\);\s*return escape \? \[\.\.\.own, escape\] : own;/.test(
      bar,
    ),
    'The escape row must be APPENDED AFTER filtering. Passed through the ' +
      'filter it disappears whenever nothing local matches — which is the one ' +
      'moment it exists for.',
  );
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
    join(APP, 'dashboard', '[eventId]', 'guests', '_components', 'guests-search.tsx'),
  ];
  for (const p of OWNERS) {
    assert.ok(
      /useEffect\(\(\) => claimCommandKey\(\), \[\]\)/.test(code(read(p))),
      `${p} binds ⌘K but does not claim it. The shared palette will open a ` +
        'dialog over it on the same keystroke.',
    );
  }
  const bar = code(
    read(join(APP, 'dashboard', '(launcher)', '_components', 'home-command-bar.tsx')),
  );
  assert.ok(
    /if \(commandKeyClaimed\(\)\) return;/.test(bar),
    'The shared palette does not check the claim, so it will fire alongside ' +
      'whichever surface-specific palette owns the key.',
  );
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
    assert.match(
      src,
      /search=\{\s*account\.signedIn \? \(\s*<HomeCommandBar items=\{commandItems\} variant="rail" \/>\s*\) : undefined\s*\}/,
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
  const expr = (src: string) =>
    (code(src).match(/search=\{[\s\S]*?\n      \}/) ?? [''])[0].replace(/\s+/g, ' ');
  const [a, b] = SEARCH_MOUNTS.map((m) => expr(read(m.file)));
  assert.ok(a && a.length > 40, 'The front door mount matched no search expression at all.');
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
    /\{inApp \? null : \(\s*<div className="fd-searchrow">\s*\{search \?\? <SearchBox \/>\}/,
    'The phone search row must render the SAME control the desktop row does ' +
      '(`search ?? <SearchBox />`). Hardcoding <SearchBox /> here gives one ' +
      'page two different searches depending on how wide the window is.',
  );
});
