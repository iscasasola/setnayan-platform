/**
 * the-band-reads-what-the-host-typed.test.ts — the entourage march and the band's Song Desk (coordinator walk,
 * 2026-10-23; owner: "Keep what we have first and make them run smoothly").
 *
 *   ⓵ THE LAST LETTER IS SAVED. A playlist pick saves 600 ms after the last keystroke, but the save was built from the
 *      render that scheduled it — the value BEFORE that keystroke. The band read "Perfec" while the host's screen said
 *      "Perfect · Saved". The save reads the latest typed values; "Saved" is said only after a save landed.
 *   ⓶ A REFUSED READ IS NOT A FACT ABOUT THE COUPLE. The Song Desk drew a failed picks read as "they haven't picked
 *      any songs yet" and a failed repertoire read as "N requests you don't play yet"; with the vibes read and the
 *      picks not, it said "No songs named — they left the choices to you". Each now says it could not load.
 *   ⓷ The host's playlist page drew a failed picks read as eight empty moments and a tray of "unplaced" songs —
 *      inviting every song to be added twice.
 *   ⓸ The Maker's Wedding March drew a failed read as "Nobody walks yet. Give a guest a role…" to a host with a full
 *      march; its row said "Nobody walks yet" too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PICK_ROW = 'app/dashboard/[eventId]/studio/playlist/_components/playlist-pick-row.tsx';
const PLAYLIST_PAGE = 'app/dashboard/[eventId]/studio/playlist/page.tsx';
const DESK = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/song-desk.tsx';
const LOADERS = 'app/[slug]/_lib/loaders.ts';
const LOAD = 'app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx';
/* 🗂 R4: the march's "as drafted" builder is shared by the Maker and Guests › March. */
const AS_DRAFTED = 'lib/march-as-drafted.ts';
const PARTS = 'app/dashboard/[eventId]/launch/_components/details-your-event-parts.tsx';

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  // The body's brace closes the parameter list (and an optional plain return type) — never a destructuring `({`.
  const head = /\)(?:\s*:\s*[\w<>[\]., |']+)?\s*\{\n/.exec(src.slice(at));
  assert.ok(head, `${name} has no body brace`);
  const open = at + head.index + head[0].length - 2;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

test('⓵ a pick’s save sends the LATEST typed values, and says "Saved" only after one landed', () => {
  const src = read(PICK_ROW);
  const save = body(src, 'scheduleSave');
  const timer = save.slice(save.indexOf('setTimeout('));
  assert.match(timer, /latest\.current/, 'the save no longer reads the latest typed values');
  for (const stale of ['songLabel.trim()', 'artist.trim()', 'notes.trim()']) {
    assert.ok(!timer.includes(` ${stale}`) && !timer.includes(`(${stale}`), `the save reads the render's ${stale} — one keystroke behind`);
  }
  // every field writes the latest values before it schedules the save
  const edit = body(src, 'edit');
  assert.ok(edit.indexOf('latest.current =') < edit.indexOf('scheduleSave()'), 'the save is scheduled before the latest value is kept');
  const fields = src.match(/onChange=\{[^}]*\}/g) ?? [];
  assert.equal(fields.length, 3, 'the pick editor lost or gained a field — re-point this guard');
  for (const f of fields) assert.match(f, /edit\('(songLabel|artist|notes)'/, `a field schedules its own save: ${f}`);
  // "Saved" before any edit, or after a refusal, is a claim nothing made
  assert.doesNotMatch(src, /isPending \? 'Saving…' : 'Saved'/);
  assert.match(src, /saved === 'saved' \? 'Saved'/);
  assert.match(save, /setSaved\('failed'\)/);
});

test('⓶ the Song Desk never draws a refused read as what the couple did', () => {
  const src = read(DESK);
  const desk = body(src, 'SongDesk');
  assert.match(desk, /readEventSongRequests\(/, 'the desk reads the picks without knowing if the read failed');
  assert.match(desk, /readVendorSongs\(/, 'the desk reads the repertoire without knowing if the read failed');
  assert.doesNotMatch(desk, /fetchEventSongRequests\(|fetchVendorSongs\(/);
  assert.match(desk, /matchUnread\s*=\s*requestsRead\.failed\s*\|\|\s*repertoireRead\.failed/);
  assert.match(desk, /\{matchUnread \? \([\s\S]*?\) : \(\s*<Coverage /, 'Coverage is drawn over a refused read');
  for (const group of ['desk.gaps.length', 'desk.ready.length', 'desk.spare.length']) {
    assert.match(desk, new RegExp(`!matchUnread && ${group.replace(/\./g, '\\.')}`), `${group} is drawn over a refused read`);
  }
  // the running order: a failed picks read wins over a playlist that has only vibes
  const host = body(src, 'HostPlaylist');
  const failedFirst = host.indexOf('if (readFailed && !playlist.isEmpty)');
  assert.ok(failedFirst >= 0 && failedFirst < host.indexOf('if (playlist.isEmpty)'), 'moments are drawn over a failed picks read');
});

test('⓷ the host’s playlist page says a failed picks read, and offers nothing to add over it', () => {
  const src = read(PLAYLIST_PAGE);
  const gate = src.indexOf('{picksRaw.failed ? (');
  assert.ok(gate > 0, 'the page draws its slots whatever the picks read did');
  const tray = src.indexOf('<UnsortedTray');
  const slots = src.indexOf('<PlaylistSlotSection');
  assert.ok(tray > gate && slots > gate, 'the tray or the slots are drawn outside the failed-read gate');
  assert.equal(src.match(/<UnsortedTray/g)?.length, 1);
});

test('⓸ a failed march read is said in the Maker — never "Nobody walks yet"', () => {
  const loaders = read(LOADERS);
  assert.match(loaders, /if \(guestRes\.error\) \{[\s\S]{0,300}?return \{ walking: \[\], out: null, unread: true \};/, 'loadMarch answers a failed read as an empty march');
  const load = read(LOAD);
  const asDrafted = body(read(AS_DRAFTED), 'marchAsDrafted');
  assert.match(asDrafted, /if \(marchUnread\) return \{ \.\.\.live, draftUnread: true, marchUnread: true \};/);
  assert.match(load, /marchAsDrafted\([\s\S]*?draftedMarch,\s*marchUnread,\s*\)/, 'the loader drops the unread march');
  // 🗂 R4: Guests › March reads the same march and hands its unread on the same way (the maker then says so, with Retry).
  // (The read lives in lib/guests-march-read.ts since slice 8 — the March view and its PDF share it.)
  assert.match(read('lib/guests-march-read.ts'), /marchAsDrafted\([\s\S]*?drafted,\s*march\.unread === true,\s*\)/, 'Guests › March drops the unread march');
  assert.match(read('app/dashboard/[eventId]/guests/_components/guests-march.tsx'), /const shown = await readShownMarch\(/, 'Guests › March reads the march another way');
  const parts = read(PARTS);
  assert.match(parts, /march: input\.march\.marchUnread\s*\?\s*'Couldn’t load the march'/, 'the march row says "Nobody walks yet" over a failed read');
});
