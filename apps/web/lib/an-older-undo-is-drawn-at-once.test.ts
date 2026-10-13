/**
 * ↺ AN OLDER UNDO IS DRAWN AT ONCE — not only the last scene drag (plan `UNDO_PLAN_2026-10-13.md` phase 1).
 *
 * Owner rules: *"a press answers at once"* (≤ 100 ms) · *"never a silent refusal"* · one press = one undo step.
 * MEASURED before (lab, production latencies): only the LAST scene-drag ↺ was drawn at once; the 2nd ↺ of a run of
 * moves and every ↺ of a Style · Text · Animate · words · RSVP-line pick waited 6–10 s for a whole-Maker render and a
 * new canvas page, because the Maker remembered one drawable step and forgot it at the next save of any kind.
 *
 * Now every held save leaves its inverse in a JOURNAL as it is sent (`lib/maker-drawn-undo.ts`), the draft answers
 * carry a STAMP of the state they left (`lib/hub-draft-stamp.ts`), and a ↺ draws the newest step backwards in its own
 * click and sends a HELD undo naming the state it expects (`lib/maker-undo-run.ts`). Held here:
 *   G1 the journal: noted at send · a run folded into one step (the FIRST before, the LAST next) · a barrier for every
 *      write it did not draw · cleared on Restore / Apply · trimmed to the server's stamp · ten at most.
 *   G2 the stamp: one name per state however it is spelled; an undo always steps ONE back and says `matched`.
 *   G3 the claim: move A, move B, ↺, ↺ — BOTH drawn, no unheld write, no render owed; Style 100 → 110 → ↺ — the
 *      Maker's copy reads 100 at once and the undo goes held, naming 110's stamp; Style then a move then ↺ ↺.
 *   G4 refusals: a refused ↺ puts the step back, keeps it on top, and SAYS why; `matched: false` → the truth path.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { createUndoJournal, stampOf, type DrawnUndo, type UndoStep } from './maker-drawn-undo';
import { canonicalJson, hubDraftStamp, hubDraftUndoMatched } from './hub-draft-stamp';
import { emptyHubDraft, mergeHubDraft, sanitizeHubDraft, undoHubDraft, type HubDraft } from './hub-draft';
import type { HubSectionCanvas } from './hub-canvas';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const tick = () => new Promise((r) => setTimeout(r, 0));
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SUP = Symbol('superseded');

/* ── a step that records how it was drawn ── */
function stepOf(name: string, log: string[], key?: string): UndoStep {
  return {
    ...(key ? { key } : {}),
    undraw: () => {
      log.push(`undraw ${name}`);
      return { settle: Promise.resolve('shown'), landed: (ok) => log.push(`${ok ? 'kept' : 'put back'} ${name}`) };
    },
  };
}
const ok = (stamp: string) => Promise.resolve({ ok: true, intent: 'save', stamp });

/* ═════════════ G1 — the journal ═════════════ */

test('G1 a step is noted at SEND: a ↺ pressed while its save is still on its way finds it on top', async () => {
  const j = createUndoJournal((a) => a === SUP);
  const log: string[] = [];
  let answer!: (v: unknown) => void;
  const e = j.push(stepOf('A', log), new Promise((r) => (answer = r)));
  assert.equal(j.top(), e, 'on top before any answer');
  answer({ ok: true, stamp: 's1' });
  await tick();
  assert.equal(stampOf(e.answer), 's1', 'the answer (its stamp) is kept beside the step');
});

test('G1 a run of quick picks is ONE step: its ↺ draws back to the FIRST before, its put-back to the LAST next', async () => {
  const j = createUndoJournal((a) => a === SUP);
  const log: string[] = [];
  j.push(stepOf('110', log, 'canvas:hero'), Promise.resolve(SUP));
  j.push(stepOf('120', log, 'canvas:hero'), ok('s120'));
  await tick();
  assert.equal(j.size(), 2);
  const top = j.top();
  assert.ok(top && top !== 'barrier');
  assert.equal(j.size(), 1, 'the carried write is folded into the one that carried it');
  const d = top.step.undraw()!;
  assert.deepEqual(log, ['undraw 120', 'undraw 110'], 'newest drawn back first — the page ends at the run’s FIRST before');
  log.length = 0;
  d.landed(false);
  assert.deepEqual(log, ['put back 110', 'put back 120'], 'a refused ↺ lays the run on again, ending at its LAST next');
});

