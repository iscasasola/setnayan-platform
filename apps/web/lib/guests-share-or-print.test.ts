/**
 * 📤 GUESTS › SHARE OR PRINT (R4 slice 8; owner 2026-10-29, prototype `printsFor` / `shareSheet`; DECISION_LOG "GUESTS TOP
 * ROW …": "📤 … waits for the per-view 'Share or print' sheet (slice 8)"; built on #7032's engine, `lib/share-pdf.ts`).
 *
 * The PROPERTIES:
 *   1. Each view lists ITS files, in the prototype's order — List: Guest list · Check-in sheet · Meal count; Map: Guest
 *      list; Seats: Seat plan · Table list · Entrance seating chart · Table signs & place cards; March: the march order.
 *   2. LINKED, NOT REDRAWN: the four prints that already ship point at their own routes (the ones `lib/free-prints.ts`
 *      names); only Guest list · Check-in · Table list · March go to the new `guests/share` route — with Paper ▾.
 *   3. The Guest list carries the view's ⇅ (Show · Group by) and says it in its line and in the file.
 *   4. The documents draw — real PDFs whose words are the guests' printed names (full name + “nickname”), counts with
 *      commas; nothing is cut; an empty list says so in words.
 *   5. The route's doors come before any name: signed in · not a delegate without the guest list · the march is the
 *      couple's · every refused read is a 503 in words, never a file of nobody.
 *   6. 🔒 THE SEAT PLAN IS ITS OWN AREA: a helper whose grant lacks `seat_plan` is REFUSED the Table list, and every other
 *      file is drawn for them with NO Table column — the route does not even read the tables. A helper past the 7-day
 *      window is nobody (404), whatever their grant said.
 *   (The 📤 round that opens the sheet is placed in the top row by whoever owns that row — not here.)
 *
 * SABOTAGE (each seen RED, then restored): the Meal count pointed at `guests/share` · the guest-list href without the
 * filter · `!read.measured` check removed · the event read's error check removed · the door's `table-list` refusal
 * removed · the guest list's TABLE column kept when `tables` is false · the route's `fetchTables` un-gated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { guestsShareItems } from '@/lib/guests-share-sheet';
import { checkInPdf, guestListPdf, guestsShareDoor, marchPdf, tableListPdf, GUESTS_SHARE_DOCS } from '@/lib/guests-share-pdf';
import { permissionsWithinWindow } from '@/lib/delegate-access-window';
import type { ModeratorPermissions } from '@/lib/delegate-areas';
import { sharePdf } from '@/lib/share-pdf';
import { NO_GUESTS_FILTER } from '@/lib/guests-filter';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const CTX = { eventId: 'E1', slug: 'cale-ice', filter: NO_GUESTS_FILTER, showLabel: 'Everyone', groupLabel: 'Role' };
const HEAD = { eventName: 'Cale & Ice', meta: ['Saturday, December 12, 2026', 'Manila Hotel'], generatedAt: new Date('2026-10-30T00:00:00Z') };

async function pdfWords(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents && 'asArray' in contents ? (contents as unknown as { asArray(): unknown[] }).asArray() : [contents];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.contents);
      const text = (stream.dict.get(PDFName.of('Filter')) ? inflateSync(raw) : raw).toString('latin1');
      for (const m of text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(m[1]!, 'hex').toString('latin1').replace(/\x93/g, '“').replace(/\x94/g, '”'));
    }
  }
  return out.join(' ');
}

test('1 · each view lists its own files, in the prototype’s order', () => {
  const keys = (v: Parameters<typeof guestsShareItems>[0]) => guestsShareItems(v, CTX).map((i) => i.key);
  assert.deepEqual(keys('list'), ['guest-list', 'check-in', 'meal-count']);
  assert.deepEqual(keys('map'), ['guest-list']);
  assert.deepEqual(keys('seats'), ['seat-plan', 'table-list', 'entrance-chart', 'signs-cards']);
  assert.deepEqual(keys('march'), ['march']);
});

test('2 · the prints that ship are linked, not redrawn; only the new four take Paper ▾', () => {
  const all = (['list', 'map', 'seats', 'march'] as const).flatMap((v) => guestsShareItems(v, CTX));
  const by = (k: string) => all.find((i) => i.key === k)!;
  assert.equal(by('meal-count').href, '/dashboard/E1/seating/caterer?format=pdf');
  assert.equal(by('seat-plan').href, '/dashboard/E1/seating/export?mode=moodboard');
  assert.equal(by('entrance-chart').href, '/dashboard/E1/seating/print?chart=table&format=pdf');
  assert.equal(by('signs-cards').href, '/dashboard/E1/seating/print?format=pdf');
  for (const k of ['meal-count', 'seat-plan', 'entrance-chart', 'signs-cards']) assert.equal(by(k).papers, undefined, `${k} offers a paper its route ignores`);
  for (const k of ['guest-list', 'check-in', 'table-list', 'march']) {
    assert.match(by(k).href, /^\/dashboard\/E1\/guests\/share\?/, `${k} is not drawn by guests/share`);
    assert.equal(by(k).papers, 'document');
  }
  // The routes are the ones free-prints names (one source of what ships).
  const free = src('lib/free-prints.ts');
  for (const r of ['/seating/caterer?format=pdf', '/seating/export?mode=moodboard', '/seating/print?chart=table&format=pdf', '/seating/print?format=pdf']) assert.ok(free.includes(r), `${r} is not a shipped print`);
  assert.equal(by('march').fileName, 'cale-ice-wedding-march.pdf');
});

test('3 · the Guest list carries the view’s ⇅ and says it', () => {
  const [gl] = guestsShareItems('list', { ...CTX, filter: { show: 'attending', group: 'side', sort: 'importance' }, showLabel: 'Attending', groupLabel: 'Side' });
  assert.equal(gl!.href, '/dashboard/E1/guests/share?gshow=attending&ggroup=side&from=list&doc=guest-list');
  assert.match(gl!.line, /attending · grouped by side/);
  assert.match(guestsShareItems('map', CTX)[0]!.href, /from=map/);
});

test('4 · the documents draw: names whole with their nickname, counts with commas, empties in words', async () => {
  const many = Array.from({ length: 1200 }, (_, i) => ({ name: `Guest ${i}`, reply: 'Attending', table: 'Table 1' }));
  const list = await pdfWords(
    await sharePdf(
      guestListPdf(HEAD, {
        showLabel: 'Everyone',
        groupLabel: 'Role',
        sections: [
          { label: 'Principal Sponsors', guests: [{ name: 'Atty. Ramon Francisco Dela Cruz-Villanueva “Monching”', reply: 'Attending', table: 'Table 2' }] },
          { label: 'Guests', guests: many },
        ],
        tables: true,
      }),
    ),
  );
  assert.match(list, /Monching/);
  assert.match(list, /1,201/, 'the count has no comma');
  assert.match(list, /GUEST LIST/);
  const none = await pdfWords(await sharePdf(guestListPdf(HEAD, { showLabel: 'Attending', groupLabel: 'Role', sections: [], tables: true })));
  assert.match(none, /Nobody matches what this list was showing\./);
  const check = await pdfWords(await sharePdf(checkInPdf(HEAD, [{ name: 'Ana Reyes', table: null }], 3, true)));
  assert.match(check, /Ana Reyes/);
  assert.match(check, /Not seated yet/);
  const tables = await pdfWords(await sharePdf(tableListPdf(HEAD, [{ label: 'Table 1', capacity: 10, guests: [{ name: 'Ben Cruz' }] }], [{ name: 'Lola Nena' }])));
  assert.match(tables, /1 of 10/);
  assert.match(tables, /No seat yet/);
  const march = await pdfWords(await sharePdf(marchPdf(HEAD, { sections: [{ label: 'Principal Sponsors', walks: [['Tito Ben', 'Tita Cora'], ['Lola Nena']] }], notWalking: ['Kuya Jun'], drafted: true })));
  assert.match(march, /Tito Ben & Tita Cora/);
  assert.match(march, /walks alone/);
  assert.match(march, /not yet Applied/);
});

test('5 · the route’s doors come before any name, and a refused read is never a file', () => {
  const r = src('app/dashboard/[eventId]/guests/share/route.ts');
  const at = (s: string) => {
    const i = r.indexOf(s);
    assert.ok(i >= 0, `the route lost: ${s}`);
    return i;
  };
  const firstRead = Math.min(at('fetchGuestsByEventMeasured(supabase, eventId)'), at('readShownMarch(supabase, eventId)'));
  assert.ok(at("if (!user) return say(401") < firstRead);
  // Every door (not on the event · no guest list · the march · no seat plan) is ONE pure answer, tested in 6.
  assert.ok(at('guestsShareDoor(await fetchEventViewer(supabase, eventId, user.id), doc)') < firstRead, 'a door opens after names are read');
  assert.ok(at('if (!door.ok) return say(door.status, door.words);') < firstRead, 'a refused door still reads names');
  at("if (eventError) {");
  at('if (!read.measured) return say(503, UNREAD);');
  at('if (shown.marchUnread || shown.draftUnread || shown.out === null) return say(503,');
  at("if (group === 'group' && (!groupsRead.measured || !membersRead.measured)) return say(503, UNREAD);");
  at("'Content-Disposition': `attachment; filename=\"${built.name}\"`");
});

test('6 · the seat plan is its own area: no seat_plan → no Table list, and no Table column anywhere', async () => {
  const COUPLE = { isCouple: true, delegatePermissions: null };
  const grant = (areas: ModeratorPermissions['areas']): ModeratorPermissions => ({ edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false, areas });
  const helper = (areas: ModeratorPermissions['areas']) => ({ isCouple: false, delegatePermissions: grant(areas) });
  const guestsOnly = helper({ guest_list: 'edit' });
  const seatsOff = helper({ guest_list: 'view', seat_plan: null });
  const both = helper({ guest_list: 'view', seat_plan: 'view' });

  // The couple and a helper granted the seat plan (View is enough) keep everything but the couple-only march.
  for (const doc of GUESTS_SHARE_DOCS) assert.deepEqual(guestsShareDoor(COUPLE, doc), { ok: true, tables: true }, `couple · ${doc}`);
  assert.deepEqual(guestsShareDoor(both, 'table-list'), { ok: true, tables: true });
  assert.deepEqual(guestsShareDoor(both, 'check-in'), { ok: true, tables: true });

  // Without seat_plan — absent from the map, or set Off — the Table list is refused in words, before any read…
  for (const v of [guestsOnly, seatsOff]) {
    const door = guestsShareDoor(v, 'table-list');
    assert.equal(door.ok, false, 'a helper without the seat plan was handed the Table list');
    assert.ok(!door.ok && door.status === 403 && /seat plan isn't shared/.test(door.words));
    // …and the guest list and check-in sheet open WITHOUT tables.
    assert.deepEqual(guestsShareDoor(v, 'guest-list'), { ok: true, tables: false });
    assert.deepEqual(guestsShareDoor(v, 'check-in'), { ok: true, tables: false });
  }
  // The earlier doors still hold: no guest list → refused; the march stays the couple's; a stranger is not told it exists.
  assert.equal(guestsShareDoor(helper({ seat_plan: 'edit' }), 'table-list').ok, false);
  assert.equal(guestsShareDoor(both, 'march').ok, false);
  assert.deepEqual(guestsShareDoor({ isCouple: false, delegatePermissions: null }, 'table-list'), { ok: false, status: 404, words: 'Event not found.' });

  // THE 7-DAY WINDOW is the same source fetchEventViewer uses: past it, a full grant resolves to nobody.
  const window = (now: string) =>
    permissionsWithinWindow(grant({ guest_list: 'edit', seat_plan: 'edit' }), { isCouple: false, eventDate: '2026-12-12', eventEndDate: null, precision: 'day', now: new Date(now) });
  assert.deepEqual(guestsShareDoor({ isCouple: false, delegatePermissions: window('2026-12-15T04:00:00Z') }, 'table-list'), { ok: true, tables: true });
  assert.equal(guestsShareDoor({ isCouple: false, delegatePermissions: window('2027-01-15T04:00:00Z') }, 'table-list').ok, false, 'an expired helper kept the seat plan');

  // The route reads the tables ONLY through the door's answer, and hands it to both table-bearing files.
  const r = src('app/dashboard/[eventId]/guests/share/route.ts');
  assert.ok(r.includes('door.tables ? fetchTables(supabase, eventId) : Promise.resolve([])'), 'the route reads the tables for a helper without the seat plan');
  assert.ok(r.includes('door.tables ? fetchAssignments(supabase, eventId) : Promise.resolve([])'), 'the route reads the seats for a helper without the seat plan');
  assert.equal((r.match(/fetchTables\(/g) ?? []).length, 1, 'a second, ungated tables read');
  assert.ok(r.includes('pending, door.tables))'), 'the check-in sheet ignores the door');
  assert.ok(r.includes('tables: door.tables,'), 'the guest list ignores the door');

  // The drawn files: no TABLE header, no table name, no "Not seated yet".
  const list = await pdfWords(await sharePdf(guestListPdf(HEAD, { showLabel: 'Everyone', groupLabel: 'Role', sections: [{ label: 'Guests', guests: [{ name: 'Ana Reyes', reply: 'Attending', table: 'Table 7' }] }], tables: false })));
  assert.match(list, /Ana Reyes/);
  assert.match(list, /Attending/);
  assert.doesNotMatch(list, /TABLE|Table 7/, 'the guest list drew a Table column for a helper without the seat plan');
  const check = await pdfWords(await sharePdf(checkInPdf(HEAD, [{ name: 'Ana Reyes', table: 'Table 7' }], 0, false)));
  assert.match(check, /Ana Reyes/);
  assert.match(check, /HERE/);
  assert.doesNotMatch(check, /TABLE|Table 7|Not seated yet/, 'the check-in sheet drew a Table column for a helper without the seat plan');
  // With the seat plan, the column is there (so the negative above is not vacuous).
  const withTables = await pdfWords(await sharePdf(checkInPdf(HEAD, [{ name: 'Ana Reyes', table: 'Table 7' }], 0, true)));
  assert.match(withTables, /TABLE/);
  assert.match(withTables, /Table 7/);
});
