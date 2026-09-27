/**
 * the-draft-always-fits.test.ts — THE EVENT HUB DRAFT NEVER HITS ITS SIZE CAP,
 * AND A FAILED SAVE NEVER CRASHES THE MAKER.
 *
 * Prod, 2026-09-27, the owner editing his own wedding's Event Hub:
 *   · `event_site_drafts_draft_json_check` caps `octet_length(draft_json::text)`
 *     at 200,000. The draft reached 195,719 bytes — 7 Undo states were 167,689
 *     of them, because each is a FULL state and a traced Logo is ~24 KB a save.
 *     Undo was capped by COUNT only, so the next save hit the cap, and so did
 *     every save after it.
 *   · the Maker's element sheet said "Something went wrong" (the one action
 *     already caught it), but a plain form save to the draft THREW, and the
 *     Maker's POST came back as a full 500 page (digest 1691351420).
 *   · after a clean Apply the ⋯ panel stayed open over the Maker.
 *
 * Layers, because `lib/hub-draft-store.ts` is `server-only` (unimportable in a
 * bare `tsx --test` run) and `HubDraftToolbar` needs a real App Router:
 *   1. THE RULES, proved on the pure functions (`lib/hub-draft.ts`).
 *   2. THE WIRING, proved on the source: every door runs through them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

import {
  HUB_DRAFT_BYTE_BUDGET,
  HUB_DRAFT_DB_BYTE_CAP,
  HUB_DRAFT_HISTORY_LIMIT,
  HUB_DRAFT_SAVE_FAILED_MESSAGE,
  HUB_DRAFT_TOO_LARGE_MESSAGE,
  HubDraftTooLargeError,
  emptyHubDraft,
  fitHubDraftHistory,
  hubDraftBounceHref,
  hubDraftBytes,
  hubDraftForWrite,
  hubDraftPanelStaysOpen,
  hubDraftSaveFailure,
  hubDraftSaveFailureText,
  mergeHubDraft,
  sanitizeHubDraft,
  undoHubDraft,
  type HubDraft,
} from './hub-draft';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The text of one function, from its declaration to the next top-level one. */
function fnBody(source: string, name: string): string {
  const start = source.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*[(<]`, 'm'));
  assert.ok(start >= 0, `${name} not found`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?(?:async\s+)?function\s+\w+|^export\s+(?:const|type)\s/m);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

/* ── a realistic Logo save: a traced mark (~14 KB) plus its studio layers ── */

const SVG_HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="';
/** A distinct traced mark per edit, ~`kb` KB — the owner's was ~14 KB. */
function tracedSvg(edit: number, kb = 14): string {
  let d = `M${edit} ${edit}`;
  for (let i = 0; d.length < kb * 1000; i += 1) d += ` L${(i * 7 + edit) % 997} ${(i * 13 + edit) % 991}`;
  return `${SVG_HEAD}${d}"/></svg>`;
}
/** Studio layers with traced strokes, ~11 KB like the owner's. */
function studioConfig(edit: number) {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 300; i += 1) pts.push({ x: (i * 3 + edit) % 500, y: (i * 5 + edit) % 500 });
  return { text: 'M&J', strokes: [{ pts, w: 4 }] };
}
const logoEdit = (edit: number) => ({
  events: { monogram_custom_svg: tracedSvg(edit), monogram_studio_config: studioConfig(edit) },
});

/* ═══════════════════════════════════════════ 1 · measuring like Postgres ═══ */

/** Postgres's `jsonb::text`, re-implemented plainly: ", " and ": " separators. */
function jsonbText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonbText).join(', ')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${JSON.stringify(k)}: ${jsonbText(x)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(v);
}

test('bytes are counted the way Postgres counts octet_length(jsonb::text) — UTF-8, with its spaces', () => {
  const samples: unknown[] = [
    emptyHubDraft(),
    { v: 1, events: { special_message: 'Ñiño ✨ 💍 "quoted" \\ back\nline\t' }, widgets: {}, history: [] },
    { s: 'é'.repeat(1000), c: '\u0001', n: [1.5, -3, 0], deep: { a: [{}, [], null, true] } },
    mergeHubDraft(emptyHubDraft(), logoEdit(1)),
  ];
  for (const s of samples) {
    assert.equal(hubDraftBytes(s), Buffer.byteLength(jsonbText(s), 'utf8'), JSON.stringify(s).slice(0, 60));
  }
  // Never string length: 'é' is one UTF-16 unit and two UTF-8 bytes.
  assert.ok(hubDraftBytes({ s: 'é'.repeat(1000) }) > JSON.stringify({ s: 'é'.repeat(1000) }).length + 900);
});