test('G1 a write the Maker did not draw is a BARRIER (and a carried write with nothing to fold into becomes one)', async () => {
  const j = createUndoJournal((a) => a === SUP);
  const log: string[] = [];
  j.push(stepOf('A', log), ok('sA'));
  j.barrier();
  assert.equal(j.top(), 'barrier');
  j.barrier();
  assert.equal(j.size(), 2, 'two barriers in a row are one');
  const k = createUndoJournal((a) => a === SUP);
  k.push(stepOf('lonely', log, 'canvas:x'), Promise.resolve(SUP));
  await tick();
  assert.equal(k.top(), 'barrier', 'its server step is someone else’s write');
});

test('G1 a refused or thrown save leaves the journal by itself (the step never happened)', async () => {
  const j = createUndoJournal((a) => a === SUP);
  const log: string[] = [];
  j.push(stepOf('A', log), ok('sA'));
  j.push(stepOf('B', log), Promise.resolve({ ok: false, error: 'no' }));
  j.push(stepOf('C', log), Promise.reject(new Error('offline')));
  await tick();
  await tick();
  assert.equal(j.size(), 1);
});

test('G1 after a slow ↺ the journal is trimmed to the server’s stamp — else emptied; clear empties; ten at most', async () => {
  const j = createUndoJournal((a) => a === SUP, 10);
  const log: string[] = [];
  j.push(stepOf('A', log), ok('sA'));
  j.push(stepOf('B', log), ok('sB'));
  j.barrier();
  await tick();
  j.trimTo('sB');
  assert.equal(j.size(), 2, 'the barrier is off; B is the server’s state');
  j.trimTo('sZ');
  assert.equal(j.size(), 0, 'no entry is the server’s: nothing of it stands');
  for (let i = 0; i < 14; i += 1) j.push(stepOf(`n${i}`, log), ok(`s${i}`));
  assert.equal(j.size(), 10, 'the server keeps ten Undo states — so does the journal');
  j.clear();
  assert.equal(j.top(), null);
});

/* ═════════════ G2 — the stamp ═════════════ */

const S0: HubDraft = emptyHubDraft();
const S1 = mergeHubDraft(S0, { widgets: { hero: { canvas: { elements: { eyebrow: { size: 110 } } } } } });
const S2 = mergeHubDraft(S1, { widgets: { hero: { canvas: { elements: { eyebrow: { size: 110, color: '#b5543a' } } } } } });

/** Keys shuffled at every level (jsonb's own order), then read back as the store reads it. */
function shuffled(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shuffled);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse().map(([k, x]) => [k, shuffled(x)]));
  return v;
}

test('G2 one stamp per STATE: the written draft and the one read back with its keys shuffled agree; history is not in it', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 1, x: 2 }], c: undefined } }), canonicalJson({ a: { d: [1, { x: 2, y: 1 }] }, b: 1 }), 'keys sorted at every level, undefined dropped');
  assert.equal(hubDraftStamp(S1), hubDraftStamp(sanitizeHubDraft(shuffled(JSON.parse(JSON.stringify(S1))))));
  assert.notEqual(hubDraftStamp(S1), hubDraftStamp(S2));
  assert.equal(hubDraftStamp(S1), hubDraftStamp({ ...S1, history: [] }), 'its Undo history is not part of its name');
  assert.equal(hubDraftStamp(undoHubDraft(S2)), hubDraftStamp(S1), 'an undo lands on the state the step before left');
});

test('G2 an undo with the expected stamp is matched; a wrong one still steps back ONE and says not matched', () => {
  assert.equal(hubDraftUndoMatched(S2, hubDraftStamp(S2)), true);
  assert.equal(hubDraftUndoMatched(S2, hubDraftStamp(S1)), false);
  assert.equal(hubDraftUndoMatched(S0, hubDraftStamp(S0)), false, 'nothing left to step back: never "matched"');
  assert.equal(hubDraftUndoMatched(S2, null), undefined, 'an undo the Maker did not draw: nothing to say');
  const actions = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const undo = actions.slice(actions.indexOf("if (intent === 'undo') {"), actions.indexOf("if (intent === 'drop')"));
  assert.match(undo, /return answerWithBar\(undoHubDraft\(current\), hubDraftUndoMatched\(current, formData\.get\(HUB_DRAFT_EXPECT_FIELD\)\)\);/, 'the undo ALWAYS runs — one press, one step — and says matched');
  assert.doesNotMatch(undo, /if \(matched === false\) return/, 'never refused on a mismatch');
  assert.match(actions, /const stamp = hubDraftStamp\(mergeHubDraft\(current, patch\)\);/, 'every save answers with its stamp');
  assert.match(actions, /const stamp = hubDraftStamp\(next\);/, 'and every undo / reset');
  const lab = read('app/dev/maker-lab/lab-draft.ts');
  assert.match(lab, /hubDraftUndoMatched\(current, fields\.expect\)/, 'the lab’s door answers the same way');
});

