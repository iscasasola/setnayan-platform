/**
 * GUARD — what Google's OAuth brand reviewer reads, read the way the reviewer reads it.
 *
 * WHY THIS EXISTS. On 2026-10-22 Google refused Setnayan's OAuth branding
 * verification on three counts (owner's Google Cloud screenshot):
 *   1. "/privacy does not have sufficient content … clearly and sufficiently
 *      detail your app's data collection and usage" — the page disclosed the
 *      YouTube and Drive connections in depth and said NOTHING about the data
 *      Sign in with Google hands us, which is the grant every user makes.
 *   2. "Your home page does not explain the purpose of your app" — the signed-out
 *      hero was a promise ("Plan your Filipino event free — and never lose a
 *      photo") with three fragments under it; no sentence said what the app does.
 *   3. "The app name 'Setnayan' … does not match the app name on your home page"
 *      — the hero's eyebrow was TYPED in capitals ("SETNAYAN", the variant
 *      already rejected on 2026-07-25) and the page's one <h1> never named the
 *      app at all. `home-brand-name.test.ts` pins the top bar's wordmark, and it
 *      was green the whole time: the bar is inside the ☰ drawer markup, which is
 *      not where a reviewer looks for the heading.
 *
 * 🔑 KEYED ON PROPERTIES OF THE RENDERED HTML, NOT ON SENTENCES. The hero and
 * the privacy page are RENDERED (renderToStaticMarkup — server HTML, no JS, the
 * shape a crawler gets) and the assertions read the output: the heading's text,
 * a paragraph that names the app and says what it does, the hrefs present, the
 * section's contents. A reworded sentence passes; a lost property fails.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const APP = import.meta.dirname;
const WEB = path.join(APP, '..');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#x27;|&#39;/g, '’')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
}

async function renderHero(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorAnchor } = await import('./_components/frontdoor/front-door-anchor');
  return renderToStaticMarkup(React.createElement(FrontDoorAnchor));
}

async function renderPrivacy(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: PrivacyPage } = await import('./(shell)/privacy/page');
  return renderToStaticMarkup(React.createElement(PrivacyPage));
}

/* ── the home page ─────────────────────────────────────────────────────── */

test('the signed-out home renders the hero as its heading', () => {
  const src = stripComments(readFileSync(path.join(APP, '_components/frontdoor/front-door.tsx'), 'utf8'));
  assert.match(
    src,
    /heading=\{\s*account\.signedIn\s*\?\s*undefined\s*:\s*<FrontDoorAnchor\s*\/>\s*\}/,
    'front-door.tsx no longer hands <FrontDoorAnchor /> to the shell as the signed-OUT heading. ' +
      'That hero is the home page a Google reviewer sees (signed out); if it moved, move this guard with it.',
  );
});

test('the home <h1> contains the exact app name "Setnayan" as text', async () => {
  const html = await renderHero();
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => textOf(m[1]));
  assert.equal(h1s.length, 1, `the hero must render exactly one <h1>; got ${h1s.length}`);
  assert.match(
    h1s[0],
    /\bSetnayan\b/,
    `The home page's <h1> reads "${h1s[0]}" — it must contain "Setnayan", typed in title case. ` +
      "Google's OAuth review matches the consent-screen app name against the home page; refused 2026-10-22.",
  );
  assert.doesNotMatch(
    textOf(html),
    /\bSETNAYAN\b/,
    'The hero types the name in capitals. "SETNAYAN" is the variant Google rejected (2026-07-25); ' +
      'type "Setnayan" and let CSS (text-transform) draw the capitals.',
  );
});

test('the home page says what the app does, in one sentence naming it', async () => {
  const html = await renderHero();
  const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
  const PURPOSE = [/\bevents?\b/i, /\bguests?\b/i, /\bRSVPs?\b/, /\bsuppliers?\b/i, /\bEvent Hub\b/, /\bphotos?\b/i];
  const purpose = paras.find(
    (p) => /\bSetnayan is\b/.test(p) && PURPOSE.filter((re) => re.test(p)).length >= 4,
  );
  assert.ok(
    purpose,
    'No paragraph in the hero says what Setnayan is and does ("Setnayan is …" naming at least four of: ' +
      'event, guests, RSVP, suppliers, Event Hub, photos). Google refused 2026-10-22: "Your home page does ' +
      `not explain the purpose of your app." Paragraphs found: ${JSON.stringify(paras)}`,
  );
  assert.doesNotMatch(purpose, /\b(website|site|celebrations?)\b/i, 'House words: "Event Hub", "event".');
});