test('the budget sits safely under the row CHECK', () => {
  assert.equal(HUB_DRAFT_DB_BYTE_CAP, 200_000);
  assert.ok(HUB_DRAFT_BYTE_BUDGET <= HUB_DRAFT_DB_BYTE_CAP - 15_000, 'headroom for what cannot be measured exactly');
  const migration = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271246169682_event_site_drafts.sql'),
    'utf8',
  );
  assert.match(migration, new RegExp(`octet_length\\(draft_json::text\\) <= ${HUB_DRAFT_DB_BYTE_CAP}`));
});

/* ═══════════════════════════════════════ 2 · the history fits the budget ═══ */

test('forty Logo edits never grow the draft past the budget, and Undo keeps the NEWEST states', () => {
  let d = emptyHubDraft();
  let before: HubDraft = d;
  for (let edit = 1; edit <= 40; edit += 1) {
    before = d;
    d = mergeHubDraft(d, logoEdit(edit));
    assert.ok(hubDraftBytes(d) <= HUB_DRAFT_BYTE_BUDGET, `edit ${edit}: ${hubDraftBytes(d)} bytes`);
  }
  // The current state is the last edit, whole.
  assert.equal(d.events.monogram_custom_svg, tracedSvg(40));
  // Undo still works — several steps of it — and the step back is the edit before.
  assert.ok(d.history.length >= 3, `only ${d.history.length} Undo steps survived`);
  assert.ok(d.history.length < HUB_DRAFT_HISTORY_LIMIT, 'the byte budget, not the count, is what trimmed it');
  assert.equal(d.history[d.history.length - 1]!.events.monogram_custom_svg, before.events.monogram_custom_svg);
  assert.equal(undoHubDraft(d).events.monogram_custom_svg, tracedSvg(39));
  // What was dropped is the OLDEST: the history is a contiguous run ending at edit 39.
  const kept = d.history.map((h) => h.events.monogram_custom_svg);
  const first = 40 - kept.length;
  kept.forEach((svg, i) => assert.equal(svg, tracedSvg(first + i), `history[${i}]`));
});

test('the prod shape — a stored 195 KB draft — is brought under the budget on read', () => {
  // Built without mergeHubDraft, the way the row really held it before this fix.
  const states = Array.from({ length: 8 }, (_, i) => mergeHubDraft(emptyHubDraft(), logoEdit(i + 1)));
  const stored = { ...states[7]!, history: states.slice(0, 7).map(({ events, widgets }) => ({ events, widgets })) };
  assert.ok(hubDraftBytes(stored) > HUB_DRAFT_BYTE_BUDGET, 'the fixture must start over the budget');
  const d = sanitizeHubDraft(stored);
  assert.ok(hubDraftBytes(d) <= HUB_DRAFT_BYTE_BUDGET);
  assert.equal(d.events.monogram_custom_svg, tracedSvg(8), 'the current state is never dropped');
  assert.equal(d.history[d.history.length - 1]!.events.monogram_custom_svg, tracedSvg(7), 'the newest Undo step stays');
});

test('a draft that already fits is handed back untouched', () => {
  const d = mergeHubDraft(mergeHubDraft(emptyHubDraft(), logoEdit(1)), logoEdit(2));
  assert.equal(fitHubDraftHistory(d), d);
  assert.equal(hubDraftForWrite(d), d);
});

/* ═══════════════════════ 3 · a current state that can never fit is refused ═══ */

