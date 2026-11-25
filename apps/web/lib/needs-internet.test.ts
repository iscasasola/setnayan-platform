/**
 * GUARD — R15 "NEEDS INTERNET" (owner 2026-11-24): with no signal, a control that needs a connection stays in place,
 * greys out, says "Needs internet", is `aria-disabled`, and a press on it only says why. Back online, it is normal by
 * itself. This drives the REAL `startNeedsInternetGuard` against a small document (no DOM library is installed — the
 * fake below implements exactly the selectors the guard uses, and fails loudly on any other), with the browser's
 * `navigator.onLine` turned off and on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  NEEDS_INTERNET_ADDRESSES,
  NEEDS_INTERNET_ATTR,
  NEEDS_INTERNET_TAP,
  NEEDS_INTERNET_WORD,
  needsInternetHref,
  startNeedsInternetGuard,
} from './needs-internet';
import { guestHubSavePaths } from './offline-copies';
import { guestHubAddress } from './offline-copy-addresses';

// ── a small document ──────────────────────────────────────────────────────────────────────────────────────────────

type Listener = (e: FakeEvent) => void;

class El {
  attrs = new Map<string, string>();
  children: El[] = [];
  parent: El | null = null;
  classList: { contains: (c: string) => boolean };
  constructor(public tag: string, attrs: Record<string, string> = {}, kids: El[] = []) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    for (const k of kids) this.append(k);
    this.classList = { contains: (c) => (this.attrs.get('class') ?? '').split(/\s+/).includes(c) };
  }
  append(k: El) {
    k.parent = this;
    this.children.push(k);
    return k;
  }
  getAttribute(n: string) {
    return this.attrs.has(n) ? this.attrs.get(n)! : null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  matches(sel: string): boolean {
    return sel.split(',').some((s) => matchOne(this, s.trim()));
  }
  closest(sel: string): El | null {
    for (let e: El | null = this; e; e = e.parent) if (e.matches(sel)) return e;
    return null;
  }
  *walk(): Generator<El> {
    for (const c of this.children) {
      yield c;
      yield* c.walk();
    }
  }
  querySelectorAll(sel: string): El[] {
    return [...this.walk()].filter((e) => e.matches(sel));
  }
  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

/** `tag`, `.cls`, `[attr]`, `[attr="v"]` and one tag followed by attribute tests — nothing else. */
function matchOne(e: El, s: string): boolean {
  const m = /^([a-z]*)((?:\[[^\]]+\])*)(\.[a-z-]+)?$/i.exec(s);
  if (!m) throw new Error(`the fake document does not know the selector "${s}" — teach it, do not loosen the guard`);
  const [, tag, attrPart, cls] = m;
  if (tag && e.tag !== tag) return false;
  if (cls && !e.classList.contains(cls.slice(1))) return false;
  for (const a of (attrPart ?? '').match(/\[[^\]]+\]/g) ?? []) {
    const am = /^\[([a-z-]+)(?:="([^"]*)")?\]$/i.exec(a);
    if (!am) throw new Error(`the fake document does not know "${a}"`);
    if (!e.hasAttribute(am[1]!)) return false;
    if (am[2] !== undefined && e.getAttribute(am[1]!) !== am[2]) return false;
  }
  return true;
}

class FakeEvent {
  defaultPrevented = false;
  stopped = false;
  constructor(public type: string, public target: El, public submitter: El | null = null) {}
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.stopped = true;
  }
  stopImmediatePropagation() {
    this.stopped = true;
  }
}

