/**
 * THE INVITATION TELLS THE TRUTH (owner 2026-08-21).
 *
 * The invitation page is how a host's guest list fills itself. So each of these
 * is pinned by ONE test: does it stop a guest completing their record, or make
 * us say something untrue while they decide whether to trust us?
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`
 * emits bare `React.createElement`), plus stubs for `.css` and `server-only`,
 * which this runner cannot resolve.
 *
 * ⚠ CODE-VERIFIED, NOT EYES-VERIFIED for the reply card: it renders only for a
 * signed-in guest and I do not sign in as one.
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
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

function read(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8');
}
/** apps/web/app/<parts> — `__dirname` is app/[slug]/_lib. */
function web(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', '..', ...parts), 'utf8');
}

// ── 1 · WE DO NOT PROMISE A DELETION WE DO NOT DO ───────────────────────────

test('the access card never promises a 3-day photo window', () => {
  // There is no 3-day mechanism anywhere in the product, and "delete"
  // contradicts the standing lock: photos are compressed, never deleted, and
  // the gallery is kept for life.
  const src = read('_components', 'tier-comparison-widget.tsx');
  const rendered = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // drop JSX comments
  assert.doesNotMatch(rendered, /3 days/, 'the 3-day promise is back');
  assert.doesNotMatch(
    rendered,
    /Photos delete|photos delete/,
    'the card tells guests their photos get deleted — we never delete a photo',
  );
});

test('and it says the thing that IS true, in the words the product already uses', () => {
  // ⚠ STRIP THE JSX COMMENTS FIRST. The comment above this copy EXPLAINS the
  // rule using the same words, so a raw match is satisfied by the explanation
  // even when the sentence a guest reads has been deleted. The mutation run
  // caught exactly that: removing the rendered line left this green.
  const src = read('_components', 'tier-comparison-widget.tsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\s+/g, ' ');
  assert.match(src, /winds down about a day after/, 'the honest replacement is gone');
  // The sibling card in the body says the same thing; if that wording ever
  // changes, these two must not drift into disagreeing about the same rule.
  assert.match(
    read('_components', 'site-body.tsx').replace(/\s+/g, ' '),
    /winds down about a day after/,
    'the sibling copy moved — the two cards now describe the same rule differently',
  );
});

// ── 2 · NO TAB EJECTS A GUEST FROM THE EVENT ────────────────────────────────
//
// 🛑 THE OBVIOUS FIX WAS THE WRONG ONE, AND A PRE-EXISTING TEST CAUGHT IT.
// The Camera tab renders LIVE for an unidentified visitor and lands on a page
// that refuses them. The tempting repair — require a guest session before the
// tab goes live — quietly repeals an owner ruling that site-nav.test.ts pins in
// as many words: "for everyone else the HOST'S SWITCH is the gate". The gate
// was never the defect. The DESTINATION was: its only way out went to
// Setnayan's marketing homepage, so one tap of one of five tabs took a guest
// off the celebration with no route back.
// So the gate is untouched and the link now carries the event.

/**
 * Strip comments before scanning source. THREE of this session's guards were
 * fooled by prose — a docblock that NAMES the string it forbids satisfies a raw
 * match, so the guard passes while the real thing is gone (or fails while it is
 * fine). If you are matching source, strip first.
 */
function code(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the camera link carries the event it was opened from', () => {
  const body = code(read('_components', 'site-body.tsx'));
  // ⚠ ANCHOR THE ROUTE'S END. A bare /papic/guest match also catches the
  // IMPORT of its own components (`@/app/papic/guest/_components/…`), which is
  // not a link at all — the first cut of this test failed on exactly that.
  const links = body.match(/\/papic\/guest(?![/\w])[^`'"\n]*/g) ?? [];
  assert.ok(links.length >= 2, `expected both camera destinations, found ${links.length}`);
  for (const l of links) {
    assert.match(
      l,
      /\?from=\$\{event\.slug\}/,
      `a camera link (${l}) does not carry the event — its refusal screen can only send the guest to Setnayan`,
    );
  }
});

test('the refusal sends them back to the invitation, not off the event', () => {
  const page = readFileSync(
    join(__dirname, '..', '..', 'papic', 'guest', 'page.tsx'),
    'utf8',
  );
  assert.match(page, /Back to the invitation/, 'the way back to the event is gone');
  assert.match(page, /href=\{`\/\$\{backSlug\}`\}/, 'the link no longer points at the event');
  // The homepage link survives ONLY as the fallback for a visit naming no event.
  assert.match(page, /backSlug \? \(/, 'the fallback and the real way back got collapsed');
});

test('…and the event it returns to is validated, never taken as a path', () => {
  // 🔒 It arrives in a query string on a PUBLIC page. Anything reaching an href
  // must be re-checked, or the most-shared link in the product is an open
  // redirect.
  const page = readFileSync(
    join(__dirname, '..', '..', 'papic', 'guest', 'page.tsx'),
    'utf8',
  );
  const guard = page.slice(page.indexOf('const backSlug'), page.indexOf('const session'));
  assert.match(guard, /\.test\(sp\.from\)/, 'the incoming value is not pattern-checked');
  assert.match(guard, /\^\[a-z0-9\]/, 'the pattern is not anchored — a path could slip through');
  assert.match(guard, /: null/, 'an unrecognised value must fall back to null, not through');
});

test('the owner ruling it nearly broke still holds', async () => {
  // Belt and braces: the ruling lives in site-nav.test.ts, but this file is
  // where the temptation to break it appears, so it is asserted here too.
  const { resolveSiteNav } = await import('./site-nav');
  for (const kind of ['public', 'guest'] as const) {
    const nav = resolveSiteNav({
      viewer: { kind },
      phase: 'day',
      hostAllowsCamera: true,
      anyChapterPublic: true,
      hasStory: true,
      hasDetails: true,
      liveBroadcast: false,
      destinations: { camera: '/papic/guest?from=x', watch: '/x/hub', join: '/x/invite' },
    } as never) as { key: string; state: string }[];
    assert.equal(
      nav.find((s) => s.key === 'camera')?.state,
      'live',
      `${kind} lost the camera — the host's switch is the gate (owner ruling)`,
    );
  }
});

