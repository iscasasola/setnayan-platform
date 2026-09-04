/**
 * PICKING A SHARED RENDER NEVER SPENDS A CREDIT AND NEVER CALLS THE PROVIDER.
 *
 * ⛔ THE DESIGN THIS GUARDS IS THE ONE THAT REPLACED A CANCELLED ONE. MB9 was
 * originally a CACHE: match a new brief against a prior render's
 * `config_digest` and serve it back as a FREE OUTPUT. The owner cancelled that
 * on 2026-09-03 — *"no need to give free renders. always charge for
 * renders."* What survives is the opposite shape: a render is always bought at
 * full price, and what became free is LOOKING at renders other couples shared.
 *
 * 🔑 SO THERE ARE EXACTLY TWO ACTIONS AND THEY MUST NOT BLEED INTO EACH OTHER:
 *
 *   requestRender    (render-actions.ts)  reads config → debits → calls Gemini
 *   applyRenderPick  (actions.ts)         writes ONE event_inspiration_assets row
 *
 * The silent bug this file exists to catch is a pick that ALSO renders — the
 * couple taps "Save to this slot", a credit disappears, and the tile fills
 * either way so nothing on screen says what happened. A behavioural test cannot
 * see it without a live provider, so this reads the SOURCE of the two pick
 * functions and asserts that neither can reach the money.
 *
 * ⚠ AND IT IS ANCHORED PER FUNCTION, NOT PER FILE. `actions.ts` is 966+ lines
 * and legitimately holds other things; a file-wide grep would answer a question
 * nobody asked. The window below is sliced from each function's own signature
 * to the next top-level `export`, so wiring a render call INTO the pick is what
 * goes red — not a mention of credits elsewhere in the module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIONS = new URL('./actions.ts', import.meta.url);
const RENDER_ACTIONS = new URL('./render-actions.ts', import.meta.url);
const BOARD = new URL('./_components/inspiration-board.tsx', import.meta.url);
const PICKER = new URL('./_components/render-pool-picker.tsx', import.meta.url);

const read = (u: URL) => readFileSync(u, 'utf8');

/**
 * One exported function's body — its signature to its own closing brace.
 *
 * ⚠ THE BOUNDARY IS THE CLOSING BRACE, NOT "THE NEXT export". Slicing to the
 * next `export` swallows the NEXT function's docblock, and these docblocks
 * name the paid path on purpose (to say what the free path must not touch) —
 * so that window reported `fetchRenderPool` reaching `moodboard_begin_render`
 * when it was reading a comment about it. A guard that fires on prose is a
 * guard nobody will keep.
 */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} is gone — this guard now watches nothing`);
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} has no closing brace at column 0`);
  return source.slice(start, end + 3);
}

/**
 * Everything that spends money or makes an image. Each is a SYMBOL, not a line
 * number: `an anchor is a string, never a number`.
 */
const SPENDS_OR_RENDERS = [
  'requestRender',
  'moodboard_begin_render',
  'moodboard_reserve_render_credits',
  'moodboard_finish_render',
  'moodboard_fail_render',
  'readMoodboardRenderConfig',
  'creditsForPart',
  'generateRenderImage',
  'buildRenderPrompt',
  'event_render_credit_usage',
  'event_render_credit_grants',
];

test('applyRenderPick cannot spend a credit and cannot make an image', () => {
  const body = bodyOf(read(ACTIONS), 'applyRenderPick');
  for (const symbol of SPENDS_OR_RENDERS) {
    assert.equal(
      body.includes(symbol),
      false,
      `applyRenderPick reaches ${symbol} — a reference selection must not be able to trigger a render`,
    );
  }
  // It writes the reference row, and that is the whole of what it does.
  assert.ok(body.includes("source_kind: 'render_pick'"));
  assert.ok(body.includes('source_render_id'));
});

