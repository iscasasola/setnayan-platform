/**
 * 🚶 THE WEDDING MARCH WAITS FOR APPLY (owner 2026-10-06, DECISION_LOG "THE
 * WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER": *"Wait for apply"*;
 * 2026-10-07: *"build the step 1-6 completely and all its fixes"*).
 *
 * Each test is one way the ruling could be quietly broken:
 *   · a drop writes the march guests see before Apply;
 *   · Apply replays the drafted steps out of order, or drops one — so what goes
 *     live is not what the couple arranged;
 *   · Undo takes back more (or less) than the last move;
 *   · opening the march writes something;
 *   · a drafted move, re-read from the draft, is drawn somewhere other than
 *     where it was dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import { marchSections, marchTray, printedSectionOrder } from '@/lib/march-sections';
import {
  planMove,
  planSectionsDefault,
  replayMarch,
  replayMarchStep,
  type MarchShown,
  type MarchSource,
  type MarchStep,
  type MarchTarget,
} from '@/lib/march-drag';
import { MARCH_DRAFT_MAX_MOVES, runDraftedMarch, sanitizeMarchMoves } from '@/lib/march-draft';
import {
  emptyHubDraft,
  hubDraftHasChanges,
  mergeHubDraft,
  planHubDraftApply,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  type HubDraft,
  type HubLiveState,
} from '@/lib/hub-draft';
import { hubDraftChangeLines } from '@/lib/hub-draft-change-lines';
import type { MarchResult } from '@/lib/march-result';
import { stripComments } from './strip-comments';

type G = EntourageGuestRow & { guest_id: string };
const g = (id: string, first: string, role: string, walk?: [number, number], side = 'both', out = false): G => ({
  guest_id: id,
  first_name: first,
  last_name: 'Test',
  role,
  side,
  extra_roles: [],
  march: walk ? { walk_no: walk[0], place_in_walk: walk[1] } : null,
  ...(out ? { not_walking: true } : {}),
});

/** A wedding's march: the couple and parents, sponsors, the crew, bearers — and two people not walking. */
function rows(): G[] {
  return [
    g('groom', 'Jose', 'groom', undefined, 'groom'),
    g('gdad', 'Manuel', 'groom_parents', [0, 0], 'groom'),
    g('gmom', 'Rosa', 'groom_parents', [0, 1], 'groom'),
    g('bride', 'Maria', 'bride', undefined, 'bride'),
    g('bmom', 'Lita', 'bride_parents', [9, 0], 'bride'),
    g('n1', 'Ricardo', 'principal_sponsor_ninong', [2, 0]),
    g('a1', 'Jessica', 'principal_sponsor_ninang', [2, 1]),
    g('n2', 'Cesar', 'principal_sponsor_ninong', [3, 0]),
    g('a2', 'Pilar', 'principal_sponsor_ninang', [3, 1]),
    g('n3', 'Ben', 'principal_sponsor_ninong', [4, 0]),
    g('c1', 'Paolo', 'candle_sponsor', [5, 0]),
    g('c2', 'Ivy', 'candle_sponsor', [5, 1]),
    g('v1', 'Karl', 'veil_sponsor', [6, 0]),
    g('bm', 'Joy', 'bridesmaid', [7, 0]),
    g('gm', 'Dennis', 'groomsman', [7, 1]),
    g('rb', 'Joaquin', 'ring_bearer', [8, 0]),
    g('cb', 'Enzo', 'coin_bearer', [8, 1]),
    g('gm2', 'Vince', 'groomsman', undefined, 'groom', true),
    g('fg', 'Sofia', 'flower_girl', undefined, 'bride', true),
  ];
}

/** The live march, as the loader hands it to the maker. */
function live(saved: string[] | null = null): MarchShown {
  const walking = buildEntourage(rows().filter((r) => !r.not_walking), saved, {}, undefined, { march: true });
  const outGroups = buildEntourage(rows().filter((r) => r.not_walking), saved, {}, undefined, { march: true });
  return { sections: marchSections(walking), printed: printedSectionOrder([...walking, ...outGroups], saved), out: marchTray(outGroups) };
}

