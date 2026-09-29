/**
 * A TAP ON A PRINT-SET ROW FLIPS ITS SWITCH — rendered, then resolved the way
 * the browser resolves it.
 *
 * 🚨 Live bug (owner: "why can't i toggle them?"): every Details row with an ⓘ
 * was `<label><InfoTip/><input role=switch/></label>`. A label with no `for`
 * controls its FIRST labelable descendant, and InfoTip's ⓘ is a <button> that
 * comes first — so the tap opened the tip and the switch never moved.
 *
 * There is no DOM in this suite, so this renders `Toggle` to markup and runs
 * the HTML "labeled control" rule over it: the element whose id is the label's
 * `for`, else the first labelable descendant. A click on a label activates
 * exactly that element, so asserting it IS the switch is asserting the click
 * flips it. The second test runs the same rule on the same markup with `for`
 * removed and gets the ⓘ button — proof the rule can see the bug it guards.
 *
 * The source-shape guard for every other label is
 * lib/a-label-controls-its-switch.test.ts.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';

/**
 * 🪤 `server-only` IS NOT AN INSTALLED PACKAGE — Next's bundler provides it.
 * maker-details imports server actions whose helpers import the marker, so this
 * runner cannot load `Toggle` without a stub. The real boundary is enforced by
 * `lint-server-only-boundary.mjs` in CI and is not weakened here. Same shim as
 * app/[slug]/_components/the-reply-is-a-sheet.test.ts.
 */
{
  const Mod = createRequire(import.meta.url)('node:module') as {
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

// 🪤 tsconfig `jsx: preserve` → tsx compiles JSX to `React.createElement`, so
// React must be global BEFORE the component is (dynamically) imported.
(globalThis as unknown as { React: unknown }).React = React;

async function render(props: { name: string; label: string; on: boolean; tip?: string }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Toggle } = await import('./maker-details');
  return renderToStaticMarkup(React.createElement(Toggle, props));
}

type El = { tag: string; attrs: Record<string, string>; start: number; end: number };

/** Every element in the markup with its attributes and [start, end) span. */
function elements(html: string): El[] {
  const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
  const out: El[] = [];
  const open: El[] = [];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [, closing, tag = '', rawAttrs = '', selfClose] = m;
    if (closing) {
      for (let i = open.length - 1; i >= 0; i--) {
        const o = open[i];
        if (o && o.tag === tag) {
          o.end = m.index + m[0].length;
          open.splice(i);
          break;
        }
      }
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) if (a[1]) attrs[a[1]] = a[2] ?? '';
    const el: El = { tag, attrs, start: m.index, end: m.index + m[0].length };
    out.push(el);
    if (!selfClose && !VOID.has(tag)) open.push(el);
  }
  return out;
}

/** HTML's "labeled control" of a <label> — what a click on it activates. */
function labeledControl(html: string): El | undefined {
  const all = elements(html);
  const label = all.find((e) => e.tag === 'label');
  assert.ok(label, 'no <label> rendered');
  const labelable = (e: El) =>
    ['button', 'select', 'textarea', 'meter', 'output', 'progress'].includes(e.tag) ||
    (e.tag === 'input' && e.attrs.type !== 'hidden');
  if ('for' in label.attrs) {
    const byId = all.filter((e) => e.attrs.id === label.attrs.for);
    assert.equal(byId.length, 1, `for="${label.attrs.for}" must name exactly one element`);
    const target = byId[0];
    return target && labelable(target) ? target : undefined;
  }
  return all.find((e) => e.start > label.start && e.end <= label.end && labelable(e));
}

const WITH_TIP = { name: 'inc_seat_plan', label: 'Seat plan', on: false, tip: 'Prints your seating chart.' };

test('a row WITH an ⓘ: the label controls the switch, not the tip button', async () => {
  const html = await render(WITH_TIP);
  assert.match(html, /<button[^>]*aria-label="About Seat plan"/, 'the ⓘ button must still render');
  const control = labeledControl(html);
  assert.equal(control?.tag, 'input');
  assert.equal(control?.attrs.type, 'checkbox');
  assert.equal(control?.attrs.role, 'switch');
  assert.equal(control?.attrs.name, 'inc_seat_plan');
});

test('the rule sees the bug: the same row with `for` removed resolves to the ⓘ', async () => {
  const html = (await render(WITH_TIP)).replace(/ for="[^"]*"/, '');
  assert.equal(labeledControl(html)?.tag, 'button');
});

test('a row WITHOUT an ⓘ still controls its switch', async () => {
  const control = labeledControl(await render({ name: 'inc_thank_you', label: 'E-Gifts', on: true }));
  assert.equal(control?.attrs.name, 'inc_thank_you');
  assert.equal(control?.attrs.role, 'switch');
});

test('two rows never share an id — each label reaches its own switch', async () => {
  const a = await render(WITH_TIP);
  const b = await render({ ...WITH_TIP, name: 'inc_love_story', label: 'Love Story' });
  const idOf = (h: string) => elements(h).find((e) => e.tag === 'input')?.attrs.id;
  assert.ok(idOf(a) && idOf(b));
  assert.notEqual(idOf(a), idOf(b));
});
