/**
 * Stage script (host / MC "Script & cues" desk) — the decision tests.
 *
 * `buildStageScript()` is the whole decision surface behind the specialization:
 * the component is a renderer over the model. So this suite carries the claims
 * the PR is accountable for.
 *
 *   1. A PRIVATE BLOCK IS NEVER MARKED SAYABLE. A booked vendor reads the FULL
 *      timeline, so the desk sees the couple's private blocks. The host is
 *      holding a live microphone; a private note is context, never copy. No
 *      entry, announcement or cue derived from an `is_public: false` block may
 *      come back `publicFacing: true`, on any path. This is the invariant the
 *      module exists for and it is asserted exhaustively below.
 *   2. RUN-STATE IS THE TRUTH, NOT THE CLOCK. "You're on" tracks the `live`
 *      pointer that `advance_schedule_block` sets — moving the wall clock alone
 *      never changes which block is current.
 *   3. THE CUES ARE THE SHIPPED ONES. The desk renders the SAME `BLOCK_CUE`
 *      sentences the couple downloads in their emcee script, asserted against
 *      the real imported map rather than a hand-copied literal, so a reworded
 *      cue can never leave the paper script and the desk disagreeing.
 *   4. NOTHING BREAKS ON A RAGGED TIMELINE. Empty, all-private, unparseable
 *      timestamps, and a part whose parent RLS filtered away all produce a
 *      model, never a throw and never a silently dropped line.
 *
 * Time is injected everywhere (`formatTime` + `now`), so every assertion is
 * deterministic and none of these tests can flake on a clock.
 *
 * ── NEUTRALISATION CHECKS (2026-07-27) ─────────────────────────────────────
 *
 * Each proof was run by editing the source, observing the failure, and
 * reverting:
 *
 *   • Forcing `publicFacing: true` in `toCueBlock` + `buildScript` (i.e.
 *     neutralising the private-block guard) fails 4 of the 5 privacy tests and
 *     nothing else (19 pass). The fifth — "a public block with a note IS
 *     sayable" — correctly still passes, which is the point: it is the control
 *     proving the guard is a real per-block read of `is_public` and not a
 *     blanket `false`. Neutralising in the other direction (forcing `false`)
 *     fails that control plus the mixed-timeline test, and those two only —
 *     so the guard is pinned from both sides.
 *   • Overriding the `deriveRunOfShow` result with a wall-clock "latest block
 *     already started" pick fails exactly 2 tests — "run-state, not the clock,
 *     decides what is on" and "between moments names the next block" (21 pass)
 *     — proving the run-state pointer, not the clock, is what drives the desk.
 *   • Hardcoding `order` to `['cue','script','announcements']` fails exactly 2
 *     tests — the imminent-note lift and the wrapped-show drop (21 pass) —
 *     proving the derived placement is real logic, not a constant dressed as a
 *     decision.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildStageScript, nextTimingLabel, type StageScriptBlock } from './stage-script';
import { BLOCK_CUE } from './emcee-script';
import { buildDayOfFrame } from './vendor-dayof-frame';
import { resolveVendorSpecializationAccess } from './vendor-specialization-gate';

/** Deterministic, human-checkable time rendering. */
const fmt = (s: string, e: string | null) => (e ? `${s}→${e}` : s);
// 10 AM AT THE VENUE. `now` is a real instant; every `start_at` below is the
// venue's wall clock stored in a UTC column. Setting this to 10:00Z would make
// the two look comparable when they are not — which is how the host's desk came
// to announce a moment eight minutes away as "in 488 min".
const NOW = new Date('2026-07-27T02:00:00Z');
const opts = { formatTime: fmt, now: NOW };

function block(over: Partial<StageScriptBlock> & { block_id: string }): StageScriptBlock {
  return {
    label: `Block ${over.block_id}`,
    block_type: 'custom',
    start_at: '2026-07-27T10:00:00Z',
    end_at: null,
    location: null,
    notes: null,
    is_public: true,
    sort_order: 0,
    parent_block_id: null,
    run_state: 'upcoming',
    actual_start_at: null,
    ...over,
  };
}

