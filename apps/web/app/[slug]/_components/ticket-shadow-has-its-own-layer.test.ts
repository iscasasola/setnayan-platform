import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TICKET_SHADOW_LAYER } from './ticket-picture';

/**
 * ⬛ THE TICKET'S SHADOW IS DRAWN ON ITS OWN LAYER (walk 2026-11-01, Event Hub › Me at 390).
 *
 * Safari (WebKit) painted a solid black square at the top-left of the Me page — white under dark mode — whenever a
 * ticket picture carrying `filter: drop-shadow` sat below the fold. Measured on /dev/me-lab by bisection: removing the
 * filter from the off-screen ticket alone removed the square; giving the picture its own compositing layer
 * (`translateZ(0)`) kept the shadow and removed the square.
 *
 * Property: in `ticket-picture.tsx`, every class list that carries a Tailwind `drop-shadow` also carries the layer, and
 * the layer is a 3D transform (what promotes the element). Not a phrasing check on the comment — comments are stripped.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(join(here, 'ticket-picture.tsx'), 'utf8'));

test('the layer is a 3D transform (promotes the picture to its own compositing layer)', () => {
  assert.match(TICKET_SHADOW_LAYER, /^\[transform:translateZ\(0(px)?\)\]$|^transform-gpu$/);
});

test('every drop-shadow class list in the ticket picture carries the layer', () => {
  const lists = [...src.matchAll(/className=\{?[`'"]([^`'"]*)[`'"]/g)].map((m) => m[1]!);
  const shadowed = lists.filter((l) => /(^|\s)drop-shadow(-|\s|$)/.test(l));
  assert.ok(shadowed.length > 0, 'the ticket picture should still draw its drop-shadow (or this guard is aimed at nothing)');
  for (const l of shadowed) {
    assert.ok(l.includes('${TICKET_SHADOW_LAYER}'), `a drop-shadow without its own layer: "${l.trim()}"`);
  }
});
