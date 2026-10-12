/**
 * ⚡ A WISH ACTION COSTS ONE REQUEST AND RENDERS NO PAGE (owner rule 2026-10-08:
 * "the program created will create the least amount of request for the tasks to
 * be done"; controller-2026-10-08/COMMON.md "THE MINIMUM-REQUEST RULES" 4 · 8 · 11).
 *
 * ── WHAT IT COST BEFORE (measured from the code, 2026-10-08) ───────────────
 * Every add / edit / got-it / remove / reorder in Studio › E-Gifts › Wish list
 * rendered the WHOLE Maker on the server TWICE:
 *   · the door ended with `await revalidateSurfaces()` — and `revalidatePath`
 *     called inside an action makes Next render the action's own route into its
 *     response (`skipFlight: !workStore.pathWasRevalidated`, next 15.5
 *     `action-handler.js`);
 *   · the screen then asked for the same render again
 *     (`makerSave(…, requestMakerRefresh)`, unheld → `router.refresh()`).
 * One person in the Maker is what took production down that morning.
 *
 * ── WHAT THIS HOLDS ────────────────────────────────────────────────────────
 *   1 · BEHAVIOUR, on the Maker's own shared `makerSave` (not a copy): the five
 *       wish actions, sent the way the screen sends them, refresh the Maker ZERO
 *       times — and an unheld save through the same spy refreshes it once, so
 *       the zero is not a spy that cannot fire;
 *   2 · the same five, typed fast: several edits to one wish, the switch flipped
 *       back and forth, a run of arrow-key moves are ONE write each
 *       (`makerLatestWrite`) — an add is never folded (two adds are two wishes);
 *   3 · the screen: every one of its five sends sits in a HELD `makerSave`, the
 *       only thing that still asks for a Maker render is the couple's own "Try
 *       again" on a list that could not be read, and nothing here polls;
 *   4 · the door: the guests' pages are refreshed AFTER the answer is sent, so
 *       the action's own route is never rendered into its response;
 *   5 · the answer: a save hands back the row as kept, and the screen lays it
 *       over what it drew — the reason no re-read is owed.
 *
 * The DATABASE half — how many requests each write sends, counted on the real
 * functions over the replayed schema — is test 8 of
 * `tests/db/the-wish-list-writes-keep-their-rules.db.test.ts`.
 *
 * NOT SEEN (so a green is not over-read): a browser. That Next skips the render
 * when no path was revalidated is read from its own code, not driven here.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08, builder EH):
 *   • `{ held: true }` dropped from the got-it save                      → 3 red;
 *   • `makerLatestWrite` dropped from the edit save                      → 2-pin red (3);
 *   • a `requestMakerRefresh()` added after a kept add                   → 3 red;
 *   • the door back to `await revalidateSurfaces(eventId)`               → 4 red;
 *   • the save answering `{ ok: true }` with no row                      → 5 red;
 *   • `sendHeld` below sent unheld (the test's own probe)                → 1 red.
 *
 * Run from apps/web:  npx tsx --test lib/the-wish-list-costs-one-request.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAKER_REFRESH_COALESCE_MS, MAKER_WRITE_BEAT_MS, SUPERSEDED, makerLatestWrite, makerSave, makerSavesInFlight, type Superseded } from './maker-refresh';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const flat = (rel: string) => read(rel).replace(/\s+/g, ' ');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SCREEN = 'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx';
const DOOR = 'app/dashboard/[eventId]/pabuya/actions.ts';
const WRITES = 'app/dashboard/[eventId]/pabuya/wish-items.server.ts';

type Res = { ok: true } | { ok: false; error: string };
const kept = (r: Res | Superseded) => r === SUPERSEDED || r.ok;

/** The screen's two shapes, on the Maker's own shared functions. */
function probe() {
  const seen = { writes: [] as string[], refreshes: 0 };
  const refresh = () => void (seen.refreshes += 1);
  const write = (name: string) => async (): Promise<Res> => {
    seen.writes.push(name);
    return { ok: true };
  };
  return {
    seen,
    refresh,
    /** An add, a remove: one write each, held. */
    sendHeld: (name: string) => makerSave(write(name), refresh, { held: true }),
    /** An edit, the switch, a move: the latest write for its key, held. */
    sendLatest: (key: string, name: string) => makerSave(() => makerLatestWrite(key, write(name)), refresh, { held: true, ok: kept }),
  };
}

