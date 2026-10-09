/**
 * the-mood-board-lab-cannot-reach-the-database.test.ts — A LAB PRESS ON STUDIO › MOOD BOARD & DRESS CODE NEVER REACHES THE DATABASE
 * (2026-10-09; the pattern is `guests-lab/the-lab-cannot-reach-the-database.test.ts`).
 *
 * The dev lab (`/dev/maker-lab?studio=1`, `/dev/details-lab?studio=1`) draws the REAL page on fixtures; a colour pick, an outfit, a
 * photo, a Do's & Don'ts edit and "Undo it" used to call the real action. Now the page takes its seven writers from a context under
 * their own names; the lab fills it with local stand-ins and the app never does.
 *
 * THE CLAIM, three ways: (1) every name the context carries has a stand-in (none is left real); (2) the page's call sites take their
 * action from the context and import no action module of their own; (3) nothing but the lab provides the context. Behaviour: the
 * stand-ins answer the way the real ones do without a database, and `&refuse=1` refuses with the database's own words — which the
 * page must never print (`studio-mood-board-posts-the-same.test.ts`).
 *
 * NOT stubbed (listed, not hidden): the Auto sheet and the colour picker (no write); "Search ideas" reads (`fetchGalleryAssets`) answer an
 * empty gallery, so a supplier's photo cannot be picked in the lab.
 *
 * SABOTAGE (each seen RED, then restored): a stand-in deleted from the lab · a call site importing its action directly again · a
 * provider put in the app · the lab's node no longer wrapping the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LAB_MOOD_BOARD_ACTIONS, LAB_MOOD_BOARD_REFUSALS } from './lab-mood-board-stand-ins';
import { isPlainSentence } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const MB = join(APP, 'dashboard', '[eventId]', 'studio', 'mood-board', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('(1) every write the context carries has a lab stand-in — none is left real', () => {
  const ctx = read(join(MB, 'mood-board-actions-context.tsx'));
  const real = [...ctx.slice(ctx.indexOf('export const REAL_MOOD_BOARD_ACTIONS')).matchAll(/^\s{2}(\w+),/gm)].map((m) => m[1]);
  assert.equal(real.length, 7, 'the context’s names could not be read');
  assert.deepEqual(Object.keys(LAB_MOOD_BOARD_ACTIONS).sort(), [...real].sort(), 'a lab press can reach a real action');
  for (const f of ['lab-mood-board-stand-ins.ts', 'lab-mood-board-actions.tsx']) {
    assert.doesNotMatch(read(join(HERE, f)), /from '[^']*(?:-actions|\/actions)'|wizard-actions|hub-draft-actions|dress-code-actions/, `${f} imports a real action module`);
  }
});

test('(1b) the stand-ins answer like the real ones, locally — and refuse in database words on request', async () => {
  const a = LAB_MOOD_BOARD_ACTIONS;
  const drafted = await a.hubDraftAction!('e', new FormData());
  assert.ok(drafted.ok);
  const rejected = await a.rejectColourChange!('e', 'c1');
  assert.equal(rejected.status, 'ok');
  const up = await a.uploadMoodboardSlot!(new FormData());
  assert.ok(up.status === 'ok' && typeof up.image_url === 'string' && up.image_url.length > 0);
  assert.equal((await a.removeMoodboardSlot!(new FormData())).status, 'ok');
  assert.equal(await a.updateDressCodeLists!('e', new FormData()), undefined);
  const r = LAB_MOOD_BOARD_REFUSALS;
  const refused = await r.hubDraftAction!('e', new FormData());
  assert.ok(!refused.ok && !isPlainSentence(refused.error ?? ''), 'the refusal is not in the database’s words');
  assert.ok(!isPlainSentence((await r.uploadMoodboardSlot!(new FormData())).message ?? ''));
  assert.ok(!isPlainSentence((await r.removeMoodboardSlot!(new FormData())).message ?? ''));
  assert.equal((await r.rejectColourChange!('e', 'c1')).status, 'error');
  await assert.rejects(() => r.updateDressCodeLists!('e', new FormData()), /permission denied/);
});

test('(2) the call sites take their action from the context and import no action module of their own', () => {
  for (const f of ['mood-board-studio.tsx', 'studio-dos.tsx']) {
    const src = read(join(MB, f));
    assert.match(src, /useMoodBoardActions\(\)/, `${f} does not read its writers from the context`);
    assert.doesNotMatch(src, /from '[^']*(?:hub-draft-actions|colour-access-actions|wizard-actions|dress-code-actions|\.\.\/actions)'/, `${f} imports a real action module`);
  }
});

test('(3) nothing but the lab provides the context — the app runs the shipped actions', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === 'node_modules' || name === '.next') continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name) && /MoodBoardActionsProvider|MoodBoardActionsContext\.Provider/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(APP.length + 1));
    }
  };
  walk(APP);
  assert.deepEqual(hits.sort(), ['dashboard/[eventId]/studio/mood-board/_components/mood-board-actions-context.tsx', 'dev/details-lab/lab-mood-board-actions.tsx']);
  const node = read(join(HERE, 'details-lab-node.tsx'));
  assert.match(node, /<LabMoodBoardActions refuse=\{one\('refuse'\) === '1'\}>\s*<MoodBoardStudio/, 'the lab’s page is not wrapped in the stand-ins');
});