// ── 1 · THE PRIVACY INVARIANT ──────────────────────────────────────────────

test('a private block never yields a publicFacing entry, announcement or cue', () => {
  const blocks = [
    block({ block_id: 'a', is_public: false, notes: 'Do NOT reveal the surprise yet', run_state: 'live' }),
    block({ block_id: 'b', is_public: false, notes: 'Private staging note', start_at: '2026-07-27T11:00:00Z' }),
  ];
  const m = buildStageScript({ blocks, options: opts });

  assert.ok(m.script.length > 0, 'sanity: the private blocks are present');
  for (const e of m.script) assert.equal(e.publicFacing, false);
  for (const a of m.announcements) assert.equal(a.publicFacing, false);
  assert.equal(m.cue.now?.publicFacing, false);
  assert.equal(m.cue.next?.publicFacing, false);
});

test('a private block is CARRIED, not dropped — the host is told, and told not to say it', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'p', is_public: false, notes: 'Surprise entrance — say nothing' })],
    options: opts,
  });
  assert.equal(m.script.length, 1, 'the private block still appears in the script');
  assert.equal(m.announcements.length, 1, 'and its note still reaches the host');
  assert.equal(m.announcements[0]!.note, 'Surprise entrance — say nothing');
  assert.equal(m.announcements[0]!.publicFacing, false, 'marked as not-for-guests');
});

test('publicFacing tracks is_public exactly, per block, in a mixed timeline', () => {
  const blocks = [
    block({ block_id: 'pub', is_public: true, notes: 'Thank the sponsors' }),
    block({ block_id: 'priv', is_public: false, notes: 'Cake is late — stall', start_at: '2026-07-27T11:00:00Z' }),
  ];
  const m = buildStageScript({ blocks, options: opts });
  const byId = new Map(m.script.map((e) => [e.blockId, e]));
  assert.equal(byId.get('pub')!.publicFacing, true);
  assert.equal(byId.get('priv')!.publicFacing, false);

  const ann = new Map(m.announcements.map((a) => [a.blockId, a]));
  assert.equal(ann.get('pub')!.publicFacing, true);
  assert.equal(ann.get('priv')!.publicFacing, false);
});

test('no publicFacing:true output can originate from an is_public:false block (exhaustive)', () => {
  // Every run_state × both nesting depths, all private — the whole space.
  const states = ['upcoming', 'live', 'done'] as const;
  const blocks: StageScriptBlock[] = [];
  let i = 0;
  for (const s of states) {
    blocks.push(block({ block_id: `top-${i}`, is_public: false, run_state: s, notes: `n${i}`, start_at: `2026-07-27T1${i}:00:00Z` }));
    blocks.push(block({ block_id: `kid-${i}`, is_public: false, run_state: s, notes: `k${i}`, parent_block_id: `top-${i}`, start_at: `2026-07-27T1${i}:30:00Z` }));
    i += 1;
  }
  const m = buildStageScript({ blocks, options: opts });
  assert.equal(m.script.length, 6);
  assert.equal(m.script.some((e) => e.publicFacing), false);
  assert.equal(m.announcements.some((a) => a.publicFacing), false);
  assert.equal(m.cue.now?.publicFacing ?? false, false);
  assert.equal(m.cue.next?.publicFacing ?? false, false);
});

test('a public block with a note IS sayable — the guard is not just "always false"', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'x', is_public: true, notes: 'Welcome everyone' })],
    options: opts,
  });
  assert.equal(m.announcements[0]!.publicFacing, true);
  assert.equal(m.script[0]!.publicFacing, true);
});

// ── 2 · RUN-STATE IS THE TRUTH ─────────────────────────────────────────────

