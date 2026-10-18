/**
 * ↺ A PANEL FOLLOWS THE DRAFT — Cover › Edit's line switches (and Cover › Animate) after ↺ · Reset · Restore · a merged
 * save, exactly as after an edit (`follow-draft.ts`).
 *
 * The live fault (WebKit 375, origin/main e11f5346 and #6632): Date off → ↺ → the cover drew the Date again while the
 * Date switch still read off. Each test runs the REAL Maker copy (`lib/maker-draft-store.ts`), the REAL ↺ of a canvas
 * pick (`lib/canvas-pick-undo.ts`) and the REAL save door (`makerSave`), and reads the switch through the panel's own
 * rule (`followDraft` — the hook's whole decision). There is no DOM in this suite: `window` is an EventTarget.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* A window before any Maker module loads (the copy wires its "unheld write" listener at load). */
const win = new EventTarget() as EventTarget & Record<string, unknown>;
(globalThis as unknown as { window: unknown }).window = win;

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(HERE, p), 'utf8');

type Canvas = { elements?: Record<string, { hidden?: true }> };
const SHOWN: Canvas = {};
const DATE_OFF: Canvas = { elements: { date: { hidden: true } } };

async function load() {
  const store = await import('@/lib/maker-draft-store');
  const undo = await import('@/lib/canvas-pick-undo');
  const refresh = await import('@/lib/maker-refresh');
  const follow = await import('./follow-draft');
  return { store, undo, refresh, follow };
}

/** The Date switch as Cover › Edit draws it: its own pick while the draft has not moved, else the draft's `hidden`. */
function dateSwitch(follow: Awaited<ReturnType<typeof load>>['follow'], copy: () => Canvas) {
  let own: ReturnType<typeof follow.followDraft<boolean>>['own'] = null;
  const truth = () => copy().elements?.date?.hidden !== true;
  return {
    /** One render: what `aria-checked` says. */
    render(): boolean {
      const f = follow.followDraft(own, truth());
      own = f.own;
      return f.shown;
    },
    /** The tap: the pick, made at this render's draft. */
    tap(on: boolean) {
      const f = follow.followDraft(own, truth());
      own = { pick: on, at: f.at };
    },
  };
}

test('↺ after a switch was turned off: the switch turns back on with the page', async () => {
  const { store, undo, follow } = await load();
  const server = SHOWN; // the last render's hero row
  const copy = () => store.draftedCanvasOr('hero', server as never) as Canvas;
  const sw = dateSwitch(follow, copy);
  assert.equal(sw.render(), true);

  // Date off — the pick, then the copy (`keepShown`), then the held save's ↺ step.
  sw.tap(false);
  assert.equal(sw.render(), false, 'the tap is shown at once');
  store.noteDraftedCanvas('hero', DATE_OFF as never, server as never);
  assert.equal(sw.render(), false, 'the landed pick is the draft');

  // ↺ drawn in the click (no Maker render): the BEFORE canvas goes back into the copy…
  let heard = 0;
  const off = follow.onDraftMoves(() => (heard += 1));
  undo.canvasPickUndo('hero', SHOWN as never, DATE_OFF as never, server as never, () => []).undraw();
  off();
  assert.ok(heard > 0, 'the ↺ that renders nothing was not heard — the panel would never re-read');
  // …and the switch reads it.
  assert.equal(sw.render(), true, 'after ↺ the Date switch still reads off (the bug)');
});

test('Reset / Restore (a Maker render): the switch shows the render, and a pick never comes back', async () => {
  const { store, refresh, follow } = await load();
  let server: Canvas = SHOWN;
  const copy = () => store.draftedCanvasOr('hero', server as never) as Canvas;
  const sw = dateSwitch(follow, copy);
  store.makerRendered('r1');
  sw.render();
  sw.tap(false);
  store.noteDraftedCanvas('hero', DATE_OFF as never, server as never);
  server = DATE_OFF; // the next render brought it
  store.makerRendered('r2');
  assert.equal(sw.render(), false);

  // Reset: an unheld write, then the render it brings — the Date shown again.
  refresh.announceUnheldWrite();
  server = SHOWN;
  store.makerRendered('r3');
  assert.equal(sw.render(), true, 'after Reset the switch kept the old pick');
  assert.equal(sw.render(), true, 'the draft came back to the value the pick was made at — the pick revived');
});

test('a merged save (another screen): its canvas lands in the Maker copy and the panel is told', async () => {
  const { store, refresh, follow } = await load();
  const server = SHOWN;
  store.noteDraftedCanvas('hero', SHOWN as never, server as never);
  const copy = () => store.draftedCanvasOr('hero', server as never) as Canvas;
  const sw = dateSwitch(follow, copy);
  assert.equal(sw.render(), true);
  let heard = 0;
  const off = follow.onDraftMoves(() => (heard += 1));
  // This screen saved something on the cover; the answer says the other screen hid the Date meanwhile.
  const merged = { widgets: { hero: { canvas: DATE_OFF } } };
  await refresh.makerSave(async () => ({ ok: true, intent: 'save', elsewhere: { merged, clashed: [], note: 'Changed on another screen a moment ago — showing the newest.' } }), () => {}, { held: true, undo: 'noted' });
  off();
  assert.ok(heard > 0, 'the merged save was not heard');
  assert.equal(sw.render(), false, 'after a merged save the switch still shows this screen’s copy, not the merged draft');
});

test('the panels use the rule — no copy of a draft value seeded once, no override for good', () => {
  const lines = src('cover-lines.tsx');
  const animate = src('cover-animate.tsx');
  const tools = src('../stage-tools.tsx');
  assert.match(lines, /usePickUntilDraftMoves\(/, 'Cover › Edit’s switches do not follow the draft');
  assert.doesNotMatch(lines, /useState</, 'Cover › Edit keeps a state of its own again');
  assert.match(animate, /usePickUntilDraftMoves<HubSectionCanvas>\(stored\)/, 'Cover › Animate does not follow the draft');
  assert.doesNotMatch(animate, /useState<HubSectionCanvas>\(stored\)/, 'Cover › Animate seeds its canvas once again');
  // The cover lines are read again on every move of the copy no render brings.
  const read = tools.slice(tools.indexOf('const [coverLines, setCoverLines]'));
  assert.match(read.slice(0, read.indexOf('const editOn')), /\}, \[[^\]]*\bdraftMoves\b[^\]]*\]\);/, 'the cover lines are read only on a render');
  // And the save door hands the merged values to the panels.
  assert.match(src('../../../../../../lib/maker-refresh.ts'), /state: 'elsewhere', text: elsewhere\.note, merged: elsewhere\.merged/);
});
