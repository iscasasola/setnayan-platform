/**
 * H6 MIRRORS THE BOOKING PATH — and says so the day it stops.
 *
 * `service_cards_unbookable_on()` (migration 20271221805341) hides a supplier
 * from the bench search when the booking path would refuse every card they
 * sell. It is a restatement: the booking path is `acquire_schedule_pools()`,
 * `acquire_service_time_slot()`, and the TypeScript pool resolver
 * `resolvePoolIdsForService`. A restatement is only right until one side moves.
 *
 * The seeded differential (tests/db/a-full-card-leaves-bench-search.db.test.ts)
 * proves agreement BY BEHAVIOUR on every case it seeds. What it cannot see is a
 * refusal nobody seeded — a new block source, a new status, a new pool source.
 * This file is the net for those:
 *
 *   1. THE STATUSES — every status the two acquire functions can return is
 *      classified here as a refusal the mirror copies, the one ruled exception
 *      ('whitelist'), or not a refusal. A new status fails until classified.
 *   2. THE PREDICATES — each refusal condition in the LATEST body of each
 *      acquire function is found again in the mirror. Mutation-checked below:
 *      every predicate is shown to fail the audit when removed from either side.
 *   3. THE POOLS — the resolver still reads exactly the sources the mirror reads.
 *   4. THE DAILY LIMIT — vendor_services.daily_capacity refuses through ONE
 *      count, `service_card_bookings_on` (LOCK-PATH CAPACITY, migration
 *      20271222330608). The lock's "#2" gate (vendors/actions.ts) and the mirror
 *      both ask it, both compare it to the card's limit the same way, and it
 *      counts exactly lib/events.ts CONFIRMED_VENDOR_STATUSES on day-precise
 *      events. (This replaced H6's tripwire, which existed to fail the day the
 *      gate stopped counting through the couple's RLS-blind session.)
 *      The supplier's yes (`vendor_agree_to_lock`, LOCK-PATH 2, migration
 *      20271223386305) — the step that BOOKS under the lock handshake — asks
 *      the same count the same way, so the ask, the yes and the search can
 *      never disagree about a card's daily limit.
 *   5. THE CALLERS — only the bench asks to hide; everyone else is unchanged;
 *      and only server code, with the admin client, ever calls the mirror.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { stripSqlComments } from '@/lib/security/events-column-privileges';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const MIRROR_FN = 'service_cards_unbookable_on';

const squash = (s: string) => s.replace(/\s+/g, ' ');

/** The body in force: the LAST migration (filename order) that defines it. */
function latestBody(fn: string): { file: string; body: string } {
  const create = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fn}\\s*\\(`);
  const defining = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: stripSqlComments(readFileSync(join(MIGRATIONS, file), 'utf8')) }))
    .filter((m) => create.test(m.sql));
  assert.ok(defining.length > 0, `no migration defines public.${fn}`);
  const { file, sql } = defining[defining.length - 1]!;
  const start = sql.search(create);
  // Dollar-quoted body: from the first $tag$ after the CREATE to its twin.
  const open = /\$([A-Za-z_]*)\$/.exec(sql.slice(start));
  assert.ok(open, `${file}: no dollar-quoted body for ${fn}`);
  const bodyStart = start + open.index + open[0].length;
  const bodyEnd = sql.indexOf(open[0], bodyStart);
  assert.ok(bodyEnd > bodyStart, `${file}: unterminated body for ${fn}`);
  return { file, body: squash(sql.slice(bodyStart, bodyEnd)) };
}

const pools = latestBody('acquire_schedule_pools');
const slots = latestBody('acquire_service_time_slot');
const resolver = latestBody('resolve_schedule_pool');
const mirror = latestBody(MIRROR_FN);
const COUNT_FN = 'service_card_bookings_on';
const count = latestBody(COUNT_FN);
/** The supplier's yes — under the lock handshake, the step that books. */
const agree = latestBody('vendor_agree_to_lock');

/**
 * The lock's "#2" daily-limit gate, read from finalizeVendor: from where it
 * reads the card's limit to where it refuses. Comment-stripped.
 */
const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';
function dailyLimitGate(src: string): string {
  const start = src.search(/export async function finalizeVendor\(/);
  assert.ok(start >= 0, 'finalizeVendor is gone — re-derive where the daily limit is enforced');
  const from = src.indexOf(".select('daily_capacity')", start);
  assert.ok(from > start, 'the #2 gate no longer reads daily_capacity — re-derive it');
  const to = src.indexOf("'soft_hold_limit_reached'", from);
  assert.ok(to > from, 'the #2 gate no longer refuses with soft_hold_limit_reached — re-derive it');
  return src.slice(from, to);
}
const gate = squash(dailyLimitGate(stripComments(readFileSync(join(WEB, ACTIONS), 'utf8'))));

// ── 1 · THE STATUSES ─────────────────────────────────────────────────────

/** Mirrored refusals · the ruled exception · outcomes that are not refusals. */
const STATUS_CLASS: Record<string, 'refusal' | 'ruled_shown' | 'not_a_refusal'> = {
  blocked: 'refusal',
  locked: 'refusal',
  full: 'refusal',
  // Held for the supplier's yes; search shows it (orchestrator ruling 2026-09-11).
  whitelist: 'ruled_shown',
  ok: 'not_a_refusal',
  // The couple is not on the event — search is always for the couple's own.
  not_authorized: 'not_a_refusal',
  // No day-precise date — the search asks nothing without one either.
  no_date: 'not_a_refusal',
  // No pools to gate — the booking goes through ungated.
  no_pools: 'not_a_refusal',
  // The couple picked a slot that went away — they pick again; the mirror
  // answers "is ANY active slot open", which already covers that.
  slot_not_found: 'not_a_refusal',
};

function returnedStatuses(body: string): Set<string> {
  const out = new Set<string>();
  for (const m of body.matchAll(/jsonb_build_object\(\s*'status'\s*,\s*'([a-z_]+)'/g)) out.add(m[1]!);
  return out;
}

test('every status the booking path can return is classified', () => {
  for (const [name, fn] of [
    ['acquire_schedule_pools', pools],
    ['acquire_service_time_slot', slots],
  ] as const) {
    const statuses = returnedStatuses(fn.body);
    assert.ok(statuses.size >= 5, `${fn.file}: read ${statuses.size} statuses — the scan is broken`);
    const unknown = [...statuses].filter((s) => !(s in STATUS_CLASS));
    assert.deepEqual(
      unknown,
      [],
      `${name} (${fn.file}) can now return ${unknown.join(', ')}. If it is a new REFUSAL, ` +
        `teach ${MIRROR_FN} to refuse it (a new migration), seed it in ` +
        'tests/db/a-full-card-leaves-bench-search.db.test.ts, then classify it here.',
    );
    for (const s of ['blocked', 'locked', 'full', 'whitelist'].filter((x) => name === 'acquire_schedule_pools' || x !== 'blocked')) {
      assert.ok(statuses.has(s), `${name} no longer returns '${s}' — the mirror refuses something the booking path does not`);
    }
  }
});

// ── 2 · THE PREDICATES ───────────────────────────────────────────────────

/**
 * The mirror's CTEs by name. A predicate is checked in the CTE where it must
 * hold, not anywhere in the body — several conditions appear in more than one
 * CTE, and "somewhere" would let one copy be deleted unseen.
 */
const CTES = ['svc', 'wanted_category', 'real_pool', 'virtual_pool_card', 'active_pool', 'shop_closed', 'pool_refused', 'slot', 'slot_refused', 'capacity_refused'] as const;
type Cte = (typeof CTES)[number];

function mirrorParts(body: string): Record<Cte, string> {
  const out = {} as Record<Cte, string>;
  for (const name of CTES) {
    const m = new RegExp(`\\b${name} AS \\(`).exec(body);
    assert.ok(m, `the mirror has no CTE named ${name} — this guard must be re-derived`);
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < body.length && depth > 0; i += 1) {
      if (body[i] === '(') depth += 1;
      else if (body[i] === ')') depth -= 1;
    }
    out[name] = body.slice(m.index + m[0].length, i - 1);
  }
  return out;
}

type Predicate = { name: string; side: 'pools' | 'slots' | 'count' | 'gate' | 'agree'; booking: RegExp; mirror: Array<[Cte, RegExp]> };

const DAY_COVERS = (d: string) =>
  new RegExp(
    `\\(b\\.blocked_at AT TIME ZONE 'Asia/Manila'\\)::date <= ${d} AND \\(b\\.blocked_until AT TIME ZONE 'Asia/Manila'\\)::date >= ${d}`,
  );

const PREDICATES: Predicate[] = [
  {
    name: 'closures are manual or synced-calendar blocks',
    side: 'pools',
    booking: /b\.block_source IN \('manual', 'synced_calendar'\)/,
    mirror: [
      ['pool_refused', /b\.block_source IN \('manual', 'synced_calendar'\)/],
      ['shop_closed', /b\.block_source IN \('manual', 'synced_calendar'\)/],
    ],
  },
  {
    name: 'a closure covers the pool or the whole shop',
    side: 'pools',
    booking: /\(b\.pool_id = v_pool\.pool_id OR b\.pool_id IS NULL\)/,
    mirror: [
      ['pool_refused', /\(b\.pool_id = ap\.pool_id OR b\.pool_id IS NULL\)/],
      ['shop_closed', /AND b\.pool_id IS NULL/],
    ],
  },
  {
    name: 'a block covers the day on the Manila calendar',
    side: 'pools',
    booking: DAY_COVERS('v_date'),
    mirror: [
      ['pool_refused', DAY_COVERS('d\\.day')],
      ['shop_closed', DAY_COVERS('d\\.day')],
    ],
  },
  {
    name: 'a day state covers the pool or the whole shop',
    side: 'pools',
    booking: /\(ds\.pool_id = v_pool\.pool_id OR ds\.pool_id IS NULL\)/,
    mirror: [
      ['pool_refused', /\(ds\.pool_id = ap\.pool_id OR ds\.pool_id IS NULL\)/],
      ['shop_closed', /AND ds\.pool_id IS NULL/],
    ],
  },
  {
    name: "a 'locked' day refuses",
    side: 'pools',
    booking: /ds\.day_state = 'locked'/,
    mirror: [
      ['pool_refused', /ds\.day_state = 'locked'/],
      ['shop_closed', /ds\.day_state = 'locked'/],
    ],
  },
  {
    name: 'only live pool bookings count',
    side: 'pools',
    booking: /pb\.booked_date = v_date AND pb\.released_at IS NULL/,
    mirror: [['pool_refused', /pb\.booked_date = d\.day AND pb\.released_at IS NULL/]],
  },
  {
    name: 'external clients count toward the pool',
    side: 'pools',
    booking: /b\.pool_id = v_pool\.pool_id AND b\.block_source = 'external_client'/,
    mirror: [['pool_refused', /b\.pool_id = ap\.pool_id AND b\.block_source = 'external_client'/]],
  },
  {
    name: 'full at daily_booking_capacity',
    side: 'pools',
    booking: /v_used >= v_pool\.daily_booking_capacity/,
    mirror: [
      ['active_pool', /p\.daily_booking_capacity AS cap/],
      ['pool_refused', /\) >= ap\.cap/],
    ],
  },
  {
    name: 'only active pools are gated',
    side: 'pools',
    booking: /WHERE pool_id = ANY \(p_pool_ids\) AND is_active/,
    mirror: [['active_pool', /WHERE p\.is_active/]],
  },
  {
    name: 'only active slots are offered',
    side: 'slots',
    booking: /AND vendor_service_id = p_service_id AND is_active/,
    mirror: [['slot', /AND t\.is_active/]],
  },
  {
    name: "a shop-wide 'locked' day refuses a slot",
    side: 'slots',
    booking: /ds\.state_date = v_date AND ds\.pool_id IS NULL/,
    mirror: [['slot_refused', /ds\.state_date = d\.day AND ds\.pool_id IS NULL AND ds\.day_state = 'locked'/]],
  },
  {
    name: 'a slot is taken by booked, unarchived rows',
    side: 'slots',
    booking: /status IN \('contracted', 'deposit_paid', 'delivered', 'complete'\) AND archived_at IS NULL/,
    mirror: [['slot_refused', /ev\.status IN \('contracted', 'deposit_paid', 'delivered', 'complete'\) AND ev\.archived_at IS NULL/]],
  },
  {
    name: 'only day-precise events occupy a slot',
    side: 'slots',
    booking: /WHERE event_date = v_date AND event_date_precision = 'day'/,
    mirror: [['slot_refused', /e\.event_date = d\.day AND e\.event_date_precision = 'day'/]],
  },
  {
    name: 'a slot is full at its capacity',
    side: 'slots',
    booking: /v_used >= v_capacity/,
    mirror: [['slot_refused', /< sl\.cap/]],
  },
  // ── the per-card daily limit: the count, then the gate, then the mirror ──
  {
    name: 'the daily limit counts only booked rows',
    side: 'count',
    booking: /ev\.status IN \('contracted', 'deposit_paid', 'delivered', 'complete'\)/,
    mirror: [['capacity_refused', /public\.service_card_bookings_on\(svc\.sid, d\.day\)/]],
  },
  {
    name: 'an archived booking does not count toward the daily limit',
    side: 'count',
    booking: /AND ev\.archived_at IS NULL/,
    mirror: [['capacity_refused', /public\.service_card_bookings_on\(/]],
  },
  {
    name: 'only a day-precise event counts toward the daily limit',
    side: 'count',
    booking: /e\.event_date = p_day AND e\.event_date_precision = 'day'/,
    mirror: [['capacity_refused', /public\.service_card_bookings_on\(/]],
  },
  {
    name: 'the gate asks only on a day-precise event',
    side: 'gate',
    booking: /if \(capDate && capEvent\?\.event_date_precision === 'day'\)/,
    mirror: [['capacity_refused', /CROSS JOIN d/]],
  },
  {
    name: 'the gate and the mirror ask the SAME count',
    side: 'gate',
    booking: /await createAdminClient\(\)\.rpc\( 'service_card_bookings_on', \{ p_service_id: targetVendor\.service_id, p_day: capDate, p_exclude_vendor_id: vendorId, \}, \)/,
    mirror: [['capacity_refused', /AND public\.service_card_bookings_on\(svc\.sid, d\.day\)/]],
  },
  {
    name: 'the limit is the card’s daily_capacity, only when set above zero',
    side: 'gate',
    booking: /typeof capacity === 'number' && capacity > 0/,
    mirror: [
      ['svc', /s\.daily_capacity AS dcap/],
      ['capacity_refused', /WHERE svc\.dcap IS NOT NULL AND svc\.dcap > 0/],
    ],
  },
  {
    name: 'full AT the limit, not past it',
    side: 'gate',
    booking: /typeof booked === 'number' && booked >= capacity/,
    mirror: [['capacity_refused', /\) >= svc\.dcap/]],
  },
  {
    name: 'the date is the couple’s own event, read through their session',
    side: 'gate',
    booking: /await supabase \.from\('events'\) \.select\('event_date, event_date_precision'\) \.eq\('event_id', eventId\)/,
    mirror: [['capacity_refused', /FROM svc/]],
  },
  {
    name: 'a slotted card is judged by its slots, never the daily limit',
    side: 'slots',
    booking: /AND vendor_service_id = p_service_id AND is_active/,
    mirror: [['capacity_refused', /AND NOT EXISTS \(SELECT 1 FROM slot sl WHERE sl\.sid = svc\.sid\)/]],
  },
  // ── …and the supplier's yes, which books under the handshake (LOCK-PATH 2) ──
  {
    name: 'the yes asks the SAME count, full AT the limit',
    side: 'agree',
    booking: /AND public\.service_card_bookings_on\(v_service, v_date, p_event_vendor_id\) >= v_daily_cap THEN/,
    mirror: [['capacity_refused', /AND public\.service_card_bookings_on\(svc\.sid, d\.day\) >= svc\.dcap/]],
  },
  {
    name: 'the yes reads the card’s own daily_capacity',
    side: 'agree',
    booking: /SELECT vs\.daily_capacity INTO v_daily_cap FROM public\.vendor_services vs WHERE vs\.vendor_service_id = v_service/,
    mirror: [['svc', /s\.daily_capacity AS dcap/]],
  },
  {
    name: 'the yes applies a limit only when set above zero',
    side: 'agree',
    booking: /IF v_daily_cap IS NOT NULL AND v_daily_cap > 0/,
    mirror: [['capacity_refused', /WHERE svc\.dcap IS NOT NULL AND svc\.dcap > 0/]],
  },
  {
    name: 'the yes judges a slotted card by its slots, never the daily limit',
    side: 'agree',
    booking: /NOT EXISTS \( SELECT 1 FROM public\.vendor_service_time_slots t WHERE t\.vendor_service_id = v_service AND t\.is_active \)/,
    mirror: [['capacity_refused', /AND NOT EXISTS \(SELECT 1 FROM slot sl WHERE sl\.sid = svc\.sid\)/]],
  },
  {
    name: 'the yes asks only on a day-precise date',
    side: 'agree',
    booking: /IF v_date IS NOT NULL AND v_prec = 'day' AND v_status NOT IN \('contracted', 'deposit_paid', 'delivered', 'complete'\) THEN SELECT ev\.service_id INTO v_service/,
    mirror: [['capacity_refused', /CROSS JOIN d/]],
  },
  {
    name: 'the yes refuses with a status the supplier is told about',
    side: 'agree',
    booking: /RETURN jsonb_build_object\( 'status', 'daily_limit_reached'/,
    mirror: [['capacity_refused', /FROM svc/]],
  },
];

type Bodies = { pools: string; slots: string; count: string; gate: string; agree: string; mirror: string; parts: Record<Cte, string> };

/** Every predicate that is missing from either side — the audit itself. */
function auditMirror(b: Bodies): string[] {
  const out: string[] = [];
  for (const p of PREDICATES) {
    if (!p.booking.test(b[p.side])) out.push(`booking path lost: ${p.name}`);
    for (const [cte, re] of p.mirror) {
      if (!re.test(b.parts[cte])) out.push(`mirror lost: ${p.name} (in ${cte})`);
    }
  }
  if (/'whitelist'/.test(b.mirror)) out.push("mirror refuses 'whitelist' (ruled shown)");
  if (!/UNION SELECT r\.sid, r\.day FROM capacity_refused r;/.test(b.mirror)) {
    out.push('mirror does not return the daily-limit refusals');
  }
  return out;
}

const real: Bodies = {
  pools: pools.body,
  slots: slots.body,
  count: count.body,
  gate,
  agree: agree.body,
  mirror: mirror.body,
  parts: mirrorParts(mirror.body),
};
const everywhere = (re: RegExp) => new RegExp(re.source, 'g');

test('the mirror restates every refusal condition in the booking path in force', () => {
  assert.deepEqual(auditMirror(real), [], `against ${pools.file} · ${slots.file} · ${count.file} · ${ACTIONS} · ${agree.file} · ${mirror.file}`);
});

test('MUTATION · every predicate fails the audit when removed from either side', () => {
  for (const p of PREDICATES) {
    for (const [cte, re] of p.mirror) {
      const parts = { ...real.parts, [cte]: real.parts[cte].replace(everywhere(re), 'TRUE') };
      assert.ok(
        auditMirror({ ...real, parts }).includes(`mirror lost: ${p.name} (in ${cte})`),
        `deleting "${p.name}" from the mirror's ${cte} went unseen`,
      );
    }
    const lostBooking = auditMirror({ ...real, [p.side]: real[p.side].replace(everywhere(p.booking), 'TRUE') });
    assert.ok(
      lostBooking.includes(`booking path lost: ${p.name}`),
      `deleting "${p.name}" from the booking path went unseen`,
    );
  }
  const whitelisted = real.mirror.replace("day_state = 'locked'", "day_state IN ('locked','whitelist')");
  assert.ok(auditMirror({ ...real, mirror: whitelisted }).includes("mirror refuses 'whitelist' (ruled shown)"));
  const unreturned = real.mirror.replace(' UNION SELECT r.sid, r.day FROM capacity_refused r;', ';');
  assert.notEqual(unreturned, real.mirror, 'mutation did not apply');
  assert.ok(auditMirror({ ...real, mirror: unreturned }).includes('mirror does not return the daily-limit refusals'));
});