test('a current state over the budget on its own is REFUSED with the specific words — not written', () => {
  const huge = mergeHubDraft(emptyHubDraft(), {
    events: { monogram_custom_svg: tracedSvg(1, 190), monogram_studio_config: studioConfig(1) },
  });
  const fitted = fitHubDraftHistory({ ...huge, history: [...huge.history, ...huge.history] });
  assert.deepEqual(fitted.history, [], 'every Undo step goes before anything else is refused');
  let thrown: unknown = null;
  try {
    hubDraftForWrite(huge);
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof HubDraftTooLargeError, 'an oversized draft must be refused before the write');
  assert.equal(hubDraftSaveFailure(thrown), 'too_large');
  assert.equal(hubDraftSaveFailureText('too_large'), HUB_DRAFT_TOO_LARGE_MESSAGE);
  assert.match(HUB_DRAFT_TOO_LARGE_MESSAGE, /too large to save — remove a layer or an image/);
  assert.equal(hubDraftSaveFailure(new Error('network')), 'failed');
  assert.equal(hubDraftSaveFailureText('failed'), HUB_DRAFT_SAVE_FAILED_MESSAGE);
  assert.equal(hubDraftSaveFailureText('<script>'), null, 'only the two known words ever become text');
});

test('the store writes ONLY what hubDraftForWrite hands back, before touching the row', () => {
  const body = fnBody(src('lib/hub-draft-store.ts'), 'writeHubDraft');
  const guard = body.indexOf('hubDraftForWrite(');
  const firstWrite = body.indexOf(".from('event_site_drafts')");
  assert.ok(guard > 0 && firstWrite > guard, 'the size rule must run before the first write');
  assert.match(body, /const draft = hubDraftForWrite\(draftIn\);/);
  assert.doesNotMatch(body.slice(firstWrite), /draftIn/, 'the unfitted draft must never reach the row');
});

/* ═════════════════════════════════ 4 · a failed save never crashes the page ═══ */

