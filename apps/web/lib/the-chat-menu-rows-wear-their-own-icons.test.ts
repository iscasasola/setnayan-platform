/**
 * THE CHAT ⋮ ROWS WEAR THEIR OWN ICONS (owner 2026-10-29, live in the iPhone app, verbatim: *"when i press the ... on
 * upper right i see quote payments files, etc with the same icon"*). Every link in the thread's ⋮ wore the one ↗.
 *
 *   1. RENDERED: every picture the menu can draw is a different drawing — from each other AND from Archive, Report, Block;
 *   2. the menu draws the row's own picture (no shared ↗ is left in the file);
 *   3. on both thread pages, every row the ⋮ is handed names a picture, and no two rows on one page share one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Archive, ArchiveRestore, Ban, Flag, RotateCcw } from 'lucide-react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The menu imports the chat's server actions; their `server-only` marker is inert under node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** The drawing itself — the SVG's inner shapes, without the attributes every lucide icon shares. */
const drawing = (Icon: React.ComponentType) => renderToStaticMarkup(React.createElement(Icon)).replace(/^<svg[^>]*>/, '');

test('1 · rendered: every menu picture is its own drawing, and none is Archive’s, Report’s or Block’s', async () => {
  const { CHAT_MENU_ICONS } = await import('@/app/_components/chat-thread-menu');
  const keys = Object.keys(CHAT_MENU_ICONS) as (keyof typeof CHAT_MENU_ICONS)[];
  assert.ok(keys.length >= 5, `only ${keys.length} pictures`);
  const seen = new Map<string, string>();
  for (const [name, Icon] of [...keys.map((k) => [k, CHAT_MENU_ICONS[k]] as const), ['archive', Archive], ['unarchive', ArchiveRestore], ['report', Flag], ['block', Ban], ['unblock', RotateCcw]] as const) {
    const d = drawing(Icon as React.ComponentType);
    assert.ok(d.length > 20, `${name} drew nothing`);
    assert.ok(!seen.has(d), `${name} draws the same picture as ${seen.get(d)}`);
    seen.set(d, name);
  }
});

test('2 · the menu draws the row’s own picture — no shared ↗ left', () => {
  const menu = read('app/_components/chat-thread-menu.tsx');
  assert.match(menu, /const Icon = CHAT_MENU_ICONS\[l\.icon\];/, 'a row does not draw its own picture');
  assert.doesNotMatch(menu, /\bExternalLink\b/, 'the one shared ↗ is back');
});

test('3 · on both thread pages every ⋮ row names its picture, none shared on one page', () => {
  for (const rel of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    const s = read(rel);
    const at = s.indexOf('<ChatThreadMenu');
    assert.ok(at > 0, `${rel}: no ⋮`);
    const block = s.slice(at, s.indexOf('/>', s.indexOf(']}', s.indexOf('links={', at))));
    const rows = block.split(/\bhref:/).slice(1); // one chunk per row (an href holds `${…}`, so no brace-matching)
    assert.ok(rows.length >= 4, `${rel}: read ${rows.length} rows`);
    const icons = rows.map((r) => /icon:\s*'(\w+)'/.exec(r)?.[1] ?? null);
    assert.ok(!icons.includes(null), `${rel}: a row names no picture`);
    assert.equal(new Set(icons).size, icons.length, `${rel}: two rows share a picture (${icons.join(', ')})`);
  }
});