test('the daily-limit count counts exactly lib/events.ts CONFIRMED_VENDOR_STATUSES', () => {
  const events = stripComments(readFileSync(join(WEB, 'lib/events.ts'), 'utf8'));
  const m = /export const CONFIRMED_VENDOR_STATUSES = \[([^\]]*)\] as const;/.exec(events);
  assert.ok(m, 'CONFIRMED_VENDOR_STATUSES is gone from lib/events.ts');
  const ts = [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  const sql = /ev\.status IN \(([^)]*)\)/.exec(count.body);
  assert.ok(sql, `${count.file}: the count names no status list`);
  const counted = [...sql[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(counted, ts, 'the daily-limit count and the app disagree on what a booking is');
  assert.ok(ts.length >= 4);
});

test('the count never writes, and only the server may call it', () => {
  const sql = stripSqlComments(readFileSync(join(MIGRATIONS, count.file), 'utf8'));
  assert.doesNotMatch(count.body, /\b(INSERT|UPDATE|DELETE)\b/);
  const sig = `public\\.${COUNT_FN}\\([^)]*\\)`;
  assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${COUNT_FN}\\([\\s\\S]*?\\bSTABLE\\b[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path`));
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`));
  const grants = [...sql.matchAll(new RegExp(`GRANT [^;]* ON FUNCTION ${sig} TO ([^;]+);`, 'g'))].map((x) => x[1]!.trim());
  assert.deepEqual(grants, ['service_role'], 'a signed-in browser must never be able to count a supplier’s bookings');
});

test('only the lock’s gate and the mirror ask the count — nobody else', () => {
  const callers: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (src.includes(`'${COUNT_FN}'`)) callers.push(relative(WEB, file));
  }
  assert.deepEqual(callers, [ACTIONS]);
  assert.equal((gate.match(/'service_card_bookings_on'/g) ?? []).length, 1);
});

