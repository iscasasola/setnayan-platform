/**
 * ⚡ OUR LOVE STORY AND THE PROGRAMME ARE INSTANT IN THE MAKER — owner
 * 2026-09-30, verbatim: *"so hard to edit … Takes so long to edit both. the
 * delay of response is terrible"*; earlier the same day: *"every edit
 * alteration … forces the whole screen to reload"* (DECISION_LOG "EVERYTHING
 * REBUILT IN THE MAKER IS INSTANT BY DESIGN").
 *
 * Six properties, each sabotaged before commit:
 *
 *   A · the words and the moments are applied in the Maker with the SERVER'S
 *       OWN functions (`mergeStoryWords`, `patchStoryWord`, `applyMomentIntent`)
 *       — what shows at the tap is what the action would have written; and a
 *       new photo or a pick from another event still goes to the server;
 *   B · the canvas lays the words it is sent (`applyLoveStoryPreview`,
 *       `applySchedulePreview`) on the scenes the guest page draws;
 *   C · the two editors post editor-bridge messages BEFORE their save goes,
 *       and the stage shell carries them to its frames;
 *   D · every Love Story save is held, batched and asks for the Apply count —
 *       no refresh, no revalidate, no render of the Maker;
 *   E · every Programme edit from the Maker is quiet — its action revalidates
 *       nothing — and a typed name, place or note is one save after the pause;
 *   F · THE SWEEP: no Maker edit path refreshes the Maker route outside the
 *       measured list below, which may only shrink.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { mergeStoryWords, patchStoryWord } from '@/lib/love-story-words';
import { applyMomentIntent, momentNeedsServer } from '@/lib/love-story-moment-intent';
import { resolveMoments, type LoveStoryMoment } from '@/lib/love-story-moments';
import {
  LOVE_STORY_PREVIEW,
  SCHEDULE_PREVIEW,
  loveStoryPreviewMessage,
  makerQuietWrite,
  schedulePreviewMessage,
} from '@/lib/maker-live-preview';
import { LOVE_STORY_PREVIEW_T, SCHEDULE_PREVIEW_T, applyLoveStoryPreview, applySchedulePreview } from '@/lib/maker-live-preview-apply';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const OS = 'app/dashboard/[eventId]/website/our-story';
const SCH = 'app/dashboard/[eventId]/schedule';

/** A FormData stand-in from pairs (a name may repeat). */
function form(pairs: Array<[string, string]>) {
  return {
    get: (n: string) => pairs.find(([k]) => k === n)?.[1] ?? null,
    getAll: (n: string) => pairs.filter(([k]) => k === n).map(([, v]) => v),
  };
}

/* ── A · the server's own functions, at the tap ────────────────────────────── */

test('A · the words: the whole form merges exactly as the action does; one box changes only its key', () => {
  const base = { moments: [{ id: 'm-1' }], spark_anchor: 'x', anchors: { song: 'old', place: 'kept' } };
  const { story, togetherSince } = mergeStoryWords(base, form([['how_we_met', '  In the rain  '], ['anchor_song', 'Ikaw'], ['together_since', '2019'], ['ms_year', '2020'], ['ms_title', 'Moved in'], ['ms_year', '2018'], ['ms_title', 'Met']]));
  assert.equal(story.how_we_met, 'In the rain', 'trimmed');
  assert.deepEqual(story.moments, [{ id: 'm-1' }], 'a key the form does not edit survives');
  assert.equal(story.spark_anchor, 'x');
  assert.deepEqual(story.anchors, { song: 'Ikaw', place: '', injoke: '', food: '' }, 'the form posts every anchor');
  assert.deepEqual((story.milestones as Array<{ year: string }>).map((m) => m.year), ['2018', '2020'], 'sorted');
  assert.equal(togetherSince, '2019', 'dual-stored');

  const one = patchStoryWord({ spark: 'kept', how_we_met: 'old', anchors: { place: 'kept' } }, 'how_we_met', form([['how_we_met', 'new'], ['spark', 'STALE BOX']]));
  assert.deepEqual(one?.story, { spark: 'kept', how_we_met: 'new', anchors: { place: 'kept' } }, 'a box writes ONLY its own key — never an older box beside it');
  const anchor = patchStoryWord({ anchors: { place: 'kept' } }, 'anchor_song', form([['anchor_song', 'Ikaw']]));
  assert.deepEqual(anchor?.story.anchors, { place: 'kept', song: 'Ikaw' });
  assert.equal(patchStoryWord({}, 'together_since', form([['together_since', ' 2019 ']]))?.togetherSince, '2019');
  assert.equal(patchStoryWord({}, 'nonsense', form([])), null, 'a name that is not a story field is not written');
  assert.equal((patchStoryWord({}, 'how_we_met', form([['how_we_met', 'x'.repeat(900)]]))?.story.how_we_met as string).length, 600, 'capped as the action caps');
});

