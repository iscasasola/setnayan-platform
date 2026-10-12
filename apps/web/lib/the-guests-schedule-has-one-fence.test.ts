/**
 * the-guests-schedule-has-one-fence.test.ts — what a guest may see of the
 * schedule is ONE rule, and every guest-facing read asks through it.
 *
 * THE FAULT THIS HOLDS SHUT (2026-10-08). A moment can be made "Only for ·
 * Entourage / Sponsors / Family / Suppliers" (`event_schedule_blocks.audience`,
 * NULL = Everyone) or left as a coordinator's unreleased prep
 * (`visibility = 'coordinator_only'`). The guests' SCHEDULE asked all three
 * conditions. The guests' STORY page asked one — `is_public` — on the
 * service-role client, where the filter is the whole fence: an
 * "Only for · Entourage" moment was named on a public page with its time, its
 * place and its supplier. Two more reads were one condition short the same way
 * (the story's chapter names, the story's arranged moments), and the guests'
 * live "Now · Up next" header re-read by the database's own anonymous policy,
 * which has never heard of For ▾.
 *
 * The rule is `onlyWhatGuestsMaySee` in `lib/schedule.ts`. This file holds:
 *
 *   A · THE ROSTER. Every file that reads `event_schedule_blocks` is classified
 *       here — guest-facing (and then every read in it is fenced, counted) or
 *       not (with the reason). A new read anywhere fails until someone decides
 *       which it is. That decision is the point: the story's read was written
 *       by someone who believed `is_public` was the rule.
 *   B · THE BEHAVIOUR. The real loaders run against an in-memory table that
 *       really filters. A source scan can be satisfied by a helper that no
 *       longer does anything; rows cannot.
 *
 * ⚠ NOT COVERED, AND SAID SO: the database's own anonymous read policy
 * (`event_schedule_blocks_public_read`) asks `is_public` and `visibility` and
 * NOT `audience`. Anyone holding the public key and an event id can ask
 * PostgREST directly. Closing that is a migration; this guard is about what
 * the pages draw.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from './strip-comments';

const WEB = process.cwd();

/* ══════════════════════════════════════════════════════════════════════════
   A · THE ROSTER
   ══════════════════════════════════════════════════════════════════════════ */