test('1 · the five wish actions, sent as the screen sends them, render the Maker ZERO times', async () => {
  const p = probe();
  await Promise.all([
    p.sendHeld('add'),
    p.sendLatest('wish:w1', 'edit'),
    p.sendLatest('wish-got:w1', 'got'),
    p.sendHeld('delete'),
    p.sendLatest('wish-order', 'move'),
  ]);
  await wait(MAKER_WRITE_BEAT_MS + MAKER_REFRESH_COALESCE_MS * 3);
  assert.deepEqual([...p.seen.writes].sort(), ['add', 'delete', 'edit', 'got', 'move'], 'each wish action is one write');
  assert.equal(p.seen.refreshes, 0, `the five wish actions re-rendered the Maker ${p.seen.refreshes} time(s)`);
  assert.equal(makerSavesInFlight(), 0);

  /* The spy CAN fire: the same save, unheld, brings its one render. */
  await makerSave(async (): Promise<Res> => ({ ok: true }), p.refresh);
  await wait(MAKER_REFRESH_COALESCE_MS * 3);
  assert.equal(p.seen.refreshes, 1, 'an unheld save no longer refreshes — this test could not see a re-render');
});

test('2 · typed fast: edits to one wish, the switch, a run of moves are ONE write each — adds are never folded', async () => {
  const p = probe();
  const burst = [
    ...['name', 'price', 'note'].map((f) => p.sendLatest('wish:w1', `edit w1 ${f}`)),
    ...['on', 'off', 'on'].map((v) => p.sendLatest('wish-got:w1', `got w1 ${v}`)),
    ...[1, 2, 3, 4].map((n) => p.sendLatest('wish-order', `move ${n}`)),
    p.sendLatest('wish:w2', 'edit w2 name'),
    p.sendHeld('add A'),
    p.sendHeld('add B'),
  ];
  const answers = await Promise.all(burst);
  await wait(MAKER_WRITE_BEAT_MS + MAKER_REFRESH_COALESCE_MS * 3);
  assert.deepEqual(
    [...p.seen.writes].sort(),
    ['add A', 'add B', 'edit w1 note', 'edit w2 name', 'got w1 on', 'move 4'],
    'the latest write for a wish carries the ones before it — and another wish, or an add, is its own write',
  );
  assert.equal(answers.filter((a) => a === SUPERSEDED).length, 2 + 2 + 3, 'a carried write must answer SUPERSEDED, never "refused"');
  assert.equal(p.seen.refreshes, 0);
});