test('A · the moments: add · edit · delete · arrange, and what must still go to the server', () => {
  const before: LoveStoryMoment[] = resolveMoments({
    moments: [
      { id: 'm-a', date: { y: 2018 }, line: 'We met', anchor: 'met', canvas: {} },
      { id: 'm-b', date: { y: 2020 }, line: 'Moved in', canvas: {} },
    ],
  });
  const added = applyMomentIntent(before, 'add', form([['intent', 'add'], ['date_y', '2023'], ['line', 'The yes'], ['anchor', 'yes']]), () => 0.5);
  assert.ok(added.ok && added.after.length === 3 && added.touched?.anchor === 'yes');
  const noYear = applyMomentIntent(before, 'add', form([['intent', 'add'], ['line', 'x']]));
  assert.deepEqual(noYear, { ok: false, error: 'A moment needs a year and a line — nothing else is required.' });
  const moved = applyMomentIntent(before, 'edit', form([['id', 'm-b'], ['date_y', '2021'], ['line', 'Moved in together'], ['anchor', 'met']]));
  assert.ok(moved.ok);
  assert.equal(moved.after.find((m) => m.id === 'm-a')?.anchor, undefined, 'one "How we met" — the tag moves');
  const hidden = applyMomentIntent(before, 'arrange', form([['id', 'm-b'], ['hidden', 'on']]));
  assert.ok(hidden.ok && hidden.after.find((m) => m.id === 'm-b')?.hidden === true);
  const gone = applyMomentIntent(before, 'delete', form([['id', 'm-a']]));
  assert.ok(gone.ok && gone.after.map((m) => m.id).join() === 'm-b');

  assert.equal(momentNeedsServer(before, form([['intent', 'edit'], ['id', 'm-b'], ['line', 'x']])), false, 'words are applied here');
  assert.equal(momentNeedsServer(before, form([['intent', 'pick'], ['id', 'm-b']])), true, 'a pick from another event is the server’s to decide');
  assert.equal(
    momentNeedsServer(before, form([['intent', 'edit'], ['id', 'm-b'], ['media', 'r2://setnayan-media/events/e/love-story/new.jpg']])),
    true,
    'a NEW photo is screened by the server before it is kept',
  );

  // The action applies the SAME function — never a second copy.
  const action = read(`${OS}/actions.ts`);
  assert.match(action, /const r = applyMomentIntent\(before, intent, formData\);/);
  assert.match(action, /const \{ story: merged, togetherSince \} = mergeStoryWords\(base, formData\);/);
  assert.doesNotMatch(action, /function momentFields\(|function readMilestones\(/, 'a second copy of the rule came back');
});

/* ── B · the canvas lays the words ─────────────────────────────────────────── */

type El = { textContent: string | null; hidden: boolean; attrs: Record<string, string>; children: El[]; querySelectorAll(sel: string): El[] };
function el(attrs: Record<string, string>, text = '', children: El[] = []): El {
  const node: El = {
    textContent: text,
    hidden: false,
    attrs,
    children,
    querySelectorAll(sel: string) {
      const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
      assert.ok(m, `unexpected selector ${sel}`);
      const out: El[] = [];
      const walk = (n: El) => {
        for (const c of n.children) {
          if (m[1]! in c.attrs && (m[2] === undefined || c.attrs[m[1]!] === m[2])) out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
  };
  return node;
}

test('B · a Love Story scene and a Programme moment take the Maker’s words in place', () => {
  assert.equal(LOVE_STORY_PREVIEW_T, LOVE_STORY_PREVIEW, 'the canvas and the Maker must name the story message alike');
  assert.equal(SCHEDULE_PREVIEW_T, SCHEDULE_PREVIEW, 'the canvas and the Maker must name the programme message alike');
  const line = el({ 'data-love-line': '' }, 'old line');
  const when = el({ 'data-love-when': '' }, '2018 · How we met');
  const place = el({ 'data-love-place': '' }, '');
  const doc = el({}, '', [el({ 'data-love-scene': 'm-a' }, '', [when, line, place])]);
  const msg = loveStoryPreviewMessage([{ id: 'm-a', when: '2019', chapterLabel: 'How we met', line: 'In the rain', place: 'Baguio' }]);
  assert.equal(msg.source, 'setnayan-editor');
  assert.equal(applyLoveStoryPreview(doc, msg.scenes), 1);
  assert.equal(line.textContent, 'In the rain');
  assert.equal(when.textContent, '2019 · How we met');
  assert.equal(place.textContent, 'Baguio');
  assert.equal(place.hidden, false);
  applyLoveStoryPreview(doc, [{ id: 'm-a', when: '', chapterLabel: 'How we met', line: 'x', place: '' }]);
  assert.equal(place.hidden, true, 'an emptied place hides');
  assert.equal(applyLoveStoryPreview(doc, [{ id: 'bad"]', line: 'x' }]), 0, 'an id that is not ours is dropped');

  const label = el({ 'data-schedule-label': '' }, 'Cocktails');
  const time = el({ 'data-schedule-time': '' }, '4:00 PM');
  const loc = el({ 'data-schedule-location': '' }, 'Garden');
  const sdoc = el({}, '', [el({ 'data-schedule-moment': 'b-1' }, '', [time, label, loc])]);
  assert.equal(applySchedulePreview(sdoc, schedulePreviewMessage({ id: 'b-1', label: 'Cocktail hour', time: '4:15 PM' }).moment), 1);
  assert.equal(label.textContent, 'Cocktail hour');
  assert.equal(time.textContent, '4:15 PM');
  assert.equal(loc.textContent, 'Garden', 'a field not sent is left alone');
  applySchedulePreview(sdoc, { id: 'b-1', label: '   ' });
  assert.equal(label.textContent, 'Cocktail hour', 'an emptied name is never drawn blank');
});

test('B · the guest page marks where the words go, and the bridge lays them', () => {
  const widget = read('app/[slug]/_components/our-love-story-widget.tsx');
  for (const a of ['data-love-when', 'data-love-line', 'data-love-place']) assert.match(widget, new RegExp(`${a}=""`), `the story scene lost ${a}`);
  const sched = read('app/[slug]/_components/schedule-widget.tsx');
  for (const a of ['data-schedule-time', 'data-schedule-label', 'data-schedule-location']) assert.match(sched, new RegExp(`${a}=""`), `the programme lost ${a}`);
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /data\.t === LOVE_STORY_PREVIEW\) \{\s*applyLoveStoryPreview\(document,/);
  assert.match(bridge, /data\.t === SCHEDULE_PREVIEW\) \{\s*applySchedulePreview\(document,/);
});

/* ── C · the editors post, the stage shell carries ─────────────────────────── */

test('C · both editors post editor-bridge messages before the save goes; the stage shell broadcasts them', () => {
  const live = read(`${OS}/_components/love-story-live.tsx`);
  const edit = live.slice(live.indexOf('export async function editLoveStory('), live.indexOf('export function sayLoveStory('));
  assert.match(edit, /postPreview\(next\);[\s\S]*makerSave\(/, 'the canvas must be told BEFORE the save goes');
  assert.match(live, /postToMakerCanvas\(\s*loveStoryPreviewMessage\(/);
  const insp = read(`${SCH}/_components/moment-inspector.tsx`);
  const field = insp.slice(insp.indexOf('function liveField('), insp.indexOf('function saveField('));
  assert.match(field, /onOverride\(m\.block_id, patch\);\s*postMomentToCanvas\(\{ id: m\.block_id, \[field\]: text \}\);/, 'a typed name must be on the rail and the canvas before it saves');
  assert.match(field, /momentLatestWrite\(m\.block_id, field,/, 'typing is not batched');
  for (const box of ['label', 'location', 'notes']) {
    assert.match(insp, new RegExp(`onChange=\\{live \\? \\(e\\) => liveField\\('${box}', e\\.target\\.value\\) : undefined\\}`), `the ${box} box does not draw as it is typed`);
  }
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /window\.addEventListener\(MAKER_CANVAS_POST_EVENT, onPost\)/);
  assert.match(shell, /broadcastToCanvasRef\.current\(message\)/);
  assert.match(shell, /window\.addEventListener\(MAKER_CANVAS_STALE_EVENT, onStale\)/);
});

/* ── D · the Love Story saves: held, batched, the bar in the answer ─────────── */

test('D · every Love Story save is held, batched and asks for the Apply count — never a render', () => {
  const live = read(`${OS}/_components/love-story-live.tsx`);
  assert.match(live, /makerLatestWrite\(canvasWriteKey\(LOVE_STORY_DRAFT_TYPE\)/, 'not batched');
  assert.match(live, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/, 'not held');
  assert.match(live, /fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\)/, 'the Apply count must come back with the save');
  assert.match(live, /fd\.set\('intent', 'save'\)/);
  assert.doesNotMatch(live, /router\.refresh|useRouter|revalidatePath|location\.reload/, 'a Love Story edit refreshes the Maker');
  // A refusal goes back to what the draft holds — on the page AND the canvas — and says so.
  assert.match(live, /did not save, so it is back as it was/);
  assert.match(live, /noteDraftedCanvas\(LOVE_STORY_DRAFT_TYPE, back as HubSectionCanvas[\s\S]*postPreview\(back\)/);
  // The Maker draws the live pieces — lazily, never in its first load.
  const lazy = readFileSync(join(ROOT, 'app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), 'utf8');
  const book = readFileSync(join(ROOT, `${OS}/_components/live-book-lazy.tsx`), 'utf8');
  assert.match(book, /LiveLoveStoryBook = dynamic\(\s*\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/love-story-live'\)/);
  assert.match(read(`${OS}/page.tsx`), /import \{ LiveLoveStoryBook \} from '\.\/_components\/live-book-lazy';/, 'the page must reach the scrapbook lazily');
  assert.match(lazy, /LiveStoryPanel = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\//);
  assert.match(read(`${OS}/page.tsx`), /\{inMaker \? \(\s*<LiveLoveStoryBook\s+story=\{story\}/, 'the Maker still draws the scrapbook from the server render');
  assert.match(read('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /<LiveStoryPanel eventId=\{eventId\}/);
});

/* ── E · the Programme: quiet, batched ─────────────────────────────────────── */

test('E · a Programme edit from the Maker revalidates nothing; the standalone page still does', async () => {
  assert.equal(makerQuietWrite(form([['maker_quiet', '1']])), true);
  assert.equal(makerQuietWrite(form([])), false);
  const actions = read(`${SCH}/actions.ts`);
  assert.match(
    actions,
    /function revalidateScheduleUnlessMaker\(eventId: string, formData: FormData\): void \{\s*if \(makerQuietWrite\(formData\)\) return;\s*revalidatePath\(`\/dashboard\/\$\{eventId\}\/schedule`\);\s*revalidatePath\(`\/dashboard\/\$\{eventId\}`\);\s*\}/,
  );
  for (const fn of ['updateScheduleBlock', 'toggleBlockVisibility', 'setBlockResponsibleParty', 'setBlockPrepVisibility', 'bulkRetimeScheduleBlocks', 'deleteScheduleBlock']) {
    const at = actions.indexOf(`export async function ${fn}(`);
    const next = actions.indexOf('export async function', at + 10);
    const body = actions.slice(at, next < 0 ? undefined : next);
    assert.ok(at >= 0, `${fn} is gone`);
    assert.match(body, /revalidateScheduleUnlessMaker\(eventId, formData\);/, `${fn} no longer asks before revalidating`);
    assert.doesNotMatch(body, /\brevalidatePath\(/, `${fn} revalidates outside the quiet guard`);
  }
  const live = read(`${SCH}/_components/schedule-live.ts`);
  assert.match(live, /fd\.set\(SCHEDULE_QUIET_FIELD, '1'\);\s*const r = await run\(fd\);/);
  // Its own spelling of the Maker's names (see its docblock) — held equal here.
  const sl = await import(`../${SCH}/_components/schedule-live`);
  const mlp = await import('@/lib/maker-live-preview');
  assert.equal(sl.SCHEDULE_QUIET_FIELD, mlp.MAKER_QUIET_FIELD);
  assert.equal(sl.SCHEDULE_CANVAS_POST_EVENT, mlp.MAKER_CANVAS_POST_EVENT);
  assert.equal(sl.SCHEDULE_CANVAS_STALE_EVENT, mlp.MAKER_CANVAS_STALE_EVENT);
  assert.equal(sl.MOMENT_WRITE_BEAT_MS, (await import('@/lib/maker-refresh')).MAKER_WRITE_BEAT_MS);
  assert.doesNotMatch(live, /from '@\/lib\/maker-/, 'the rail (the standalone Schedule page too) must not import the Maker’s modules — a new shared chunk grows every page');
  for (const fn of ['updateScheduleBlock', 'toggleBlockVisibility', 'setBlockResponsibleParty', 'setBlockPrepVisibility', 'bulkRetimeScheduleBlocks', 'deleteScheduleBlock']) {
    assert.match(live, new RegExp(`${fn}: quiet\\(actions\\.${fn}`), `${fn} is sent loud from the Maker`);
  }
  const rail = read(`${SCH}/_components/day-rail.tsx`);
  assert.match(rail, /const live = inspectorSlot !== null;/);
  assert.match(rail, /<DayActionsContext\.Provider value=\{dayActions\}>/, 'the rail hands its sheets the loud actions');
});

/* ── F · THE SWEEP ─────────────────────────────────────────────────────────── */

/**
 * Every Maker-drawn client file that still asks for a whole render of the Maker
 * after an edit (`router.refresh()`), MEASURED 2026-09-30 on this branch. Each
 * is a known, listed follow-up (the PR body names them); a NEW file here fails.
 * Shrink it; never grow it.
 */
const STILL_REFRESHES = new Set([
  'app/dashboard/[eventId]/launch/_components/maker-hero-design.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-logo.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx',
  'app/dashboard/[eventId]/launch/_components/qr-look-controls.tsx',
  'app/dashboard/[eventId]/launch/_components/soft-post.tsx',
  'app/dashboard/[eventId]/launch/_components/view-as-free.tsx',
  'app/dashboard/[eventId]/schedule/_components/announce-button.tsx',
  'app/dashboard/[eventId]/schedule/_components/prep-item-controls.tsx',
  'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
  'app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx',
  'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
  'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx',
  'app/dashboard/[eventId]/website/editor/_components/fixed-scene-style-row.tsx',
  'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx',
  'app/dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx',
  'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx',
  'app/dashboard/[eventId]/website/editor/_components/use-scene-canvas.ts',
]);

test('F · no Maker edit path refreshes the Maker outside the measured list — and Love Story and the Programme are off it', () => {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const dirs = [
    'app/dashboard/[eventId]/launch/_components',
    'app/dashboard/[eventId]/website/_components',
    'app/dashboard/[eventId]/website/editor/_components',
    `${OS}/_components`,
    `${SCH}/_components`,
  ];
  const found: string[] = [];
  for (const d of dirs) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (!/\.tsx?$/.test(f) || /\.test\./.test(f)) continue;
      const rel = `${d}/${f}`;
      /* A frame's own `contentWindow.location.reload()` (a replay) is not the Maker. */
      if (/\brouter\.refresh\(\)|(?<![.\w])location\.reload\(|\bwindow\.location\.reload\(/.test(read(rel))) found.push(rel);
    }
  }
  const added = found.filter((f) => !STILL_REFRESHES.has(f));
  assert.deepEqual(added, [], `a Maker edit path now refreshes the whole Maker — make it held/quiet instead:\n${added.join('\n')}`);
  const cleared = [...STILL_REFRESHES].filter((f) => !found.includes(f));
  assert.deepEqual(cleared, [], `these no longer refresh — take them off STILL_REFRESHES:\n${cleared.join('\n')}`);
  for (const f of [`${OS}/_components/love-story-live.tsx`, `${OS}/_components/love-story-book.tsx`, `${OS}/_components/moment-sheet.tsx`, `${SCH}/_components/day-rail.tsx`, `${SCH}/_components/moment-inspector.tsx`, `${SCH}/_components/schedule-live.ts`]) {
    assert.doesNotMatch(read(f), /\brouter\.refresh\(|\brevalidatePath\(|\blocation\.reload\(/, `${f} refreshes the Maker`);
  }
});

/* ── G · the sweep's first conversion: Details › Words › Special message ──── */

test('G · the special message saves as it is typed in the Maker — held, batched, on Details’ card at once', () => {
  const field = read('app/dashboard/[eventId]/launch/_components/special-message-field.tsx');
  assert.match(field, /onInput=\{\(e\) => type\(e\.currentTarget\.value\)\}/, 'typing does not save');
  assert.match(field, /makerLatestWrite\('events:special_message'/, 'not batched');
  assert.match(field, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/, 'not held');
  assert.match(field, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ special_message: text \} \}\)\)/);
  assert.match(field, /preview\(text\);\s*showOnCards\(text\);/, 'the words must be shown before the save goes');
  assert.match(field, /did not save, so it is back as it was/);
  assert.doesNotMatch(field, /\brouter\.refresh\(|\brevalidatePath\(/);
  const details = read('app/dashboard/[eventId]/launch/_components/maker-details.tsx');
  assert.match(details, /<WordsCard text=\{specialMessage\} note="How it reads on your Event Hub\." live="special_message" \/>/);
  assert.match(details, /data-live-words=\{live\}/);
});

test('E · five quick values for one field are ONE write after the pause; the first four are carried by it', async () => {
  const { momentLatestWrite, CARRIED } = await import(`../${SCH}/_components/schedule-live`);
  let sent = 0;
  const outs: Array<Promise<unknown>> = [];
  for (let i = 0; i < 5; i++) {
    outs.push(
      momentLatestWrite('b-lab', 'label', async () => {
        sent += 1;
        return i;
      }),
    );
  }
  const answers = await Promise.all(outs);
  assert.equal(sent, 1, `${sent} writes for five values`);
  assert.deepEqual(answers, [CARRIED, CARRIED, CARRIED, CARRIED, 4]);
});
