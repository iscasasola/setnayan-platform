/**
 * the-front-door-tells-the-truth.test.ts — the signed-out hero says only what is true,
 * and its one button reaches the event-type choice.
 *
 * Owner, 2026-10-25, approving Option B of
 * `prototypes/ceremo_deltas_2026-10-25/01_front_door.html` and correcting it before it
 * shipped: *"don't they pay for papic?"* · *"unlimited camera but papic credits is
 * used"* · *"free 50 credits is only on their first event"* · *"DO NOT INVENT … we want
 * to tell the truth"* — and, on the button: *"for setnayan use our template"*.
 *
 * WHAT IT HOLDS, read from the RENDERED hero (renderToStaticMarkup — the HTML a stranger
 * and a crawler get), not from the source text:
 *   1. the headline is "Plan any event free. Every photo in one album." — the promise is
 *      ONE ALBUM, not free photos;
 *   2. neither the hero nor the home <title>/description says "never lose a photo" or
 *      "keep every photo" (both overpromise: photos use Papic credits);
 *   3. the Papic line is there and carries NO number (free credits are first-event only;
 *      an amount on the front door reads as per event);
 *   4. the main button reaches `/dashboard/create-event` — the app's one event-type
 *      picker — and not the wedding-only onboarding, and that page still renders the
 *      picker;
 *   5. the main button wears the house terracotta token (`--m-mulberry`), not the gold.
 *
 * 🛡 Comments are stripped before any source match (`lib/strip-comments.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const APP = path.join(HERE, '..', '..');

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#x27;|&#39;/g, '’')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function hero(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorAnchor } = await import('./front-door-anchor');
  return renderToStaticMarkup(React.createElement(FrontDoorAnchor));
}

const OVERPROMISE = /never lose (a|any|every)? ?photos?|keep every photo/i;

test('1 · the headline is the approved one', async () => {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(await hero());
  assert.ok(h1, 'the hero has no <h1>');
  const text = textOf(h1[1] ?? '');
  assert.match(
    text,
    /Plan any event free\. Every photo in one album\./,
    `The front-door headline reads "${text}". Owner 2026-10-25: "Plan any event free. Every photo in one album." ` +
      '(not "Keep every photo" — photos use Papic credits).',
  );
});

test('2 · no "never lose a photo" / "keep every photo" on the hero or the home <title>', async () => {
  assert.doesNotMatch(textOf(await hero()), OVERPROMISE, 'the hero overpromises the photos again');
  const home = stripComments(readFileSync(path.join(APP, 'page.tsx'), 'utf8'));
  for (const name of ['HOME_TITLE', 'HOME_DESCRIPTION']) {
    const m = new RegExp(`const ${name}\\s*=\\s*'([^']+)'`).exec(home);
    assert.ok(m, `${name} is gone from app/page.tsx — find it before changing this guard`);
    assert.doesNotMatch(m[1] ?? '', OVERPROMISE, `${name} overpromises the photos: ${JSON.stringify(m[1])}`);
  }
});

test('3 · the Papic line is there, and states no number', async () => {
  const html = await hero();
  const line = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => textOf(m[1] ?? ''))
    .find((p) => /Papic credits/.test(p));
  assert.ok(line, 'the hero lost "Unlimited cameras · photos use Papic credits."');
  assert.match(line, /Unlimited cameras/);
  assert.doesNotMatch(
    textOf(html),
    /\d+\s*(free\s*)?credits?/i,
    'the hero states a credit amount — free credits are first-event only (owner 2026-10-25); say no number here',
  );
});

function mainButton(html: string): { href: string; cls: string } {
  const a = /<a\b(?=[^>]*\bclass="([^"]*\bfd-opening-cta\b[^"]*)")(?=[^>]*\bhref="([^"]*)")[^>]*>/.exec(html);
  assert.ok(a, 'the hero has no main button (.fd-opening-cta)');
  return { cls: a[1] ?? '', href: (a[2] ?? '').replace(/&amp;/g, '&') };
}

test('4 · the main button reaches the event-type picker, not the wedding-only flow', async () => {
  const { href } = mainButton(await hero());
  const url = new URL(href, 'https://setnayan.com');
  const lands = url.pathname === '/signup' ? (url.searchParams.get('next') ?? '') : url.pathname;
  assert.equal(
    lands.split('?')[0],
    '/dashboard/create-event',
    `"Start your event — free" goes to ${href}. The page says "any event"; the button must reach the ` +
      'create-event type picker (directly, or through /signup?next=), never /onboarding/wedding alone.',
  );
  const picker = stripComments(readFileSync(path.join(APP, 'dashboard/(account)/create-event/page.tsx'), 'utf8'));
  assert.match(picker, /<EventTypePicker\b/, 'the create-event page no longer renders the event-type picker');
});

test('5 · the main button is terracotta (the house token), not the gold', async () => {
  const { cls } = mainButton(await hero());
  assert.match(cls, /\bfd-btn-terra\b/, `the main button's class is "${cls}" — it must be .fd-btn-terra`);
  assert.doesNotMatch(cls, /\bfd-btn-gold\b/, 'the main button still wears the gold');
  const css = readFileSync(path.join(HERE, 'front-door.css'), 'utf8');
  const rule = /^\.fd-btn-terra\s*\{([^}]*)\}/m.exec(css);
  assert.ok(rule, '.fd-btn-terra is gone from front-door.css');
  assert.match(rule[1] ?? '', /background:\s*var\(--m-mulberry\)/, '.fd-btn-terra must paint var(--m-mulberry)');
});
