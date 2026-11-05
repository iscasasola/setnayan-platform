/**
 * your-schedule-is-only-yours.test.ts — 📅 EVENT HUB › ME › YOUR SCHEDULE, AND RELEASE (owner 2026-11-01; plan §3,
 * §3b, §11b). Three properties, each on the REAL code against a table that really filters:
 *
 *   1 · A GUEST NEVER SEES ANOTHER PERSON'S LINES. The read asks broadly for tasks (their seat, and every role and
 *       group task at once); the card must keep only the lines that name THIS guest, a role they hold or a group they
 *       are in — never another guest's, another role's, another group's, a supplier's — and never a private moment
 *       that is not theirs.
 *   2 · BEFORE RELEASE THERE IS NO FULL SCHEDULE. Only the chapters on the invitation, with no lines at all; a role
 *       holder's call time says Estimated.
 *   3 · FREE NEVER SHOWS RELEASE AS WORKING. On a Free event a released stamp draws the before view, and the press
 *       itself refuses before anything is written.
 *
 * Sabotage (recorded in the PR): make `isMine` answer true for any task → 1 red; draw lines when `stage` is 'before'
 * → 2 red; drop `pro &&` from `released:` in the read, or the `releasePro` check in `releaseFullSchedule` (asked through `sendCoordinatorBroadcast`, intent=release) → 3 red.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let rpcCalls: string[] = [];
let PRO = true;
let RELEASE_PRO = true;

/** An in-memory PostgREST: `eq` / `neq` / `is` / `in` really filter; `or` passes rows through (the read asks broadly). */
function memoryClient(): unknown {
  return {
    from(table: string) {
      let rows: Row[] = [...(tables[table] ?? [])];
      const b: Record<string, unknown> = {};
      const step = (name: string, apply: (rows: Row[], ...args: never[]) => Row[]) => {
        b[name] = (...args: unknown[]) => {
          rows = apply(rows, ...(args as never[]));
          return b;
        };
      };
      step('eq', (r, c: string, v: unknown) => r.filter((x) => x[c] === v));
      step('neq', (r, c: string, v: unknown) => r.filter((x) => x[c] !== v));
      step('is', (r, c: string, v: unknown) => r.filter((x) => (x[c] ?? null) === v));
      step('in', (r, c: string, vs: unknown[]) => r.filter((x) => vs.includes(x[c])));
      for (const m of ['select', 'order', 'or', 'not', 'limit']) step(m, (r) => r);
      b.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      return b;
    },
    rpc: (fn: string) => {
      rpcCalls.push(fn);
      return Promise.resolve({ data: { released_at: '2026-12-11T09:00:00Z', told: 3, already: false, notice: 'schedule_released' }, error: null });
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-host' } } }) },
  };
}

/* ── module shims: `server-only`, the Pro reads, and the host's own session ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
function shim(id: string, exports: unknown): string {
  const file = path.join(process.cwd(), `__your_schedule_is_only_yours_${id}__.js`);
  const m = new CjsModule(file);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  m.paths = [];
  CjsModule._cache[file] = m;
  return file;
}
const SHIMS: Record<string, string> = {
  'server-only': shim('server_only', {}),
  './hub-look': shim('hub_look', { websiteProActiveFor: async () => PRO }),
  '@/lib/schedule-release.server': shim('release', { releasePro: async () => RELEASE_PRO }),
  '@/lib/supabase/server': shim('server', { createClient: async () => memoryClient() }),
  '@/lib/host-gate': shim('host_gate', { limitedHelperRefusal: async () => null, refuseLimitedHelper: async () => undefined }),
  '@/lib/coordinator-broadcasts-server': shim('authority', {
    resolveBroadcastAuthority: async () => ({ canSend: true, role: 'couple' }),
    isCoordinatorP3Enabled: async () => true,
  }),
  'next/cache': shim('next_cache', { revalidatePath: () => {}, revalidateTag: () => {} }),
};
{
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request in SHIMS) return SHIMS[request]!;
    return original.call(this, request, ...rest);
  };
}

let read: typeof import('./your-schedule.server');
let action: typeof import('@/app/dashboard/[eventId]/_actions/day-of-broadcast');
before(async () => {
  read = await import('./your-schedule.server');
  action = await import('@/app/dashboard/[eventId]/_actions/day-of-broadcast');
});

const EVENT = 'ev-me';
const PAM = 'g-pam';
const DAY = '2026-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00+00:00`;

function block(over: Row): Row {
  return {
    event_id: EVENT, parent_block_id: null, end_at: null, location: null, spot: null, notes: null, call_lead_minutes: 60,
    on_invitation: false, is_public: false, audience: null, visibility: 'couple_visible', time_tba: false, travel_from: null, travel_to: null,
    ingress_minutes_before: null, egress_minutes_after: null, photo_who: 'chapter', photo_when: 'right_away', sort_order: 0,
    ...over,
  };
}
function task(id: string, blockId: string, who: Row, what: string): Row {
  return { event_id: EVENT, task_id: id, block_id: blockId, vendor_id: null, crew: null, guest_id: null, group_id: null, role: null, who_label: null, what, call_at: null, place: null, sort_order: 0, ...who };
}

/** Pam is a bridesmaid in the "Maids" group. Everybody else's lines sit beside hers. */
function theDay(releasedAt: string | null): void {
  tables = {
    events: [{ event_id: EVENT, schedule_released_at: releasedAt }],
    event_schedule_blocks: [
      block({ block_id: 'c-prep', label: 'Preparation · Bridesmaids', start_at: at('07:00'), location: 'Seda', spot: 'Floor 12' }),
      block({ block_id: 'c-groom', label: 'Preparation · Groomsmen', start_at: at('08:00'), location: 'Seda', spot: 'Floor 9' }),
      block({ block_id: 'c-cer', label: 'Ceremony', start_at: at('13:30'), end_at: at('15:30'), location: 'San Vicente Parish', on_invitation: true, is_public: true }),
      block({ block_id: 'c-rec', label: 'Reception', start_at: at('17:00'), location: 'Seda', on_invitation: true, is_public: true }),
      block({ block_id: 'm-hair', parent_block_id: 'c-prep', label: 'Hair and makeup', start_at: at('08:00') }),
      block({ block_id: 'm-barong', parent_block_id: 'c-groom', label: 'Barong fitting', start_at: at('09:00') }),
      block({ block_id: 'm-march', parent_block_id: 'c-cer', label: 'Wedding March', start_at: at('14:00'), is_public: true }),
      block({ block_id: 'm-reading', parent_block_id: 'c-cer', label: 'First reading', start_at: at('14:25') }),
      block({ block_id: 'm-sponsors', parent_block_id: 'c-cer', label: 'Sponsors sign', start_at: at('15:00'), is_public: true, audience: 'sponsors' }),
      block({ block_id: 'm-staged', parent_block_id: 'c-rec', label: 'Coordinator walk-through', start_at: at('16:30'), visibility: 'coordinator_only' }),
      block({ block_id: 'm-entrance', parent_block_id: 'c-rec', label: 'Grand Entrance', start_at: at('18:00'), is_public: true }),
      block({ block_id: 'm-toast', parent_block_id: 'c-rec', label: 'Toast', start_at: at('19:00') }),
    ],
    event_schedule_tasks: [
      task('t-mine-role', 'm-hair', { role: 'Bridesmaid' }, 'With Sinag Beauty'),
      task('t-mine-seat', 'm-march', { guest_id: PAM }, 'You walk 3rd, with Ana'),
      task('t-mine-group', 'm-entrance', { group_id: 'grp-maids' }, 'You walk 1st'),
      task('t-other-role', 'm-barong', { role: 'groomsman' }, 'OTHER groomsmen fitting'),
      task('t-other-role-2', 'm-march', { role: 'groomsman' }, 'OTHER you walk 2nd'),
      task('t-other-seat', 'm-reading', { guest_id: 'g-ninong' }, 'OTHER ninong reads'),
      task('t-other-group', 'm-toast', { group_id: 'grp-ushers' }, 'OTHER ushers toast'),
      task('t-supplier', 'm-entrance', { vendor_id: 'v-lights' }, 'OTHER lights cue'),
      task('t-words', 'm-toast', { who_label: 'Seda captain' }, 'OTHER captain pours'),
      task('t-staged', 'm-staged', { guest_id: PAM }, 'OTHER staged line'),
    ],
    guest_group_memberships: [
      { group_id: 'grp-maids', guest_id: PAM },
      { group_id: 'grp-ushers', guest_id: 'g-usher' },
    ],
  };
}

async function pamsCard() {
  const r = await read.readYourSchedule(memoryClient() as never, { eventId: EVENT, guestId: PAM, roles: ['bridesmaid'], guestsArriveBy: '4:45 PM' });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok' || r.schedule.kind !== 'ok') throw new Error('Pam has a schedule');
  return r.schedule;
}

const every = (s: Awaited<ReturnType<typeof pamsCard>>) => s.chapters.flatMap((c) => c.lines.map((l) => `${c.name} | ${l.title} | ${l.sub ?? ''}`));

test('1 · a guest never sees another person’s lines', async () => {
  PRO = true;
  theDay('2026-12-11T09:00:00Z');
  const s = await pamsCard();
  assert.equal(s.stage, 'after');
  const lines = every(s);
  console.log(`[your-schedule] Pam after Release: ${lines.length} lines`);
  assert.ok(lines.length >= 3, `the card drew only ${lines.length} lines — the test is not seeing it`);
  assert.deepEqual(lines.filter((l) => l.includes('OTHER')), [], 'somebody else’s line reached Pam');
  for (const hidden of ['First reading', 'Barong fitting', 'Toast', 'Sponsors sign', 'Coordinator walk-through']) {
    assert.ok(!lines.some((l) => l.includes(hidden)), `"${hidden}" is not Pam’s and not for every guest, and was drawn`);
  }
  assert.ok(!s.chapters.some((c) => c.name === 'Preparation · Groomsmen'), 'a private chapter Pam is not on was listed');
  // Hers, by seat, by role (any case), by group — all three reach her.
  for (const own of ['You walk 3rd, with Ana', 'With Sinag Beauty', 'You walk 1st']) {
    assert.ok(lines.some((l) => l.includes(own)), `Pam’s own line "${own}" is missing`);
  }
  assert.equal(s.call?.label, 'Your call time');
  assert.equal(s.call?.time, '7:00 AM', 'the exact call time is her first task (8:00 AM) less the chapter’s 60 minutes');
});

test('1b · a plain guest sees the moments for everyone, and no one’s lines', async () => {
  PRO = true;
  theDay('2026-12-11T09:00:00Z');
  const r = await read.readYourSchedule(memoryClient() as never, { eventId: EVENT, guestId: 'g-plain', roles: [], guestsArriveBy: '4:45 PM' });
  assert.ok(r.kind === 'ok' && r.schedule.kind === 'ok');
  if (r.kind !== 'ok' || r.schedule.kind !== 'ok') return;
  const lines = every(r.schedule);
  assert.deepEqual(lines.map((l) => l.split(' | ')[1]), ['Wedding March', 'Grand Entrance']);
  assert.ok(lines.every((l) => l.endsWith('| ')), 'a plain guest’s line carries somebody’s task under it');
  assert.equal(r.schedule.call?.label, 'Arrive by');
});

test('2 · before Release there is no full schedule', async () => {
  PRO = true;
  theDay(null);
  const s = await pamsCard();
  assert.equal(s.stage, 'before');
  assert.deepEqual(s.chapters.map((c) => c.name), ['Ceremony', 'Reception'], 'before Release only the invited chapters are listed');
  assert.deepEqual(every(s), [], 'a line was drawn before Release');
  assert.equal(s.call?.label, 'Estimated call time');
  assert.equal(s.call?.time, '6:00 AM', 'Estimated = the first chapter she is on (7:00 AM) less 60 minutes');
  assert.equal(s.footnote, 'Your full schedule comes closer to the event.');
});

test('2b · Time TBA reads "Time TBA" — never midnight, never a call time', async () => {
  PRO = true;
  theDay(null);
  const prep = tables.event_schedule_blocks!.find((b) => b.block_id === 'c-prep')!;
  prep.time_tba = true;
  prep.start_at = `${DAY}T00:00:00+00:00`;
  const before = await pamsCard();
  // Her next chapter (Ceremony 1:30 PM, by her seat) is timed: the estimate comes from it, never from 12:00 AM.
  assert.equal(before.call?.time, '12:30 PM');
  tables.events = [{ event_id: EVENT, schedule_released_at: '2026-12-11T09:00:00Z' }];
  const after = await pamsCard();
  const prepCard = after.chapters.find((c) => c.name === 'Preparation · Bridesmaids')!;
  assert.match(prepCard.line, /Time TBA/);
  assert.ok(prepCard.lines.every((l) => l.time === 'Time TBA'), 'a line in a Time-TBA chapter drew a clock');
  assert.ok(!JSON.stringify(after).includes('12:00 AM'), 'midnight was drawn');
});

test('3 · Free never shows Release as working — the guest’s card', async () => {
  PRO = false;
  theDay('2026-12-11T09:00:00Z');
  const s = await pamsCard();
  assert.equal(s.stage, 'before', 'a Free event drew the full schedule because the column was set');
  assert.deepEqual(every(s), []);
  assert.equal(s.footnote, null, 'Free is told a full schedule is coming, which it never is');
  PRO = true;
});

test('3b · Free never shows Release as working — the press refuses and writes nothing', async () => {
  rpcCalls = [];
  RELEASE_PRO = false;
  const fd = new FormData();
  fd.set('event_id', EVENT);
  fd.set('intent', 'release');
  const refused = await action.sendCoordinatorBroadcast(fd);
  assert.equal(refused.ok, false);
  assert.deepEqual(rpcCalls, [], 'a Free event reached release_full_schedule');
  RELEASE_PRO = true;
  const ok = await action.sendCoordinatorBroadcast(fd);
  assert.equal(ok.ok, true, 'a Pro event could not release (the test is not seeing the action)');
  assert.deepEqual(rpcCalls, ['release_full_schedule']);
});