test('run-state, not the clock, decides what is on', () => {
  const blocks = [
    block({ block_id: 'early', label: 'Ceremony', start_at: '2026-07-27T08:00:00Z', run_state: 'done' }),
    // Planned for much later, but the host has ADVANCED to it — it is on now.
    block({ block_id: 'late', label: 'Dinner', start_at: '2026-07-27T20:00:00Z', run_state: 'live' }),
  ];
  const m = buildStageScript({ blocks, options: opts });
  assert.equal(m.cue.now?.label, 'Dinner');
  assert.equal(m.cue.headline, 'You’re on: Dinner.');

  // Move the clock four hours; the live pointer is unchanged, so "now" is too.
  const later = buildStageScript({
    blocks,
    options: { formatTime: fmt, now: new Date('2026-07-27T14:00:00Z') },
  });
  assert.equal(later.cue.now?.label, 'Dinner');
});

test('phases: empty · not_started · running · wrapped', () => {
  assert.equal(buildStageScript({ blocks: [], options: opts }).phase, 'empty');

  assert.equal(
    buildStageScript({ blocks: [block({ block_id: 'a' })], options: opts }).phase,
    'not_started',
  );
  assert.equal(
    buildStageScript({ blocks: [block({ block_id: 'a', run_state: 'live' })], options: opts }).phase,
    'running',
  );
  assert.equal(
    buildStageScript({ blocks: [block({ block_id: 'a', run_state: 'done' })], options: opts }).phase,
    'wrapped',
  );
});

test('every phase gets a real headline — never blank', () => {
  const cases: StageScriptBlock[][] = [
    [],
    [block({ block_id: 'a', label: 'Processional' })],
    [block({ block_id: 'a', label: 'Toasts', run_state: 'live' })],
    [block({ block_id: 'a', run_state: 'done' })],
    // Running but between moments: one done, one upcoming, nothing live.
    [
      block({ block_id: 'a', run_state: 'done' }),
      block({ block_id: 'b', label: 'Cake', run_state: 'upcoming', start_at: '2026-07-27T12:00:00Z' }),
    ],
  ];
  for (const blocks of cases) {
    const h = buildStageScript({ blocks, options: opts }).cue.headline;
    assert.equal(typeof h, 'string');
    assert.ok(h.trim().length > 0, `blank headline for ${JSON.stringify(blocks.map((b) => b.run_state))}`);
  }
});

test('between moments names the next block rather than claiming one is on', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'a', run_state: 'done' }),
      block({ block_id: 'b', label: 'First dance', run_state: 'upcoming', start_at: '2026-07-27T12:00:00Z' }),
    ],
    options: opts,
  });
  assert.equal(m.cue.now, null);
  assert.equal(m.cue.headline, 'Between moments. Next: First dance.');
});

test('next.minutesAway is measured from the injected clock', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'b', start_at: '2026-07-27T10:45:00Z' })],
    options: opts, // NOW = 10:00Z
  });
  assert.equal(m.cue.next?.minutesAway, 45);
});

test('drift is reported from the shipped run-of-show derivation', () => {
  const m = buildStageScript({
    blocks: [
      block({
        block_id: 'a',
        run_state: 'live',
        start_at: '2026-07-27T10:00:00Z',
        // 10 AM at the venue is 02:00Z; twelve minutes late is 02:12Z. The
        // planned time is a wall clock, the actual one a real instant.
        actual_start_at: '2026-07-27T02:12:00Z',
      }),
    ],
    options: opts,
  });
  assert.equal(m.cue.drift, '12 min behind');
});

// ── 3 · THE CUES ARE THE SHIPPED ONES ──────────────────────────────────────

test('block cues come from the shared BLOCK_CUE map, not a second copy', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'c', block_type: 'ceremony', run_state: 'live' }),
      block({ block_id: 'd', block_type: 'dinner', start_at: '2026-07-27T12:00:00Z' }),
    ],
    options: opts,
  });
  assert.equal(m.cue.now?.cue, BLOCK_CUE.ceremony);
  assert.equal(m.cue.next?.cue, BLOCK_CUE.dinner);
  assert.ok(BLOCK_CUE.ceremony, 'sanity: the shared map really has a ceremony cue');
});

