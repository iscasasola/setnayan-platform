/**
 * a-drawn-pick-never-rerenders-the-maker.test.ts — ⚡ A PICK THE CANVAS ALREADY
 * SHOWS NEVER RE-RENDERS THE MAKER.
 *
 * Owner, 2026-09-30: *"every edit alteration create forces the whole screen to
 * reload and sometimes take more than 10 seconds to change. when i pick
 * something. it does not interact realtime."* — the tester: the small top
 * line's text, the effects, the mark's − / + on every click, the joiner
 * (DECISION_LOG "THE MAKER RE-PLAN — SPEED FIRST").
 *
 * MEASURED from the code that day (`scratchpad/maker-speed/MEASURE.md`): each
 * of those is one part-sheet pick, drawn on the canvas at once and then saved
 * with `router.refresh()` behind it — a whole-Maker render (3–6 s on
 * production) that Next.js runs in the SAME serial queue as the next pick's
 * save, so the next save waited behind it, the render came back older than the
 * canvas, and the canvas reloaded to the older value — twice.
 *
 * What this holds:
 *   1. BEHAVIOUR of the shared `makerSave` the Maker calls (not a copy): a
 *      `held` save — the bridge drew it — calls its refresh ZERO times; an
 *      unheld one still calls it once.
 *   2. every held save in the Maker asks the save to answer with the Apply bar
 *      (`HUB_DRAFT_BAR_FIELD`), the draft action answers with the SAME summary
 *      the render counts with (for both answers to "owns Pro" — it never asks),
 *      and the toolbar takes its half — so no count needs a render;
 *   3. the part sheet folds quick picks into one write (`makerLatestWrite`) and
 *      builds on the Maker's own canvas (`draftedCanvasOr`), and the scene
 *      panels read canvases through the same copy;
 *   4. no draft door revalidates the Maker's route for a draft-only save.
 *
 * NOT SEEN (so a green is not over-read): the pixels (the bridge's own tests
 * hold that each pick draws), and saves the bridge cannot draw — a theme, the
 * hero design, adding or moving a scene, an upload, Undo · Restore · Apply —
 * which still end in one render, on purpose.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAKER_REFRESH_COALESCE_MS, MAKER_WRITE_BEAT_MS, makerLatestWrite, makerSave, makerSavesInFlight } from './maker-refresh';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('1 · the shared makerSave: a held save refreshes NOTHING; an unheld one refreshes once', async () => {
  let held = 0;
  await Promise.all([1, 2, 3].map(() => makerSave(async () => ({ ok: true }), () => void (held += 1), { held: true })));
  await wait(MAKER_REFRESH_COALESCE_MS * 3);
  assert.equal(held, 0, 'a pick the canvas already shows re-rendered the whole Maker');

  let unheld = 0;
  await makerSave(async () => ({ ok: true }), () => void (unheld += 1));
  await wait(MAKER_REFRESH_COALESCE_MS * 3);
  assert.equal(unheld, 1, 'a write the bridge did not draw must still bring its one render');
});

test('1b · five quick taps through the shared writer are ONE server write, and nothing re-renders', async () => {
  let writes = 0;
  let refreshes = 0;
  const taps = [1, 2, 3, 4, 5].map((n) =>
    makerSave(
      () => makerLatestWrite('canvas:guard-hero', async () => ((writes += 1), { ok: true, n })),
      () => void (refreshes += 1),
      { held: true },
    ),
  );
  assert.ok(makerSavesInFlight() > 0, 'a pick waiting for its beat counts as a save in flight');
  await Promise.all(taps);
  await wait(MAKER_WRITE_BEAT_MS + MAKER_REFRESH_COALESCE_MS * 2);
  assert.equal(writes, 1, `five taps sent ${writes} writes`);
  assert.equal(refreshes, 0);
  assert.equal(makerSavesInFlight(), 0);
});

const MAKER_DIRS = [
  'app/dashboard/[eventId]/launch/_components',
  'app/dashboard/[eventId]/website/editor/_components',
  'app/dashboard/[eventId]/website/_components',
];

test('2 · every held save asks for the Apply bar; the action answers with the render’s own count; the toolbar takes it', () => {
  const heldFiles: string[] = [];
  for (const d of MAKER_DIRS) {
    for (const f of readdirSync(join(WEB, d))) {
      if (!f.endsWith('.tsx') || f.endsWith('.test.tsx')) continue;
      const rel = `${d}/${f}`;
      const src = read(rel);
      if (!/makerSave\([\s\S]*?\{\s*held(?:: true)?\b/.test(src)) continue;
      heldFiles.push(rel);
      assert.match(src, /\.set\(HUB_DRAFT_BAR_FIELD, '1'\)/, `${rel}: a held save that does not ask for the bar leaves the Apply count stale (no render follows it)`);
    }
  }
  console.log(`[drawn-pick] held saves in: ${heldFiles.join(', ')}`);
  assert.ok(heldFiles.length >= 4, `only ${heldFiles.length} files hold a save — the scan is not reading the Maker`);

  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const save = action.slice(action.indexOf("if (intent === 'save')"), action.indexOf("if (intent === 'reset')"));
  assert.match(save, /const wantsBar = formData\.get\(HUB_DRAFT_BAR_FIELD\) === '1';/);
  assert.match(save, /wantsBar \? hubDraftBarAfterSave\(supabase, eventId, mergeHubDraft\(current, patch\)\)/, 'the bar must be read from the draft this save wrote');
  assert.match(save, /if \(!bar\) return done\(\);\s*return \{ \.\.\.done\(\), bar \};/);
  // The same count the render uses — both answers to "owns Pro", and nobody asked (the view switch never reaches a save).
  const store = read('lib/hub-draft-store.ts');
  const after = store.slice(store.indexOf('export async function hubDraftBarAfterSave('));
  assert.match(after, /summarizeHubDraft\(draft, live, false\)[\s\S]*summarizeHubDraft\(draft, live, true\)/);
  assert.doesNotMatch(after.slice(0, after.indexOf('\n}\n')), /asViewed\(|eventCoupleWebsiteProActive\(|lookProAllows\(/, 'the save-side bar asked who owns Pro');

  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /addEventListener\(MAKER_DRAFT_BAR_EVENT/, 'the toolbar no longer hears the count a save answers with');
  assert.match(bar, /fromSave \? \(ownsPro \? fromSave\.owned : fromSave\.free\) : renderedSummary/, 'the toolbar must pick the half the render drew with');
  const refresh = read('lib/maker-refresh.ts');
  assert.match(refresh, /shared\.save\(send, refresh, options\.ok, Boolean\(options\.held\)\)/, 'makerSave dropped `held` on its way to the refresher');
  assert.match(refresh, /announceDraftBar\(result\)/);
});

test('3 · the part sheet batches its picks and builds on the Maker’s own canvas; the scene panels read the same copy', () => {
  const sheet = read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx');
  assert.match(sheet, /makerSave\(\s*\(\) => makerLatestWrite\(canvasWriteKey\(target\.widgetType\)/, 'each tap is its own write again');
  assert.match(sheet, /\{ held: true, ok: /);
  assert.match(sheet, /const canvas = draftedCanvasOr\(target\.widgetType, serverCanvas\)/, 'the sheet builds on a server prop from before these picks');
  assert.match(sheet, /noteDraftedCanvas\(target\.widgetType, next, serverCanvas\)/);

  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /const canvasOf = \(type: string\): HubSectionCanvas => draftedCanvasOr\(type,/);
  assert.match(shell, /const releaseCanvas = \(\) => \{\s*canvasHold\.current = NO_CANVAS_HOLD;\s*makerNeedsRender\(\);/, 'a released hold must still bring its one render');
});

test('4 · no draft door revalidates the Maker route for a draft-only save', () => {
  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const draftOnly = action.slice(action.indexOf("if (intent === 'restore')"), action.indexOf('const live = await readHubLiveState('));
  assert.doesNotMatch(draftOnly, /revalidatePath\(|revalidateTag\(|revalidateWebsiteEditor\(|revalidateGuestSite\(/);
});