// ── 3 · THE LABELS A GUEST SCANS ARE READABLE ───────────────────────────────

test('the chapter eyebrow WORDS are ink, not the decorative gold', () => {
  const css = web('globals.css');
  const rule = css.slice(css.indexOf('.sn-editorial .pahina-eyebrow {'));
  const block = rule.slice(0, rule.indexOf('}'));
  assert.doesNotMatch(
    block.replace(/\/\*[\s\S]*?\*\//g, ''),
    /color:\s*rgb\(var\(--color-gild\)\)/,
    'the eyebrow words are gold again — measured 3.37:1 on cream against a 4.5 floor',
  );
  assert.match(block, /color:\s*rgb\(var\(--color-ink\)/, 'the words lost their ink colour');
});

test('…and the metal stays on the parts that carry no meaning', () => {
  const css = web('globals.css');
  // The № numeral and the ✦ star are aria-hidden, so no reader ever reads them.
  assert.match(
    css,
    /\.sn-editorial \.pahina-eyebrow > \[aria-hidden='true'\][\s\S]{0,120}--color-gild/,
    'the numeral lost its gold — the fix was meant to MOVE the metal, not delete it',
  );
  // The rule line under the eyebrow is decoration too and keeps its gild.
  assert.match(css, /\.sn-editorial \.pahina-eyebrow::after[\s\S]{0,200}--color-gild/);
});

// ── 4 · NOBODY IS ASKED TO WRITE TO A STRANGER ──────────────────────────────

test('the note box addresses THIS event, not a sample couple', async () => {
  const src = read('_components', 'rsvp-widget.tsx');
  assert.doesNotMatch(
    src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''),
    /Maria &amp; Juan|Maria & Juan/,
    'every event is asking its guests to write to "Maria & Juan" again',
  );

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  const html = renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: {
        organizer: 'celebrant',
        theOrganizer: 'the celebrant',
        TheOrganizer: 'The celebrant',
        theOrganizerPossessive: 'the celebrant’s',
        TheOrganizerPossessive: 'The celebrant’s',
        eventWord: 'birthday',
        organizerIsHonoree: true,
      },
      guest: {
        guest_id: 'g-1',
        first_name: 'Ana',
        last_name: 'Cruz',
        display_name: 'Ana Cruz',
        rsvp_status: 'pending',
        meal_preference: null,
        dietary_restrictions: null,
        guest_note: null,
        qr_token: 't',
        photo_source: null,
        photo_url: null,
      },
      eventId: 'e-1',
      eventPublicId: 'S89E-X',
      faceMode: 'mode_b',
    } as never),
  );
  // ⚠ The apostrophe is HTML-escaped in the output (`&#x27;`), which is SIX
  // characters — a tight wildcard here fails on a placeholder that is correct.
  assert.match(
    html,
    /Anything you(?:&#x27;|’|')d like the celebrant to know/,
    'the placeholder ignores the event',
  );
  assert.doesNotMatch(html, /Juan/);
});