test('the mirror never writes, and only the server may call it', () => {
  const sql = stripSqlComments(readFileSync(join(MIGRATIONS, mirror.file), 'utf8'));
  assert.doesNotMatch(mirror.body, /\b(INSERT|UPDATE|DELETE)\b|resolve_schedule_pool\s*\(/);
  assert.match(sql, /\bSTABLE\b/);
  const sig = `public\\.${MIRROR_FN}\\([^)]*\\)`;
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`));
  assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`));
  const grants = [...sql.matchAll(new RegExp(`GRANT [^;]* ON FUNCTION ${sig} TO ([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.deepEqual(grants, ['service_role'], 'a signed-in browser must never be able to call it');
});

test('only server code calls it, with the admin client', () => {
  const callers: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (src.includes(`'${MIRROR_FN}'`)) callers.push(relative(WEB, file));
  }
  assert.deepEqual(callers, ['lib/bench-bookable-days.server.ts']);
  const server = tsSource('lib/bench-bookable-days.server.ts');
  assert.match(server, new RegExp(`args\\.admin\\.rpc\\(\\s*'${MIRROR_FN}'`));
  assert.doesNotMatch(server, /session/, 'the refusals are never read through, or returned to, the browser session');
});

// ── 3 · THE POOLS ─────────────────────────────────────────────────────────

const tsSource = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function functionBody(src: string, header: RegExp): string {
  const start = src.search(header);
  assert.ok(start >= 0, `not found: ${header}`);
  const next = src.slice(start + 1).search(/\nexport (async )?function /);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

test('the pool resolver still reads exactly what the mirror reads', () => {
  const body = functionBody(tsSource('lib/schedule-pools.ts'), /export async function resolvePoolIdsForService\(/);
  const tables = new Set([...body.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)].map((m) => m[1]));
  const rpcs = new Set([...body.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]));
  assert.deepEqual(
    [...tables].sort(),
    ['vendor_schedule_calendar_services', 'vendor_service_links', 'vendor_services'],
    'resolvePoolIdsForService reads a new source — service_cards_unbookable_on must read it too',
  );
  assert.deepEqual([...rpcs], ['resolve_schedule_pool']);
  assert.match(body, /namedCalendarsEnabled\(\)/, 'the lock reads the named-calendars switch through the one helper');
  // resolve_schedule_pool finds an existing pool through the category map.
  assert.match(resolver.body, /FROM public\.vendor_schedule_pool_categories WHERE vendor_profile_id = p_vendor_profile_id AND category_key = p_category_key/);
  for (const t of ['vendor_schedule_calendar_services', 'vendor_service_links', 'vendor_schedule_pool_categories']) {
    assert.match(mirror.body, new RegExp(`public\\.${t}\\b`), `the mirror no longer reads ${t}`);
  }
  // The search passes the same switch.
  assert.match(tsSource('lib/bench-bookable-days.server.ts'), /p_named_calendars:\s*namedCalendarsEnabled\(\)/);
});

// ── 5 · THE CALLERS ──────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Each `searchCategoryVendors({...})` call's argument text. */
function callArgs(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\bsearchCategoryVendors\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

test('only the bench asks to hide — every other caller is unchanged', () => {
  const seen: Record<string, string[]> = {};
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const calls = callArgs(src).filter((a) => !a.includes('input: {'));
    if (calls.length === 0) continue;
    seen[relative(WEB, file)] = calls.map((a) =>
      /\bhideUnbookable:\s*true\b/.test(a) ? 'hides' : /\bhideUnbookable\b/.test(a) ? 'OTHER' : 'unchanged',
    );
  }
  assert.deepEqual(seen, {
    'app/dashboard/[eventId]/progress/_actions/free-venue-shortlist.ts': ['unchanged'],
    'app/dashboard/[eventId]/vendors/_actions/inline-more-row.ts': ['hides'],
    'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts': ['unchanged'],
    'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx': ['hides', 'hides'],
    'app/dashboard/[eventId]/vendors/build-3state-fallback-actions.ts': ['unchanged'],
  });
});

test('the search hides only when asked, and only strangers', () => {
  const src = tsSource('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  assert.match(src, /input\.hideUnbookable === true\s*\?\s*await findSuppliersWithNoBookingLeft\(/);
  assert.match(src, /ordered = ordered\.filter\(\(s\) => !leavesBenchSearch\(s, noBookingLeft\)\)/);
  assert.equal([...src.matchAll(/findSuppliersWithNoBookingLeft\(/g)].length, 1);
});
