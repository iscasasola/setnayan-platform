/**
 * 🎵 LOOK › MUSIC › SOURCE ▾ "OUR MUSIC" — a couple picks a song from the list a
 * Setnayan admin uploads (owner 2026-10-08: *"background music is upload your
 * music or pick from our background music"*; the approved Look restudy § 2.3,
 * screens 13–14).
 *
 * THE PICK IS STORED IN THE COLUMN THE SONG ALREADY LIVES IN —
 * `events.site_bg_music_r2_key` holding a reference into `hub-music/`. No new
 * column: the guest page plays it through the shipped `BackgroundMusic` exactly
 * as it plays a couple's own song. What this file holds is everything that
 * choice leans on:
 *
 *   1. the reference is recognised, and nothing else passes for one;
 *   2. the draft accepts it and the guest page may serve it;
 *   3. a pick from Our music is free to use — the couple's OWN song stays Pro;
 *   4. deleting an event NEVER deletes a shared track's file;
 *   5. the form names a TRACK and the server looks the file up — a browser
 *      cannot hand it a file to play, and only a published track resolves;
 *   6. Apply admits the song only while its track is published, and says so in
 *      its own words when it is not;
 *   7. Source ▾ is one dropdown that writes nothing; the list loads lazily;
 *   8. the list says "couldn't load" for an unread list and "No music here yet."
 *      for an empty one — never one for the other;
 *   9. a track removed from the list keeps its file while an Event Hub plays it.
 *
 * 🛡 Sabotaged, each red then restored (the file backed up and copied back):
 *   • `isHubMusicRef` admits any media ref                     → 1 red;
 *   • the Our-music line removed from `eventItemIsPro`         → 3 red;
 *   • …and widened to every song (`!== null`)                  → 3 red (own song free);
 *   • `eventSiteMediaScope` widened to `hub-music/`            → 4 red;
 *   • the helper writes `formData.get('bg_music_track')` as-is → 5 red;
 *   • `.eq('is_published', true)` dropped from the lookup      → 5 red;
 *   • Apply's `|| r === ourSong` → `|| isHubMusicRef(r)`       → 6 red;
 *   • the Source pick made to submit the form                  → 7 red;
 *   • `our-music` imported by media-panels itself              → 7 red;
 *   • the unread list drawn as the empty one                   → 8 red;
 *   • the events read dropped from the sweep's resolver        → 9 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { hubMusicKeyFromRef, hubMusicRefForKey, isHubMusicRef, type HubMusicChoice } from './hub-music-ref';
import { isHubMusicKey } from './hub-music';
import { classifyHubDraft, emptyHubDraft, eventItemIsPro, planHubDraftApply, sanitizeHubDraftEventValue } from './hub-draft';
import { siteMediaServeRef } from './site-media-ref';
import { eventSiteMediaScope, planCleanupDelete } from './cleanup-delete-scope';
import { OurMusicSong } from '../app/dashboard/[eventId]/website/editor/_components/our-music';

// The component is plain JSX; under `tsx --test` that needs React in scope.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const EVENT = '11111111-2222-4333-8444-555555555555';
const OURS = 'r2://setnayan-media/hub-music/7c1e-Harana-Moonlit.m4a';
const OWN = `r2://setnayan-media/events/${EVENT}/site-music/9d2f-our-song.m4a`;

test('1 · a song is one of ours only when its reference sits in hub-music/', () => {
  assert.equal(hubMusicRefForKey('hub-music/7c1e-Harana-Moonlit.m4a'), OURS);
  assert.ok(isHubMusicRef(OURS));
  assert.equal(hubMusicKeyFromRef(OURS), 'hub-music/7c1e-Harana-Moonlit.m4a');
  assert.ok(isHubMusicKey(hubMusicKeyFromRef(OURS)), 'the key is one the admin side recognises');
  for (const not of [
    OWN,
    'r2://setnayan-media/hub-music/',
    'r2://setnayan-media/hub-music/../events/x/a.m4a',
    'r2://setnayan-media/hub-music//a.m4a',
    'r2://setnayan-thread-files/hub-music/a.m4a',
    `r2://setnayan-media/events/${EVENT}/hub-music/a.m4a`,
    'hub-music/a.m4a',
    'https://example.com/hub-music/a.m4a',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isHubMusicRef(not), false, String(not));
    assert.equal(hubMusicKeyFromRef(not), null, String(not));
  }
});

test('2 · the draft keeps the pick, and the guest page may serve it', () => {
  assert.equal(sanitizeHubDraftEventValue('site_bg_music_r2_key', OURS), OURS);
  assert.equal(siteMediaServeRef(OURS), OURS, 'the public media bucket — what `BackgroundMusic` is handed');
});

test('3 · a song from Our music is free to use; the couple’s own song stays Event Hub Pro', () => {
  for (const change of ['add', 'change'] as const) {
    assert.equal(eventItemIsPro('site_bg_music_r2_key', OURS, change), false, `ours · ${change}`);
    assert.equal(eventItemIsPro('site_bg_music_r2_key', OWN, change), true, `own · ${change}`);
  }
  // The other look columns are untouched by the song's rule.
  assert.equal(eventItemIsPro('landing_page_hero_video_r2_key', OURS, 'add'), true);

  // Through the whole plan, for a couple WITHOUT Pro: ours applies, own is held.
  const plan = (song: string) => {
    const draft = emptyHubDraft();
    draft.events.site_bg_music_r2_key = song;
    return planHubDraftApply(draft, { events: { site_bg_music_r2_key: null }, widgets: [] }, false);
  };
  const ours = plan(OURS);
  assert.deepEqual(ours.apply.map((i) => i.kind === 'event' && i.column), ['site_bg_music_r2_key']);
  assert.equal(ours.refused.length, 0);
  const own = plan(OWN);
  assert.equal(own.apply.length, 0);
  assert.deepEqual(own.refused.map((i) => i.kind === 'event' && i.column), ['site_bg_music_r2_key']);

  // Swapping an own song for one of ours is a change — and still free.
  const draft = emptyHubDraft();
  draft.events.site_bg_music_r2_key = OURS;
  const swap = classifyHubDraft(draft, { events: { site_bg_music_r2_key: OWN }, widgets: [] }).items;
  assert.deepEqual(swap.map((i) => [i.change, i.pro]), [['change', false]]);
});

test('4 · deleting an event never deletes a shared track’s file', () => {
  const scope = eventSiteMediaScope(EVENT);
  assert.deepEqual(planCleanupDelete(OURS, scope), { ok: false, reason: 'out_of_scope' });
  // The control: the couple's own song in that same column IS theirs to sweep.
  const own = planCleanupDelete(OWN, scope);
  assert.equal(own.ok, true);
});

test('5 · the form names a track; the server looks its file up, and only a published track has one', () => {
  const action = code('app/dashboard/[eventId]/website/site-chrome/actions.ts');
  const door = action.indexOf('if (isHubDraftWrite(formData)) {');
  const draftBranch = action.slice(door, action.indexOf('return draftEventsAndReturn(', door));
  assert.match(draftBranch, /await draftOurMusic\(supabase, formData, events\);/, 'the draft door takes an Our-music pick');
  const helper = action.slice(action.indexOf('async function draftOurMusic('), action.indexOf('export async function updateSiteChrome('));
  assert.match(
    helper,
    /const ourRef = picked \? await publishedHubMusicRef\(supabase, formData\.get\('bg_music_track'\)\) : null;\s*if \(ourRef\) events\.site_bg_music_r2_key = ourRef;/,
    'the pick is resolved on the server, and an unresolved pick writes no song',
  );
  assert.match(helper, /if \(!picked && !\(formData\.has\('bg_music_keep'\) && !formData\.has\('bg_music_url'\)\)\) return;/, 'a fresh upload in the same post is not overridden');
  assert.equal(action.slice(action.indexOf('return draftEventsAndReturn(', door)).includes('bg_music_track'), false, 'the live path never reads a posted track');
  assert.equal(
    action.split("formData.get('bg_music_track')").length - 1,
    1,
    'the posted track id goes to the lookup and nowhere else',
  );
  assert.match(helper, /events\.site_bg_music_enabled = formData\.get\('bg_music_enabled'\) === 'on';/, 'the switch is written with it');

  const reader = code('lib/hub-music-server.ts');
  const lookup = reader.slice(reader.indexOf('export async function publishedHubMusicRef('), reader.indexOf('export async function isPublishedHubMusicRef('));
  assert.match(lookup, /\.eq\('track_id', trackId\)\s*\.eq\('is_published', true\)/, 'published only — by filter, on top of RLS');
  assert.match(lookup, /return key && isHubMusicKey\(key\) \? hubMusicRefForKey\(key\) : null;/);
  const list = reader.slice(reader.indexOf('export async function fetchHubMusicChoices('), reader.indexOf('export async function publishedHubMusicRef('));
  assert.match(list, /\.eq\('is_published', true\)/);
  assert.match(list, /if \(error \|\| !data\) return \{ ok: false \};/, 'a refused read is not an empty list');
});

test('6 · Apply admits one of our songs only while its track is published, and says so when it is not', () => {
  const apply = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(
    apply,
    /const draftedSong = siteMediaServeRef\(current\.events\.site_bg_music_r2_key\);\s*const ourSong = \(await isPublishedHubMusicRef\(supabase, draftedSong\)\) \? draftedSong : null;/,
  );
  assert.match(apply, /parseClientRef\(r, eventMediaPolicy\(eventId\)\) !== null \|\| r === ourSong\);/, 'the ONE published ref — not any hub-music ref');
  const own = apply.indexOf("isHubMusicRef(item.value) && item.value !== ourSong) {");
  const held = apply.indexOf("held.push({ item, reason: 'song_off_the_list' });");
  const generic = apply.indexOf('!newMediaIsOwn(item.column, item.value)');
  assert.ok(own > 0 && held > own && generic > held, 'the song’s own reason is given before the generic one');

  const reader = code('lib/hub-music-server.ts');
  const check = reader.slice(reader.indexOf('export async function isPublishedHubMusicRef('));
  assert.match(check, /\.eq\('r2_key', key\)\s*\.eq\('is_published', true\)/);
  assert.match(check, /return !error && Boolean\(data\);/, 'fails closed');

  assert.match(code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx'), /song_off_the_list: 'is no longer on our music list — pick another song'/);
});

test('7 · Source ▾ is one dropdown that writes nothing, and the list is not in the Maker’s first load', () => {
  const panel = code('app/dashboard/[eventId]/website/editor/_components/media-panels.tsx');
  const source = panel.slice(panel.indexOf('data-music-source={source}'), panel.indexOf("{source === 'ours' && ("));
  assert.match(source, /<PickMenu\s+label="Music source"\s+value=\{source\}/);
  assert.match(source, /\{ key: 'ours', label: 'Our music', hint: 'Setnayan’s own songs, by mood · free to use' \}/);
  assert.match(source, /\{ key: 'yours', label: 'Your music', hint: 'A song from your phone' \}/);
  assert.match(source, /onPick=\{\(k\) => setSource\(k === 'ours' \? 'ours' : 'yours'\)\}/, 'a source pick only changes what is drawn');
  assert.doesNotMatch(source, /draftNow|requestSubmit/);

  // The panel reaches the list through its lazy stand-in, never the piece itself.
  assert.match(panel, /^import \{ OurMusicSong \} from '\.\/scene-styles-lazy';/m);
  assert.doesNotMatch(panel, /from '\.\/our-music'/, 'reached only through import()');
  // Comments are stripped by `code()`, so the chunk name is read from the raw file.
  const lazy = readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/scene-styles-lazy.tsx'), 'utf8');
  assert.match(
    lazy,
    /export const OurMusicSong = dynamic\(\s*\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/our-music'\)\.then\(\(m\) => m\.OurMusicSong\)/,
    'in the existing chunk — a new one grows every page’s runtime',
  );

  // The couple's own upload never shows one of OUR files as theirs.
  assert.match(panel, /currentValue=\{songIsOurs \? null : musicRef\}/);
  // A pick posts the track; the switch can still be saved when nothing is picked.
  assert.match(panel, /\{ourTrack \? <input type="hidden" name="bg_music_track" value=\{ourTrack\} \/> : null\}/);
  assert.equal(panel.split('name="bg_music_keep"').length - 1, 2);

  const page = code('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /fetchHubMusicChoices\(supabase\)/, 'read with the couple’s own client');
  assert.match(page, /ourMusic=\{ourMusic\.ok \? ourMusic\.choices : null\}/);
});

const choice = (over: Partial<HubMusicChoice>): HubMusicChoice => ({
  trackId: 'a0000000-0000-4000-8000-000000000001',
  ref: OURS,
  title: 'Harana - Moonlit',
  moodLabel: 'Harana',
  length: '3:04',
  previewUrl: 'https://media.example/harana.m4a',
  ...over,
});
const draw = (choices: readonly HubMusicChoice[] | null, currentRef: string | null) =>
  renderToStaticMarkup(React.createElement(OurMusicSong, { choices, currentRef, onPick: () => {} }));

test('8 · the Song row: unread says so, empty says so, a pick shows its title and mood with ▶', () => {
  const unread = draw(null, null);
  assert.match(unread, /role="alert"/);
  assert.match(unread, /Couldn’t load our music — refresh to try again\./);
  assert.doesNotMatch(unread, /No music here yet/);

  const empty = draw([], null);
  assert.match(empty, /No music here yet\./);
  assert.doesNotMatch(empty, /role="alert"/);
  assert.doesNotMatch(empty, /data-our-music-open/);

  const list = [choice({}), choice({ trackId: 'a0000000-0000-4000-8000-000000000002', ref: 'r2://setnayan-media/hub-music/x-Warm.m4a', title: 'Warm and Intimate', moodLabel: 'Warm and Intimate' })];
  const picked = draw(list, OURS);
  assert.match(picked, />Song</);
  assert.match(picked, /Harana - Moonlit · Harana/);
  assert.match(picked, /aria-label="Play Harana - Moonlit"/);

  const none = draw(list, null);
  assert.match(none, /Pick a song/);
  assert.doesNotMatch(none, /data-our-music-play/, 'nothing to play until a song is picked');

  const gone = draw(list, 'r2://setnayan-media/hub-music/removed.m4a');
  assert.match(gone, /A song no longer on our list/);
});

test('9 · a track removed from the list keeps its file while an Event Hub still plays it', () => {
  const server = code('lib/website-media-server.ts');
  const resolver = server.slice(server.indexOf('async function readHubMusicRefs('), server.indexOf('type LookupSource'));
  assert.match(resolver, /\.from\('events'\)\s*\.select\('site_bg_music_r2_key'\)\s*\.like\('site_bg_music_r2_key', `\$\{hubMusicRefForKey\(HUB_MUSIC_PREFIX\)\}%`\)/);
  assert.match(resolver, /if \(playingError\) \{\s*return \{\s*ok: false,/, 'an unread events list proves nothing — the file stays');
  assert.match(resolver, /const key = hubMusicKeyFromRef\(\(row as \{ site_bg_music_r2_key: string \| null \}\)\.site_bg_music_r2_key\);\s*if \(key\) keys\.add\(key\);/);
});
