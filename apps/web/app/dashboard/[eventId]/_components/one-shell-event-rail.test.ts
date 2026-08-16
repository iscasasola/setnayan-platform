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
 *   · Losing the content wrapper's `.sn-vt-page` or its `[data-shell-main]`
 *     hook breaks the PHONE, at widths where the rail does not paint at all.
 *   · Losing its `.sn-ambient` ground changes the colour of every event screen.
 *   · A second `<aside>` in this layout renders two rails, one on top of the
 *     other, both correct in isolation.
 *   · Restoring `lg:hidden` on the switcher strands sign-out on the couple's
 *     desktop, because the plaque that used to carry it no longer renders.
 *   · A hand-typed terracotta is invisible to every contrast guard in the repo
 *     — the exact defect design#6 shipped as `#9A8F86`.
 *
 * ⚠ THESE USED TO READ `sidebar-shell.tsx`, WHICH IS DELETED (2026-08-15).
 * The component is gone; the RULES it carried are not, so each assertion was
 * re-pointed at the layout that owns the job now rather than removed. A guard
 * deleted to go green is a rule deleted.
 *
 * 🔑 THE BEHAVIOUR TESTS CALL THE REAL BUILDER, NOT A COPY OF IT. A first cut
 * of the sibling rail guard declared its own row list, so a mutation that
 * deleted `exact: true` from the REAL list passed everything. Testing the
 * primitive is not testing the caller.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUT = join(HERE, '..', 'layout.tsx');
const RAIL = join(HERE, 'event-rail-context.tsx');
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
  for (const p of [LAYOUT, RAIL, CSS]) {
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

/* ══ 2 · THE MOBILE TRAP — THE CONTENT WRAPPER CARRIES THE SLIDE ═════════ */

test('the event content still carries the view-transition name and the sub-nav hook', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  const named = src.match(/\bsn-vt-page\b/g) ?? [];
  assert.equal(
    named.length,
    1,
    `expected exactly one sn-vt-page in the event layout, saw ${named.length}. ` +
      'ZERO kills the mobile bottom-nav page slide silently — the tap still ' +
      'starts a view transition and animates NOTHING, at widths where the rail ' +
      'does not even paint. TWO is a duplicate view-transition-name, which ' +
      'makes the browser skip the transition entirely. ' +
      'It used to ride on SidebarShell\'s <main>; that component is deleted.',
  );
  assert.match(
    src,
    /data-shell-main\b/,
    'The `[data-shell-main]` hook is gone — the docked sub-nav loses the extra ' +
      'bottom room and covers the last row of content on the phone.',
  );
});

test('the named element is a <main>, and it is the only landmark here', () => {
  /*
    TWO RULES IN ONE ELEMENT, and they are only both satisfiable by a <main>.
    `FrontDoorShell` renders a <div> in its app variant precisely BECAUSE the
    host owns the landmark (`one-main-per-page.test.ts`), so a <div> here
    leaves the whole event tree with no <main> at all — invisible, and exactly
    the state the admin tree is in today.
  */
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(
    src,
    /<main className="sn-vt-page"/,
    'The `.sn-vt-page` element is no longer a <main>. It must be both: the ' +
      'view-transition name AND this tree\'s only landmark.',
  );
  assert.equal(
    (src.match(/<main\b/g) ?? []).length,
    1,
    'One landmark per page. Two <main> elements is invalid HTML and a ' +
      'duplicated landmark for anyone navigating by landmark.',
  );
});

