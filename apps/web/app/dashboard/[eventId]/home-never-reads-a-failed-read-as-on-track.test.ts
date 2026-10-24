/**
 * home-never-reads-a-failed-read-as-on-track.test.ts — H3 of the Home redraw
 * (owner 2026-10-07, `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md`; Maker PR 4e).
 *
 * The defect it pins, measured on origin/main before the redraw: a guest read
 * that THREW reached `pickHomeNext` as `null`, fell through papic → ai → plan,
 * and the couple was told "You are on track — Nothing is waiting on you". A
 * money read that failed printed "—" quietly; a thrown read must never look
 * like success or like emptiness.
 *
 *   1 · a thrown guest read → the Today line says "Guests couldn't load · reload" and points at the Guests widget,
 *       never "Nothing waits on you" / "on track" (the Next card became the Today line, owner-approved 2026-10-24);
 *   2 · the Guests widget becomes ONE "Couldn't load" face with ⟳ Reload, never 0 — on the phone and from md up;
 *   3 · a failed money read is SAID on the Budget widget (not hidden like "not shared", never ₱0);
 *   4 · a thrown service read prints "—", never a zero count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { aiStatus, homeServices, papicStatus, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { count, drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

const READ: HomeNextInput = { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding', papicReady: false, aiOffer: false };
const UNREAD: HomeNextInput = { ...READ, guests: null };

/** The Home as the page draws it — `unread` = every read failed. */
function draw(unread: boolean, input: HomeNextInput = unread ? UNREAD : READ, over: Parameters<typeof drawHome>[0] = {}): string {
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
    ...over,
  });
}
/** What a person reads: the markup's text plus every aria-label / title. */
const words = (html: string) =>
  [html.replace(/<[^>]+>/g, ' '), ...(html.match(/(?:aria-label|title)="[^"]*"/g) ?? [])].join(' ');

test('1 · a thrown guest read is said on the Today line, pointing at Guests — never "on track"', () => {
  assert.equal(pickHomeNext(UNREAD).kind, 'unread');
  // Whatever else is waiting (Papic, the AI offer), an unread list comes first.
  assert.equal(pickHomeNext({ ...UNREAD, papicReady: true, aiOffer: true }).kind, 'unread');
  const html = draw(true);
  const at = html.lastIndexOf('<', html.indexOf('data-home-today='));
  const line = html.slice(at, html.indexOf('</button>', at));
  assert.match(line, /data-home-today="guests"/, 'the line does not point at the Guests widget');
  assert.match(line, /Guests couldn’t load/);
  assert.doesNotMatch(words(html), /You are on track|Nothing is waiting|Nothing waits on you/i, 'a failed read read as success');
});

test('2 · the Guests widget says it could not load — one face, with Reload, never 0', () => {
  const html = draw(true);
  for (const [marker, ends] of [
    ['data-home-tile="guests"', ['data-home-tile="hub"']],
    ['data-home-card-key="guests"', ['data-home-card-key="sup"']],
  ] as const) {
    const w = slice(html, marker, [...ends]);
    assert.match(w, /[Cc]ouldn’t load/, `${marker}: does not say it could not load`);
    assert.match(w, /aria-label="Reload"/, `${marker}: offers no Reload`);
    assert.doesNotMatch(w, />0</, `${marker}: an unread count printed as 0`);
    assert.doesNotMatch(w, /> coming</, `${marker}: a "coming" count drawn from a read that did not happen`);
  }
});

test('3 · a failed money read is said, not hidden and not ₱0', () => {
  const html = draw(true);
  const budget = slice(html, 'data-home-card-key="budget"', ['data-home-card-key="guests"']);
  assert.ok(budget.length > 0, 'the Budget widget vanished like "not shared"');
  assert.match(budget, /Money couldn’t load/);
  assert.doesNotMatch(budget.replace(/not zero|not ₱0/g, ''), /₱0/);
  // …while "not shared" (budget === null) is still absent, as it was.
  const hidden = draw(false, READ, { control: fixtureControl('e1', { budget: null }) });
  assert.equal(count(hidden, 'data-home-tile="budget"') + count(hidden, 'data-home-card-key="budget"'), 0);
});

test('4 · a thrown service read prints "—", never a zero count', () => {
  const html = draw(true);
  const row = html.slice(html.indexOf('data-home-services'));
  assert.equal(count(row, '>—<'), 2, 'Papic and Setnayan AI must each read "—"');
  assert.doesNotMatch(words(row), /\b0 (orders?|photos?)\b/);
});

test('the page hands a failed guest read to the picker as null — never as an empty list', () => {
  const page = src('page.tsx');
  assert.match(page, /guests: homeGuestsRead\(guests, guestsMeasured\),/);
  assert.match(page, /control=\{homeControl\}/, 'the measurements reach the render');
  assert.match(page, /money: moneyNow,/, 'the money read reaches the composer as read');
  assert.match(src('_components/home-control-faces.ts'), /i\.money === null\s*\?\s*'unread'/, 'a failed money read must arrive as "unread", not as no widget');
});
