/**
 * 🧍‍♀️➡️🧍 A ROLE HOLDER CAN SEND A PROXY — the SQL half (owner, 2026-10-27; migration
 * 20271292712479_a_role_holder_can_send_a_proxy). Against the replayed migrations, with the cale-ice pair as the
 * fixture (Mrs. Ma. Theresa Sacdalan-Tria, a principal sponsor, is proxied by Maria Catherine Sacdalan):
 *
 *   · the link holds only for a ROLE holder ("this only works if they have role and not guest"), never self, never a
 *     chain, never two holders on one proxy, never across events;
 *   · the SEAT moves with the link, both ways — set → the proxy sits in the role's seat; cleared → it comes back;
 *     a proxy taken off the list gives the seat back too;
 *   · a decline that NAMES a proxy keeps the seat (every other decline still frees it);
 *   · the pair counts ONCE: the Papic divisor leaves the represented holder out and counts the proxy, and every guest
 *     read in the caterer / brief / seat-plan / pool functions carries the rule, as the database holds them.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let otherEventId = '';
let tableId = '';
const id: Record<string, string> = {};

const addGuest = async (key: string, first: string, last: string, role = 'guest', ev = eventId, rsvp = 'attending') => {
  id[key] = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status)
       VALUES ($1, $2, $3, 'bride', 'family', $4::public.guest_role, $5) RETURNING guest_id`,
      [ev, first, last, role, rsvp],
    )
  ).rows[0]!.guest_id;
  return id[key]!;
};
const seatOf = async (guestId: string) =>
  (
    await db.query<{ table_id: string; seat_number: number | null }>(
      `SELECT table_id, seat_number FROM public.event_seat_assignments WHERE event_id = $1 AND guest_id = $2`,
      [eventId, guestId],
    )
  ).rows[0] ?? null;
const link = (holder: string, proxy: string | null) =>
  db.query(`UPDATE public.guests SET represented_by_guest_id = $2 WHERE guest_id = $1`, [holder, proxy]);
const refused = async (sql: Promise<unknown>, words: RegExp) => {
  await assert.rejects(sql, (e: Error) => words.test(e.message));
};
const headcount = async () =>
  (await db.query<{ n: number }>(`SELECT public.papic_event_guest_headcount($1) AS n`, [eventId])).rows[0]!.n;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Cale & Ice', 'birthday', '2027-02-14') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  otherEventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Elsewhere', 'birthday', '2027-03-01') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  tableId = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity) VALUES ($1, 'Sponsors', 'round_8', 8) RETURNING table_id`,
      [eventId],
    )
  ).rows[0]!.table_id;
  await addGuest('theresa', 'Ma. Theresa', 'Sacdalan-Tria', 'principal_sponsor_ninang');
  await addGuest('catherine', 'Maria Catherine', 'Sacdalan');
  await addGuest('plain', 'Ben', 'Cruz');
  await addGuest('ninong', 'Ramon', 'Tria', 'principal_sponsor_ninong');
  await addGuest('elsewhere', 'Ana', 'Reyes', 'guest', otherEventId);
  await db.query(
    `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES ($1, $2, $3, 1), ($1, $2, $4, 2)`,
    [eventId, tableId, id.theresa, id.catherine],
  );
});
after(async () => {
  await db?.close();
});

test('the columns exist, nullable, and nobody is linked by the migration', async () => {
  const cols = (
    await db.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'guests'
          AND column_name IN ('represented_by_guest_id', 'represented_since', 'proxy_named_by_guest')`,
    )
  ).rows;
  assert.equal(cols.length, 3, 'a proxy column is missing');
  for (const c of cols) assert.equal(c.is_nullable, 'YES', `${c.column_name} must be nullable — "not said" is NULL`);
  const linked = (
    await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guests WHERE represented_by_guest_id IS NOT NULL`)
  ).rows[0]!.n;
  assert.equal(linked, 0);
});

test('only a ROLE holder can send a proxy — never a plain guest, never the couple', async () => {
  await refused(link(id.plain!, id.catherine!), /Only a guest with a role/);
  const bride = await addGuest('bride', 'Ice', 'Casasola', 'bride');
  await refused(link(bride, id.catherine!), /Only a guest with a role/);
  // A typed name on the reply is held to the same rule.
  await refused(
    db.query(`UPDATE public.guests SET proxy_named_by_guest = 'Someone' WHERE guest_id = $1`, [id.plain]),
    /Only a guest with a role/,
  );
});

test('never self, never another event, never the couple standing in', async () => {
  await refused(link(id.theresa!, id.theresa!), /themselves/);
  await refused(link(id.theresa!, id.elsewhere!), /guest of this event/);
  await refused(link(id.theresa!, id.bride!), /couple/);
});

test('linking moves the SEAT to the proxy — the proxy’s own seat is released, the holder is unseated', async () => {
  const roleSeat = await seatOf(id.theresa!);
  assert.equal(roleSeat?.seat_number, 1);
  await link(id.theresa!, id.catherine!);
  const proxySeat = await seatOf(id.catherine!);
  assert.equal(proxySeat?.table_id, tableId);
  assert.equal(proxySeat?.seat_number, 1, 'the proxy did not take the role holder’s seat');
  assert.equal(await seatOf(id.theresa!), null, 'the role holder still holds a seat — the pair would be seated twice');
  const since = (
    await db.query<{ s: string | null }>(`SELECT represented_since AS s FROM public.guests WHERE guest_id = $1`, [id.theresa])
  ).rows[0]!.s;
  assert.ok(since, 'represented_since was not stamped');
});

test('one proxy per holder, one holder per proxy, and no chains', async () => {
  await refused(link(id.ninong!, id.catherine!), /duplicate key|unique/i);
  // The proxy cannot themselves be represented…
  await db.query(`UPDATE public.guests SET role = 'principal_sponsor_ninang' WHERE guest_id = $1`, [id.catherine]);
  await refused(link(id.catherine!, id.plain!), /already stands in/);
  await db.query(`UPDATE public.guests SET role = 'guest' WHERE guest_id = $1`, [id.catherine]);
  // …and a represented holder cannot stand in for anyone.
  await refused(link(id.ninong!, id.theresa!), /sending someone in their own place/);
});

test('the pair counts ONCE — the represented holder is out of the Papic divisor, the proxy is in', async () => {
  // theresa (represented) · catherine · plain · ninong · bride → 4 counted, not 5.
  assert.equal(await headcount(), 4);
});

test('removing the proxy gives the seat back to the role holder and they count again', async () => {
  await link(id.theresa!, null);
  assert.equal((await seatOf(id.theresa!))?.seat_number, 1, 'the seat did not come back to the role holder');
  assert.equal(await seatOf(id.catherine!), null);
  assert.equal(await headcount(), 5);
  const since = (
    await db.query<{ s: string | null }>(`SELECT represented_since AS s FROM public.guests WHERE guest_id = $1`, [id.theresa])
  ).rows[0]!.s;
  assert.equal(since, null);
});

test('a proxy taken off the list ends the link and the seat comes back', async () => {
  await link(id.theresa!, id.catherine!);
  assert.equal((await seatOf(id.catherine!))?.seat_number, 1);
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [id.catherine]);
  const holder = (
    await db.query<{ r: string | null }>(`SELECT represented_by_guest_id AS r FROM public.guests WHERE guest_id = $1`, [id.theresa])
  ).rows[0]!.r;
  assert.equal(holder, null, 'a removed proxy still represents the role holder');
  assert.equal((await seatOf(id.theresa!))?.seat_number, 1);
  await db.query(`UPDATE public.guests SET deleted_at = NULL WHERE guest_id = $1`, [id.catherine]);
});

test('a decline that NAMES a proxy keeps the seat; a plain decline still frees it', async () => {
  await db.query(
    `UPDATE public.guests SET rsvp_status = 'declined', proxy_named_by_guest = 'Maria Catherine Sacdalan' WHERE guest_id = $1`,
    [id.theresa],
  );
  assert.equal((await seatOf(id.theresa!))?.seat_number, 1, 'the seat was freed although a proxy was named to take it');
  // The host links the named person: the typed name has done its work, and the seat moves to them.
  await link(id.theresa!, id.catherine!);
  const named = (
    await db.query<{ n: string | null }>(`SELECT proxy_named_by_guest AS n FROM public.guests WHERE guest_id = $1`, [id.theresa])
  ).rows[0]!.n;
  assert.equal(named, null);
  assert.equal((await seatOf(id.catherine!))?.seat_number, 1);
  // The control: an ordinary decline frees its seat, exactly as before.
  await db.query(
    `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES ($1, $2, $3, 5)`,
    [eventId, tableId, id.plain],
  );
  await db.query(`UPDATE public.guests SET rsvp_status = 'declined' WHERE guest_id = $1`, [id.plain]);
  assert.equal(await seatOf(id.plain!), null, 'an ordinary decline no longer frees the seat');
});

test('every guest read in the caterer / brief / seat-plan / pool functions leaves a represented holder out, as the DB holds them', async () => {
  for (const fn of ['get_vendor_catering_metrics', 'get_vendor_event_brief', 'get_vendor_seat_plan', 'papic_event_guest_headcount']) {
    const def = (
      await db.query<{ d: string }>(
        `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn],
      )
    ).rows[0]?.d;
    assert.ok(def, `${fn} is missing`);
    const reads = (def.match(/public\.guests\b/g) ?? []).length;
    const ruled = (
      def.match(/\b(g2?)\.entry_source <> 'self_added_unlisted' AND NOT \1\.passed_away AND \1\.represented_by_guest_id IS NULL\b/g) ?? []
    ).length;
    assert.ok(reads > 0, `${fn} reads no guests — re-point this test`);
    assert.equal(ruled, reads, `${fn}: ${ruled} of ${reads} guest reads leave a represented role holder out`);
  }
});

test('a couple member may write the link (RLS: the table’s own policies — no new door)', async () => {
  const pols = (
    await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guests' AND cmd IN ('UPDATE', 'ALL')`,
    )
  ).rows[0]!.n;
  assert.ok(pols > 0, 'guests has no write policy at all');
  const rls = (
    await db.query<{ r: boolean }>(`SELECT relrowsecurity AS r FROM pg_class WHERE oid = 'public.guests'::regclass`)
  ).rows[0]!.r;
  assert.equal(rls, true);
});
