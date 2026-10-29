/**
 * ✂ GUESTS' WORDS WRAP, NEVER CUT (owner, Guests prototype v15: "guest names NEVER ellipsized — wrap to 2–3 lines").
 * The R4 parts that still cut with `truncate` (an ellipsis): the Seats › List table headers, the count tiles' words,
 * the move sheet's guest name, the seat head's title beside its mode dropdown. Each now wraps (line-clamp + anywhere).
 * Anchored per element, so one surviving `truncate` is named.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));
const S = 'app/dashboard/[eventId]/seating/_components';

/** The class list of the element that draws `content`. */
function classOf(src: string, content: string): string {
  const at = src.indexOf(content);
  assert.notEqual(at, -1, `${content} moved — re-aim this guard`);
  const open = src.lastIndexOf('<', at);
  const m = /className="([^"]*)"/.exec(src.slice(open, at));
  assert.ok(m, `${content} has no className`);
  return m![1]!;
}

test('the Seats and March words a person reads wrap, never cut', () => {
  const faces = read(`${S}/seat-faces-list.tsx`);
  const tiles = read('app/dashboard/[eventId]/guests/_components/view-summary-cards.tsx');
  const phone = read(`${S}/seat-plan-phone.tsx`);
  const spots: [string, string, string][] = [
    ['the Seats › List table name', faces, '{label}</span>'],
    ['the main tile’s word', tiles, '{t.word}</span>'],
    ['a count tile’s word', tiles, "{t.value === null ? 'couldn’t read' : t.word}</span>"],
    ['the move sheet’s guest name', phone, '{fullName}</span>'],
  ];
  for (const [what, src, content] of spots) {
    const cls = classOf(src, content);
    assert.doesNotMatch(cls, /\btruncate\b|text-ellipsis|whitespace-nowrap/, `${what} is cut`);
    assert.match(cls, /line-clamp-\d/, `${what} has no wrap limit`);
  }
  const head = phone.slice(phone.indexOf('export function StudioSeatPlanHead('), phone.indexOf('export function StudioSeatPlanTools('));
  assert.doesNotMatch(head, /<h2 className="[^"]*\btruncate\b/, 'the seat head’s title is cut beside its mode dropdown');
});

test('a guest card’s name and its eyebrow wrap, never cut — on a seat’s card too (owner, live iPhone 2026-10-29)', () => {
  const col = read('app/_components/inspector/inspector-column.tsx');
  const title = /<h2\s+ref=\{headingRef\}[\s\S]*?className="([^"]*)"/.exec(col)?.[1];
  assert.ok(title !== undefined, 'the card title moved — re-aim this guard');
  assert.doesNotMatch(title!, /\btruncate\b|text-ellipsis|whitespace-nowrap/, `the card title is cut ("Rosario Bernaldo's +1 · T…"): ${title}`);
  assert.match(title!, /overflow-wrap:anywhere/, 'the card title has no wrap');
  const css = readFileSync(join(__dirname, '..', 'app/globals.css'), 'utf8');
  const eye = /\.sn-inspector-sheet \.sn-inspector-head \.sn-eye \{([^}]*)\}/.exec(css)?.[1];
  assert.ok(eye !== undefined, 'the card eyebrow rule moved — re-aim this guard');
  assert.doesNotMatch(eye!, /text-overflow:\s*ellipsis|white-space:\s*nowrap/, `the card eyebrow is cut ("GROOM'S…"): ${eye}`);
});