test('a failed form save bounces back to where it came from, with draft_error — never a thrown 500', () => {
  const fd = new FormData();
  fd.set('return_to', '/dashboard/E1/launch?scene=W1');
  assert.equal(hubDraftBounceHref(fd, '/dashboard/E1/launch', 'too_large'), '/dashboard/E1/launch?scene=W1&draft_error=too_large');
  const bare = new FormData();
  assert.equal(hubDraftBounceHref(bare, '/dashboard/E1/launch', 'failed'), '/dashboard/E1/launch?draft_error=failed');
  const hostile = new FormData();
  hostile.set('return_to', 'https://evil.test/x');
  assert.equal(hubDraftBounceHref(hostile, '/dashboard/E1/launch', 'failed'), '/dashboard/E1/launch?draft_error=failed');

  const save = fnBody(src('lib/hub-draft-store.ts'), 'saveHubDraftPatch');
  assert.match(
    save,
    /try \{[\s\S]*writeHubDraft\([\s\S]*\} catch \(e\) \{[\s\S]*redirect\(hubDraftBounceHref\(back\.formData, back\.fallback, hubDraftSaveFailure\(e\)\)\)/,
    'saveHubDraftPatch must turn a failed write into a redirect back, not a throw',
  );
  const words = fnBody(src('lib/hub-draft-store.ts'), 'draftEventsAndReturn');
  assert.match(words, /saveHubDraftPatch\(eventId, \{ events \}, \{ formData, fallback \}\)/, 'the words door must pass its way back');
});

test('EVERY saveHubDraftPatch caller either passes its way back or catches and returns', () => {
  // Every file under app/ and lib/ that calls it — a new door is scanned the day it lands.
  const files = ['app', 'lib']
    .flatMap((root) =>
      (readdirSync(join(WEB, root), { recursive: true }) as string[]).map((f) => join(root, f)),
    )
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== join('lib', 'hub-draft-store.ts'))
    .filter((f) => readFileSync(join(WEB, f), 'utf8').includes('saveHubDraftPatch('));
  for (const must of ['widgets/actions.ts', 'editor/actions.ts', 'hero-photo/actions.ts', 'photo-moments/actions.ts']) {
    assert.ok(files.some((f) => f.endsWith(must)), `the sweep must reach ${must} (found: ${files.join(', ')})`);
  }
  let calls = 0;
  for (const f of files) {
    const s = src(f);
    for (const m of s.matchAll(/await saveHubDraftPatch\(/g)) {
      calls += 1;
      // The call's own arguments, by balanced parentheses.
      let depth = 0;
      let i = m.index! + 'await saveHubDraftPatch'.length;
      const open = i;
      for (; i < s.length; i += 1) {
        if (s[i] === '(' || s[i] === '{' || s[i] === '[') depth += 1;
        else if (s[i] === ')' || s[i] === '}' || s[i] === ']') depth -= 1;
        if (depth === 0) break;
      }
      const args = s.slice(open, i + 1);
      const inTry = /try \{\s*$/.test(s.slice(Math.max(0, m.index! - 40), m.index!));
      const bounces = /, \{ formData, fallback\b[\s\S]*\}\s*,?\s*\)$/.test(args.replace(/\s+/g, ' '));
      assert.ok(bounces || inTry, `${f}: a draft save with no way back and no catch would crash the page:\n${args.slice(0, 200)}`);
    }
  }
  assert.ok(calls >= 5, `expected every draft door to be scanned, found ${calls}`);
  // The one that RETURNS (Camera cues) says the specific words too.
  assert.match(
    src('app/dashboard/[eventId]/website/photo-moments/actions.ts'),
    /catch \(e\) \{[\s\S]*e instanceof HubDraftTooLargeError[\s\S]*HUB_DRAFT_TOO_LARGE_MESSAGE/,
  );
});

test('the one draft action says "too large" in words, and everything else as the kept-draft line', () => {
  const s = src('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(s, /if \(e instanceof HubDraftTooLargeError\) return \{ ok: false, intent, error: HUB_DRAFT_TOO_LARGE_MESSAGE \};/);
  assert.match(s, /return \{ ok: false, intent, error: HUB_DRAFT_SAVE_FAILED_MESSAGE \};/);
});

test('the bounce reaches the RENDER: launch page → HubDraftDock → the toolbar, and through the editor redirect', () => {
  const launch = src('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<HubDraftDock eventId=\{eventId\} saveError=\{one\(search\.draft_error\)\} \/>/);
  const dock = src('app/dashboard/[eventId]/website/_components/hub-draft-dock.tsx');
  assert.match(dock, /saveError=\{hubDraftSaveFailureText\(saveError\)\}/);
  const bar = fnBody(src('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx'), 'HubDraftToolbar');
  assert.match(bar, /saveStatus \?\? \(saveError \? \{ state: 'error', text: saveError \} : null\)/);
  assert.match(bar, /role=\{status\.state === 'error' \? 'alert' : 'status'\}/);
  const editor = src('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(editor, /q\.set\('draft_error', draftError\)/, '/website/editor forwards to the Maker and must carry the error');
});

/* ═══════════════════════════════════════════ 5 · the ⋯ panel after Apply ═══ */

test('the ⋯ panel closes after a clean Apply, and opens only when there is something to read', () => {
  const ok = (intent: 'apply' | 'undo' | 'restore' | 'reset' | 'save', held: Array<{ label: string; reason: 'needs_pro' }> = []) =>
    ({ ok: true, intent, applied: 2, held }) as const;
  assert.equal(hubDraftPanelStaysOpen(ok('apply')), false, 'a clean Apply closes the panel');
  assert.equal(hubDraftPanelStaysOpen(ok('undo')), false);
  assert.equal(hubDraftPanelStaysOpen(ok('restore')), false);
  assert.equal(hubDraftPanelStaysOpen(ok('apply', [{ label: 'The ombre', reason: 'needs_pro' }])), true, 'a held key is never silent');
  assert.equal(hubDraftPanelStaysOpen(ok('reset')), true, "Reset's own note is read in the panel");
  assert.equal(hubDraftPanelStaysOpen({ ok: false, intent: 'apply', error: 'x' }), true, 'an error is never silent');

  const bar = fnBody(src('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx'), 'HubDraftToolbar');
  assert.match(bar, /if \(result\) setOpen\(hubDraftPanelStaysOpen\(result\)\);/);
  const act = bar.slice(bar.indexOf('const act ='), bar.indexOf('};', bar.indexOf('const act =')));
  assert.doesNotMatch(act, /setOpen\(true\)/, 'pressing a button must not pin the panel open before the answer');
});