test('a block type with no cue yields null rather than an invented sentence', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'x', block_type: 'custom', run_state: 'live' })],
    options: opts,
  });
  assert.equal(BLOCK_CUE.custom, undefined, 'sanity: custom has no shared cue');
  assert.equal(m.cue.now?.cue, null);
});

// ── 4 · A RAGGED TIMELINE STILL PRODUCES A MODEL ───────────────────────────

test('empty timeline is a real model, not a throw', () => {
  const m = buildStageScript({ blocks: [], options: opts });
  assert.equal(m.phase, 'empty');
  assert.deepEqual(m.script, []);
  assert.deepEqual(m.announcements, []);
  assert.equal(m.cue.now, null);
  assert.equal(m.cue.next, null);
  assert.ok(m.cue.headline.length > 0);
});

test('parts nest under their parent, in reading order', () => {
  const blocks = [
    block({ block_id: 'kid', label: 'Procession', parent_block_id: 'par', start_at: '2026-07-27T10:10:00Z' }),
    block({ block_id: 'par', label: 'Ceremony', start_at: '2026-07-27T10:00:00Z' }),
  ];
  const m = buildStageScript({ blocks, options: opts });
  assert.deepEqual(
    m.script.map((e) => [e.label, e.depth]),
    [
      ['Ceremony', 0],
      ['Procession', 1],
    ],
  );
});

test('an orphan part (parent hidden by RLS) is kept, not silently dropped', () => {
  // `parent_block_id` points at a coordinator-only row this vendor cannot read.
  const m = buildStageScript({
    blocks: [block({ block_id: 'orphan', label: 'Hidden parent part', parent_block_id: 'never-visible' })],
    options: opts,
  });
  assert.equal(m.script.length, 1, 'the line survives');
  assert.equal(m.script[0]!.depth, 0, 'promoted to top level');
  assert.equal(m.script[0]!.label, 'Hidden parent part');
});

test('unparseable timestamps do not throw, and minutesAway degrades to null', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'bad', start_at: 'not-a-date' })],
    options: opts,
  });
  assert.equal(m.script.length, 1);
  assert.equal(m.cue.next?.minutesAway, null);
});

test('blank and whitespace-only notes produce no announcement', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'a', notes: '   ' }),
      block({ block_id: 'b', notes: '', start_at: '2026-07-27T11:00:00Z' }),
      block({ block_id: 'c', notes: null, start_at: '2026-07-27T12:00:00Z' }),
    ],
    options: opts,
  });
  assert.deepEqual(m.announcements, []);
});

test('notes are carried verbatim, trimmed', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'a', notes: '  Thank the ninongs & ninangs  ' })],
    options: opts,
  });
  assert.equal(m.announcements[0]!.note, 'Thank the ninongs & ninangs');
});

// ── 5 · DERIVED CARD ORDER (the alternative to a stored preference) ────────

test('an imminent note lifts announcements above the script', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'a', run_state: 'live', notes: 'Announce the sponsors now' })],
    options: opts,
  });
  assert.deepEqual(m.order, ['cue', 'announcements', 'script']);
});

test('with no imminent note the script leads', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'a', run_state: 'live' }),
      // Next up carries no note …
      block({ block_id: 'b', start_at: '2026-07-27T11:00:00Z' }),
      // … and a note far down the program is NOT imminent.
      block({ block_id: 'z', notes: 'Later thing', start_at: '2026-07-27T23:00:00Z' }),
    ],
    options: opts,
  });
  assert.deepEqual(m.order, ['cue', 'script', 'announcements']);
});

test('a wrapped show drops the cue card instead of leaving it saying nothing', () => {
  const m = buildStageScript({
    blocks: [block({ block_id: 'a', run_state: 'done', notes: 'x' })],
    options: opts,
  });
  assert.deepEqual(m.order, ['script', 'announcements']);
  assert.equal(m.order.includes('cue'), false);
});

