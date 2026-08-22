/**
 * EVERY EVENT GETS THE DATE CALENDAR (owner 2026-08-21).
 *
 * Owner: *"our date of celebration should have that calendar with the hot date
 * legend. as before, but i do not see that on the on boarding of any event. We
 * used to allow multiple single dates and a 30 days range date."*
 *
 * He is right, and the cause was WIRING. The calendar — 4 candidate dates, a
 * 30-day range, the demand tint — has shipped since 2026-06-09, declared
 * INSIDE the wedding onboarding shell, so it could only ever appear on a
 * wedding. This file pins the three properties he named, that the wedding is
 * unchanged, and the two ways this move could silently fail:
 *
 *   · THE CALENDAR SHIPS UNSTYLED. DECISION_LOG 2026-07-12 already paid for
 *     this once — a wedding onboarding component reused elsewhere renders as
 *     bare boxes because its classes are `.onbw`-scoped. So the CSS must have
 *     MOVED (one source), and must not reference a colour that exists only
 *     inside `.onbw` without a fallback.
 *   · THE RULES GET COPIED INSTEAD OF MOVED, and the two flows drift.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`
 * emits bare `React.createElement`), and a stub for the `.css` import, which
 * this runner cannot parse.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css')) return {};
    return load.call(this, request, ...rest);
  };
}

async function mod() {
  return import('./date-calendar');
}

async function render(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DateCalendar } = await mod();
  return renderToStaticMarkup(
    React.createElement(DateCalendar as never, {
      mode: 'specific',
      candidates: [],
      windowStart: null,
      windowEnd: null,
      onChange: () => {},
      ...props,
    } as never),
  );
}

// ---- The three things the owner named --------------------------------------

test('multiple single dates — up to four', async () => {
  const { MAXMULTI } = await mod();
  assert.equal(MAXMULTI, 4);
  const html = await render({});
  assert.match(html, /1–4 days/, 'the control no longer offers more than one day');
});

test('a range, capped at 30 days', async () => {
  const { MAXSPAN } = await mod();
  // 29 days BETWEEN two dates is a 30-day window inclusive. Off by one here is
  // the difference between the owner's "30 days" and 31.
  assert.equal(MAXSPAN, 29);
  const html = await render({ mode: 'window' });
  assert.match(html, /Flexible window/);
  assert.match(html, /30 days/, 'the 30-day promise is not stated to the person');
});

test('no raw \\u escape reaches the screen', async () => {
  // 🪤 THIS SHIPPED FOR A MOMENT AND MY OWN TEST CAUGHT IT. Rewriting the JSX
  // programmatically emitted `1\\u20134 days` as literal TEXT — in a JSX text
  // node `\\u2013` is not an escape, it is nine characters a person reads.
  const html = await render({});
  assert.doesNotMatch(html, /\\u[0-9a-fA-F]{4}/, 'a unicode escape is being rendered as text');
  assert.match(html, /1–4 days/);
});

test('the hot-date LEGEND says what the shading means', async () => {
  // The tint shipped in 2026-06-09 with nothing anywhere decoding it. A ramp a
  // person cannot read is decoration — the owner calls it a "legend", which is
  // the name of a thing you read.
  const html = await render({});

  // 🪤 THE FIRST CUT OF THIS TEST WAS DECORATION and the mutation run caught
  // it: it only looked for the WORDS, so adding `hidden` to the list kept every
  // word in the markup and the check passed with the legend invisible. Assert
  // the container is really there AND really shown.
  const openTag = html.match(/<ul[^>]*sn-datecal-legend[^>]*>/)?.[0];
  assert.ok(openTag, 'the legend list is gone');
  assert.doesNotMatch(openTag!, /\bhidden\b/, 'the legend is rendered but hidden');
  const note = html.match(/<p[^>]*sn-datecal-legendnote[^>]*>/)?.[0];
  assert.ok(note, 'the sentence explaining the shading is gone');
  assert.doesNotMatch(note!, /\bhidden\b/, 'the explaining sentence is rendered but hidden');
  assert.match(html, /how busy suppliers usually are/, 'the sentence no longer explains anything');

  for (const word of ['Open', 'Quiet', 'Popular', 'In demand', 'Hottest']) {
    assert.ok(html.includes(word), `the legend does not name "${word}"`);
  }
  // The swatches reuse the CELLS' own classes, so a legend can never describe a
  // colour the calendar has stopped using.
  for (const t of [1, 2, 3, 4]) {
    assert.match(html, new RegExp(`swatch heat-${t}`), `swatch ${t} is not the cell's own class`);
  }
});

test('the heat ramp is the shipped one, unchanged', async () => {
  const { heatTier } = await mod();
  // Deterministic + cold-start-safe (Date-Aligner §L.1). Pinned so a move can
  // never quietly re-tune what a couple is being told about demand.
  assert.equal(heatTier(new Date(2026, 11, 12)), 4, 'Sat + Dec + repeating 12/12 is the hottest');
  assert.equal(heatTier(new Date(2026, 6, 8)), 0, 'an ordinary July Wednesday is open');
  assert.ok(heatTier(new Date(2026, 1, 14)) >= 3, "Valentine's is in demand");
  // Every tier stays inside the ramp the CSS knows about.
  for (let d = 0; d < 400; d++) {
    const day = new Date(2026, 0, 1 + d);
    const t = heatTier(day);
    assert.ok(t >= 0 && t <= 4, `heat tier ${t} has no colour`);
  }
});

// ---- The wedding is unchanged ----------------------------------------------

test("the wedding chrome is the default and keeps the wedding's own skeleton", async () => {
  const html = await render({});
  assert.match(html, /class="viewzone"/, 'the wedding viewzone is gone');
  assert.match(html, /class="tapzone sn-datecal"/, 'the wedding tapzone lost the calendar scope');
  assert.match(html, /Your wedding/);
  assert.match(html, /big day/);
});

test('a birthday is never told "Your wedding"', async () => {
  const bare = await render({ chrome: 'bare' });
  assert.doesNotMatch(bare, /Your wedding/);
  assert.doesNotMatch(bare, /viewzone|tapzone/, 'bare chrome pulls in wedding-only chrome classes');
  assert.match(bare, /class="sn-datecal"/, 'the calendar lost its style scope');
  // The calendar itself is all there.
  assert.match(bare, /class="calgrid"/);
  assert.match(bare, /Specific dates/);
});

// ---- The two silent failure modes ------------------------------------------

function css(...parts: string[]): string {
  return readFileSync(join(__dirname, ...parts), 'utf8');
}

test('the calendar CSS MOVED — it is not defined in two places', () => {
  const shared = css('date-calendar.css');
  const wedding = readFileSync(
    join(__dirname, '..', 'wedding', '_styles', 'onboarding.css'),
    'utf8',
  );
  assert.match(shared, /\.sn-datecal \.calgrid/, 'the shared sheet has no calendar rules');
  // The wedding sheet may still mention .calnav inside MULTI-selector rules it
  // shares with other controls — but must own no calendar rule of its own.
  const own = wedding.match(/\.onbw \.(calgrid|calday|calhead|calmonth|caldow|calmode|calpick|rangewarn)\b/g);
  assert.equal(
    own,
    null,
    `the wedding sheet still owns calendar rules (${own?.join(', ')}) — two copies drift`,
  );
});

test('no calendar colour resolves to nothing outside the wedding page', () => {
  // 🪤 THE RECORDED TRAP. The rules used `var(--gold)` etc., which exist ONLY
  // inside `.onbw`. Used anywhere else every one resolves to nothing and the
  // calendar renders as unstyled boxes. Each must go through a `--cal-*` alias
  // that carries its own fallback.
  // ⚠ STRIP THE COMMENTS FIRST. This guard's own docblock in the CSS file
  // NAMES `var(--gold)` as the thing to avoid, so a raw match reports the
  // sentence explaining the rule as a violation of it. A guard that cries wolf
  // teaches you to skim past the one time it is right.
  const shared = css('date-calendar.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bare = shared.match(/var\(--(?!cal-|m-r-|font-)[a-z0-9-]+\)/g) ?? [];
  assert.deepEqual(
    bare,
    [],
    `these colours only exist inside .onbw, so the calendar would render unstyled: ${bare.join(', ')}`,
  );
  // And every alias actually carries a fallback.
  const aliases = shared.match(/--cal-[a-z0-9-]+:\s*var\([^)]*\)/g) ?? [];
  assert.ok(aliases.length >= 10, 'the colour aliases are gone');
  for (const a of aliases) {
    assert.match(a, /var\(--[a-z0-9-]+,\s*[^)]+\)/, `${a} has no fallback — unstyled outside .onbw`);
  }
});

// ---- It is actually mounted where the owner looked --------------------------

test('the generic (every non-wedding) onboarding mounts the calendar', () => {
  const src = readFileSync(
    join(__dirname, '..', '[type]', '_components', 'generic-onboarding.tsx'),
    'utf8',
  );
  assert.match(src, /<DateCalendar/, 'the calendar is not on the non-wedding date step');
  assert.match(src, /chrome="bare"/);
  // And the lone date box it replaced is gone.
  assert.doesNotMatch(
    src,
    /type="date"\s*\n\s*value=\{dateValue\}/,
    'the single date box is still the control',
  );
});

test('the commit carries the calendar instead of hardcoding one day', () => {
  const src = readFileSync(
    join(__dirname, '..', '[type]', '_components', 'generic-onboarding.tsx'),
    'utf8',
  );
  const payload = src.slice(src.indexOf('const payload: GenericOnboardingPayload'));
  const body = payload.slice(0, payload.indexOf('interestedServices'));
  assert.doesNotMatch(
    body,
    /dateMode: 'specific'/,
    'dateMode is hardcoded again — the range can never be committed',
  );
  assert.doesNotMatch(
    body,
    /windowStart: null,\s*\n\s*windowEnd: null,/,
    'the window is hardcoded null — a range would be silently dropped on commit',
  );
  assert.match(body, /dateMode,/);
  assert.match(body, /windowStart: dateMode === 'window'/);
});

test('"Another day" still does something now that its input is gone', () => {
  // 🪤 The chip focused a native <input type="date"> and called showPicker().
  // That input was replaced by the calendar; a ref left pointing at it makes
  // the chip set a value and appear to do nothing.
  const src = readFileSync(
    join(__dirname, '..', '[type]', '_components', 'generic-onboarding.tsx'),
    'utf8',
  );
  assert.doesNotMatch(src, /dateInputRef/, 'the ref still names an input that no longer exists');
  assert.match(src, /dateCalendarRef/);
  assert.match(src, /scrollIntoView/, 'the chip leads nowhere');
});