/** A query against the table, in comment-free source. */
const READ = /\.from\(\s*['"`]event_schedule_blocks['"`]\s*\)/g;
/** The same query, handed straight to the fence. */
const FENCED_READ = /onlyWhatGuestsMaySee\(\s*[A-Za-z_$][\w$.]*\s*\.from\(\s*'event_schedule_blocks'\s*\)/g;
/** A PostgREST embed of the table inside another table's select — a read the fence cannot wrap. */
const EMBED = /event_schedule_blocks\s*[!(]/;

type GuestRead = {
  /** Why a guest reaches this read. */
  why: string;
  /** How many queries against the table the scope holds. Every one must be fenced. */
  reads: number;
  /** Limit the count to one exported function (the file also holds host reads). */
  scope?: string;
  /** The read is fenced by a shape other than `onlyWhatGuestsMaySee(x.from(…))` — it has its own test below. */
  ownShape?: true;
};

const GUEST_FACING: Record<string, GuestRead> = {
  'lib/schedule.ts': {
    why: 'fetchPublicScheduleBlocks — the guests’ schedule on the Event Hub, Find my seat, the pass card’s Arrive, the reminder email. Service-role callers.',
    reads: 1,
    scope: 'export async function fetchPublicScheduleBlocks',
  },
  'app/[slug]/_components/story/spine-data.ts': {
    why: 'loadStorySpineFacts — the public Story page’s "the venue, minute by minute": label, time, place, supplier credit. Service-role.',
    reads: 1,
  },
  'app/[slug]/_components/editorial/data.ts': {
    why: 'the public Story page names its chapters from the run of show, and the Story editor’s placeholder is that read’s declared twin ("cannot say different things"). Service-role, both.',
    reads: 2,
  },
  'lib/story-arrangement-store.ts': {
    why: 'loadRunOfShowMoments — the moments a guest’s arranged Story pages are grouped under (lib/story-pages.ts), shared with the editor so the two agree. Service-role.',
    reads: 1,
  },
  'app/_actions/run-of-show.ts': {
    why: 'fetchRunOfShowBlocks — the realtime refetch behind the guests’ "Now · Up next" header. The visitor’s own session; the anonymous policy does not ask audience, so the action does when the header says forGuests.',
    reads: 1,
    ownShape: true,
  },
};

/**
 * Every OTHER file that reads the table, and who it is for. None of these is
 * changed by the fence, on purpose: a host, a coordinator and a booked supplier
 * are exactly the people the narrower moments are FOR.
 */
const NOT_GUEST_FACING: Record<string, string> = {
  // ── the host's own tools (the couple's session, or the service role behind a host gate) ──
  'app/dashboard/[eventId]/schedule/actions.ts': 'host — the Schedule’s own writes and their re-reads',
  'app/dashboard/[eventId]/schedule/activity-picks-actions.ts': 'host — activity picks on the Schedule',
  'app/dashboard/[eventId]/launch/_components/details-guided-progress.ts': 'host — the Maker’s Details progress ticks',
  'app/dashboard/[eventId]/launch/page.tsx': 'host — the Maker’s Details › Schedule pieces',
  'app/dashboard/[eventId]/checklist-actions.ts': 'host — a head count for the checklist',
  'app/dashboard/[eventId]/website/editor/page.tsx': 'host — the older editor’s schedule panel (asks is_public only; a host mirror, not a guest page)',
  'lib/website-section-content.ts': 'host — a HEAD count that decides whether the host may force-show the Schedule section; no row leaves it',
  'lib/upcoming-items.ts': 'host — the dashboard’s "What’s next"',
  'lib/activity.ts': 'host — the dashboard’s activity feed',
  'lib/ceremony-time.server.ts': 'host — Apply moves the Ceremony block (the couple’s own session)',
  'lib/schedule-seed.server.ts': 'host — the first-open run-of-show seed',
  'lib/schedule-ros.ts': 'host and supplier — who is responsible for a block (the caller’s own session)',
  'lib/setnayan-ai-snapshot.ts': 'host — the planning assistant’s clash check',
  'lib/print-set.server.ts':
    'host — the prints the couple makes and previews in the Maker (ceremony and reception times; the Details card’s programme asks is_public only — reported 2026-10-08, not a page a guest opens)',
  'lib/run-of-show-advance.ts': 'coordinator and host — resolves a block’s event before the advance gate; returns no row to anyone',
  // ── a booked supplier's desk ──
  'app/vendor-dashboard/clients/[eventId]/calendar.ics/route.ts': 'supplier — their own calendar file',
  'app/vendor-dashboard/clients/[eventId]/script-actions.ts': 'supplier — the emcee script’s writes',
  'app/vendor-dashboard/clients/[eventId]/actions.ts': 'supplier — the client workspace’s actions',
  'app/vendor-dashboard/clients/[eventId]/_components/script-tab.tsx': 'supplier — the emcee script tab',
  'app/vendor-dashboard/clients/[eventId]/page.tsx': 'supplier — the client workspace',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/stage-script/stage-script.tsx': 'supplier — the stage script on the day',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts': 'coordinator — floor command on the day',
  'lib/supplier-night-before-email.ts': 'supplier — their own call time, the night before',
};

/** Every non-test source file under the three trees that queries the table. */
function filesThatRead(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const raw = readFileSync(full, 'utf8');
      if (!raw.includes('event_schedule_blocks')) continue;
      const code = stripComments(raw);
      if (code.match(READ) || EMBED.test(code)) out.set(path.relative(WEB, full).split(path.sep).join('/'), code);
    }
  };
  for (const tree of ['app', 'lib', 'components']) walk(path.join(WEB, tree));
  return out;
}

let readers: Map<string, string>;
before(() => {
  readers = filesThatRead();
});

test('A1 · every file that reads the schedule is classified — guest-facing or not, with the reason', () => {
  assert.ok(readers.size >= 20, `the scan found only ${readers.size} readers — it is not looking at the tree`);
  const unclassified = [...readers.keys()].filter((f) => !(f in GUEST_FACING) && !(f in NOT_GUEST_FACING));
  assert.deepEqual(
    unclassified,
    [],
    'a file reads event_schedule_blocks and nobody has said who it is for. If a GUEST can reach it, the read goes through onlyWhatGuestsMaySee and the file joins GUEST_FACING; otherwise it joins NOT_GUEST_FACING with the reason.',
  );
  const both = Object.keys(GUEST_FACING).filter((f) => f in NOT_GUEST_FACING);
  assert.deepEqual(both, [], 'a file is on both rosters');
  const stale = [...Object.keys(GUEST_FACING), ...Object.keys(NOT_GUEST_FACING)].filter((f) => !readers.has(f));
  assert.deepEqual(stale, [], 'a roster names a file that no longer reads the table — remove the line');
});

test('A2 · nothing under the guests’ own routes is classed as "not guest-facing"', () => {
  const guestTrees = ['app/[slug]/', 'app/api/guest/'];
  const wrong = Object.keys(NOT_GUEST_FACING).filter((f) => guestTrees.some((t) => f.startsWith(t)));
  assert.deepEqual(wrong, [], 'a file under a guest route reads the schedule outside the fence');
});

test('A3 · every read in a guest-facing file goes through the fence — counted, not spotted', () => {
  for (const [file, entry] of Object.entries(GUEST_FACING)) {
    const whole = readers.get(file);
    assert.ok(whole, `${file} is on the roster and was not scanned`);
    let code = whole;
    if (entry.scope) {
      const at = whole.indexOf(entry.scope);
      assert.ok(at >= 0, `${file}: ${entry.scope} is gone`);
      const rest = whole.slice(at);
      code = rest.slice(0, rest.indexOf('\n}\n'));
    }
    const reads = (code.match(READ) ?? []).length;
    assert.equal(reads, entry.reads, `${file}: ${reads} read(s) of the table, the roster says ${entry.reads} — a read was added or removed; decide whether a guest reaches it`);
    if (entry.ownShape) continue;
    const fenced = (code.match(FENCED_READ) ?? []).length;
    assert.equal(fenced, reads, `${file}: ${fenced} of ${reads} read(s) go through onlyWhatGuestsMaySee`);
    // The fence is the only place its conditions are written — a hand-typed copy beside it is the fault.
    assert.doesNotMatch(code, /\.eq\(\s*'is_public'\s*,\s*true\s*\)/, `${file}: is_public is asked by hand beside the fence`);
  }
});

test('A4 · the table is never read as an embed inside another table’s select (the fence cannot wrap one)', () => {
  const embedded = [...readers].filter(([, code]) => EMBED.test(code)).map(([f]) => f);
  assert.deepEqual(embedded, []);
});

test('A5 · the guests’ live header refetches by the same rule', () => {
  const action = readers.get('app/_actions/run-of-show.ts')!;
  assert.match(action, /const read = supabase\s*\.from\('event_schedule_blocks'\)/);
  assert.match(action, /await \(forGuests \? onlyWhatGuestsMaySee\(read\) : read\)/);
  const header = stripComments(readFileSync(path.join(WEB, 'app/_components/run-of-show-header.tsx'), 'utf8'));
  assert.match(header, /fetchRunOfShowBlocks\(eventId, forGuests\)/, 'the header no longer tells the action who is asking');
  const widget = stripComments(readFileSync(path.join(WEB, 'app/[slug]/_components/schedule-widget.tsx'), 'utf8'));
  const mounts = widget.match(/<RunOfShowHeader\b[^>]*>/g) ?? [];
  assert.equal(mounts.length, 1, 'the guests’ schedule mounts the header once');
  assert.match(mounts[0]!, /\sforGuests\s*\/>$/, 'the guests’ schedule mounts the header without forGuests');
});

test('A6 · no guest route reaches for the whole timeline', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const raw = readFileSync(full, 'utf8');
      if (!raw.includes('fetchScheduleBlocks')) continue;
      if (/\bfetchScheduleBlocks\b/.test(stripComments(raw))) offenders.push(path.relative(WEB, full));
    }
  };
  walk(path.join(WEB, 'app/[slug]'));
  walk(path.join(WEB, 'app/api/guest'));
  assert.deepEqual(offenders, [], 'fetchScheduleBlocks is the host’s whole timeline; a guest route asks fetchPublicScheduleBlocks');
});