function page() {
  const live = new El('a', { href: '?tab=live' });
  const reply = new El('a', { href: '/ana-ben/invite/reply' });
  const nestedReply = new El('a', { href: '/ana/ana-ben/invite/reply?x=1' });
  const gallery = new El('a', { href: '?tab=gallery' });
  const walk = new El('a', { href: '/ana-ben/venue?t=abc' });
  const table = new El('a', { href: '/ana-ben/find-my-table' }); // kept offline — never greyed
  const maps = new El('a', { href: 'https://maps.google.com/?q=venue' }); // the phone's own map app
  const lbl = new El('span', { class: 'lbl' });
  const maker = new El('a', { href: '/dashboard/S89E-0123456789/launch', class: 'ab' }, [lbl]);
  const play = new El('button', {});
  const watch = new El('div', { [NEEDS_INTERNET_ATTR]: '' }, [play]);
  const hide = new El('button', { [NEEDS_INTERNET_ATTR]: '' });
  const waiting = new El('button', { class: 'ab', 'aria-disabled': 'true', 'data-waiting': '' }, [new El('span', { class: 'lbl' })]);
  const submit = new El('button', { type: 'submit' });
  const form = new El('form', { [NEEDS_INTERNET_ATTR]: '' }, [submit]);
  const body = new El('body', {}, [live, reply, nestedReply, gallery, walk, table, maps, maker, watch, hide, waiting, form]);
  const html = new El('html', {}, [body]);
  const listeners: Record<string, Listener[]> = {};
  const doc = {
    documentElement: html,
    body,
    querySelectorAll: (s: string) => html.querySelectorAll(s),
    addEventListener: (t: string, fn: Listener) => void (listeners[`doc:${t}`] ??= []).push(fn),
    removeEventListener: (t: string, fn: Listener) => {
      listeners[`doc:${t}`] = (listeners[`doc:${t}`] ?? []).filter((f) => f !== fn);
    },
  };
  const win = {
    navigator: { onLine: true },
    location: { href: 'https://www.setnayan.com/ana-ben?tab=home' },
    addEventListener: (t: string, fn: Listener) => void (listeners[`win:${t}`] ??= []).push(fn),
    removeEventListener: (t: string, fn: Listener) => {
      listeners[`win:${t}`] = (listeners[`win:${t}`] ?? []).filter((f) => f !== fn);
    },
  };
  const said: string[] = [];
  const stop = startNeedsInternetGuard(doc as unknown as Document, win as never, (w) => void said.push(w));
  const fire = (type: 'online' | 'offline') => {
    win.navigator.onLine = type === 'online';
    for (const fn of listeners[`win:${type}`] ?? []) fn(new FakeEvent(type, html));
  };
  const press = (el: El) => {
    const ev = new FakeEvent('click', el);
    for (const fn of listeners['doc:click'] ?? []) fn(ev);
    return ev;
  };
  const send = (f: El, by: El) => {
    const ev = new FakeEvent('submit', f, by);
    for (const fn of listeners['doc:submit'] ?? []) fn(ev);
    return ev;
  };
  return { html, live, reply, nestedReply, gallery, walk, table, maps, maker, lbl, watch, play, hide, waiting, form, submit, fire, press, send, said, stop };
}

const greyed = (e: El) => e.getAttribute('aria-disabled') === 'true';

// ── the rule ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('online, nothing is touched: every control is exactly as the page drew it', () => {
  const p = page();
  for (const e of [p.reply, p.gallery, p.walk, p.maker, p.play, p.hide, p.submit]) {
    assert.equal(greyed(e), false, `${e.getAttribute('href') ?? e.tag} was greyed with signal`);
  }
  assert.equal(p.html.hasAttribute('data-sn-offline'), false);
  const ev = p.press(p.reply);
  assert.equal(ev.defaultPrevented, false, 'a press with signal was stopped');
  assert.deepEqual(p.said, []);
});

test('offline, every needs-internet control is aria-disabled, greyed and says "Needs internet" — by its address or its mark', () => {
  const p = page();
  p.fire('offline');
  assert.equal(p.html.hasAttribute('data-sn-offline'), true, 'the page does not know it is offline');
  for (const [name, e] of [['the reply', p.reply], ['the reply, nested address', p.nestedReply], ['the Gallery', p.gallery], ['the 3D walk', p.walk], ['the Maker', p.maker], ['Live Watch’s play', p.play], ['a privacy request', p.hide], ['the song request’s send', p.submit]] as const) {
    assert.equal(greyed(e), true, `${name} is not aria-disabled offline`);
  }
  assert.equal(p.reply.getAttribute('data-sn-ni-word'), NEEDS_INTERNET_WORD);
  assert.equal(p.reply.hasAttribute('data-sn-ni-grey'), true, 'the reply is not drawn grey');
  // An ActionButton wears the house waiting look, and its word gets the label.
  assert.equal(p.maker.hasAttribute('data-waiting'), true, 'the Maker button does not wear the waiting look');
  assert.equal(p.lbl.getAttribute('data-sn-ni-word'), NEEDS_INTERNET_WORD, 'the Maker button’s word does not say "Needs internet"');
  // A block (Live Watch) gets its label above it.
  assert.equal(p.watch.hasAttribute('data-sn-ni-block'), true);
  // What works offline is never greyed: a saved room, the phone's own map app, the arrival tabs.
  for (const [name, e] of [['find-my-table', p.table], ['Open in Maps', p.maps], ['the Live tab', p.live]] as const) {
    assert.equal(greyed(e), false, `${name} was greyed — it works with no signal`);
  }
});

