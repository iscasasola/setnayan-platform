/**
 * 📐 AN EXAMPLE NEVER RUNS UNDER THE BUTTONS — the greyed "Example" under a Home counter ends its big line ABOVE the
 * tile's round corner buttons (owner bug 2026-11-11, 390 px: the Event Hub's *"Save the Date live"* ran under its two
 * buttons and hid "live"; at 320 px *"Date live"* did the same after wrapping).
 *
 * Cause: the Example is the LAST block of a tile, so it lands on the row where `.hc-acts` / `.hc-side` (32-px `.hc-tiny`
 * circles) are pinned bottom-right. Its small line reserved the buttons' WIDTH (`.hc-sm` padding-right) but was only
 * ~18 px tall, so the big line above it sat in the buttons' 32-px row with no reserve at all.
 *
 * Fix (globals.css): inside a tile that HAS corner buttons, the Example's small line is exactly as tall as a
 * `.hc-tiny` (`line-height: 32px`). The small line now owns the buttons' row (its width already reserved), and the big
 * line — at full size, wrapping freely — always ends above it. No width math, so it holds at any phone width.
 *
 * Properties:
 *   1 · globals.css keeps the rule, its selector reaches the Example's `.hc-sm` only in a tile with direct-child
 *       `.hc-acts` / `.hc-side`, and its line-height is at least the `.hc-tiny` height.
 *   2 · On an empty event, every Home tile that draws an Example beside corner buttons has both as DIRECT children of
 *       `.hc-tile` and a `.hc-sm` inside the Example — the shape that selector matches. The Event Hub tile (the bug)
 *       must be one of them.
 *
 * Sabotage (each went RED): deleting the rule (1) · `line-height: 18px` (1) · wrapping the hub tile's `.hc-side` in an
 * extra `<span>` in `home-tile.tsx` so the selector no longer matches (2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

function px(body: string, prop: string): number | null {
  const m = body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+(?:\\.\\d+)?)px`));
  return m ? Number(m[1]) : null;
}

test('📐 an Example\'s small line takes the corner buttons\' height, so its big line ends above them', () => {
  const tiny = css.match(/\n\.hc-tiny \{([^}]*)\}/);
  assert.ok(tiny, '.hc-tiny rule not found in globals.css');
  const tinyH = px(tiny[1] ?? '', 'height');
  assert.ok(tinyH && tinyH > 0, '.hc-tiny no longer states a px height');

  const rule = css.match(/\n\.hc-tile:has\(> :is\(\.hc-acts, \.hc-side\)\) > \.hc-example \.hc-sm \{([^}]*)\}/);
  assert.ok(rule, 'the rule that keeps an Example clear of the corner buttons is gone from globals.css');
  const lh = px(rule[1] ?? '', 'line-height') ?? px(rule[1] ?? '', 'min-height');
  assert.ok(lh !== null, 'the Example\'s small line no longer states its height in px');
  assert.ok(lh >= tinyH, `the Example's small line is ${lh}px — shorter than a ${tinyH}px corner button, so the big line runs under it`);
});

test('📐 every Home Example sits where that rule reaches it: beside direct-child corner buttons', async () => {
  const { fixtureControlEmpty } = await import('@/lib/home-control-fixture');
  const { drawHome, loadHome } = await import('@/app/dashboard/[eventId]/home-render.harness');
  await loadHome();
  const html = drawHome({ control: fixtureControlEmpty('e1') });

  const tiles = topLevelTiles(html);
  const withExample = tiles.filter((t) => t.children.some((c) => /\bhc-example\b/.test(c.cls)));
  assert.ok(withExample.length >= 3, `expected the Guests, Event Hub and Suppliers Examples at least — found ${withExample.length}`);
  assert.ok(withExample.some((t) => t.key === 'hub'), 'the Event Hub tile drew no Example on an empty event');

  for (const t of withExample) {
    const ex = t.children.find((c) => /\bhc-example\b/.test(c.cls))!;
    const buttons = t.children.some((c) => /(^|\s)hc-(acts|side)(\s|$)/.test(c.cls));
    const nested = /class="hc-(acts|side)"/.test(t.html);
    if (t.key === 'hub') assert.ok(nested, 'the Event Hub tile lost its corner buttons — this guard no longer tests the bug it was written for');
    if (nested) assert.ok(buttons, `the ${t.key} tile's corner buttons are no longer a direct child of .hc-tile — the rule cannot see them`);
    if (buttons) assert.match(ex.html, /class="hc-sm"/, `the ${t.key} Example sits beside corner buttons but has no small line to take their row`);
  }
});

type Child = { cls: string; html: string };
type Tile = { key: string; html: string; children: Child[] };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Every `.hc-tile` element in the markup, with its direct children (class + outer markup). */
function topLevelTiles(html: string): Tile[] {
  const out: Tile[] = [];
  const re = /<div class="hc-tile\b[^"]*"[^>]*>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const key = m[0].match(/data-home-tile="([^"]+)"/)?.[1] ?? '?';
    const end = closeOf(html, m.index);
    const inner = html.slice(m.index + m[0].length, end - '</div>'.length);
    out.push({ key, html: inner, children: directChildren(inner) });
  }
  return out;
}

/** Index just past the close of the element opening at `start`. */
function closeOf(html: string, start: number): number {
  const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const name = (m[2] ?? '').toLowerCase();
    if (VOID.has(name) || m[3]) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}

function directChildren(inner: string): Child[] {
  const kids: Child[] = [];
  const re = /<([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let i = 0;
  while (i < inner.length) {
    re.lastIndex = i;
    const m = re.exec(inner);
    if (!m) break;
    const name = (m[1] ?? '').toLowerCase();
    const end = VOID.has(name) || m[3] ? m.index + m[0].length : closeOf(inner, m.index);
    kids.push({ cls: (m[2] ?? '').match(/class="([^"]*)"/)?.[1] ?? '', html: inner.slice(m.index, end) });
    i = end;
  }
  return kids;
}