/** A run of drops, each planned on the march AS DRAWN after the ones before (the maker's own loop). */
const GESTURES: ReadonlyArray<[MarchSource, MarchTarget]> = [
  [{ kind: 'name', id: 'c1' }, { kind: 'name', id: 'v1' }], // trade places
  [{ kind: 'name', id: 'gmom' }, { kind: 'gap', section: 'groom_side', index: 0 }], // out of a pair, above it
  [{ kind: 'name', id: 'a1' }, { kind: 'tray' }], // not walking — her ninong walks alone
  [{ kind: 'out', id: 'gm2' }, { kind: 'gap', section: 'bridesmaids_groomsmen', index: 0 }], // back in, at a gap
  [{ kind: 'out', id: 'fg' }, { kind: 'gap', section: 'bearers', index: 0 }], // back in — a section of her own returns
  [{ kind: 'name', id: 'cb' }, { kind: 'gap', section: 'bearers', index: 0 }], // out of a pair, to a gap
  [{ kind: 'section', key: 'bearers' }, { kind: 'section', key: 'principal_sponsors' }], // a whole section
  [{ kind: 'name', id: 'a2' }, { kind: 'beside', anchor: 'n1' }], // walk together (her ninong walks alone)
];

/** Every drop of `GESTURES`, planned in turn — what the maker draws at each drop. */
function planAll(start: MarchShown) {
  let shown = start;
  const plans: Array<{ before: MarchShown; steps: MarchStep[]; after: MarchShown }> = [];
  for (const [source, target] of GESTURES) {
    const plan = planMove(shown.sections, shown.printed, source, target, shown.out);
    assert.ok(plan && plan.ok, `the fixture's drop was refused: ${JSON.stringify(source)} → ${JSON.stringify(target)} ${plan && !plan.ok ? plan.reason : ''}`);
    const after: MarchShown = { sections: plan.sections, printed: plan.printed, out: plan.out ?? shown.out };
    plans.push({ before: shown, steps: plan.steps, after });
    shown = after;
  }
  return plans;
}

/** The draft as the server stores it after these saves — through the JSON column and its reader. */
function drafted(moves: MarchStep[][]): HubDraft {
  let d = emptyHubDraft();
  for (const move of moves) d = sanitizeHubDraft(JSON.parse(JSON.stringify(mergeHubDraft(d, { march: [move] }))));
  return d;
}

const LIVE: HubLiveState = { events: {}, widgets: [] };

test('a drafted move is drawn exactly where it was dropped — the live march with the steps laid on', () => {
  for (const p of planAll(live())) {
    // Re-read from the draft, the Maker draws the live march + the steps: it must be what the drop drew.
    assert.deepEqual(replayMarch(p.before, p.steps), p.after, `drawn somewhere else after a re-read: ${JSON.stringify(p.steps)}`);
  }
  // The usual section order back, too.
  const arranged = live(['bearers', 'parents', 'secondary_sponsors', 'principal_sponsors']);
  const back = planSectionsDefault(arranged.sections, arranged.printed);
  assert.ok(back && back.ok);
  assert.deepEqual(replayMarch(arranged, back.steps), { sections: back.sections, printed: back.printed, out: arranged.out });
});