/* ══════════════════════════════════════════════════════════════════════════
   B · THE BEHAVIOUR — real loaders, a table that really filters
   ══════════════════════════════════════════════════════════════════════════ */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Each query's chain of calls, in order — `['from:t', 'eq:["a",1]', …]`. */
let chains: string[][] = [];
let tables: Tables = {};

/**
 * An in-memory PostgREST, as far as these loaders go: `eq` / `neq` / `is` /
 * `in` / `not(…, 'is', null)` really filter; everything else passes rows
 * through. A filter the stub ignored would let a dropped condition stay green,
 * so the three the fence uses are the three it implements exactly.
 */
function memoryClient(): unknown {
  return {
    from(table: string) {
      let rows: Row[] = [...(tables[table] ?? [])];
      const chain: string[] = [`from:${table}`];
      chains.push(chain);
      const b: Record<string, unknown> = {};
      const step = (name: string, apply: (rows: Row[], ...args: never[]) => Row[]) => {
        b[name] = (...args: unknown[]) => {
          chain.push(`${name}:${JSON.stringify(args)}`);
          rows = apply(rows, ...(args as never[]));
          return b;
        };
      };
      step('eq', (r, c: string, v: unknown) => r.filter((x) => x[c] === v));
      step('neq', (r, c: string, v: unknown) => r.filter((x) => x[c] != null && x[c] !== v));
      step('is', (r, c: string, v: unknown) => r.filter((x) => (x[c] ?? null) === v));
      step('in', (r, c: string, vs: unknown[]) => r.filter((x) => vs.includes(x[c])));
      step('not', (r, c: string, op: string, v: unknown) => (op === 'is' && v === null ? r.filter((x) => x[c] != null) : r));
      for (const m of ['select', 'order', 'limit', 'range', 'gte', 'lte', 'gt', 'lt', 'or', 'like', 'ilike', 'contains', 'overlaps', 'filter', 'match']) {
        step(m, (r) => r);
      }
      b.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
      b.single = b.maybeSingle;
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject);
      return b;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
}

/* ── module shims: `server-only`, and the service-role factory the spine calls itself ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
function shim(id: string, exports: unknown): string {
  const file = path.join(process.cwd(), `__the_guests_schedule_has_one_fence_${id}__.js`);
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
  '@/lib/supabase/admin': shim('admin', { createAdminClient: () => memoryClient() }),
};
{
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request in SHIMS) return SHIMS[request]!;
    return original.call(this, request, ...rest);
  };
}

let schedule: typeof import('./schedule');
let spine: typeof import('@/app/[slug]/_components/story/spine-data');
let arrangement: typeof import('./story-arrangement-store');
before(async () => {
  schedule = await import('./schedule');
  spine = await import('@/app/[slug]/_components/story/spine-data');
  arrangement = await import('./story-arrangement-store');
});

const EVENT = 'ev_fence';
const DAY = '2026-12-12';

/** One block per way a moment can be kept from the room — and one that is for everybody. */
function theDay(): Row[] {
  const block = (over: Row): Row => ({
    event_id: EVENT,
    block_type: 'custom',
    end_at: null,
    is_public: true,
    audience: null,
    visibility: 'couple_visible',
    sort_order: 0,
    parent_block_id: null,
    responsible_vendor_ids: [],
    ...over,
  });
  return [
    block({ public_id: 'S89B-EVERYONE00', label: 'Ceremony', start_at: `${DAY}T14:00:00+00:00`, location: 'San Agustin Church', responsible_vendor_ids: ['v_choir'] }),
    block({ public_id: 'S89B-ENTOURAGE0', label: 'Entourage photos', start_at: `${DAY}T12:00:00+00:00`, location: 'Garden gate', audience: 'entourage', responsible_vendor_ids: ['v_photo'] }),
    block({ public_id: 'S89B-SPONSORS00', label: 'Sponsors briefing', start_at: `${DAY}T13:00:00+00:00`, location: 'Sacristy', audience: 'sponsors' }),
    block({ public_id: 'S89B-FAMILY0000', label: 'Family blessing', start_at: `${DAY}T13:15:00+00:00`, location: 'Side chapel', audience: 'family' }),
    block({ public_id: 'S89B-SUPPLIERS0', label: 'Supplier ingress', start_at: `${DAY}T09:00:00+00:00`, location: 'Loading bay', audience: 'suppliers' }),
    block({ public_id: 'S89B-STAGED0000', label: 'Coordinator prep', start_at: `${DAY}T10:00:00+00:00`, location: 'Holding room', visibility: 'coordinator_only' }),
    block({ public_id: 'S89B-PRIVATE000', label: 'Envelope handover', start_at: `${DAY}T16:00:00+00:00`, location: 'Bridal suite', is_public: false }),
  ];
}

/** Every word that belongs only to a moment a guest may not see. */
const KEPT_FROM_GUESTS = [
  'Entourage photos',
  'Garden gate',
  'Photo Crew',
  'Sponsors briefing',
  'Sacristy',
  'Family blessing',
  'Side chapel',
  'Supplier ingress',
  'Loading bay',
  'Coordinator prep',
  'Holding room',
  'Envelope handover',
  'Bridal suite',
];

function seed(): void {
  chains = [];
  tables = {
    events: [{ event_id: EVENT, event_type: 'wedding', created_at: '2026-01-05T02:00:00+00:00', role_palette: null }],
    event_vendors: [
      { event_id: EVENT, vendor_id: 'v_choir', vendor_name: 'Chapel Choir', contract_signed_at: null },
      { event_id: EVENT, vendor_id: 'v_photo', vendor_name: 'Photo Crew', contract_signed_at: null },
    ],
    event_schedule_blocks: theDay(),
  };
}

const labels = (rows: ReadonlyArray<{ label?: unknown }>) => rows.map((r) => String(r.label)).sort();

test('B1 · the fence itself: public, for Everyone, and not a coordinator’s prep', async () => {
  seed();
  const client = memoryClient() as { from(t: string): { select(c: string): never } };
  const all = (await schedule.onlyWhatGuestsMaySee(client.from('event_schedule_blocks').select('label') as never)) as unknown as { data: Row[] };
  assert.deepEqual(labels(all.data), ['Ceremony']);
  // The one opt-out, which only the public fetch's own callers hold.
  const staged = (await schedule.onlyWhatGuestsMaySee(client.from('event_schedule_blocks').select('label') as never, {
    excludeStaged: false,
  })) as unknown as { data: Row[] };
  assert.deepEqual(labels(staged.data), ['Ceremony', 'Coordinator prep']);
});

test('B2 · the guests’ Story names only the moment that is for everybody', async () => {
  seed();
  const facts = await spine.loadStorySpineFacts({ eventId: EVENT, eventDate: DAY, eventEndDate: null, createdAtMs: null });
  assert.deepEqual(labels(facts.blocks), ['Ceremony'], 'the day’s venue blocks');
  assert.deepEqual(facts.blocks[0]!.location, 'San Agustin Church');
  assert.deepEqual(facts.blocks[0]!.vendorNames, ['Chapel Choir'], 'the public moment keeps its supplier credit');
  // Not one word of a kept moment anywhere in what the page is handed — label, place or supplier.
  const everything = JSON.stringify(facts);
  for (const word of KEPT_FROM_GUESTS) {
    assert.ok(!everything.includes(word), `the Story's facts carry "${word}"`);
  }
  // And the read asked for it in ONE query, by the three conditions.
  const reads = chains.filter((c) => c[0] === 'from:event_schedule_blocks');
  assert.equal(reads.length, 1, 'one read of the schedule per Story render');
  assert.deepEqual(reads[0]!.slice(2), [
    `eq:["event_id","${EVENT}"]`,
    'eq:["is_public",true]',
    'is:["audience",null]',
    'neq:["visibility","coordinator_only"]',
  ]);
});

test('B3 · the Story’s arranged pages are grouped under the same moments', async () => {
  seed();
  const out = await arrangement.loadRunOfShowMoments(memoryClient() as never, EVENT);
  assert.equal(out.failed, false);
  assert.deepEqual(labels(out.moments), ['Ceremony']);
});

/** The columns the public fetch has always asked for, in its one private list. */
const PUBLIC_COLUMNS =
  'block_id,public_id,event_id,label,block_type,start_at,end_at,location,notes,is_public,sort_order,parent_block_id,created_at,run_state,actual_start_at,actual_end_at,audience';

test('B4 · the guests’ schedule is unchanged — the same request, condition for condition', async () => {
  // The chain below is what `fetchPublicScheduleBlocks` sent BEFORE the fence
  // was lifted out of it (run against origin/main's lib/schedule.ts on
  // 2026-10-08 — same test, same result). Moving the rule must not move a filter.
  seed();
  const released = await schedule.fetchPublicScheduleBlocks(memoryClient() as never, EVENT, true);
  assert.deepEqual(labels(released), ['Ceremony']);
  assert.deepEqual(chains.at(-1), [
    'from:event_schedule_blocks',
    `select:["${PUBLIC_COLUMNS}"]`,
    `eq:["event_id","${EVENT}"]`,
    'eq:["is_public",true]',
    'is:["audience",null]',
    'neq:["visibility","coordinator_only"]',
    'order:["start_at",{"ascending":true}]',
    'order:["sort_order",{"ascending":true}]',
  ]);

  // The `coordinator_prep_release` control OFF: the visibility column is never named.
  seed();
  const control = await schedule.fetchPublicScheduleBlocks(memoryClient() as never, EVENT);
  assert.deepEqual(labels(control), ['Ceremony', 'Coordinator prep']);
  assert.deepEqual(chains.at(-1), [
    'from:event_schedule_blocks',
    `select:["${PUBLIC_COLUMNS}"]`,
    `eq:["event_id","${EVENT}"]`,
    'eq:["is_public",true]',
    'is:["audience",null]',
    'order:["start_at",{"ascending":true}]',
    'order:["sort_order",{"ascending":true}]',
  ]);
});
