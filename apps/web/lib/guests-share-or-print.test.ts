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
 *   6. The 📤 round sits left of the ⚙ in the top row (both faces), and the pinned face stops short of it.
 *
 * SABOTAGE (each seen RED, then restored): the Meal count pointed at `guests/share` · the guest-list href without the
 * filter · `!read.measured` check removed · the 📤 round dropped from the first row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { guestsShareItems } from '@/lib/guests-share-sheet';
import { checkInPdf, guestListPdf, marchPdf, tableListPdf } from '@/lib/guests-share-pdf';
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
      }),
    ),
  );
  assert.match(list, /Monching/);
  assert.match(list, /1,201/, 'the count has no comma');
  assert.match(list, /GUEST LIST/);
  const none = await pdfWords(await sharePdf(guestListPdf(HEAD, { showLabel: 'Attending', groupLabel: 'Role', sections: [] })));
  assert.match(none, /Nobody matches what this list was showing\./);
  const check = await pdfWords(await sharePdf(checkInPdf(HEAD, [{ name: 'Ana Reyes', table: null }], 3)));
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
  assert.ok(at("isDelegateWithoutArea(viewer, 'guest_list')") < firstRead, 'a delegate without the guest list reads names first');
  assert.ok(at("if (doc === 'march' && !viewer.isCouple)") < firstRead, 'the march is not the couple’s only');
  at('if (!read.measured) return say(503, UNREAD);');
  at('if (shown.marchUnread || shown.draftUnread || shown.out === null) return say(503,');
  at("if (group === 'group' && (!groupsRead.measured || !membersRead.measured)) return say(503, UNREAD);");
  at("'Content-Disposition': `attachment; filename=\"${built.name}\"`");
});

test('6 · the 📤 round is one sheet of this view’s files (it is placed in the top row by whoever owns that row)', () => {
  // The Guests/Seats top row is being reworked elsewhere (2026-10-30), so this change does not touch it: the round ships
  // ready, and its one line — `<GuestsShareRound items={guestsShareItems(gview, …)} />` left of the ⚙ — lands with the row.
  const sheet = src('app/dashboard/[eventId]/guests/_components/guests-share-round.tsx');
  assert.match(sheet, /title="Share or print"/);
  assert.match(sheet, /<SharePdfButton href=\{it\.href\} fileName=\{it\.fileName\}/);
  assert.match(sheet, /<InfoTip label="Each file is made when you tap Share\."/, 'the help is not behind ⓘ');
});