test('a march drop changes NO guest-visible row before Apply — the maker’s only door is the draft’s save', () => {
  const maker = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'), 'utf8'));
  // 🔑 Not one shipped march action is reachable from the maker — every one writes the march guests read.
  for (const door of ['march-actions', 'entourage-order-actions', 'pair-actions', 'march-step', 'swapEntouragePlaces', 'joinEntourageLine', 'setEntourageLineOrder', 'setMarchWalking', 'unpairGuestAction', 'moveEntourageSection', 'resetEntourageSections', 'callMarchStep']) {
    assert.ok(!maker.includes(door), `the march maker reaches ${door} — a drop would reach guests before Apply`);
  }
  assert.match(maker, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(patch\)\);\s*const \{ hubDraftAction \} = await import\('\.\.\/\.\.\/website\/hub-draft-actions'\);\s*const r = await hubDraftAction\(eventId, fd\);/, 'a drop is not a draft save');
  assert.match(maker, /\{ march: \[plan\.steps\] \}/, 'a drop does not put its steps in the draft');
  // The live-write marks are gone with it.
  assert.doesNotMatch(maker, /HubSavesImmediately|data-writes-live/, 'the march still says it writes live');
  // …and the save is draft-only on the server: `march` is a draft key, never a live column.
  const d = drafted(planAll(live()).map((p) => p.steps));
  assert.deepEqual(d.events, {});
  assert.deepEqual(d.widgets, {});
  assert.equal(d.march?.length, GESTURES.length);
  assert.ok(hubDraftHasChanges(d));
});

test('Apply replays every drafted step IN ORDER through the shipped actions — and lands where the instant march did', async () => {
  const plans = planAll(live());
  // The instant path (before 2026-10-06): each drop's steps sent at once.
  let instant = live();
  const instantCalls: MarchStep[] = [];
  for (const p of plans) for (const s of p.steps) {
    instantCalls.push(s);
    instant = replayMarchStep(instant, s);
  }
  // The drafted path: every drop into the draft (through storage), then Apply.
  const draft = drafted(plans.map((p) => p.steps));
  const plan = planHubDraftApply(draft, LIVE, false);
  const item = plan.apply.find((i) => i.kind === 'march');
  assert.ok(item && item.kind === 'march', 'Apply has nothing to replay');
  assert.equal(plan.refused.length, 0, 'a march move was held for Pro');
  let server = live();
  const calls: MarchStep[] = [];
  const replay = await runDraftedMarch(item.value, async (step): Promise<MarchResult> => {
    calls.push(step);
    server = replayMarchStep(server, step);
    return { ok: true, written: 1 };
  });
  assert.deepEqual(calls, instantCalls, 'Apply sent different steps, or in another order, than the drops made');
  assert.equal(replay.applied, instantCalls.length);
  assert.deepEqual(server, instant, 'what went live at Apply is not what the instant march would have made');
  assert.deepEqual(server, plans.at(-1)!.after, 'what went live is not what the couple saw in the Maker');
});

test('a refused step ends the replay (the rest is dropped, said by name); a step that could not be sent stays drafted', async () => {
  const moves = planAll(live()).map((p) => p.steps);
  const total = moves.flat().length;
  // Refused at the 3rd step: two made, nothing left, the server's words kept.
  let n = 0;
  const refused = await runDraftedMarch(moves, async () => (++n === 3 ? { ok: false, reason: 'They already walk together.' } : { ok: true, written: 1 }));
  assert.deepEqual(refused, { applied: 2, stopped: 'They already walk together.', failed: false, left: [] });
  // Thrown at the 3rd step: two made — and the 3rd and every one after it wait for the next Apply.
  n = 0;
  const thrown = await runDraftedMarch(moves, async () => {
    if (++n === 3) throw new Error('network');
    return { ok: true, written: 1 };
  });
  assert.equal(thrown.failed, true);
  assert.equal(thrown.applied, 2);
  assert.equal(thrown.left.flat().length, total - 2, 'a step was lost (or repeated) after a failed send');
  assert.deepEqual(thrown.left.flat(), moves.flat().slice(2));
});

