/**
 * GUARD — a tour TITLE is plain text, so an HTML entity in one shows literally.
 *
 * 🚨 THIS SHIPPED TO PRODUCTION AND WAS THE FIRST THING A GUEST EVER READ.
 * `guest_welcome_v1`'s opening slide was authored `"You&rsquo;re invited"`, and
 * every guest opening their invitation link was greeted with the raw
 * `&rsquo;` on screen. It survived because **the body directly beneath it,
 * written the same way by the same hand, rendered correctly** — so the file
 * looked internally consistent and the mistake looked like the house style.
 *
 * 🔑 THE CAUSE IS A SPLIT CONTRACT ON ONE OBJECT. `guided-tour.tsx` renders
 * `{current.title}` as React text and `body` through
 * `dangerouslySetInnerHTML`. Same shape, same authoring, opposite escaping,
 * and nothing at the call site or in the type said so until now.
 *
 * ⚖ THE FIX IS NOT "REMOVE THE DANGEROUS RENDER." Two admin slides genuinely
 * carry `<code>` tags, so the body really is HTML. The asymmetry is legitimate;
 * it was only ever undocumented.
 *
 * ⚠ THIS GUARD IS DELIBERATELY ONE-SIDED. It polices titles ONLY. A body may
 * contain entities and tags — that is its contract — so asserting anything
 * about bodies here would fire on correct code, and a guard that cries wolf
 * teaches you to skim past the one time it is right.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS, TOUR_KEYS } from './tours';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Named entities plus numeric ones — `&#8217;` fails exactly the same way. */
const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]{1,9}|#\d{1,6}|#[xX][0-9a-fA-F]{1,5});/;

test('no tour title contains an HTML entity', () => {
  const offenders: string[] = [];
  let titlesChecked = 0;

  for (const key of TOUR_KEYS) {
    for (const [i, slide] of TOURS[key].slides.entries()) {
      titlesChecked += 1;
      const m = slide.title.match(ENTITY);
      if (m) offenders.push(`${key} slide ${i + 1}: "${slide.title}" contains ${m[0]}`);
    }
  }

  // Asserted so this can never quietly become a test of nothing — an empty or
  // renamed TOURS map would otherwise sweep zero slides and pass.
  assert.ok(titlesChecked >= 20, `expected 20+ tour slides, saw ${titlesChecked}`);
  assert.deepEqual(
    offenders,
    [],
    `these render the entity literally to the user:\n  ${offenders.join('\n  ')}`,
  );
});

test('no tour title contains an HTML tag either', () => {
  // Same contract, other half: a tag in a title shows as literal angle brackets.
  const offenders = TOUR_KEYS.flatMap((key) =>
    TOURS[key].slides
      .filter((s) => /<[a-zA-Z/]/.test(s.title))
      .map((s) => `${key}: "${s.title}"`),
  );
  assert.deepEqual(offenders, [], `tags in a plain-text title: ${offenders.join(', ')}`);
});

test('the guest tour greets people in English, not in markup', () => {
  // The exact regression, pinned by value. This is the sentence a guest reads
  // before anything else on the product.
  const first = TOURS.guest_welcome_v1.slides[0];
  assert.ok(first, 'the guest tour has no first slide');
  assert.equal(first.title, 'You’re invited');
  assert.ok(!first.title.includes('&'), 'the greeting must contain no ampersand at all');
});

test('title is still rendered as TEXT and body as HTML — the split this guard assumes', () => {
  // If someone makes the title dangerous too, the guard above stops protecting
  // anything and should be deleted rather than left as decoration. If someone
  // makes the BODY plain text, every body entity starts showing literally and
  // this file's whole premise has moved.
  const src = readFileSync(
    resolve(HERE, '..', 'app', '_components', 'guided-tour.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  assert.ok(
    src.includes('{current.title}'),
    'title is no longer rendered as plain text — re-read this guard before changing it',
  );
  assert.ok(
    src.includes('__html: current.body'),
    'body is no longer rendered as HTML — tour bodies carry entities and <code> tags',
  );
});
