/**
 * A WAKE IS NOT "INVITED" (2026-09-24 — found by a design pass, verified by
 * rendering before the fix).
 *
 * `invitationCard` returns null for the solemn register so a funeral keeps its
 * quiet masthead. But the quiet masthead's eyebrow was `PahinaMasthead`'s
 * DEFAULT — 'You are invited' — and none of site-body's mounts passed one, so a
 * wake's first screen read "№ 01 · You are invited". Same disease the rest of
 * the-wake-never-celebrates.test.ts fences: a celebratory word reaching a
 * mourner through a default nobody wired.
 *
 * Asserts the PROPERTY on rendered markup, not a phrasing in source: whatever a
 * future edit names the eyebrow, no invitation/celebration word may reach a
 * solemn masthead on either branch (hero media · text-only).
 *
 * 🪤 `globalThis.React` before the dynamic import (tsconfig `jsx: preserve`).
 * Run from inside this directory: `npx tsx --test ./the-wake-is-not-invited.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { eventWordsFromProfile } from './event-words';
import { invitationCard, mastheadEyebrow } from './invitation-card';
import { WAKE_PROFILE, WEDDING_PROFILE, GENERIC_PROFILE } from '@/lib/event-type-profile';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

/** Every word a wake must never be greeted with. */
const CELEBRATORY = /invit|celebrat|party/i;

/** Render the masthead exactly as site-body resolves its props, on both the
 *  hero-media branch and the text-only branch, and return the visible text. */
async function renderMastheads(profile: typeof WAKE_PROFILE): Promise<[withMedia: string, textOnly: string]> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../_components/pahina-masthead');
  const words = eventWordsFromProfile(profile);
  const card = invitationCard({ words, firstStartAt: '2026-10-01T19:00:00+08:00' });
  const common = {
    eyebrow: mastheadEyebrow(words),
    displayName: 'Lola Remedios Santos',
    twoPeople: words.twoPeople,
    eventDate: '2026-10-01',
    venueName: 'St. Peter Chapels',
  };
  const withMedia = renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      ...common,
      mediaSlot: React.createElement('div', null, 'plate'),
      mediaCaption: 'St. Peter Chapels',
    }),
  );
  const textOnly = renderToStaticMarkup(
    React.createElement(PahinaMasthead, { ...common, card: card ?? undefined }),
  );
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return [text(withMedia), text(textOnly)];
}

test('a wake’s masthead carries no invitation or celebration word, on either branch', async () => {
  const [withMedia, textOnly] = await renderMastheads(WAKE_PROFILE);
  // Sanity: this IS the masthead, not an empty render that passes by default.
  assert.match(withMedia, /Lola Remedios Santos/);
  assert.match(textOnly, /Lola Remedios Santos/);
  assert.doesNotMatch(withMedia, CELEBRATORY, `hero-media masthead greets a wake: ${withMedia}`);
  assert.doesNotMatch(textOnly, CELEBRATORY, `text-only masthead greets a wake: ${textOnly}`);
});

test('🔒 every celebratory register still reads "You are invited" on the plain masthead', async () => {
  for (const profile of [WEDDING_PROFILE, GENERIC_PROFILE]) {
    const [withMedia] = await renderMastheads(profile);
    assert.match(withMedia, /You are invited/, `${profile.eventType} lost its eyebrow`);
  }
});

test('every site-body masthead mount resolves its eyebrow from the event’s words', () => {
  // 🚨 FAILS CLOSED — a walk, not a list. A fifth `<PahinaMasthead` written
  // without the prop takes the 'You are invited' default and greets a wake.
  const body = stripComments(
    readFileSync(join(__dirname, '..', '_components', 'site-body.tsx'), 'utf8'),
  );
  const mounts = body.split('<PahinaMasthead').length - 1;
  const wired = body.split('eyebrow={mastheadEyebrow(clientWords)}').length - 1;
  assert.ok(mounts > 0, 'site-body.tsx no longer mounts PahinaMasthead — has it moved?');
  assert.equal(
    wired,
    mounts,
    `site-body.tsx mounts the masthead ${mounts} times but resolves the eyebrow ${wired} ` +
      'times — an unwired mount falls back to "You are invited", including at a wake.',
  );
});