test('Undo takes back exactly the last move — the march’s own Undo and the toolbar’s ↺', () => {
  const moves = planAll(live()).map((p) => p.steps);
  const d = drafted(moves);
  // The march's toast Undo: the last drafted move comes back off, the rest stay.
  const once = mergeHubDraft(d, { marchUndo: true });
  assert.deepEqual(once.march, moves.slice(0, -1));
  // …and drawn, it is the march as it stood before that drop.
  const plans = planAll(live());
  assert.deepEqual(replayMarch(live(), once.march!.flat()), plans.at(-2)!.after);
  // The toolbar's ↺ Undo steps the draft back one save — the same last move.
  assert.deepEqual(undoHubDraft(d).march, moves.slice(0, -1));
  // Undo of the only move leaves nothing drafted.
  const one = mergeHubDraft(emptyHubDraft(), { march: [moves[0]!] });
  assert.equal(mergeHubDraft(one, { marchUndo: true }).march, undefined);
  assert.equal(hubDraftHasChanges(mergeHubDraft(one, { marchUndo: true })), false);
});

test('opening the march writes nothing — the draft is saved only from a drop or its Undo', () => {
  const maker = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'), 'utf8'));
  // ONE server door, used in ONE place…
  assert.equal((maker.match(/hubDraftAction\(/g) ?? []).length, 1, 'the maker calls the draft action from somewhere new');
  assert.equal((maker.match(/draftStep\(/g) ?? []).length, 2, 'the draft save is reached from somewhere new (its definition + the commit)');
  // …and `commit` is reached only from a drop (`run`) or the toast's Undo — never from a mount or an effect.
  const calls = [...maker.matchAll(/\bcommit\(/g)].map((m) => m.index!);
  assert.equal(calls.length, 2, `commit is called from ${calls.length} places`);
  for (const at of calls) {
    const before = maker.slice(0, at);
    const owner = Math.max(before.lastIndexOf('const run = useCallback('), before.lastIndexOf('const undo = () =>'), before.lastIndexOf('useEffect('), before.lastIndexOf('useLayoutEffect('));
    assert.ok(
      owner === before.lastIndexOf('const run = useCallback(') || owner === before.lastIndexOf('const undo = () =>'),
      'commit is called from an effect — opening the march would write the draft',
    );
  }
});

test('the ✓ Apply sheet names the march: "Wedding March · N changes" — one line, counted once', () => {
  const moves = planAll(live()).map((p) => p.steps).slice(0, 3);
  const d = drafted(moves);
  assert.deepEqual(hubDraftChangeLines(d, LIVE, false), [{ place: 'Wedding March', what: '3 changes', pro: false, held: false }]);
  assert.equal(summarizeHubDraft(d, LIVE, false).changeCount, 1);
  assert.deepEqual(hubDraftChangeLines(drafted(moves.slice(0, 1)), LIVE, false)[0]!.what, '1 change');
});

test('the draft keeps only the shipped moves — a hand-made step is dropped with its whole move', () => {
  const good: MarchStep[] = [{ kind: 'swap', section: 'bearers', a: 'rb', b: 'cb' }];
  assert.deepEqual(sanitizeMarchMoves([good, [{ kind: 'swap', section: 'bearers', a: 'rb' }], [{ kind: 'drop_table' }], []]), [good]);
  assert.equal(sanitizeMarchMoves([]), undefined);
  assert.equal(sanitizeMarchMoves(Array.from({ length: MARCH_DRAFT_MAX_MOVES + 5 }, () => good))!.length, MARCH_DRAFT_MAX_MOVES);
  // The server refuses a move past the bound, in words — never one silently dropped by the reader.
  const action = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'hub-draft-actions.ts'), 'utf8');
  assert.match(action, /\(current\.march\?\.length \?\? 0\) \+ patch\.march\.length > MARCH_DRAFT_MAX_MOVES\) \{\s*return \{ ok: false, intent, error: MARCH_DRAFT_FULL_MESSAGE \};/);
  // …and Apply sends each step through the shipped dispatch, after every other write.
  assert.match(action, /const replay = await runDraftedMarch\(item\.value, \(step\) => callMarchStep\(eventId, step\)\);/);
});