/* ═════════════ G3 · G4 — the shared journal, the runner, the draft store, in a stand-in window ═════════════ */

type Mods = {
  dj: typeof import('./maker-drawn-undo');
  run: typeof import('./maker-undo-run');
  mr: typeof import('./maker-refresh');
  store: typeof import('./maker-draft-store');
  pick: typeof import('./canvas-pick-undo');
};
let m!: Mods;
const events: string[] = [];
const said: string[] = [];
before(async () => {
  const w = new EventTarget() as EventTarget & Record<string, unknown>;
  w.location = { origin: 'http://lab.test', search: '' };
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;
  (globalThis as Record<string, unknown>).window = w;
  m = {
    dj: await import('./maker-drawn-undo'),
    run: await import('./maker-undo-run'),
    mr: await import('./maker-refresh'),
    store: await import('./maker-draft-store'),
    pick: await import('./canvas-pick-undo'),
  };
  w.addEventListener(m.mr.MAKER_UNHELD_WRITE_EVENT, () => events.push('unheld'));
  w.addEventListener('setnayan:maker-save-status', (e) => {
    const d = (e as CustomEvent<{ state: string; text?: string }>).detail;
    said.push(d.state === 'error' ? `error: ${d.text}` : d.state);
  });
});

/** The bar's door, stood in: each undo answered from a script, its `expect` recorded. */
function io(answers: Array<Record<string, unknown>>) {
  const sent: Array<string | null> = [];
  const truths: number[] = [];
  return {
    sent,
    truths,
    io: {
      send: async (expect: string | null) => {
        sent.push(expect);
        await later(5);
        return (answers.shift() ?? { ok: true, intent: 'undo', matched: true }) as never;
      },
      truth: () => {
        truths.push(1);
        m.mr.announceUnheldWrite();
      },
      answered: () => {},
    },
  };
}
const reset = () => {
  m.dj.undoJournal.clear();
  events.length = 0;
  said.length = 0;
};

test('G3 move A, move B, ↺, ↺ — BOTH drawn at the press, no unheld write, each undo held and naming its own step', async () => {
  reset();
  const drawn: string[] = [];
  const hand = m.dj.setSceneUndrawer((d) => {
    drawn.push(`${d.kind} ${d.id}`);
    return { settle: Promise.resolve('shown'), landed: (ok) => drawn.push(`landed ${ok}`) } satisfies DrawnUndo;
  });
  const A = { kind: 'move' as const, id: 'A', stage: 'rsvp', key: 'w:countdown', label: 'Countdown', prior: ['A', 'B'], moved: ['B', 'A'] };
  const B = { kind: 'move' as const, id: 'B', stage: 'rsvp', key: 'w:special_message', label: 'Message', prior: ['B', 'A'], moved: ['A', 'B'] };
  m.dj.noteUndoStep({ undraw: () => m.dj.undrawScene(A) }, ok('sA'));
  m.dj.noteUndoStep({ undraw: () => m.dj.undrawScene(B) }, ok('sB'));
  await tick();
  const door = io([]);
  const first = m.run.runDrawnUndo(door.io);
  assert.ok(first, 'the 1st ↺ is drawn');
  assert.deepEqual(drawn, ['move B'], '…in its own click');
  const second = m.run.runDrawnUndo(door.io);
  assert.ok(second, 'the 2nd ↺ — the step BENEATH the last — is drawn too (it waited 6–10 s before)');
  assert.deepEqual(drawn, ['move B', 'move A'], 'both at the press, newest first');
  assert.deepEqual(events, [], 'no write the canvas did not draw — no Maker render, no new page');
  await later(40);
  assert.deepEqual(door.sent, ['sB', 'sA'], 'one undo per press, in order, each naming the state it takes back');
  assert.deepEqual(drawn.slice(2), ['landed true', 'landed true']);
  assert.equal(m.run.runDrawnUndo(door.io), null, 'nothing left the Maker drew: the next ↺ is the slow path');
  hand();
});

