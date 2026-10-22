/**
 * ics-text.test.ts — a supplier's `.ics` download parses in Apple and Google Calendar (coordinator walk 2026-10-23).
 *
 *   ⓵ TEXT is escaped: `;` `,` `\` and every line break. The shop-wide file wrote `'\;'` (= `;`), so "Ana; Ben"
 *      ended its SUMMARY at the semicolon.
 *   ⓶ No physical line passes 75 octets, a fold never splits a character, and unfolding gives the line back.
 *   ⓷ The file ends with CRLF and has no bare LF or CR anywhere.
 *   ⓸ Every `text/calendar` route a supplier downloads goes through `icsDocument` — none hand-rolls its own escape
 *      or join again (that is how the two drifted).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { foldIcsLine, icsDocument, icsEscape } from '@/lib/ics-text';

const WEB = join(__dirname, '..');
const utf8 = new TextEncoder();

test('⓵ TEXT values escape ; , \\ and every line break', () => {
  assert.equal(icsEscape('Ana; Ben'), 'Ana\\; Ben');
  assert.equal(icsEscape('Hall A, Hall B'), 'Hall A\\, Hall B');
  assert.equal(icsEscape('C:\\path'), 'C:\\\\path');
  assert.equal(icsEscape('one\r\ntwo\rthree\nfour'), 'one\\ntwo\\nthree\\nfour');
  // an escaped value can never end a property early
  assert.doesNotMatch(icsEscape('a;b,c'), /(^|[^\\]);/);
});

test('⓶ folded lines stay within 75 octets, keep every character whole, and unfold to the original', () => {
  // Long enough for several continuation lines — each of which carries its own leading space within the 75.
  const long = `SUMMARY:${icsEscape('Kasal nina Señorita María Concepción Dela Cruz-Santos at Ginoong Juan Ñiño · booked on Setnayan · '.repeat(4))}`;
  const folded = foldIcsLine(long);
  for (const physical of folded.split('\r\n')) assert.ok(utf8.encode(physical).length <= 75, `"${physical}" passes 75 octets`);
  assert.ok(folded.split('\r\n').slice(1).every((l) => l.startsWith(' ')), 'a continuation line does not start with a space');
  assert.equal(folded.replace(/\r\n /g, ''), long, 'unfolding does not give the line back');
  assert.ok(!folded.includes('\uFFFD'));
  assert.equal(foldIcsLine('DTSTART;VALUE=DATE:20261218'), 'DTSTART;VALUE=DATE:20261218', 'a short line is folded');
});

test('⓷ the file ends with CRLF and holds no bare LF or CR', () => {
  const doc = icsDocument(['BEGIN:VCALENDAR', `SUMMARY:${icsEscape('a\nb')}`, 'END:VCALENDAR']);
  assert.ok(doc.endsWith('END:VCALENDAR\r\n'), 'the last line is not terminated');
  assert.doesNotMatch(doc, /[^\r]\n/, 'a bare LF');
  assert.doesNotMatch(doc, /\r(?!\n)/, 'a bare CR');
});

test('⓸ every supplier .ics route builds through icsDocument, with no escape or join of its own', () => {
  const routes = ['app/vendor-dashboard/customers/calendar.ics/route.ts', 'app/vendor-dashboard/clients/[eventId]/calendar.ics/route.ts'];
  for (const rel of routes) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.match(src, /text\/calendar/, `${rel} no longer serves a calendar — re-point this guard`);
    assert.match(src, /import\s*\{[^}]*\bicsDocument\b[^}]*\}\s*from\s*'@\/lib\/ics-text'/, `${rel} does not import icsDocument`);
    assert.match(src, /new NextResponse\(icsDocument\(lines\)/, `${rel} builds its body some other way`);
    assert.doesNotMatch(src, /function\s+icsEscape/, `${rel} hand-rolls its own escape again`);
    assert.doesNotMatch(src, /lines\.join\(/, `${rel} joins its own lines again`);
  }
});

test('⓹ a read that did not finish is said (503), never a file that imports "fine" with bookings missing', () => {
  const shop = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/customers/calendar.ics/route.ts'), 'utf8'));
  assert.match(shop, /if\s*\(!blocksRead\.complete\)\s*\{\s*return new NextResponse\([^)]*status:\s*503/s);
  const one = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/clients/[eventId]/calendar.ics/route.ts'), 'utf8'));
  assert.match(one, /const\s*\{\s*data,\s*error\s*\}\s*=\s*await supabase\s*\.from\('event_schedule_blocks'\)/);
  assert.match(one, /if\s*\(error\)\s*\{\s*return new NextResponse\([^)]*status:\s*503/s);
});
