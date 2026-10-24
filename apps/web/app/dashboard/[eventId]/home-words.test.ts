/**
 * home-words.test.ts — H4 of the Home redraw (owner 2026-10-07; Maker PR 4e).
 * The couple's Home says "supplier" never "vendor", "event" never
 * "celebration", "Event Hub" never "website" — on what a person READS (text,
 * aria-label, title) in every state, and in every word `pickHomeNext` can say.
 * (`/vendors` in an href is a route, not a word, and is not read.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { aiStatus, homeServices, papicStatus, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { drawHome, loadHome } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

const READ: HomeNextInput = { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding', papicReady: false, aiOffer: false };
const UNREAD: HomeNextInput = { ...READ, guests: null };

/** The Home as the page draws it — `unread` = every read failed. */
function draw(unread: boolean, input: HomeNextInput = unread ? UNREAD : READ): string {
  const next = pickHomeNext(input);
  return drawHome({
    next,
    control: unread ? fixtureControlUnread('e1', { next }) : fixtureControl('e1', { next }),
    services: homeServices({
      next: 'plan',
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: unread ? 'failed' : { photosGathered: 0, preCapture: true } }),
      ai: aiStatus(unread ? null : false),
    }),
  });
}
/** What a person reads: the markup's text plus every aria-label / title. */
const words = (html: string) =>
  [html.replace(/<[^>]+>/g, ' '), ...(html.match(/(?:aria-label|title)="[^"]*"/g) ?? [])].join(' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

const BANNED = /\bvendors?\b|\bcelebrations?\b|\bweb ?sites?\b/i;

test('the rendered Home never says vendor, celebration or website', () => {
  for (const unread of [false, true]) {
    const html = draw(unread);
    assert.doesNotMatch(words(html), BANNED, unread ? 'failed state' : 'read state');
  }
});

test('no Next card says vendor, celebration or website', () => {
  const inputs: HomeNextInput[] = [
    READ,
    UNREAD,
    { ...READ, guide: { done: 1, total: 2, stageTitle: 'Invitation', stageDone: 0, stageTotal: 1, offer: true } },
    { ...READ, guide: { done: 1, total: 2, stageTitle: 'Invitation', stageDone: 0, stageTotal: 1 } },
    { ...READ, hasDate: false },
    { ...READ, hasDate: false, noun: 'event' },
    { ...READ, guests: { total: 0, unsent: 0 } },
    { ...READ, guests: { total: 1, unsent: 0 }, papicReady: true },
    { ...READ, guests: { total: 1, unsent: 0 }, aiOffer: true },
    { ...READ, guests: { total: 1, unsent: 0 } },
  ];
  for (const i of inputs) {
    const n = pickHomeNext(i);
    assert.doesNotMatch(`${n.title} ${n.body} ${n.action}`, BANNED, n.kind);
  }
});

test('the Home\'s own copy (source strings) says supplier, event, Event Hub', () => {
  for (const f of ['_components/home-first-screen.tsx', '_components/home-parts.tsx', '_components/home-control-row.tsx', '_components/home-tile.tsx', '_components/home-control-faces.ts']) {
    const text = src(f);
    const copy = (text.match(/>[^<{}]+</g) ?? []).join(' ') + ' ' + (text.match(/label[:=]\s*['"`][^'"`]*['"`]/g) ?? []).join(' ');
    assert.doesNotMatch(copy, BANNED, f);
  }
  // The money names where it opens: the widget IS Budget (owner 2026-10-24: "Paid-Balance : Budget"), its card titled so.
  assert.match(src('_components/home-control-row.tsx'), /budget: 'Budget',/, 'the Budget widget does not name its page');
});