test('order only ever contains known cards, with no duplicates', () => {
  const cases: StageScriptBlock[][] = [
    [],
    [block({ block_id: 'a' })],
    [block({ block_id: 'a', run_state: 'live', notes: 'n' })],
    [block({ block_id: 'a', run_state: 'done' })],
  ];
  for (const blocks of cases) {
    const { order } = buildStageScript({ blocks, options: opts });
    assert.equal(new Set(order).size, order.length, 'no duplicate cards');
    for (const id of order) assert.ok(['cue', 'script', 'announcements'].includes(id));
  }
});

// ── 6 · THE ENTITLEMENT GATE, FOR THIS SPECIALIZATION SPECIFICALLY ─────────
//
// `vendor-dayof-frame.test.ts` already pins "being REGISTERED does not unlock"
// generically. These re-prove it through the REAL gate and the REAL frame for
// the set THIS PR registers, so the claim is carried by the PR that could break
// it: registering `stage_script` is what flips a HELD set from `coming_soon` to
// `ready`, and it must do nothing whatsoever for a vendor who does not hold it.
//
// Neutralisation (2026-07-27, run and reverted): reordering `buildDayOfFrame`'s
// state expression to `registeredSets?.has(...) ? 'ready' : held ? …` — i.e.
// dropping the `held` check so registration alone unlocks — fails exactly 4
// tests across both suites and no others (42 pass): the two LOCKED cases below,
// plus `vendor-dayof-frame.test.ts`'s "BELOW FLOOR → …locked" and "being
// REGISTERED does not unlock". The `ready` case still passes throughout, which
// is what makes these tests about the entitlement rather than about the
// registry.

/** The real gate, for a host/MC vendor at a given tier. */
const hostAccess = (tier: string, expires: string | null = null) =>
  resolveVendorSpecializationAccess({
    subscription: { tier_state: tier, tier_expires_at: expires },
    services: ['host_mc'],
    now: Date.parse('2026-07-27T10:00:00Z'),
  });

const REGISTERED = new Set(['stage_script' as const]);

test('a host/MC vendor AT the tier floor gets the built desk (ready)', () => {
  const model = buildDayOfFrame({
    access: hostAccess('solo'),
    genericModuleIds: [],
    registeredSets: REGISTERED,
  });
  assert.equal(model.specialization?.set, 'stage_script');
  assert.equal(model.specialization?.state, 'ready');
  assert.equal(model.upsell, null);
});

test('an unsubscribed host/MC gets LOCKED — registering the surface grants nothing', () => {
  const model = buildDayOfFrame({
    access: hostAccess('free'),
    genericModuleIds: [],
    registeredSets: REGISTERED, // built and registered, and still locked
  });
  assert.equal(model.specialization?.state, 'locked');
  assert.notEqual(model.specialization?.state, 'ready');
  assert.equal(model.upsell?.set, 'stage_script');
});

test('a LAPSED host/MC gets LOCKED with a renew-flavoured upsell', () => {
  const model = buildDayOfFrame({
    access: hostAccess('pro', '2020-01-01T00:00:00Z'),
    genericModuleIds: [],
    registeredSets: REGISTERED,
  });
  assert.equal(model.specialization?.state, 'locked');
  assert.equal(model.upsell?.lapsed, true);
});

test('registering stage_script does not touch any OTHER category', () => {
  // A coordinator with only stage_script registered still gets their own set,
  // unbuilt → coming_soon. One PR cannot leak into another's slot.
  const coordinator = resolveVendorSpecializationAccess({
    subscription: { tier_state: 'solo', tier_expires_at: null },
    services: ['coordinator'],
    now: Date.parse('2026-07-27T10:00:00Z'),
  });
  const model = buildDayOfFrame({
    access: coordinator,
    genericModuleIds: [],
    registeredSets: REGISTERED,
  });
  assert.equal(model.specialization?.set, 'floor_command');
  assert.equal(model.specialization?.state, 'coming_soon');
});

