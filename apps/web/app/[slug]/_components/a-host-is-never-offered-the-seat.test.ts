/**
 * a-host-is-never-offered-the-seat.test.ts — THE PAGE HALF of "a host holds a guest's link to look, never to keep"
 * (owner 2026-10-21: signed in as the host on Pam's link, he was asked "Save it to <his email>?"). The server half —
 * the binder refusing a managing account and writing nothing — is `lib/a-host-never-binds-a-guest-seat.test.ts`.
 *
 *   1 · the shared Save, in `host_viewing`, says ONE quiet line and offers nothing to press (executed render);
 *   2 · every page that builds the account state asks whether the viewer manages the event — a page that forgets
 *       would hand a host the press again (property over every call site, count required non-zero).
 *
 * Sabotages seen red (each restored): the `host_viewing` branch removed from `SaveToAccount` (1 red) · the
 * `viewerManagesEvent` line removed from the plus-one door's page (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import { hostViewingLine } from '@/lib/seat-binding';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_host_never_offered__.js');
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

function words(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

test('1 · a host on a guest’s seat reads one quiet line — no form, no button, no link', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('./save-to-account');
  for (const seatName of ['Pam', null]) {
    const html = renderToStaticMarkup(
      React.createElement(SaveToAccount, {
        state: { kind: 'host_viewing', seatName },
        eventId: 'e-1',
        slug: 'cale-and-ice',
        personalLink: 'https://setnayan.com/cale-and-ice?invite=x',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
        termsCarried: true,
      }),
    );
    assert.equal(words(html), hostViewingLine(seatName), 'the host is told something other than the one line');
    assert.doesNotMatch(html, /<form|<button|href=|Save to my account|Yes, save/, 'the host is offered a press');
  }
});

const WEB = join(__dirname, '..', '..', '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('2 · every page that builds the account state asks whether the viewer manages the event', () => {
  const sites: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (let at = src.indexOf('guestAccountState('); at >= 0; at = src.indexOf('guestAccountState(', at + 1)) {
      if (/function\s+$/.test(src.slice(Math.max(0, at - 20), at))) continue; // the definition
      // The call's own arguments: up to the parenthesis that closes it (nested calls inside are skipped).
      let depth = 0;
      let end = at + 'guestAccountState'.length;
      for (; end < src.length; end += 1) {
        if (src[end] === '(') depth += 1;
        else if (src[end] === ')' && --depth === 0) break;
      }
      const args = src.slice(at, end);
      const rel = relative(WEB, file);
      sites.push(rel);
      assert.match(args, /\bviewerManagesEvent:/, `${rel}: builds the account state without asking whether the viewer is a host`);
    }
  }
  assert.ok(sites.length >= 3, `found only ${sites.length} call site(s) — the walk is looking in the wrong place`);
});
