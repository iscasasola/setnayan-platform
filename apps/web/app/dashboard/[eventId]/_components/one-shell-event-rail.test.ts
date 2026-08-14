import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import type { RailMatchRow } from '@/app/_components/frontdoor/rail-active';
import { buildCustomerNavGroups } from './customer-nav-config';

/**
 * ONE SHELL, SLICE 1 — the event tree wears the shared chrome.
 *
 * Owner 2026-08-13: *"the sidebar should stay. look at here as we navigate
 * around. what you did was jumping back to the old dashboards. so what we want
 * to see the dashboards converted for this desktop view."*
 * `ONE_SHELL_PLAN_2026-08-13.md`.
 *
 * ─── WHAT EACH GUARD IS ACTUALLY FOR ─────────────────────────────────────
 * Every assertion below corresponds to something that would break SILENTLY —
 * no error, no red CI, and in three cases no visible symptom at the width the
 * author was looking at:
 *
 *   · Removing `<SidebarShell>` for a "desktop-only" swap deletes the app's
 *     ONLY `.sn-vt-page` and the `[data-shell-main]` hook — i.e. it breaks the
 *     PHONE, at widths where the new rail does not paint at all.
 *   · Forgetting `desktopRailExternal` renders two sidebars, one on top of the
 *     other, both correct in isolation.
 *   · Restoring `lg:hidden` on the switcher strands sign-out on the couple's
 *     desktop, because the plaque that used to carry it no longer renders.
 *   · A hand-typed terracotta is invisible to every contrast guard in the repo
 *     — the exact defect design#6 shipped as `#9A8F86`.
 *
 * 🔑 THE BEHAVIOUR TESTS CALL THE REAL BUILDER, NOT A COPY OF IT. A first cut
 * of the sibling rail guard declared its own row list, so a mutation that
 * deleted `exact: true` from the REAL list passed everything. Testing the
 * primitive is not testing the caller.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUT = join(HERE, '..', 'layout.tsx');
const RAIL = join(HERE, 'event-rail-context.tsx');
const SHELL = join(HERE, '..', '..', '..', '_components', 'nav', 'sidebar-shell.tsx');
const CSS = join(
  HERE, '..', '..', '..', '_components', 'frontdoor', 'front-door.css',
);
const EVENT_ID = 'S89E-TESTEVENT';

/** Strip comments so a guard can never be satisfied by prose ABOUT the thing. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

/*
  ── THE ANCHOR ────────────────────────────────────────────────────────────
  Assert the inputs before counting anything in them. A guard whose file path
  is wrong reads an empty string and passes every `assert.doesNotMatch` in this
  file — which is how a mutation run reports zero failures and means nothing.
*/
test('the anchor: every file this guard reads exists and is real', () => {
  for (const p of [LAYOUT, RAIL, SHELL, CSS]) {
    assert.ok(
      readFileSync(p, 'utf8').length > 1000,
      `${p} is missing or a stub — every other test in this file would pass vacuously.`,
    );
  }
});

/* ══ 1 · THE RAIL IS MOUNTED, AND THE EVENT'S MENU IS PUSHED INTO IT ══════ */

test('the event layout mounts the shared rail and pushes the event group into it', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(
    src,
    /<AppRailShell\b/,
    'The event tree no longer mounts the shared rail — opening a wedding swaps ' +
      'the page furniture again, which is the exact complaint this shipped for.',
  );
  assert.match(
    src,
    /railContext=\{/,
    'The rail is mounted with no context group, so an event shows the account ' +
      'rows and NO event menu — every event destination becomes unreachable ' +
      'from the desktop rail.',
  );
  assert.match(
    src,
    /<EventRailContext\b/,
    'The context slot no longer receives the event menu.',
  );
});

/* ══ 2 · THE MOBILE TRAP — SidebarShell STAYS MOUNTED ════════════════════ */