test('offline, a press says the one quiet line and does nothing else; a submit is stopped too', () => {
  const p = page();
  p.fire('offline');
  for (const e of [p.reply, p.maker, p.play, p.hide]) {
    const ev = p.press(e);
    assert.equal(ev.defaultPrevented, true, `${e.getAttribute('href') ?? e.tag}: the press went through`);
    assert.equal(ev.stopped, true, 'a handler further down still ran');
  }
  assert.deepEqual([...new Set(p.said)], [NEEDS_INTERNET_TAP]);
  assert.equal(NEEDS_INTERNET_TAP, 'Needs internet · it works again when you’re back online');
  const sent = p.send(p.form, p.submit);
  assert.equal(sent.defaultPrevented, true, 'the form was sent with no signal');
  const ok = p.press(p.table);
  assert.equal(ok.defaultPrevented, false, 'a saved room was stopped offline');
});

test('back online it turns normal by itself — and only what the guard wrote is removed', () => {
  const p = page();
  p.fire('offline');
  p.fire('online');
  for (const e of [p.reply, p.gallery, p.walk, p.maker, p.play, p.hide, p.submit]) {
    assert.equal(greyed(e), false, `${e.getAttribute('href') ?? e.tag} stayed greyed after the signal came back`);
    assert.equal(e.hasAttribute('data-sn-ni-word') || e.hasAttribute('data-sn-ni-grey'), false);
  }
  assert.equal(p.maker.hasAttribute('data-waiting'), false, 'the Maker button stayed waiting');
  assert.equal(p.html.hasAttribute('data-sn-offline'), false);
  // A button that was ALREADY waiting (its own state) keeps it: the guard never removes what it did not write.
  assert.equal(p.waiting.getAttribute('aria-disabled'), 'true');
  assert.equal(p.waiting.hasAttribute('data-waiting'), true);
  assert.equal(p.press(p.reply).defaultPrevented, false, 'a press after the signal came back was still stopped');
  p.stop();
});

// ── the address list ──────────────────────────────────────────────────────────────────────────────────────────────

test('no address that needs internet is a page the guest’s saved copy keeps — the two lists never overlap', () => {
  for (const base of ['/ana-ben', '/ana/ana-ben']) {
    for (const p of guestHubSavePaths('/ana-ben', ['live', 'home', 'details', 'story'])) {
      const real = base === '/ana-ben' ? p : p.replace('/ana-ben', base);
      assert.ok(guestHubAddress(real), `${real} is not a kept address`);
      assert.equal(needsInternetHref(real, 'https://www.setnayan.com/'), false, `${real} is kept AND greyed`);
    }
  }
  assert.ok(NEEDS_INTERNET_ADDRESSES.length >= 7);
  // An app page whose second word looks like an event page's is not a guest door.
  assert.equal(needsInternetHref('/dashboard/0e0e0e0e-0000-4000-8000-000000000001/invite', 'https://www.setnayan.com/'), false);
  assert.equal(needsInternetHref('https://elsewhere.example/ana-ben/invite', 'https://www.setnayan.com/'), false, 'another site’s address was greyed');
  assert.equal(needsInternetHref('/dashboard/S89E-0123456789/launch', 'https://www.setnayan.com/'), true);
});

test('the guard is mounted on the guest Event Hub and on the couple’s offline pages — never in the dashboard layout', () => {
  const app = path.join(import.meta.dirname, '..', 'app');
  const read = (p: string) => readFileSync(path.join(app, p), 'utf8');
  for (const p of ['[slug]/layout.tsx', 'dashboard/[eventId]/page.tsx', 'dashboard/[eventId]/schedule/layout.tsx', 'dashboard/[eventId]/guests/checkin/page.tsx']) {
    assert.match(read(p), /<NeedsInternetGuard \/>/, `${p} does not mount the guard`);
  }
  // The Maker draws schedule/page.tsx whole and loads the dashboard layouts: the guard stays out of all three.
  for (const p of ['dashboard/layout.tsx', 'dashboard/[eventId]/layout.tsx', 'dashboard/[eventId]/schedule/page.tsx']) {
    assert.doesNotMatch(read(p), /NeedsInternetGuard/, `${p} carries the guard into the Maker's first load`);
  }
  // The explicit marks: Live Watch, the photo wall, the privacy requests, the song request.
  const marked = [
    '[slug]/_components/watch-live-block.tsx',
    '[slug]/_components/watch-live-embed.tsx',
    '[slug]/_components/roam-watch-picker.tsx',
    '[slug]/_components/live-wall-block.tsx',
    '[slug]/_components/face-data-notice.tsx',
    '[slug]/_components/face-tagging-row.tsx',
    '[slug]/_components/photos-of-you-gallery.tsx',
    '[slug]/_components/scan-trail-notice.tsx',
    '[slug]/_components/supplier-page-notice-line.tsx',
    '[slug]/_components/story/your-own-consent.tsx',
    '[slug]/_components/song-request-card.tsx',
  ];
  for (const p of marked) assert.match(read(p), /data-needs-internet=""/, `${p} lost its Needs-internet mark`);
});
