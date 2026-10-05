/**
 * the-ticket-never-shows-blank.test.ts — the guest card's ticket picture is
 * never an empty white box while it is being drawn.
 *
 * Owner, live on maria-and-jose at 375 px (2026-10-05): "Guest card ticket
 * thumbnail is blank white for ~4 s before the ticket appears." The picture is
 * a 1080×1440 PNG the server draws on demand (`/api/guest/pass-card`), so it
 * takes seconds; the <img> carried `bg-white`, and was fully visible while
 * empty — a white rectangle where the ticket should be.
 *
 *   (1) EXECUTED: the first paint (before the picture is even asked for) is
 *       the ticket's shape with the guest's NAME on it, not an empty box;
 *   (2) the picture stays invisible until it has LOADED, the placeholder stays
 *       until then, and nothing paints the box white.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` resolve to an empty module (the thumb's file
// imports a server action), as in the-live-iphone-test-renders.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_ticket_blank__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

test('(1) the first paint is the ticket’s shape with their name — not a blank box', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestTicketThumb } = await import('./guest-ticket-parts');
  const html = renderToStaticMarkup(
    React.createElement(GuestTicketThumb, { guestId: 'g-daniel', name: 'Daniel Ramos', available: true }),
  );
  assert.match(html, /data-guest-ticket-waiting=""/, 'no placeholder on the first paint');
  const waiting = html.slice(html.indexOf('data-guest-ticket-waiting'));
  assert.match(waiting, /Daniel Ramos/, 'the placeholder does not carry the guest’s name');
  assert.match(waiting, /<svg/, 'the placeholder lost its QR mark');
  assert.doesNotMatch(html, /bg-white/, 'something paints the ticket box white again');
});

test('(2) the picture is hidden until it LOADS, and the placeholder holds the box until then', () => {
  const src = stripComments(
    readFileSync(
      join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-ticket-parts.tsx'),
      'utf8',
    ),
  );
  const thumb = src.slice(src.indexOf('export function GuestTicketThumb('), src.indexOf('function TicketPlaceholder('));
  assert.ok(thumb.length > 0, 'GuestTicketThumb moved — re-anchor this guard');
  const img = /<img\b[\s\S]*?\/>/.exec(thumb)?.[0] ?? '';
  assert.ok(img, 'the thumb lost its <img>');
  assert.match(img, /onLoad=\{\(\) => setLoaded\(true\)\}/, 'nothing records that the picture arrived');
  assert.match(img, /loaded \? 'opacity-100' : 'opacity-0'/, 'the picture is visible before it has loaded');
  assert.doesNotMatch(img, /bg-white/, 'the empty picture paints a white box');
  assert.match(thumb, /\{loaded \? null : <TicketPlaceholder name=\{name\} \/>\}/, 'the placeholder does not hold the box');
  // A cached picture can finish before onLoad is attached — it must not be held
  // behind the placeholder forever.
  assert.match(thumb, /img\?\.complete && img\.naturalWidth > 0\) setLoaded\(true\)/);
});