test('SidebarShell is still mounted — dropping it breaks the PHONE, not the desktop', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(
    src,
    /<SidebarShell\b/,
    'SidebarShell was removed from the event layout. Its <main> carries the ' +
      "app's only `.sn-vt-page` (view-transition-name), which is what the " +
      'mobile bottom-nav carousel slides, and `[data-shell-main]` inside it is ' +
      'what gives the docked sub-nav its extra room. Both die at MOBILE widths, ' +
      'where the new rail does not even paint. Plan § 3, trap #2.',
  );
  assert.match(
    src,
    /data-shell-main\b/,
    'The `[data-shell-main]` hook is gone — the docked sub-nav loses the extra ' +
      'bottom room and covers the last row of content on the phone.',
  );
});

test('the shell keeps rendering the one .sn-vt-page at ALL widths', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  const hits = src.match(/\bsn-vt-page\b/g) ?? [];
  assert.equal(
    hits.length,
    1,
    'SidebarShell must render `.sn-vt-page` exactly once, unconditionally. ' +
      'Putting it behind a breakpoint or a flag silently disables the mobile ' +
      `page-slide; found ${hits.length} occurrence(s).`,
  );
  // It must not have been moved inside the branch that the new flag removes.
  assert.doesNotMatch(
    src,
    /desktopRailExternal[^\n]*\n[^\n]*sn-vt-page/,
    'The `.sn-vt-page` <main> was moved under the desktopRailExternal branch — ' +
      'setting the flag would then delete the mobile page-slide.',
  );
});

/* ══ 3 · THE FLAG IS SET, AND THE SHELL ACTUALLY HONOURS IT ══════════════ */

test('the event layout hands the desktop column to the rail', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(
    src,
    /\bdesktopRailExternal\b/,
    'Without this the old <aside> renders UNDER the new rail: two sidebars, ' +
      'and the content is offset by a sidebar width it no longer has.',
  );
});

test('desktopRailExternal is a real mount condition, not a style', () => {
  const src = code(readFileSync(SHELL, 'utf8'));
  assert.match(
    src,
    /desktopRailExternal\s*\?\s*null\s*:/,
    'The <aside> must not RENDER when an outer rail owns the column. Hiding it ' +
      'with CSS would leave a dozen focusable links reachable by keyboard ' +
      'behind the rail — the defect this repo has already paid for once.',
  );
  assert.match(
    src,
    /desktopRailExternal\s*\n?\s*\?\s*'0px'/,
    'The desktop offset is not zeroed, so the content column is pushed a ' +
      'second sidebar width to the right past a rail already sitting there.',
  );
});

/* ══ 4 · SIGN-OUT SURVIVED THE PLAQUE ════════════════════════════════════ */

test('the account menu is reachable on the couple desktop', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  const switcher = /<div className="lg:hidden">\s*<AccountSwitcher/;
  assert.doesNotMatch(
    src,
    switcher,
    'The AccountSwitcher is hidden on desktop again. The <SwitcherPlaqueTrigger> ' +
      'that used to carry sign-out / profile / Setnayan AI on this surface no ' +
      'longer renders (the rail owns the left column), so this would strand all ' +
      'three behind no door at all — council acceptance criterion 2026-07-16.',
  );
  assert.match(
    src,
    /<AccountSwitcher\b/,
    'The event top bar lost its AccountSwitcher entirely — there is now no ' +
      'sign-out anywhere on the couple desktop.',
  );
});

/* ══ 5 · THE MENU IS THE SSOT'S, NOT A NEW IA ════════════════════════════ */

test('the rail reproduces the three named sections, from the shipped SSOT', () => {
  const groups = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true });
  assert.deepEqual(
    groups.map((g) => g.label),
    ['Plan', 'Go live', 'Also in this event'],
    'The event rail renders whatever the SSOT gives it, so a change here is a ' +
      'change to the couple IA on the desktop rail, the old sidebar and the ' +
      'phone at once. Three named sections is the shipped shape.',
  );
});

test('Budget is NOT a top-level menu — owner removed it 2026-07-10', () => {
  const groups = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true });
  const plan = groups.find((g) => g.label === 'Plan');
  const also = groups.find((g) => g.label === 'Also in this event');
  assert.ok(plan && also);
  assert.ok(
    !plan.items.some((i) => i.key === 'budget'),
    'Budget was promoted back into Plan. The owner removed it as a top-level ' +
      'menu on 2026-07-10; it belongs under "Also in this event" as a quiet link.',
  );
  assert.ok(
    also.items.some((i) => i.key === 'budget'),
    'Budget fell out of "Also in this event" — /budget loses its rail link.',
  );
});