test('the slide wrapper is unconditional — never behind a breakpoint or a flag', () => {
  /*
    🪤 THE WHOLE TRAP IN ONE LINE. The rail replaced a DESKTOP sidebar, so
    every instinct here is to gate on `lg:`. This element wraps content at ALL
    widths, and the thing it protects only runs on a PHONE. A `lg:` prefix or a
    ternary would read as tidy and disable the carousel where nobody testing a
    desktop conversion would look.
  */
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.doesNotMatch(
    src,
    /(?:lg|md|sm):[^"'\s]*sn-vt-page|sn-vt-page[^"']*\s(?:lg|md|sm):hidden/,
    'The `.sn-vt-page` wrapper is gated on a breakpoint. It must wrap content ' +
      'at every width — the page slide it names is a PHONE behaviour.',
  );
  assert.doesNotMatch(
    src,
    /\?[^\n]*\bsn-vt-page\b|\bsn-vt-page\b[^\n]*:\s*(?:null|undefined|'')/,
    'The `.sn-vt-page` wrapper moved behind a conditional. Rendered sometimes, ' +
      'the mobile page-slide works sometimes, and nothing anywhere says which.',
  );
});

/* ══ 3 · ONE RAIL, AND THE GROUND IT PAINTS ON ══════════════════════════ */

test('the event layout draws no sidebar of its own', () => {
  /*
    The old `<aside>` left with `sidebar-shell.tsx`. If one comes back here it
    renders UNDER the shared rail — two sidebars, both correct in isolation.
  */
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.equal(
    (src.match(/<aside\b/g) ?? []).length,
    0,
    'The event layout renders its own <aside>. The shared rail already owns ' +
      'the desktop left column; a second one stacks on top of it.',
  );
});

test('the warm ground survived the shell, and is a SEPARATE element from the slide', () => {
  /*
    🔑 THE SILENT COLOUR CHANGE. `.sn-ambient` sat on SidebarShell's own root,
    INSIDE the content column, so it paints over the rail's cream. Nothing
    else in this tree sets it — the parent dashboard layout paints
    `var(--m-paper)` and the rail paints `--fd-cream`, both different — so
    dropping it recolours every event screen with nothing thrown.

    ⚠ AND IT MUST NOT BE MERGED ONTO THE NAMED ELEMENT. `view-transition-name`
    snapshots the element it names; folding the painted ground into it makes
    the BACKGROUND slide with the page instead of standing still behind it —
    a visible change to the one animation the test above exists to protect.
  */
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(
    src,
    /className="sn-ambient min-h-screen"/,
    'The `.sn-ambient` ground (with its `min-h-screen`, or a short page shows ' +
      'the layer underneath) is gone from the event content column.',
  );
  assert.doesNotMatch(
    src,
    /className="[^"]*\bsn-ambient\b[^"]*\bsn-vt-page\b|className="[^"]*\bsn-vt-page\b[^"]*\bsn-ambient\b/,
    'The ground and the view-transition name are on the SAME element. The ' +
      'painted background is then inside the transition snapshot and slides ' +
      'with the page. They must stay nested, not merged.',
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

test('every row in the SSOT lights itself, and only itself', () => {
  /*
    DERIVED FROM THE SSOT, NOT A HAND-TYPED ROUTE LIST.

    🪤 A hardcoded list here would CRY WOLF on somebody else's correct change.
    The owner ruled on 2026-08-14 that "Seat plan" is retired from this group
    because the guest-journey step wins (`DECISION_LOG.md`), and a list naming
    `/seating` → 'seat' would go red on the commit that carries out his own
    ruling. A guard that fires on a legitimate change teaches you to skim past
    the one time it is right.

    What is actually worth pinning is the INVARIANT, and it survives any row
    being added or retired: every destination the rail offers lights ITS OWN
    row when you are on it. The sub-route and no-match cases below cannot be
    derived, so they stay explicit.
  */
  const rows = realRows();
  assert.ok(rows.length >= 5, `only ${rows.length} rows — the builder returned a stub.`);
  for (const row of rows) {
    assert.equal(
      activeRailKey(rows, row.href),
      row.key,
      `${row.href} should light "${row.key}" and nothing else.`,
    );
  }
});

test('a sub-route lights its parent, and an unlisted route lights nothing', () => {
  const base = `/dashboard/${EVENT_ID}`;
  assert.equal(
    activeRailKey(realRows(), `${base}/guests/anything`),
    'guests',
    'A page inside Guests must keep the Guests row lit.',
  );
  /*
    `null` is a REAL answer and must render as "no row lit". Telling someone
    they are somewhere they are not is worse than telling them nothing — and
    it is why the resolver must never fall back to the first row.
  */
  assert.equal(
    activeRailKey(realRows(), `${base}/messages`),
    null,
    'A route the rail does not list must light NOTHING, never a fallback row.',
  );
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