test('fetchRenderPool cannot spend a credit and cannot make an image', () => {
  const body = bodyOf(read(ACTIONS), 'fetchRenderPool');
  for (const symbol of SPENDS_OR_RENDERS) {
    assert.equal(body.includes(symbol), false, `fetchRenderPool reaches ${symbol}`);
  }
  assert.ok(body.includes('moodboard_inspiration_pool'), 'the pool read must go through the RPC');
});

test('the whole pick module never imports the render provider', () => {
  // Defence in depth against the per-function window being outflanked by a
  // helper defined elsewhere in the file: if the provider is not imported, no
  // helper in this module can call it either.
  const src = read(ACTIONS);
  assert.equal(src.includes("from '@/lib/gemini-image'"), false);
  assert.equal(src.includes("from './render-actions'"), false);
  assert.equal(src.includes("from '@/lib/moodboard-render-credits'"), false);
});

test('the picker component offers no price, no credit and no Generate', () => {
  const src = read(PICKER);
  const body = src.slice(src.indexOf('*/') + 2); // the header NAMES the cancelled design
  for (const forbidden of ['credit', 'Credit', 'Generate', '₱', 'requestRender']) {
    assert.equal(
      body.includes(forbidden),
      false,
      `the pool picker shows "${forbidden}" — saving a reference costs nothing`,
    );
  }
});

test('the pool picker is MOUNTED, and wired to the free actions', () => {
  // 🔑 A SOURCE GUARD CANNOT SEE A COMPONENT NOBODY RENDERS. The constant being
  // present in the file and the section drawing nothing look identical, so pin
  // the mount and the props that make it work.
  const board = read(BOARD);
  assert.ok(board.includes('<RenderPoolPicker'), 'the pool picker is never mounted');
  assert.ok(board.includes('fetchAction={fetchRenderPoolAction!}'));
  assert.ok(board.includes('applyAction={applyRenderPickAction!}'));

  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('fetchRenderPoolAction={fetchRenderPool}'));
  assert.ok(page.includes('applyRenderPickAction={applyRenderPick}'));
});

/* ── and the paid path stays paid ─────────────────────────────────────────── */

test('requestRender still reads the config and still debits, every time', () => {
  const body = bodyOf(read(RENDER_ACTIONS), 'requestRender');
  // No coarse-match lookup, no substitution, no discount: every render call
  // reaches the provider at the stated price.
  assert.ok(body.includes('readMoodboardRenderConfig'));
  assert.ok(body.includes('creditsForPart'));
  assert.ok(body.includes('moodboard_begin_render'));
  assert.ok(body.includes('generateRenderImage'));
  // The cancelled cache would have shown up as a pool read on the paid path.
  assert.equal(
    body.includes('moodboard_inspiration_pool'),
    false,
    'the paid path must never consult the pool — that is the cache the owner cancelled',
  );
});

test('the couple’s own copy is written from the ORIGINAL bytes, the gallery copy from the marked ones', () => {
  const body = bodyOf(read(RENDER_ACTIONS), 'requestRender');
  // image_key ← image.bytes (never through the watermarker)
  assert.ok(body.includes('body: image.bytes'), "the couple's copy must be the original bytes");
  assert.ok(body.includes('p_image_key: key'));
  // gallery_image_key ← buildGalleryCopy's output, key and bytes together
  assert.ok(body.includes('buildGalleryCopy('));
  assert.ok(body.includes('key: gallery.key'));
  assert.ok(body.includes('body: gallery.bytes'));
  assert.ok(body.includes('contentType: gallery.contentType'));
  assert.ok(body.includes('p_gallery_image_key: gallery.key'));
  // 🔒 AND THE MARKED BYTES NEVER REACH THE PRIVATE KEY. If these two ever
  // converged, a couple would be charged for a render and handed it defaced.
  assert.equal(body.includes('p_image_key: gallery.key'), false);
  assert.equal(body.includes('body: gallery.bytes,\n      contentType: image.mimeType'), false);
});