test('every rail row is a plain leaf — "solid menu with no submenus" (2026-07-15)', () => {
  const src = code(readFileSync(RAIL, 'utf8'));
  assert.doesNotMatch(
    src,
    /\bitem\.children\b/,
    'The rail renders NavItem.children, which reverses the owner lock of ' +
      '2026-07-15 ("solid menu with no submenus") silently, while looking like ' +
      'a nicety. Sub-navigation lives inside each page.',
  );
});

/* ══ 6 · WHICH ROW IS LIT — one, and the right one ═══════════════════════ */

/** The rows exactly as the component builds them — from the REAL builder. */
function realRows(): RailMatchRow[] {
  return buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true }).flatMap((g) =>
    g.items.map((i) => ({
      key: i.key,
      href: i.href,
      ...(i.matchPrefix ? { matchPrefix: i.matchPrefix } : {}),
    })),
  );
}

test('exactly one row lights on each real event URL', () => {
  const base = `/dashboard/${EVENT_ID}`;
  const cases: Array<[string, string | null]> = [
    [base, 'home'],
    [`${base}/guests`, 'guests'],
    [`${base}/guests/anything`, 'guests'],
    [`${base}/vendors`, 'explore'],
    [`${base}/studio`, 'studio'],
    [`${base}/schedule`, 'schedule'],
    [`${base}/seating`, 'seat'],
    [`${base}/budget`, 'budget'],
    [`${base}/website/editor`, 'launch'],
    // A route the rail does not list. `null` is a REAL answer and must render
    // as "no row lit" — telling someone they are somewhere they are not is
    // worse than telling them nothing.
    [`${base}/messages`, null],
  ];
  for (const [pathname, expected] of cases) {
    assert.equal(
      activeRailKey(realRows(), pathname),
      expected,
      `${pathname} should light ${expected ?? 'nothing'}.`,
    );
  }
});

test('Overview does not light on every other event route', () => {
  const base = `/dashboard/${EVENT_ID}`;
  /*
    THE ONE THAT WOULD GO WRONG. Overview's href IS the prefix of every other
    event route, so a prefix match lights it everywhere. The SSOT defends that
    with the `__home__` sentinel; if someone "tidies" it away, this goes red.
  */
  for (const p of [`${base}/guests`, `${base}/vendors`, `${base}/budget`]) {
    assert.notEqual(
      activeRailKey(realRows(), p),
      'home',
      `Overview lit on ${p} — the __home__ sentinel prefix was removed from the ` +
        'SSOT, so Overview now claims every route under the event.',
    );
  }
});

/* ══ 7 · THE COLOUR IS DERIVED, AND THE STRIP STAYS ICON-ONLY ════════════ */

test('the context heading derives terracotta from the token, never a hex', () => {
  const src = readFileSync(CSS, 'utf8');
  assert.match(
    src,
    /\.fd-rctx\s*\{[^}]*var\(--m-mulberry\)/,
    'The context heading must take its colour from the app CTA token. A ' +
      'hand-typed hex is invisible to every contrast guard in the repo — that ' +
      'is exactly how design#6 shipped `#9A8F86` at 3.06:1 on eight live pages.',
  );
  assert.doesNotMatch(
    code(src),
    /#C24E25/i,
    'Terracotta was re-typed as a literal in front-door.css. Derive it from ' +
      '--m-mulberry so it moves when the palette moves.',
  );
});

test('the 72px icon strip drops the event name with the other words', () => {
  const src = readFileSync(CSS, 'utf8');
  const strip = src.slice(src.indexOf('@media (max-width: 1279.98px)'));
  assert.ok(strip.length > 200, 'the 72px media query moved — re-anchor this guard.');
  assert.match(
    strip.slice(0, strip.indexOf('}\n}')),
    /\.fd-rctx\b/,
    'The event name is not hidden on the 72px icon strip, so a long wedding ' +
      'name renders into a 72px column and overflows the rail.',
  );
});