test('the home page links the Privacy Policy and the Terms', async () => {
  const hrefs = hrefsOf(await renderHero());
  for (const want of ['/privacy', '/terms']) {
    assert.ok(
      hrefs.includes(want),
      `The signed-out hero has no link to ${want} (found ${JSON.stringify(hrefs)}). The drawer's small ` +
        'print is off-screen on a phone; Google requires the home page to link the privacy policy.',
    );
  }
});

test("the home page's <title> starts with the app name", () => {
  const src = stripComments(readFileSync(path.join(APP, 'page.tsx'), 'utf8'));
  const m = /const HOME_TITLE\s*=\s*'([^']+)'/.exec(src);
  assert.ok(m, 'HOME_TITLE is gone from app/page.tsx');
  assert.match(m[1], /^Setnayan\b/, `The home <title> "${m[1]}" must lead with "Setnayan".`);
  assert.match(src, /title:\s*HOME_TITLE/, 'app/page.tsx metadata no longer uses HOME_TITLE as its title.');
});

/* ── /privacy ──────────────────────────────────────────────────────────── */

function googleSection(html: string): string {
  const m = /<section\b[^>]*\bid="google-user-data"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(
    m,
    '/privacy has no <section id="google-user-data">. Google refused 2026-10-22 because the policy did not ' +
      'detail the Google user data we receive; that section is the answer and its anchor is what we hand them.',
  );
  return m[1];
}

test('/privacy has a "Google user data" section saying what we get, why, who sees it, and how to delete it', async () => {
  const html = await renderPrivacy();
  const sec = googleSection(html);
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(sec);
  assert.ok(h2 && /Google user data/i.test(textOf(h2[1])), 'the section must be headed "Google user data"');

  const text = textOf(sec);
  const needs: [RegExp, string][] = [
    [/\bname\b/i, 'the name we receive'],
    [/\bemail address\b/i, 'the email address we receive'],
    [/\bprofile photo\b/i, 'the profile photo we receive'],
    [/\bdo not sell\b/i, 'that we do not sell it'],
    [/\badvertising\b/i, 'that it is not used for advertising'],
    [/\bSupabase\b/, 'who processes it (Supabase, our sign-in/database provider)'],
    [/\bLimited Use\b/, 'the Limited Use statement'],
    [/\bdelete\b/i, 'how to delete it'],
  ];
  for (const [re, what] of needs) assert.match(text, re, `"Google user data" no longer states ${what}.`);

  const hrefs = hrefsOf(sec);
  assert.ok(
    hrefs.includes('https://developers.google.com/terms/api-services-user-data-policy'),
    'the section must link the Google API Services User Data Policy',
  );
  assert.ok(hrefs.includes('/dashboard/profile'), 'the section must link the real delete-account page (/dashboard/profile)');
  assert.ok(
    /<a\b[^>]*href="#google-user-data"/.test(html),
    '"What we collect" must point at the Google user data section',
  );
});

test('every in-page link on /privacy lands on an id that exists', async () => {
  const html = await renderPrivacy();
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const frags = hrefsOf(html).filter((h) => h.startsWith('#')).map((h) => h.slice(1));
  assert.ok(frags.length >= 5, `expected the Google section's in-page links; found ${frags.length}`);
  const missing = frags.filter((f) => !ids.has(f));
  assert.deepEqual(missing, [], `/privacy links to #${missing.join(', #')} but no element carries that id`);
});

/* ── the sign-in scopes the section discloses ──────────────────────────── */

/** Each `signInWithOAuth({ … })` argument object in a file, brace-matched. */
function oauthCalls(file: string): string[] {
  const src = stripComments(readFileSync(path.join(WEB, file), 'utf8'));
  const out: string[] = [];
  let at = src.indexOf('signInWithOAuth(');
  while (at !== -1) {
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}' && --depth === 0) {
        out.push(src.slice(open, i + 1));
        break;
      }
    }
    at = src.indexOf('signInWithOAuth(', at + 1);
  }
  return out;
}

test('Sign in with Google asks for the default scopes only — the ones /privacy names', async () => {
  const calls = ['app/auth/oauth-actions.ts', 'lib/native-oauth.ts'].flatMap(oauthCalls);
  assert.ok(calls.length >= 2, `expected both signInWithOAuth calls (web + app); found ${calls.length}`);
  for (const c of calls) {
    assert.doesNotMatch(
      c,
      /\bscopes\s*:/,
      'A signInWithOAuth call now passes `scopes`. /privacy § Google user data discloses only the default ' +
        '`email` + `profile` grant — update that section (and the OAuth consent screen) in the same change.',
    );
  }
  const sec = googleSection(await renderPrivacy());
  const codes = [...sec.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/g)].map((m) => textOf(m[1]));
  for (const s of ['email', 'profile']) assert.ok(codes.includes(s), `the section must name the \`${s}\` scope`);
});