test('3 · the screen: five sends, each inside a HELD makerSave; only "Try again" asks for a render; nothing polls', () => {
  const s = flat(SCREEN);
  /* Every makerSave in the file, with everything up to its closing options. */
  const saves = [...s.matchAll(/\bmakerSave\( ?(.*?),? ?requestMakerRefresh, (\{[^}]*\}),? ?\);/g)].map((m) => [m[0], m[1]!.replace(/[\s,]+$/, ''), m[2]!] as const);
  assert.equal(saves.length, 5, `${saves.length} held saves found — add · edit · got · remove · reorder is five`);
  assert.equal(s.match(/\bmakerSave\(/g)?.length, 5, 'a makerSave in this file is not held (it would re-render the whole Maker)');
  const ops: Record<string, string> = {};
  for (const [, send, opts] of saves) {
    const op = /wish_op: '(\w+)'(, wish_item_id)?/.exec(send);
    assert.ok(op, `a save sends no wish_op: ${send.slice(0, 80)}`);
    assert.match(opts, /\bheld: true\b/, `the "${op[1]}" save is not held — a whole-Maker render per press`);
    ops[`${op[1]}${op[1] === 'save' ? (op[2] ? ':edit' : ':add') : ''}`] = send;
  }
  assert.deepEqual(Object.keys(ops).sort(), ['delete', 'got', 'move', 'save:add', 'save:edit']);
  /* The three a couple can repeat quickly fold into one write per wish (or per list). */
  assert.match(ops['save:edit']!, /^\(\) => makerLatestWrite\(`wish:\$\{id\}`, \(\) => action\(form\(\{ wish_op: 'save', wish_item_id: id,/);
  assert.match(ops.got!, /^\(\) => makerLatestWrite\(`wish-got:\$\{id\}`, \(\) => action\(form\(\{ wish_op: 'got', wish_item_id: id,/);
  assert.match(ops.move!, /^\(\) => makerLatestWrite\('wish-order', async \(\) => \{/);
  /* …and the two that must each land are sent straight. */
  assert.match(ops['save:add']!, /^\(\) => action\(form\(\{ wish_op: 'save', name: draft\.name,/);
  assert.match(ops.delete!, /^\(\) => action\(form\(\{ wish_op: 'delete', wish_item_id: id \}\)\)$/);

  /* The ONLY call that asks the Maker to render is the couple's own "Try again" on a list that
     could not be read (the read lives in the page). Everywhere else the name is only handed on. */
  const calls = [...s.matchAll(/requestMakerRefresh\(\)/g)];
  assert.equal(calls.length, 1, `requestMakerRefresh() is called ${calls.length} times`);
  assert.match(s, /label="Try again" data-testid="wish-retry" onClick=\{\(\) => requestMakerRefresh\(\)\}/);
  assert.doesNotMatch(s, /router\.refresh|useRouter|location\.reload|setInterval|revalidate/, 'the wish list refreshes, reloads or polls');
  assert.doesNotMatch(s, /makerRedrawSave|announceUnheldWrite|makerNeedsRender/, 'a wish write reloads the canvas (a guest-page render per press)');
});

test('4 · the door refreshes the guests’ pages AFTER its answer — its own route is never rendered into the response', () => {
  const door = flat(DOOR);
  const at = door.indexOf("if (formData.has('wish_op')) {");
  assert.ok(at > 0, 'the wish list’s door was not found');
  const branch = door.slice(at, door.indexOf('const methodKind', at)).trim();
  assert.match(branch, /const wish = await wishListWrite\(eventId, formData\);/);
  assert.match(branch, /\bafter\(\(\) => revalidateSurfaces\(eventId\)\);/, 'the guests’ pages are no longer refreshed after a wish write');
  assert.doesNotMatch(branch, /await revalidateSurfaces|revalidatePath\(|revalidateTag\(|redirect\(|cookies\(\)/, 'the door marks its own route revalidated: Next renders the whole Maker into the answer');
  assert.match(branch, /return wish; \}$/);
  assert.match(door, /import \{ after \} from 'next\/server';/);
  /* The writes themselves refresh nothing. */
  assert.doesNotMatch(read(WRITES), /revalidatePath|revalidateTag|from 'next\/cache'|cookies\(\)/, 'a wish write revalidates on its own');
});

test('5 · a save answers with the row as kept, and the screen lays it over what it drew', () => {
  const w = flat(WRITES);
  assert.match(w, /export type WishWriteResult = \{ ok: true; wish\?: StudioWishKept \} \| \{ ok: false; error: string \};/);
  /* Add and edit both read their own row back in the SAME write — never a read after it. */
  assert.match(w, /\.insert\(\{[^}]*\}\) \.select\(WISH_ITEM_SELECT\); const added = /);
  assert.match(w, /\.update\(patch\) \.eq\('wish_item_id', id\) \.eq\('event_id', eventId\) \.select\(WISH_ITEM_SELECT\); if \(error\) return \{ ok: false, error: NOT_KEPT \}; const now = /);
  assert.match(w, /if \(error \|\| !added\) return \{ ok: false, error: NOT_KEPT \}; return \{ ok: true, wish: keptWish\(added\) \};/);
  assert.match(w, /if \(!now\) return \{ ok: false, error: GONE \}; return \{ ok: true, wish: keptWish\(now\) \};/);

  const s = flat(SCREEN);
  /* An add: the row as kept takes the drawn one's place (its real id), or joins the list. */
  assert.match(s, /if \(row\) setWishes\(\(cur\) => \(cur\.some\(\(w\) => w\.id === temp\.id\) \? cur\.map\(\(w\) => \(w\.id === temp\.id \? \{ \.\.\.w, \.\.\.row \} : w\)\)/);
  /* An edit: laid over the row. */
  assert.match(s, /if \(res !== SUPERSEDED && res\.ok && res\.wish\) lay\(id, res\.wish\);/);
  /* A refusal puts back the ONE wish it was about — never a snapshot of the whole list. */
  assert.doesNotMatch(s, /setWishes\(was\)/, 'a refusal restores a whole-list snapshot (it would undo changes that landed meanwhile)');
  assert.match(s, /if \(was\) putBack\(was\); return refusal\(res\);/);
  /* A reorder waits for a wish still on its way in, so the order names real rows only. */
  assert.match(s, /const ids = await Promise\.all\(order\.map\(\(w\) => adding\.current\.get\(w\.id\) \?\? w\.id\)\);/);
});
