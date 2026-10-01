import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
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

test('the rail reproduces the five rows, from the shipped SSOT', () => {
  /*
    🔄 2026-09-29 — Stage D (owner: *"this is what an event needs. Guestlist ·
    Your Team · Event Hub Maker · Our Services"*). The "by moment" headings
    (Book · Look · Invite · The day, 2026-09-24) are gone: the rail is the
    event's name row, then five plain rows — none with a heading (the interim
    Seat plan row left in train n; its Details home is on main). The rail still renders whatever the SSOT gives it, so a
    change here is a change to the couple IA on the rail, ☰ and phone at once.
  */
  const studioRows = [
    { key: 'papic', href: `/dashboard/${EVENT_ID}/studio/papic`, name: 'Papic' },
    { key: 'mood-board', href: `/dashboard/${EVENT_ID}/studio/mood-board`, name: 'Mood Board' },
  ];
  const groups = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true, studioRows });
  assert.deepEqual(groups.map((g) => g.key), ['event', 'pillars'], 'a section beyond the name row and the five');
  assert.deepEqual(groups.map((g) => g.label), ['', ''], 'the five rows carry no headings');
  assert.deepEqual(
    groups.find((g) => g.key === 'pillars')?.items.map((i) => i.key),
    ['home', 'guests', 'explore', 'launch', 'studio'],
  );
});

test('Budget is never a main room — owner 2026-07-10 (a part of Your Team since Stage D)', () => {
  const rows = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true }).flatMap((g) => g.items);
  assert.ok(!rows.some((i) => i.key === 'budget'), 'Budget is a menu row again');
  assert.ok(
    rows.find((i) => i.key === 'explore')?.alsoMatch?.includes(`/dashboard/${EVENT_ID}/budget`),
    'the old /budget page must light Your Team, which holds it',
  );
});

