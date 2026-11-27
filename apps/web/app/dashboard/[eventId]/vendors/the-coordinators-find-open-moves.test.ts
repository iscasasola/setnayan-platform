/**
 * 🧭 THE COORDINATOR'S "FIND · OPEN" MOVES (bug, 27 Nov 2026, Apple build 10 walkthrough: in an event the account
 * helps with, Suppliers › Find › "Open" did nothing when tapped).
 *
 * Root cause: the row was a link to `/dashboard/<id>/vendors?tab=shortlist`, the page it already stands on. The soft
 * navigation keeps the Suppliers shell mounted and the shell reads `initialTab` once, so nothing moved. Held here,
 * EXECUTED: the row is a button, it asks the shell's own bus for Find, and it brings the shell up under the app's bar,
 * at once when Find already shows, or when the shell has swapped to Find.
 *
 * Run: `npx tsx 'app/dashboard/[eventId]/vendors/the-coordinators-find-open-moves.test.ts'` from apps/web.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BB_TAB_EVENT } from '@/lib/budget-build';
import { HelpTheHostsChoose } from './_components/help-the-hosts-choose';
import { openFind } from './_components/find-open';

(globalThis as unknown as { React: unknown }).React = React;

test('the Find verb is a button, never a link back to this same page', () => {
  const html = renderToStaticMarkup(React.createElement(HelpTheHostsChoose, { eventId: 'e1' }));
  const at = html.indexOf('data-coordinator-supplier-verb="find"');
  assert.ok(at > 0, 'the Find verb was not drawn — this check would pass on nothing');
  const open = html.lastIndexOf('<', at);
  assert.match(html.slice(open, at), /^<button\b[^>]*type="button"/, 'the Find verb is not a button');
  assert.doesNotMatch(html, /href="[^"]*\/vendors\?tab=/, 'a link to the page it stands on is back: it moves nothing');
  assert.match(html, />Open</, 'the drawing’s "Open" word is gone');
});

type Fake = { hidden: boolean };

function stage(findBody: Fake | null) {
  const sent: string[] = [];
  const scrolls: { top: number }[] = [];
  let observer: (() => void) | null = null;
  let disconnected = false;
  const bar = { getAttribute: () => null, closest: () => null, getBoundingClientRect: () => ({ height: 60 }) };
  const root = {
    getBoundingClientRect: () => ({ top: 420 }),
    querySelector: (sel: string) => (sel === '[data-suppliers-body="find"]' ? findBody : null),
  };
  const g = globalThis as Record<string, unknown>;
  g.window = {
    scrollY: 100,
    dispatchEvent: (e: CustomEvent) => {
      if (e.type === BB_TAB_EVENT) sent.push(String(e.detail));
      return true;
    },
    scrollTo: (o: { top: number }) => scrolls.push(o),
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 0,
  };
  g.document = {
    querySelector: (sel: string) => (sel === '[data-budget-build-takeover]' ? root : sel === '.shell-topbar' ? bar : null),
  };
  g.getComputedStyle = () => ({ display: 'block' });
  g.MutationObserver = class {
    constructor(cb: () => void) {
      observer = cb;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  };
  return { sent, scrolls, fire: () => observer?.(), disconnected: () => disconnected };
}

test('Find already showing: Open asks the bus for Find and lands the shell under the bar at once', () => {
  const s = stage({ hidden: false });
  openFind();
  assert.deepEqual(s.sent, ['shortlist']);
  assert.equal(s.scrolls.length, 1, 'the press moved nothing');
  assert.equal(s.scrolls[0]!.top, 420 + 100 - 60, 'the shell does not land under the bar');
});

test('another body showing: Open waits for the shell to show Find, then lands once', () => {
  const body = { hidden: true };
  const s = stage(body);
  openFind();
  assert.deepEqual(s.sent, ['shortlist']);
  assert.equal(s.scrolls.length, 0, 'it scrolled before Find showed (the shell would scroll it back)');
  s.fire();
  assert.equal(s.scrolls.length, 0);
  body.hidden = false;
  s.fire();
  assert.equal(s.scrolls.length, 1, 'Find showed and nothing moved');
  assert.ok(s.disconnected(), 'the watch is left running');
});