test('the generic kit is untouched on every host/MC path', () => {
  const kit = ['run_of_show', 'pax_headcount'] as never[];
  for (const access of [hostAccess('solo'), hostAccess('free'), hostAccess('pro', '2020-01-01T00:00:00Z')]) {
    const model = buildDayOfFrame({ access, genericModuleIds: kit, registeredSets: REGISTERED });
    assert.deepEqual(model.genericModuleIds, kit);
  }
});

// ── 7 · "DUE N MIN AGO" — the late-show timing label ───────────────────────
//
// A running show goes late, so the next block's planned start is frequently in
// the PAST. The first cut of the renderer suppressed the negative number, which
// silently hid the most actionable fact on a late floor. These pin the fix.

test('nextTimingLabel states lateness instead of hiding it', () => {
  assert.equal(nextTimingLabel(15), 'in 15 min');
  assert.equal(nextTimingLabel(1), 'in 1 min');
  assert.equal(nextTimingLabel(0), 'due now');
  assert.equal(nextTimingLabel(-1), 'due 1 min ago');
  assert.equal(nextTimingLabel(-15), 'due 15 min ago');
  assert.equal(nextTimingLabel(null), null, 'unknown time says nothing at all');
});

test('a late show reports the next block as overdue, end to end', () => {
  // The live block started 18 min late, so its next part was due before now.
  const m = buildStageScript({
    blocks: [
      block({
        block_id: 'p', label: 'Reception', block_type: 'reception', run_state: 'live',
        start_at: '2026-07-27T16:00:00Z', actual_start_at: '2026-07-27T08:18:00Z',
      }),
      block({ block_id: 'c', label: 'Grand march', parent_block_id: 'p', start_at: '2026-07-27T16:10:00Z' }),
    ],
    // 4:25 PM at the venue.
    options: { formatTime: fmt, now: new Date('2026-07-27T08:25:00Z') },
  });
  assert.equal(m.cue.drift, '18 min behind');
  assert.equal(m.cue.next?.label, 'Grand march');
  assert.equal(m.cue.next?.minutesAway, -15);
  assert.equal(nextTimingLabel(m.cue.next!.minutesAway), 'due 15 min ago');
});

// ── the cue card carries block identity (2026-08-01) ───────────────────────
// Added so the day-of desk can join the host's OWN line for a moment
// (`vendor_block_scripts`) onto the cue card. Without an id on the cue block a
// renderer would have to match on the LABEL — and two moments in one wedding
// can share a label ("Toasts"), which would put one host's line on the wrong
// moment while he is holding a live microphone.
test('cue.now and cue.next carry blockId, so a renderer joins by identity not label', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'now-block', label: 'Dinner', run_state: 'live' }),
      block({ block_id: 'next-block', label: 'Toasts', start_at: '2026-07-27T11:00:00Z' }),
    ],
    options: opts,
  });
  assert.equal(m.cue.now?.blockId, 'now-block');
  assert.equal(m.cue.next?.blockId, 'next-block');
});

test('two moments sharing a label stay distinguishable by blockId', () => {
  const m = buildStageScript({
    blocks: [
      block({ block_id: 'toast-1', label: 'Toasts', run_state: 'live' }),
      block({ block_id: 'toast-2', label: 'Toasts', start_at: '2026-07-27T11:00:00Z' }),
    ],
    options: opts,
  });
  assert.notEqual(m.cue.now?.blockId, m.cue.next?.blockId, 'identical labels must not collapse');
});

// ── The countdown must never be a whole UTC offset out ───────────────────────
test('the countdown reads minutes away, not the venue offset', () => {
  // A moment 8 minutes away must read 8 — the failure this pins announced it
  // as "in 488 min", every moment, all day, on the host's live desk.
  const m = buildStageScript({
    blocks: [block({ block_id: 'b', start_at: '2026-07-27T10:08:00Z' })], // 10:08 AM at the venue
    options: opts, // now = 10:00 AM at the venue
  });
  assert.equal(m.cue.next?.minutesAway, 8);
  assert.equal(nextTimingLabel(m.cue.next!.minutesAway), 'in 8 min');
});
