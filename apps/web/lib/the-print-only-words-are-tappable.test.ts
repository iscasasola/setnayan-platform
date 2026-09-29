/**
 * the-print-only-words-are-tappable.test.ts — owner 2026-09-28 (approved via
 * the controller): the print-only words on a card — the opening line on The
 * Invitation, "Kindly reply" on The Finer Details — are edited by TAPPING them
 * on the card in the Details body; the right side shows that one field.
 *
 * The words are drawn as outlines inside one picture, so the picture cannot say
 * what was tapped. The layout records where each field landed
 * (`PrintDoc.fields`), the route sends it beside the picture (`x-print-fields`),
 * and the Details body lays a tap target over it. Held here: the box is where
 * the ink is — not a guess beside it — and it exists only when the words print.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { layoutPieceView, type PrintDoc, type PrintFieldBox, type PrintSetData } from './print-layout';
import { printLookFor } from './print-pieces';
import { stripComments } from './strip-comments';

function data(details: Partial<PrintSetData['details']>): PrintSetData {
  return {
    names: { first: 'Indalecio', second: 'Claire' },
    eyebrow: 'The wedding of',
    dateLabel: 'Friday · December 18, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: 'San Agustin Church',
    receptionTime: '5:00 PM',
    receptionVenue: 'The Manila Hotel',
    monogram: null,
    initials: 'I & C',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], ...details },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: 'setnayan.com/cale-ice',
    hasStill: false,
    hasEventQr: true,
  };
}

/** The bounding box of an absolute path (`M x y L … Q …`). */
function bbox(d: string) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Ink paths whose middle falls inside the box — and whether every one of them is wholly inside it. */
function inkIn(doc: PrintDoc, box: PrintFieldBox, fill?: string) {
  const inside = doc.ops
    .filter((o): o is Extract<typeof o, { t: 'path' }> => o.t === 'path' && (!fill || o.fill === fill))
    .map((o) => bbox(o.d))
    .filter((b) => {
      const my = (b.y0 + b.y1) / 2;
      return my >= box.y && my <= box.y + box.h && b.x0 >= box.x - 1 && b.x1 <= box.x + box.w + 1;
    });
  return inside;
}

for (const theme of ['house', 'vintage', 'velvet'] as const) {
  test(`${theme} · the opening line's box sits on its ink, and only when it prints`, () => {
    const look = printLookFor(theme);
    const line = 'Together with their families, we joyfully invite you to celebrate the beginning of our new life';
    const doc = layoutPieceView('invitation', { look, data: data({ openingLine: line }), mode: 'screen', foil: false });
    const box = doc.fields?.find((f) => f.field === 'opening_line');
    assert.ok(box, 'the opening line printed but cannot be tapped');
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= doc.w && box.y + box.h <= doc.h, 'the box leaves the card');
    const ink = inkIn(doc, box, look.muted);
    // Each printed line is one outline path; this line wraps to two.
    assert.ok(ink.length >= 2, `only ${ink.length} lines of the opening line fall in its box — the box is not on the words`);
    // Every muted glyph in the box's rows is inside the box (nothing of the line sticks out).
    for (const o of doc.ops) {
      if (o.t !== 'path' || o.fill !== look.muted) continue;
      const b = bbox(o.d);
      const my = (b.y0 + b.y1) / 2;
      if (my < box.y || my > box.y + box.h) continue;
      assert.ok(b.x0 >= box.x - 1 && b.x1 <= box.x + box.w + 1, 'a line of the opening line sticks out of its box');
    }
    const none = layoutPieceView('invitation', { look, data: data({}), mode: 'screen', foil: false });
    assert.equal(none.fields?.some((f) => f.field === 'opening_line') ?? false, false, 'a box over words that did not print');
  });

  test(`${theme} · "Kindly reply" on The Finer Details is tappable where it prints`, () => {
    const look = printLookFor(theme);
    const doc = layoutPieceView('details', { look, data: data({ rsvpContact: 'Claire Santos · 0917 555 0101' }), mode: 'screen', foil: false });
    const box = doc.fields?.find((f) => f.field === 'rsvp');
    assert.ok(box, 'the reply line printed but cannot be tapped');
    assert.ok(box.y + box.h <= doc.h && box.h > 8, 'the reply box is off the card or empty');
    // The "Kindly reply" heading and the reply line: two outline paths at least.
    assert.ok(inkIn(doc, box).length >= 2, 'the reply box is not on the reply words');
    const none = layoutPieceView('details', { look, data: data({}), mode: 'screen', foil: false });
    assert.equal(none.fields?.some((f) => f.field === 'rsvp') ?? false, false);
  });
}

test('the route sends the boxes beside every on-screen picture — SVG and sample JPEG', () => {
  const route = stripComments(readFileSync(join(__dirname, '..', 'app', 'api', 'hub-print', '[piece]', 'route.ts'), 'utf8'));
  assert.match(route, /'x-print-fields': JSON\.stringify\(\{ w: doc\.w, h: doc\.h, fields:/);
  assert.match(route, /previewCacheControl\(url\.searchParams\.get\('v'\)\), \.\.\.fieldsHeader\(view\)/, 'the SVG preview lost its boxes');
  assert.match(route, /mode === 'screen' && pieceView \? fieldsHeader\(pieceView\)/, 'the sample JPEG lost its boxes');
});