test('G3 Style 100 → 110 → ↺: the Maker’s copy reads 100 at once, the undo is held and names 110’s stamp', async () => {
  reset();
  const server: HubSectionCanvas = {};
  const at110: HubSectionCanvas = { elements: { eyebrow: { size: 110 } } };
  const posted: string[] = [];
  const draw = (_from: HubSectionCanvas, to: HubSectionCanvas) => {
    posted.push(`elStyle ${to.elements?.eyebrow?.size ?? 100}`);
    return [];
  };
  m.store.noteDraftedCanvas('hero', at110, server);
  const saved = m.mr.makerSave(
    () => m.mr.makerLatestWrite(m.store.canvasWriteKey('hero'), async () => ({ ok: true, intent: 'save', stamp: 's110' })),
    () => {},
    { held: true, undo: m.pick.canvasPickUndo('hero', server, at110, server, draw) },
  );
  assert.deepEqual(m.store.draftedCanvasOr('hero', server), at110);
  const door = io([]);
  const drawn = m.run.runDrawnUndo(door.io);
  assert.ok(drawn, 'drawn in the click — even before its own save was sent (its 350 ms beat)');
  assert.deepEqual(posted, ['elStyle 100'], 'the page lays the 100 % look back');
  assert.deepEqual(m.store.draftedCanvasOr('hero', server), {}, 'the panel and the NEXT pick read the undone canvas (the 110 % case)');
  await saved;
  await later(40);
  assert.deepEqual(door.sent, ['s110'], 'the undo went after the save it takes back, naming its state');
  assert.deepEqual(events, [], 'held — nothing announced as undrawn');
  assert.ok(said.includes('saved'), 'the line says it saved');
});

test('G3 Style, then a move, then ↺ ↺ — both drawn, each by its own kind', async () => {
  reset();
  const log: string[] = [];
  const hand = m.dj.setSceneUndrawer((d) => {
    log.push(`scene ${d.kind}`);
    return m.dj.drawnNow(() => log.push('scene back'));
  });
  m.mr.makerSave(async () => ({ ok: true, intent: 'save', stamp: 'sStyle' }), () => {}, { held: true, undo: stepOf('style', log) });
  m.dj.noteUndoStep({ undraw: () => m.dj.undrawScene({ kind: 'move', id: 'A', stage: 'rsvp', key: 'w:a', label: 'A', prior: ['A'], moved: ['A'] }) }, ok('sMove'));
  await tick();
  const door = io([]);
  assert.ok(m.run.runDrawnUndo(door.io));
  assert.ok(m.run.runDrawnUndo(door.io));
  assert.deepEqual(log, ['scene move', 'undraw style']);
  await later(40);
  assert.deepEqual(door.sent, ['sMove', 'sStyle']);
  hand();
});

test('G3 a held save with NO inverse, an unheld save, a form: the ↺ that meets it takes the slow path', async () => {
  reset();
  const log: string[] = [];
  m.mr.makerSave(async () => ({ ok: true, intent: 'save', stamp: 'sA' }), () => {}, { held: true, undo: stepOf('A', log) });
  m.mr.makerSave(async () => ({ ok: true, intent: 'save', stamp: 'sX' }), () => {}, { held: true });
  assert.equal(m.dj.undoJournal.top(), 'barrier', 'a held save the Maker cannot draw back');
  assert.equal(m.run.runDrawnUndo(io([]).io), null);
  reset();
  m.mr.makerSave(async () => ({ ok: true, intent: 'save', stamp: 'sA' }), () => {}, { held: true, undo: stepOf('A', log) });
  m.mr.announceUnheldWrite();
  assert.equal(m.dj.undoJournal.top(), 'barrier', 'a write that announced itself unheld (a form, Reset, a reload)');
  reset();
  m.mr.makerSave(async () => ({ ok: true, intent: 'save', stamp: 'sA' }), () => {}, { held: true, undo: stepOf('A', log) });
  m.dj.undoJournalQuiet(() => m.mr.announceUnheldWrite());
  assert.notEqual(m.dj.undoJournal.top(), 'barrier', 'the slow ↺’s own write is not a step');
});

test('G4 a refused ↺ puts the step back, keeps it on top, and SAYS why — never silent', async () => {
  reset();
  const log: string[] = [];
  m.dj.noteUndoStep(stepOf('A', log), ok('sA'));
  await tick();
  const door = io([{ ok: false, intent: 'undo', error: 'Your draft is kept. Please try again.' }]);
  assert.ok(m.run.runDrawnUndo(door.io));
  await later(40);
  assert.deepEqual(log, ['undraw A', 'put back A'], 'the step is drawn again');
  const top = m.dj.undoJournal.top();
  assert.ok(top && top !== 'barrier', 'and it is the newest step again — the next ↺ takes it');
  assert.ok(said.some((s) => s.startsWith('error: ') && s.includes(m.run.UNDO_REFUSED_WORDS) && s.includes('Please try again.')), 'the line says it, with the reason');
});

