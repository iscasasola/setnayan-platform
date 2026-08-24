/**
 * The "check your email" screen is no longer a dead end — and the plus-one who
 * names themselves stops being called "+ TBA".
 *
 * ── ITEM 3 · THE PRODUCT INVERTED ITS OWN REWARD ────────────────────────────
 * This page carried NO link of any kind. Its only pressable thing was the
 * wordmark in the shared shell, which goes to the marketing site. Meanwhile the
 * same server action, one `if (email)` branch away, redirects a guest who
 * DECLINES to give an address straight onto `/{slug}`. The person who asked for
 * an account got the worse ending than the person who did not.
 *
 * ⚖ Stated honestly: the emailed link does eventually land them on the
 * celebration, so this was "the way back is minutes away when it should be one
 * tap away", not "they can never get in".
 *
 * ⚠ THE GATE IS THE INTERESTING PART. The link renders only when the caller
 * holds a guest session FOR THIS EVENT — not merely when a slug exists.
 * Otherwise the route becomes a UUID → public-address resolver on a page that
 * discloses nothing today, and paints the action colour for a visitor it has
 * never established will be admitted (a private event would hand them a lock
 * screen — the same class of lie the fix removes).
 *
 * ── ITEM 9 (partial) · A NEW DEFECT FOUND IN THE SHIPPED HALF ───────────────
 * `/welcome` lets a plus-one type their own name, and shipped WITHOUT clearing
 * `display_name`. An unnamed +1 is minted with
 * `display_name: '+ TBA · brought by {first}'`, and `guestDisplayName` PREFERS
 * display_name over first/last — so the screen whose entire job is to replace
 * that placeholder left it standing on the seating chart, the emcee script and
 * the guest list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..', '..');
const read = (p: string) => readFileSync(resolve(WEB, p), 'utf8');
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const PAGE = strip(read('app/join/[eventId]/check-email/page.tsx'));
const WELCOME = strip(read('app/[slug]/welcome/actions.ts'));

// ── Item 3 ──────────────────────────────────────────────────────────────────

test('the screen offers a way into the celebration', () => {
  assert.ok(PAGE.includes('Open your invitation'), 'the door back in is missing');
  assert.match(PAGE, /href=\{`\/\$\{slug\}`\}/, 'the link does not point at the event');
});

test('🔒 the link is gated on a guest session for THIS event', () => {
  // Not on slug-non-null. Without this the page resolves a UUID to a public
  // address for anyone who can guess the URL.
  assert.ok(
    /session\?\.event_id === eventId/.test(PAGE),
    'the link is not gated on the session matching this event',
  );
  const gate = PAGE.indexOf('session?.event_id === eventId');
  const query = PAGE.indexOf(".from('events')");
  assert.ok(gate > -1 && query > gate, 'the event is looked up before the session is checked');
});

test('the destination comes from the database, never from the caller', () => {
  // Accepting `?slug=` would re-open the open-redirect lesson /[slug]/redeem
  // already paid for, and would be four edits instead of one.
  // ⚠ The first cut of this assertion was `!/searchParams[\s\S]{0,120}slug/`,
  // which fired on the innocent `let slug` sitting a few lines under the
  // `searchParams` type. A guard that cries wolf teaches you to skim past the
  // one time it is right — so it now checks the two things that actually
  // matter: the query-string CONTRACT, and where the value is read from.
  const props = PAGE.slice(PAGE.indexOf('searchParams: Promise<'), PAGE.indexOf('>;', PAGE.indexOf('searchParams: Promise<')));
  assert.ok(!/slug/.test(props), `searchParams accepts a slug: ${props}`);
  assert.ok(
    !/\(await searchParams\)\.slug|searchParams\)\.slug/.test(PAGE),
    'the slug is read out of the query string',
  );
  assert.ok(PAGE.includes(".from('events')"), 'the slug is not resolved from the database');
});

test('the dismissal and the invitation do not contradict each other', () => {
  // "You can close this tab" beside a button asking them to stay is two
  // instructions in one card. The reassurance stays; the dismissal goes.
  assert.ok(
    !/close this tab/i.test(PAGE),
    'the page still tells them to close the tab while offering a door',
  );
  assert.ok(
    /already on the guest list/i.test(PAGE),
    'the reassurance was dropped — that half was true and load-bearing',
  );
});

test("the sibling's /dashboard fallback is deliberately NOT copied", () => {
  // Right on `success`, whose visitor is signed in. This visitor is not, so
  // /dashboard bounces them to /login — a worse dead end than the original.
  assert.ok(!PAGE.includes('/dashboard'), 'the dashboard fallback was copied and will bounce to /login');
});

// ── Item 9, the shipped-half defect ─────────────────────────────────────────

test('a plus-one who names themselves stops being called "+ TBA"', () => {
  const at = WELCOME.indexOf('plus_one_name_confirmed_at');
  assert.ok(at > -1, 'the confirm write is gone');
  const body = WELCOME.slice(Math.max(0, at - 400), at + 200);
  assert.ok(
    /display_name:\s*null/.test(body),
    'display_name is not cleared — guestDisplayName prefers it, so the placeholder survives the rename',
  );
});

test('the placeholder is still MINTED — only the confirm clears it', () => {
  // The '+ TBA · brought by …' label is correct for a plus-one nobody has
  // named yet. This fix must not delete it at the source.
  const NEWACTION = strip(read('app/dashboard/[eventId]/guests/new/actions.ts'));
  assert.ok(
    /brought by/.test(NEWACTION),
    'the TBA placeholder was removed at the mint — an unnamed +1 now shows a blank name',
  );
});
