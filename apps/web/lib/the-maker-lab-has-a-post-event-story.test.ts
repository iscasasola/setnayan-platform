/**
 * the-maker-lab-has-a-post-event-story.test.ts — THE DEV MAKER LAB CAN OPEN THE POST EVENT PANEL.
 *
 * Controller, 2026-10-09: the lab handed the Maker `postEvent: null` and drew the Invitation for the Post Event
 * stage, so the Post Event panel could not be opened, seen or pressed without a database. The lab now has a story
 * (`app/dev/maker-lab/lab-post-event.ts`) — DEV-ONLY, nothing a real user can reach.
 *
 *   (1) THE STORY IS COMPILED, NOT TYPED — the day's facts through the REAL compiler and lister; it holds the scenes
 *       the Post Event stage's parts are (By the numbers · Wishes · Supplier Stories · Watch Live), drawn.
 *   (2) THE LAB'S DRAFT IS LAID OVER IT the way the real Maker lays the hub draft over the story (EXECUTED): a scene
 *       hidden is hidden, a scene moved is moved, a word written is read back — and a cookie nobody can parse is
 *       no draft, never a crash.
 *   (3) THE LAB WIRES IT — the page hands the story to the Maker; the save stand-in keeps the `editorial` keys; the
 *       canvas draws a stand-in per drawn scene behind the real page's own marker (`p:<scene>`).
 *
 * Mutations seen RED (2026-10-09), each restored: the page handing `postEvent: null` again → (3); the canvas marking
 * a scene `w:<key>` → (3); the draft not laid over (`labPostEventRead` ignoring it) → (2); a part's scene missing
 * from the facts (no wishes) → (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, makerPartsOnPage } from './maker-parts';
import { postEventMove, postEventSetWords, postEventShow, type PostEventDraft } from './post-event-draft';
import { postEventSceneDrawn } from './post-event-scenes';
import { labEditorialDraft, labPostEventRead } from '../app/dev/maker-lab/lab-post-event';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const cookie = (draft: PostEventDraft) => encodeURIComponent(JSON.stringify(draft));

test('(1) the story is compiled by the real compiler — and holds every scene the Post Event stage’s parts are, drawn', () => {
  const story = labPostEventRead(undefined);
  assert.equal(story.ok, true);
  assert.equal(story.dayHappened, true);
  assert.deepEqual(story.arrangement, { sections: {}, sectionOrder: null, sceneLooks: {}, customIds: [] });
  const drawn = new Set(story.rows.filter((r) => postEventSceneDrawn(r.status, r.hidden)).map((r) => `p:${r.key}`));
  // The parts the new Maker lets a couple tap on the Post Event stage's pages — each scene they stand on is there.
  const scenes = [...new Set(['home', 'film', 'suppliers', 'gallery'].flatMap((page) => makerPartsOnPage('editorial', page)))]
    .map((part) => MAKER_PARTS[part]?.canvas)
    .filter((c): c is string => typeof c === 'string' && c.startsWith('p:'));
  assert.ok(scenes.length >= 4, `anti-vacuity: only ${scenes.length} Post Event parts were found`);
  for (const c of scenes) assert.ok(drawn.has(c), `the lab’s story does not draw ${c} — its part could not be tapped`);
  // …and both kinds of place: one that is fixed (the cover) and several that move.
  assert.ok(drawn.has('p:cover'));
  assert.ok(story.rows.filter((r) => r.block && postEventSceneDrawn(r.status, r.hidden)).length >= 4);
  // Compiled, never typed: the lab file holds no scene list of its own.
  const lab = read('app/dev/maker-lab/lab-post-event.ts');
  assert.match(lab, /rows: postEventSceneList\(compilePostEventScenes\(LAB_POST_EVENT_SOURCES, LAB_STORY_WRITTEN_AT\), story\),/);
  assert.doesNotMatch(lab, /key: '(cover|wishes|numbers)'/, 'the lab types its own scenes');
});

test('(2) the lab’s draft is laid over the story as the real Maker lays the hub draft: hidden, moved, reworded — and junk is no draft', () => {
  const live = labPostEventRead(undefined);
  const at = (rows: typeof live.rows, key: string) => rows.find((r) => r.key === key)!;
  // Hidden.
  const hidden = labPostEventRead(labEditorialDraft(cookie(postEventShow(live.arrangement, 'kwento', false))));
  assert.equal(at(live.rows, 'wishes').hidden, false);
  assert.equal(at(hidden.rows, 'wishes').hidden, true, 'a scene hidden in the lab is still shown');
  assert.equal(at(hidden.rows, 'wishes').position, null);
  // Moved: one place earlier in the run the page draws.
  const order = (rows: typeof live.rows) => rows.filter((r) => r.position !== null).map((r) => r.key);
  const moved = labPostEventRead(labEditorialDraft(cookie(postEventMove(live.arrangement, 'wishes', -1)!)));
  assert.ok(order(moved.rows).indexOf('wishes') < order(live.rows).indexOf('wishes'), 'a scene moved earlier in the lab did not move');
  // Reworded: the couple's own heading is in the arrangement the panel is handed.
  const patch = postEventSetWords(live.arrangement, 'wishes', 'heading', 'What you told us') as PostEventDraft;
  assert.equal(labPostEventRead(labEditorialDraft(cookie(patch))).arrangement.sceneLooks.wishes?.words?.heading, 'What you told us');
  // A cookie nobody can parse is no draft.
  for (const junk of [undefined, '', '%E0%A4%A', 'not json', encodeURIComponent('[1,2]')]) {
    assert.deepEqual(labPostEventRead(labEditorialDraft(junk)).arrangement, live.arrangement, `junk (${String(junk)}) changed the story`);
  }
});

test('(3) the lab wires it: the page hands the story, the save stand-in keeps the story’s keys, the canvas marks each scene as the real page does', () => {
  const page = read('app/dev/maker-lab/page.tsx');
  assert.match(page, /const labPostEvent = labPostEventRead\(labEditorialDraft\(\(await cookies\(\)\)\.get\(LAB_EDITORIAL_COOKIE\)\?\.value\)\);/);
  assert.match(page, /buildMakerNavigatorData\(\{\s*postEvent: labPostEvent,/, 'the lab hands the Maker no Post Event story');
  const shell = read('app/dev/maker-lab/maker-lab-shell.tsx');
  assert.match(shell, /document\.cookie = `\$\{LAB_EDITORIAL_COOKIE\}=\$\{encodeURIComponent\(JSON\.stringify\(\{ \.\.\.held, \.\.\.patch\.editorial \}\)\)\}; path=\/; SameSite=Lax`;/, 'a Post Event press is forgotten at the next render');
  const guest = read('app/dev/maker-lab/guest/page.tsx');
  assert.match(guest, /\{phase === 'editorial' \? \(\s*<div className="sn-editorial" data-lab-post-event="">/);
  assert.match(guest, /\{r\.marker \? mark\(`p:\$\{r\.marker\}`\) : null\}/, 'a scene is not behind the real page’s own marker');
  // The day's chapters share ONE marker (they move together), as the navigator's tiles expect.
  assert.match(guest, /const marker = chapter \? \(chaptersMarked \? null : 'ch-1'\) : r\.key;/);
  assert.match(guest, /\.filter\(\(r\) => postEventSceneDrawn\(r\.status, r\.hidden\)\)/, 'a hidden scene is drawn on the lab’s canvas');
  // Dev only: the lab's pages 404 in production.
  assert.match(page, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
  assert.match(guest, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});