test('every rail row but More Services is a plain leaf — "solid menu with no submenus" (2026-07-15)', () => {
  /* 📂 The owner's ONE exception (2026-09-30, DECISION_LOG "THE SIDEBAR ROW
     'MORE SERVICES' EXPANDS TO THE FIVE"): the `studio` row opens to its five.
     Every `item.children` read must sit inside that one branch — the branch
     opens with the `studio` key check and ends at the leaf's `return (`. */
  const src = code(readFileSync(RAIL, 'utf8'));
  const start = src.indexOf("if (item.key === 'studio' && item.children?.length)");
  assert.ok(start >= 0, 'the More Services branch is gone — or it is no longer keyed to `studio`');
  const end = src.indexOf('return (', src.indexOf('</ul>', start));
  const outside = src.slice(0, start) + src.slice(end);
  assert.doesNotMatch(
    outside,
    /\bitem\.children\b/,
    'The rail renders NavItem.children for a row other than More Services, which ' +
      'reverses the owner lock of 2026-07-15 ("solid menu with no submenus") ' +
      'silently, while looking like a nicety. Sub-navigation lives inside each page.',
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

/* ══ 8 · THE EVENT'S MARK SITS ABOVE ITS NAME ═══════════════════════════════
   Owner 2026-09-23, pointing at the `.fd-rctx` name row: *"on top of this,
   show the logo/monogram of the event"*.

   🔑 ALL THREE ASSERTIONS ARE ABOUT THINGS THAT FAIL QUIETLY. The mark going
   missing renders a rail that is merely plainer; the mark rendering an
   UNGATED column renders a host-written `<svg>` into other people's chrome;
   and the mark being swept into the 72px strip's `display: none` empties the
   one width where it matters most — names hidden, icons only — of anything
   saying which event you are standing in. None of the three throws. */

test('the event rail renders the monogram ABOVE the name, not inside it', () => {
  const src = code(readFileSync(RAIL, 'utf8'));
  assert.match(
    src,
    /<EventMonogram\b/,
    "The event rail no longer draws the event's mark (owner 2026-09-23).",
  );
  const mark = src.indexOf('fd-rctx-mark');
  const name = src.indexOf('className="fd-rctx"');
  assert.ok(mark >= 0, 'the mark lost its own `.fd-rctx-mark` element');
  assert.ok(name >= 0, 'the event name row is gone');
  assert.ok(
    mark < name,
    'The mark must come BEFORE the name — "on top of this" is a position, and ' +
      'below the name it reads as belonging to the section under it instead.',
  );
});

test('the mark survives the 72px icon strip that hides the name', () => {
  const src = readFileSync(CSS, 'utf8');
  assert.match(src, /\.fd-rctx-mark\b/, 'no `.fd-rctx-mark` rule at all — the mark is unstyled.');
  /*
    THE PROPERTY, NOT THE POSITION: no rule anywhere may hide it. Written this
    way because the failure it guards is a SELECTOR LIST edit — `.fd-rctx` and
    `.fd-rctx-mark` are one token apart, and adding the mark to the strip's
    existing `display: none` list looks like tidying two related selectors
    together.
  */
  for (const rule of src.match(/[^{}]+\{[^}]*\}/g) ?? []) {
    const selector = rule.slice(0, rule.indexOf('{'));
    if (!/\.fd-rctx-mark\b/.test(selector)) continue;
    assert.doesNotMatch(
      rule,
      /display\s*:\s*none/,
      'The event mark is hidden by `' + selector.trim() + '`. At the 72px ' +
        'strip the names are already gone, so hiding the mark too leaves ' +
        'nothing naming the event you are inside.',
    );
  }
});

test('the layout hands the mark through the read-time SVG gate, never raw', () => {
  const src = code(readFileSync(LAYOUT, 'utf8'));
  assert.match(src, /eventMonogram=\{/, "The layout stopped passing the event's mark to the rail.");
  assert.match(
    src,
    /monogram_custom_svg:\s*resolveEventMonogramSvg\(/,
    'SEC-3: `events.monogram_custom_svg` and `monogram_uploaded_svg` are ' +
      'host-writable through PostgREST, and `EventMonogram` feeds that column ' +
      'straight into a data-URI. It must arrive from resolveEventMonogramSvg ' +
      '(which also applies uploaded-outranks-bespoke precedence), never read ' +
      'off the row.',
  );
});

/* ══ 9 · THE MARK IS CENTRED AT EVERY WIDTH ═════════════════════════════════
   Owner 2026-09-24, looking at `/dashboard/[eventId]`: *"the logo needs to be
   centered."*

   🔑 THE BUG WAS ONE ELEMENT WITH TWO ALIGNMENTS. The base rule left
   `justify-content` unset (= flex-start) and the 1279 block set `center`, so
   the mark was centred on the 72px icon strip and hard left in the 223px rail.
   Nothing was red: both rules were valid CSS and each looked right at the
   width its author was checking.

   ⚠ THIS GUARD DELIBERATELY DOES NOT READ THE 1279 BLOCK. Centring now lives
   in ONE place; asserting it in two would re-create the split this fixes. */

test('the event mark is centred by ONE rule, not once per width', () => {
  /* 🪤 COMMENTS STRIPPED BEFORE ANY COUNTING. The first cut of this guard
     counted the raw file and found TWO centring rules — the second was the
     COMMENT in the 1279 block saying `justify-content: center` had moved to
     the base rule. The guard convicted the note explaining the fix. */
  const src = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  const rules = (src.match(/[^{}]+\{[^}]*\}/g) ?? []).filter((r) =>
    /\.fd-rctx-mark\b/.test(r.slice(0, r.indexOf('{'))),
  );
  assert.ok(rules.length > 0, 'no `.fd-rctx-mark` rule at all — the mark is unstyled.');

  const centring = rules.filter((r) => /justify-content:\s*center/.test(r));
  assert.equal(
    centring.length,
    1,
    `justify-content:center appears in ${centring.length} .fd-rctx-mark rules. ` +
      'ZERO means the mark is flush left again — the owner\'s complaint. TWO means ' +
      'it is declared per-width, which is how it came to be centred at one width ' +
      'and not the other.',
  );

  /* And the one that declares it must be the UNCONDITIONAL rule, or "centred"
     is still a property of some widths only. Measured by BRACE DEPTH at the
     selector's offset — never by line number, which moves on every edit to
     this stylesheet. Depth 0 = top level; depth 1 = inside a media query. */
  const clean = src; // already comment-free
  const depthAt = (offset: number) => {
    let d = 0;
    for (let i = 0; i < offset; i += 1) {
      if (clean[i] === '{') d += 1;
      else if (clean[i] === '}') d -= 1;
    }
    return d;
  };

  let centredAtTopLevel = false;
  const selector = /\.fd\[data-chrome='app'\] \.fd-rctx-mark\s*\{/g;
  for (let m = selector.exec(clean); m; m = selector.exec(clean)) {
    const body = clean.slice(m.index, clean.indexOf('}', m.index));
    if (/justify-content:\s*center/.test(body) && depthAt(m.index) === 0) {
      centredAtTopLevel = true;
    }
  }
  assert.ok(
    centredAtTopLevel,
    'the rule that centres the mark is nested inside a media query, so the ' +
      'mark is centred at some widths and not others — which is the defect.',
  );
});

/* ══ 10 · MORE SERVICES READS AS A SUB-MENU, NOT FIVE MORE PLACES ═══════════
   Owner 2026-10-01 (DECISION_LOG "THE SIDEBAR'S MORE SERVICES OPENS AS A
   VISIBLE SUB-MENU"): *"why do i see a lot of side menu?"* — Setnayan AI ·
   Papic · Live Studio · Music Maker · Patiktok rendered identical to Home ·
   Guests · Suppliers · Hub, so the rail read as eleven places.

   🔑 THESE RENDER THE REAL COMPONENT. A source grep would pass the moment the
   five moved back beside the leaves, or the `hidden` was dropped from the
   group — both leave every string the grep looks for in the file. */

const FIVE = [
  { key: 'ai', label: 'Setnayan AI (SAI)', href: `/dashboard/${EVENT_ID}/studio/ai`, icon: 'ai' },
  { key: 'papic', label: 'Papic', href: `/dashboard/${EVENT_ID}/studio/papic`, icon: 'papic' },
  { key: 'live', label: 'Live Studio', href: `/dashboard/${EVENT_ID}/studio/live`, icon: 'live' },
  { key: 'pakanta', label: 'Music Maker', href: `/dashboard/${EVENT_ID}/studio/pakanta`, icon: 'pakanta' },
  { key: 'patiktok', label: 'Patiktok', href: `/dashboard/${EVENT_ID}/studio/patiktok`, icon: 'patiktok' },
] as const;

async function paintRail(activeKey: string | null): Promise<string> {
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventRailContext } = await import('./event-rail-context');
  const { RailActiveKeyProvider } = await import('@/app/_components/frontdoor/rail-active-key');
  return renderToStaticMarkup(
    React.createElement(
      // `children` goes as the 3rd argument (react/no-children-prop), which the
      // component's props type cannot see — hence the widening.
      RailActiveKeyProvider as unknown as React.ComponentType<{ activeKey: string | null }>,
      { activeKey },
      React.createElement(EventRailContext, {
        eventId: EVENT_ID,
        eventName: 'A & M',
        websiteEnabled: true,
        services: [...FIVE],
      }),
    ),
  );
}

/** The sub-group's inner markup, and everything outside it. */
function splitGroup(html: string): { tag: string; inside: string; outside: string } {
  const m = html.match(/<ul\b[^>]*\bclass="fd-msub"[^>]*>([\s\S]*?)<\/ul>/);
  assert.ok(m, 'More Services has no `.fd-msub` group — the five are loose rows again.');
  return { tag: m[0].slice(0, m[0].indexOf('>') + 1), inside: m[1]!, outside: html.replace(m[0], '') };
}

test('the five sit inside ONE `.fd-msub` group — never beside Home · Guests · Suppliers · Hub', async () => {
  const { inside, outside } = splitGroup(await paintRail('home'));
  assert.equal((inside.match(/\bfd-mchild\b/g) ?? []).length, 5, 'the group does not hold exactly the five');
  for (const f of FIVE) assert.ok(inside.includes(f.label), `${f.label} is not inside the group`);
  // Not one of them is a sibling of the four top-level rows.
  assert.ok(!/\bfd-mchild\b/.test(outside), 'a child row renders OUTSIDE the sub-group, beside the top-level rows');
  for (const f of FIVE) assert.ok(!outside.includes(f.href), `${f.label} also renders as a top-level link`);
  // The four top-level rows are still plain links, outside the group.
  const leaves = [...outside.matchAll(/<a\b[^>]*\bclass="fd-row fd-mrow"/g)].length;
  assert.ok(leaves >= 4, `expected Home · Guests · Suppliers · Hub as top-level rows, saw ${leaves}`);
  // The only button in the rail is the More Services toggle.
  assert.equal((outside.match(/<button\b/g) ?? []).length, 1, 'more than one row opens');
});

test('the group is CLOSED by default, and OPEN when the current page is one of the five', async () => {
  const closed = await paintRail('home');
  assert.match(splitGroup(closed).tag, /\bhidden=""/, 'More Services starts open — the rail reads as eleven rows');
  assert.match(closed, /aria-expanded="false"/, 'the toggle does not say it is closed');
  for (const lit of ['studio']) {
    const open = await paintRail(lit);
    assert.doesNotMatch(splitGroup(open).tag, /\bhidden=/, 'standing on a More Services page leaves the group shut');
    assert.match(open, /aria-expanded="true"/, 'the toggle does not say it is open');
  }
  // A page that is not one of the five does not open it.
  assert.match(splitGroup(await paintRail(null)).tag, /\bhidden=""/);
});

test('the group is styled as a tinted, inset panel with a gold line, smaller icons — and labels never truncate', () => {
  const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel: string): string => {
    const m = css.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `no \`${sel}\` rule`);
    return m[1]!;
  };
  const grp = rule('.fd-msub');
  assert.match(grp, /background:/, 'the group has no tint — it does not read as a panel');
  assert.match(grp, /border-left:\s*2px solid var\(--fd-gold\)/, 'the thin gold line down the group is gone');
  assert.match(rule('.fd-msub .fd-gi svg'), /width:\s*15px/, 'the children wear full-size icons again');
  assert.match(css, /@media \(min-width: 1280px\), \(max-width: 1023\.98px\)\s*\{\s*\.fd-msub\s*\{\s*margin-left:/, 'the inset is gone');
  // The 72px strip's caption WRAPS: an ellipsis there is "More Serv…".
  const strip = css.slice(css.indexOf('@media (max-width: 1279.98px)'));
  const cap = strip.slice(strip.indexOf('.fd-row .fd-icon-caption'), strip.indexOf('}', strip.indexOf('.fd-row .fd-icon-caption')));
  assert.match(cap, /white-space:\s*normal/, 'the strip caption cannot wrap');
  assert.doesNotMatch(cap, /text-overflow|nowrap/, 'the strip caption truncates — "More Serv…", "Setnayan …", "Music Ma…"');
});

test('the event mark scales to its slot and its ink is never sliced', () => {
  const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = css.match(/\.fd\[data-chrome='app'\] \.fd-rctx-mark svg\s*\{([^}]*)\}/);
  assert.ok(m, 'the rail mark has no svg-fit rule — a wide lockup spills its slot');
  assert.match(m[1]!, /max-width:\s*100%/, 'the mark can outgrow its slot');
  assert.match(m[1]!, /overflow:\s*visible/, 'the svg clips its own glyphs to the viewBox — the M is cut off');
  assert.doesNotMatch(m[1]!, /\bheight:\s*\d/, 'a fixed pixel height defeats the scale');
});

test('the rail does not remember More Services open', () => {
  assert.ok(!/localStorage/.test(code(readFileSync(RAIL, 'utf8'))), 'a remembered "open" makes the default not closed');
});
