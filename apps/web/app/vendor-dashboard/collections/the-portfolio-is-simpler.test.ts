/**
 * 🔒 THE PORTFOLIO IS SIMPLER (owner 2026-11-19, verbatim: *"simple (no header) just the way to cleanly access his
 * shop's photos"* · *"portfolio simpler approved"* · *"just one: show and sort"* · *"no word just icon"* ·
 * *"B · Sliders"*; drawing artifact 7SfMdJW9mryK59pm7bKa5A).
 *
 *   1 · NO HEADER — the photo band and its pinned row are gone; the house ⚙ sits at the right of Row 1's heading.
 *   2 · ROW 1 IS ALBUMS, in the Sort's order, through the ONE pure rule (`lib/portfolio-albums.ts`); an album that is
 *       not counted wears NO count (never a 0), and the ⓘ says why.
 *   3 · ONE ROUND in the thumb row — the sliders icon alone, named "Sort" — opens ONE dropdown: Show (a filter) then
 *       Sort. No second switch, no separate ＋ at rest: ＋ appears only when the words match nothing.
 *   4 · "MOST VIEWED" READS THE SHIPPED COUNTERS — never a new view table (CLAUDE.md rule 8); "Opened by you" is the
 *       one new table, written through RLS with no server action.
 *   5 · ⏭ THE SEARCH FIELD WAITS FOR THE MOTION LANE (#7792): today it is the shipped `ThumbRow` field. When the growing
 *       search icon lands, this row swaps to it — the TODO must stay until then, and nobody builds a second one here.
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `<SupplierHero` put back in the view (red: 1); `right={[`
 *   given a second menu (red: 3); `action={` made unconditional (red: 3); `rpc('service_card_opens'` → a select on a
 *   made-up `vendor_album_views` (red: 4); the TODO line deleted (red: 5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const VIEW = read('_components/portfolio-view.tsx');
const LIST = read('_components/collections-list.tsx');
const DATA = read('collections-data.ts');
const OPENS = read('../../../lib/portfolio-album-opens.ts');

test('1 · no header: no photo band, no pinned row — and the ⚙ is at the right of Row 1’s heading', () => {
  assert.doesNotMatch(VIEW, /<SupplierHero\b|useHeroPin|data-pinned-row|<PinWord\b/, 'the Portfolio has a header again');
  assert.match(VIEW, /gear=\{gear\}/, 'the view does not hand the ⚙ to Row 1');
  assert.match(VIEW, /<PortfolioSettings\b/, 'the ⚙ is not the shipped Portfolio settings sheet');
  assert.match(LIST, /data-portfolio-albums-row=\{sort\}[\s\S]{0,900}\{gear \? <span className="flex-none">\{gear\}<\/span> : null\}/, 'the ⚙ is not in Row 1’s heading row');
});

test('2 · Row 1 is the albums in the Sort’s order; an uncounted album wears no count, and the ⓘ says why', () => {
  assert.match(LIST, /const rowAlbums = sortAlbums\(\s*everyAlbum\.filter\(\(a\) => showKeepsAlbum\(show, a\.kind\) && albumMatches\(a, words\)\),\s*sort,\s*albumStats,\s*\);/, 'Row 1 is not sorted and filtered by the one rule (with the stats, so a half-read count never sorts)');
  assert.match(LIST, /sub=\{albumViewsLabel\(a\.views\)\}/, 'a tile’s count is not the one label (null → no badge)');
  assert.match(LIST, /\{ALBUM_UNCOUNTED_NOTE\}/, 'Row 1 does not say why some albums have no count');
  assert.match(LIST, /data-portfolio-all-albums=""/, 'the “All N albums” tile is gone');
  assert.equal((LIST.match(/data-portfolio-way=\{w\.key\}/g) ?? []).length, 1, 'the ways in are not one row template');
});

test('3 · ONE round — sliders, named Sort — opens Show then Sort; ＋ only when nothing matches', () => {
  const row = VIEW.slice(VIEW.indexOf('<ThumbRow'));
  assert.equal((row.match(/\bmenu: \[/g) ?? []).length, 1, 'the thumb row has more than one dropdown — owner: “just one: show and sort”');
  assert.match(row, /PORTFOLIO_SHOW_CHOICES\.map\([\s\S]*group: 'Show'[\s\S]*PORTFOLIO_SORT_CHOICES\.map\([\s\S]*group: 'Sort'/, 'the one dropdown is not Show, then Sort');
  assert.match(row, /label: 'Sort',/, 'the round’s name is not “Sort”');
  assert.match(row, /<SlidersHorizontal\b/, 'the round is not the sliders icon (owner: “B · Sliders”)');
  assert.doesNotMatch(row, /buttonText:/, 'the round carries a word — owner: “no word just icon”');
  assert.match(row, /\{on \? <i className="[^"]*rounded-full bg-terracotta" \/> : null\}/, 'no dot when the choice is not the default');
  assert.match(row, /action=\{\s*nothing && uploadFacts\s*\?/, 'the ＋ shows at rest — it belongs to “nothing matches” only');
  assert.doesNotMatch(row, /\bleft=\{/, 'a second control was added before the field');
});

test('4 · “Most viewed” reads the two shipped counters; the one new table is the shop’s own opens', () => {
  assert.match(DATA, /supabase\.rpc\('service_card_opens', \{ p_vendor_profile_id: vendorId \}\)/, 'service albums are not counted by the shipped card opens');
  assert.match(DATA, /pageViews: views === null \? null : portfolioRefs\.reduce\(/, 'the page album is not its photos’ shipped views, summed');
  assert.doesNotMatch(DATA + LIST + VIEW, /vendor_album_views|album_view_days/, 'a second view counter was added — the same fact counted twice');
  assert.match(DATA, /\.from\('vendor_album_opens'\)\.select\('album_kind, album_key, opened_at'\)/);
  assert.match(OPENS, /\.from\('vendor_album_opens'\)\s*\.upsert\(/, '“Opened by you” is not written');
  assert.doesNotMatch(OPENS, /['"]use server['"]/, 'the open is a server action — the export budget is at its ceiling');
  const migrations = join(HERE, '../../../../../supabase/migrations');
  assert.ok(existsSync(migrations), 'anti-vacuity: the migrations folder was not found');
  const mine = readdirSync(migrations).filter((f) => /_vendor_album_opens\.sql$/.test(f));
  assert.equal(mine.length, 1, 'the album opens migration is missing (or doubled)');
  const sql = readFileSync(join(migrations, mine[0]!), 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.vendor_album_opens FROM PUBLIC, anon, authenticated;/);
});

test('5 · the search field waits for the motion lane — the TODO stays until #7792’s field lands', () => {
  // Read WITH comments: the note IS the thing held.
  const view = raw('_components/portfolio-view.tsx');
  assert.match(view, /TODO\(#7792/, 'the swap-to-the-growing-search-icon note was removed — it stays until that component is used here');
  assert.match(VIEW, /import \{ ThumbRow \} from '@\/components\/thumb-row';/, 'the search is not the shipped ThumbRow field');
  assert.doesNotMatch(VIEW + LIST, /@keyframes|\.animate\(/, 'a search-grow motion was built here — it belongs to the motion lane');
});

test('6 · a half-read count and unread places are SAID (the review hold on #7998)', () => {
  assert.match(LIST, /\{albumRowHeading\(sort, albumStats\)\}/, 'the heading can claim "Most viewed" on half the counts');
  assert.match(DATA, /placesUnread: eventFacts === null \|\| lookLines === 'unread',/, 'a refused places read is not carried to the screen');
  assert.match(DATA, /return 'unread' as const;/, 'a failed look-lines read reads the same as "no looks"');
  assert.match(VIEW, /placesUnread=\{placesUnread\}/);
  assert.match(read('page.tsx'), /placesUnread=\{d\.placesUnread\}/, 'the page does not hand the unread state to the view');
  assert.match(LIST, /\{placesUnread && needle \? \(\s*<p role="status"[^>]*data-portfolio-places-unread="">\s*\{PLACES_UNREAD_LINE\}/, 'a place search misses its matches without a word');
});