test('G4 the server stepped back from a state the Maker did not draw: the truth path, the journal emptied, said', async () => {
  reset();
  const log: string[] = [];
  m.dj.noteUndoStep(stepOf('A', log), ok('sA'));
  m.dj.noteUndoStep(stepOf('B', log), ok('sB'));
  await tick();
  const door = io([{ ok: true, intent: 'undo', matched: false }]);
  assert.ok(m.run.runDrawnUndo(door.io));
  await later(40);
  assert.equal(door.truths.length, 1, 'the first render after this ↺ is the truth (#6485): announced unheld, refreshed');
  assert.ok(events.includes('unheld'));
  assert.equal(m.dj.undoJournal.top(), null, 'nothing the Maker drew stands');
  assert.ok(said.includes(`error: ${m.run.UNDO_ELSEWHERE_WORDS}`), 'and the line says what happened');
});

/* ═════════════ the wiring ═════════════ */

const BAR = 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx';
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';

test('the bar: a drawn ↺ is HELD and sent outside the transition; the runner is LAZY; a slow ↺ is quiet and trims', () => {
  const bar = read(BAR);
  assert.match(bar, /import\('@\/lib\/maker-undo-run'\)/, 'the runner is loaded by import() — never in the first load');
  assert.doesNotMatch(bar, /^import[^\n]*maker-undo-run/m, 'never a static import');
  const io = bar.slice(bar.indexOf('const drawnIo = () =>'), bar.indexOf('const drawnUndo = '));
  assert.match(io, /makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: true, undo: 'noted' \}\)/, 'held: no Maker render, no new page');
  assert.match(io, /fd\.set\(HUB_DRAFT_EXPECT_FIELD, expect\)/, 'naming the state it expects');
  const run = bar.slice(bar.indexOf('const run = (fields'), bar.indexOf('const slow = '));
  assert.doesNotMatch(run, /start\(/, 'the drawn path never enters the transition (its pending would grey ↺)');
  const slow = bar.slice(bar.indexOf('const slow = '), bar.indexOf('return { pending'));
  assert.match(slow, /undoJournalQuiet\(\(\) => makerSave\([^\n]*\{ held: false \}\), intent === 'undo'\)/, 'a slow ↺ is unheld, and quiet: it is not a step of the journal');
  assert.match(slow, /undoJournal\.trimTo\(r\.stamp \?\? null\)/);
  assert.match(slow, /undoJournal\.clear\(\)/);
});

test('the work area notes EVERY drawn scene step by value — no single "last drawn" slot (the 2nd ↺ went slow)', () => {
  const shell = read(SHELL);
  assert.doesNotMatch(shell, /lastDrawn/, 'the one-slot memory is gone');
  assert.match(shell, /const undoDrawn = \(d: SceneUndoData\)/);
  assert.match(shell, /const noteSceneStep = \(d: SceneUndoData, saved: Promise<unknown>\) => noteUndoStep\(/);
  assert.equal((shell.match(/noteSceneStep\(/g) ?? []).length, 3, 'its three callers: eye · move · ＋');
  /* …each noting EVERY held step of its kind, at its press, beside the save it takes back. */
  assert.match(shell, /if \(held\) noteSceneStep\(\{ kind: 'remove', id: scene\.id, stage, key: `w:\$\{scene\.type\}`, label: scene\.label \}, saved\);/);
  assert.match(shell, /if \(held !== null && mover\) noteSceneStep\(\{ kind: 'move', id, stage,/);
  assert.match(shell, /if \(held !== null\) noteSceneStep\(added, addSaved\);/);
  const drag = read('app/dashboard/[eventId]/launch/_components/scene-drag.tsx');
  assert.match(drag, /setSceneUndrawer\(\(data\) =>/, 'the drag lends the page its drawer');
  assert.doesNotMatch(drag, /claimDrawnUndo|withdrawDrawnUndo/);
});

test('RSVP lines and canvas picks hand their inverse with their save', () => {
  const ask = read('app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
  const undo = ask.slice(ask.indexOf('const undo = {'), ask.indexOf('return (async (): Promise<SaveAnswer> =>', ask.indexOf('const undo = {')));
  assert.match(undo, /announceRsvpPreview\(before\);\s*noteDraftedCanvas\(RSVP_DRAFT_TYPE, before as HubSectionCanvas, server\);/, 'the stage re-posts the config before, the copy holds it');
  assert.match(ask, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true, undo \}/);
  assert.match(ask, /hearDraftedCanvas\(\(type\) =>/, 'the panel re-reads a ↺ drawn elsewhere');
  const pick = read('lib/canvas-pick-undo.ts');
  assert.match(pick, /postToMakerCanvases\(draw\(next, before\)\);\s*noteDraftedCanvas\(type, before, server\);/, 'drawn on the page AND in the Maker’s copy');
});
