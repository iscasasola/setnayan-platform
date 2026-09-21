/**
 * ONE SEAT LINK ON THE PASS (owner 2026-09-21: "custom QR is free").
 *
 * The pass card carried "Find my table" AND "Your seat pass" — two free doors
 * to one question. The seat pass is the one. And because the custom QR is
 * free, ownership alone says yes for every event, including kinds whose /seat
 * page is notFound(): the link must also ask whether the kind seats people and
 * whether seating is published.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const body = stripComments(readFileSync(join(__dirname, 'site-body.tsx'), 'utf8'));
const loaders = stripComments(readFileSync(join(__dirname, '..', '_lib', 'loaders.ts'), 'utf8'));

function passCard(): string {
  const start = body.indexOf('const passCard');
  assert.ok(start > 0, 'precondition: the pass card exists');
  const end = body.indexOf('</section>', start);
  assert.ok(end > start, 'precondition: the pass card closes');
  return body.slice(start, end);
}

test('the pass card holds exactly one seat link, to the personal seat pass', () => {
  const card = passCard();
  const seatLinks = (card.match(/\/seat\/claim\?t=/g) ?? []).length;
  const mapLinks = (card.match(/find-my-table/g) ?? []).length;
  assert.equal(seatLinks, 1, `one link to the seat pass (found ${seatLinks})`);
  assert.equal(mapLinks, 0, `no second seat door on the card (found ${mapLinks} find-my-table)`);
  assert.match(card, /Find my seat/);
});

test('the link asks the destination’s own questions, not just ownership', () => {
  const at = loaders.indexOf('const seatPassActive');
  assert.ok(at > 0, 'precondition: seatPassActive is computed');
  const expr = loaders.slice(at, loaders.indexOf(';', at));
  assert.match(expr, /seatingSurfaceEnabled/, 'a trip or a dinner has no seat page');
  assert.match(expr, /seatingPublished/, 'an unpublished plan has no seat to show');
});
