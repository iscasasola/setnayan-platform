/**
 * 🃏 FIND'S SEARCH SAYS THE DISTANCE IN CARD 14'S WORDS — "about N km from your venue".
 *
 * Owner, 20 Nov 2026 (DECISION_LOG "CARD 14 v4 APPROVED" → closed *"straight line, about X km"*; BUILD_RULES §2:
 * *"Distance reads 'about N km from your venue'"*). Find's cards said it from the day card 14 shipped, but three presses
 * in the same Find column — "See all", "✓ Done · Search again" and a liked photo's "Find who" — open the category
 * search overlay, and its rows still printed the bare "12.3 km". When no venue is set the search measures from the
 * Region's centre, and a bare number then read as a distance from a venue the couple never named.
 *
 * So: the search says WHAT it measured from (`distanceFromVenue`, the same reception anchor as the page's `askVenue`),
 * and the overlay speaks through the one helper — the venue's km → `aboutKmLine`; the Region's → the card's own
 * "Set your venue to see distance". Never a bare `{r.distanceKm} km`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { aboutKmLine, SET_YOUR_VENUE_LINE } from '@/lib/mall-card';

const WEB = join(import.meta.dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const OVERLAY = 'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx';
const ACTION = 'app/dashboard/[eventId]/vendors/_actions/category-search.ts';

test('the words are the card’s: about N km from your venue, never 0 km', () => {
  assert.equal(aboutKmLine(12.3), 'about 12 km from your venue');
  assert.equal(aboutKmLine(0.4), 'under 1 km from your venue');
  assert.equal(aboutKmLine(null), null);
  assert.equal(SET_YOUR_VENUE_LINE, 'Set your venue to see distance');
});

test('the search says whether its km were measured from the venue (the page’s askVenue anchor)', () => {
  const a = src(ACTION);
  assert.match(a, /distanceFromVenue\?: boolean;/, 'the result no longer carries distanceFromVenue');
  assert.match(
    a,
    /hasReceptionCoords: hasCoords,\s*distanceFromVenue: anchors\.reception != null,/,
    'distanceFromVenue is no longer the reception anchor (the one the page reads for askVenue)',
  );
});

test('the overlay speaks through the one helper, never a bare number of km', () => {
  const o = src(OVERLAY);
  assert.match(o, /import \{ aboutKmLine, SET_YOUR_VENUE_LINE \} from '@\/lib\/mall-card';/);
  assert.match(o, /setFromVenue\(res\.distanceFromVenue === true\)/, 'the overlay stopped reading what the km were measured from');
  assert.match(o, /r\.distanceKm !== null && fromVenue \? \([\s\S]{0,200}\{aboutKmLine\(r\.distanceKm\)\}/, 'a venue distance is not said in card 14’s words');
  assert.match(o, /r\.distanceKm !== null \? \(\s*<span>\{SET_YOUR_VENUE_LINE\}<\/span>/, 'a Region-centre distance is no longer turned into the ask for a venue');
  assert.doesNotMatch(o, /\{r\.distanceKm\} km/, 'the overlay prints a bare "N km" again');
});
