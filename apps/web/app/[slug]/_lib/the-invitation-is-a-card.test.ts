/**
 * THE INVITATION IS A CARD (owner 2026-09-21: "doesn't look like the event hub
 * we planned" — canvas "1 · Arrival").
 *
 * Protects: the card's words come from the event's own words (a birthday never
 * says "marriage", a funeral gets no card); both first screens — the
 * stranger's and the guest's — render it; the top bar is pinned so the corner
 * buttons never sit on the content; in-page jumps stop below that bar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationCard } from './invitation-card';
import { stripComments } from '@/lib/strip-comments';

const C = join(__dirname, '..', '_components');
const read = (p: string) => readFileSync(p, 'utf8');

test('a wedding reads like a wedding invitation, from its own words', () => {
  const card = invitationCard({
    words: { solemn: false, twoPeople: true, eventWord: 'wedding' },
    firstStartAt: '2026-12-18T13:30:00+00:00',
  });
  assert.ok(card);
  assert.equal(card.eyebrow, 'Together with their families');
  assert.equal(card.line, 'invite you to celebrate their wedding');
  assert.match(card.timeLabel ?? '', /^1:30\s?PM$/, 'the programme’s own clock, never shifted');
  assert.equal(card.hubHref, '#site-details');
});

test('other kinds say their own word; one person is not "their families"', () => {
  const debut = invitationCard({ words: { solemn: false, twoPeople: false, eventWord: 'debut' }, firstStartAt: null });
  assert.equal(debut?.eyebrow, 'You are invited');
  assert.equal(debut?.line, 'invites you to celebrate');
  assert.equal(debut?.timeLabel, null, 'no programme, no time — never invented');
  const bday = invitationCard({ words: { solemn: false, twoPeople: true, eventWord: 'birthday' }, firstStartAt: null });
  assert.doesNotMatch(bday?.line ?? '', /marriage|wedding/);
});

test('the solemn register gets no card at all', () => {
  assert.equal(invitationCard({ words: { solemn: true, twoPeople: false, eventWord: 'wake' }, firstStartAt: null }), null);
});

test('both first screens render the card, and the masthead has the card branch', () => {
  const body = stripComments(read(join(C, 'site-body.tsx')));
  const mounts = body.split('card={inviteCard ?? undefined}').length - 1;
  assert.equal(mounts, 2, `the stranger's and the guest's text-only mastheads (found ${mounts})`);
  const mast = stripComments(read(join(C, 'pahina-masthead.tsx')));
  assert.match(mast, /if \(card\) \{/);
  assert.match(mast, /border border-gild\/45/, 'the gold hairline frame');
  assert.match(mast, /data-motion="arrive-mark"[\s\S]{0,900}scale-\[1\.85\]/, 'the mark at card size');
});

test('the top bar is pinned, and jumps stop below it', () => {
  const shell = stripComments(read(join(C, 'invitation-shell.tsx')));
  assert.match(shell, /<header data-sticky-top className="sticky top-0 z-20/);
  assert.match(shell, /min-h-\[4rem\]/, 'tall enough for the corner buttons (0.75rem + 2.75rem)');
  const css = read(join(__dirname, '..', '..', 'globals.css'));
  assert.match(css, /html:has\(\[data-sticky-top\]\) \{\s*scroll-padding-top: 4\.5rem;/);
});
