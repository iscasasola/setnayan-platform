/**
 * Final check, area 1, batch a1-a7-tour: the tour and the sample event. One claim per finding; every source check
 * strips comments first, so a docblock that names the old shape cannot satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { readSampleGuest } from './sample-event/snapshot';
import { SAMPLE_WORDS } from './sample-event/hub';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function tourFiles(dir = join(WEB, 'app/tour'), out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) tourFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

test('A1-010 · A1-009 · A1-011 · the tour calls itself a sample, claims no speed or count, and names only what ranks', () => {
  const files = tourFiles();
  assert.ok(files.length >= 8, 'the tour scan found its pages');
  for (const f of files) {
    const s = stripComments(readFileSync(f, 'utf8'));
    const rel = f.slice(WEB.length + 1);
    assert.doesNotMatch(s, /a real wedding/i, `${rel}: the sample is called "a real wedding"`);
    assert.doesNotMatch(s, /in minutes|the instant|the moment they|instantly|hundreds of/i, `${rel}: a speed or count claim`);
    assert.doesNotMatch(s, /(ranked by|based on) distance/i, `${rel}: claims distance, which the tour never uses`);
  }
  assert.match(src('app/tour/vendors/page.tsx'), /distanceKm: null/, 'the tour still passes no distance');
});

test('A1-002 · the tour budget headline is the one money reader', () => {
  const s = src('app/tour/budget/page.tsx');
  assert.match(s, /resolveEventMoney\(admin, id\)/);
  assert.match(s, /value=\{moneyRead \? formatPhp\(money\.committed\) : 'Couldn’t read'\}/);
  assert.match(s, /value=\{moneyRead \? formatPhp\(money\.paid\) : 'Couldn’t read'\}/);
  assert.match(s, /value=\{moneyRead \? formatPhp\(money\.stillOwed\) : 'Couldn’t read'\}/);
  assert.doesNotMatch(s, /totals\.(budget|paid|remaining|upcomingDue)/, 'no headline figure from the second reader');
  assert.match(s, /TRIGGER_THRESHOLDS\.paymentHorizonDays/, 'the "due in N days" window is read, not typed');
});

test('A1-013 · no typical range is made up on the tour', () => {
  const page = src('app/tour/budget/page.tsx');
  assert.doesNotMatch(page, /0\.85|1\.15|p25Php|p75Php/);
  assert.doesNotMatch(src('app/tour/budget/_components/tour-budget-planner.tsx'), /typical\s+range/);
});

test('A1-014 · "Bring Memory lane to life" adds photos that are not yet on the wall', () => {
  const s = src('app/tour/gallery/page.tsx');
  assert.doesNotMatch(s, /tour-incoming-|initialTiles\.slice\(0, 4\)/, 'no cloned tiles');
  assert.match(s, /const initialTiles = allTiles\.slice\(0, allTiles\.length - holdBack\);/);
  assert.match(s, /const incomingTiles = allTiles\.slice\(allTiles\.length - holdBack\);/);
  assert.match(s, /const initialCount = Math\.max\(0, snap\.count - incomingTiles\.length\);/, 'the counter ends on the real total');
});

test('A1-006 · Find your seat greets the guest who was picked', () => {
  const s = src('app/tour/seating/_components/find-your-seat.tsx');
  assert.match(s, /const \[picked, setPicked\] = useState<TourSeat \| null>\(null\);/);
  assert.match(s, /const selected = picked;/);
  assert.doesNotMatch(s, /seats\.find\(\(s\) => s\.tableId === targetTableId\)/, 'not the first seat at the table');
});

test('A1-007 · a failed read on the tour is said, never an empty or zero sample', () => {
  const vendors = src('app/tour/vendors/page.tsx');
  assert.match(vendors, /onReadRefused: \(\) => \{\s*shortlistRefused = true;/);
  assert.match(vendors, /\{shortlistRefused \? \([\s\S]*?Couldn&rsquo;t load the sample suppliers/);
  assert.doesNotMatch(vendors, /'Liwanag Studios'/, 'no typed shop name');
  const gallery = src('app/tour/gallery/page.tsx');
  assert.match(gallery, /\{feedFailed \? \([\s\S]*?Couldn&rsquo;t load the photos/);
  assert.match(gallery, /const feedFailed = snap\.unreadable === true;/);
  assert.match(src('lib/live-wall.ts'), /unreadable: Boolean\(feedError \|\| eventError\),/);
  const seating = src('app/tour/seating/page.tsx');
  assert.match(seating, /tableCount > 0 && !guestsUnreadable \?/, 'a refused guest read never prints "for 0 guests"');
});

test('A1-012 · the tour chat date and couple come from the sample event', () => {
  const chat = src('app/tour/_components/tour-chat-thread.tsx');
  assert.doesNotMatch(chat, /December 12, 2026|Maria & Jose/);
  assert.match(chat, /function scriptFor\(couple: string, dateWords: string \| null\)/);
  assert.match(src('app/tour/vendors/page.tsx'), /dateWords=\{ev\.event_date \? formatLongDate\(ev\.event_date\) : null\}/);
});

test('A1-015 · A1-016 · the sample guest Hub speaks to a guest and copies a whole link', () => {
  const hub = src('app/sample/hub/[guestKey]/page.tsx');
  assert.doesNotMatch(hub, /Opens on your wedding day/);
  assert.match(hub, /Opens on the \{SAMPLE_WORDS\.eventWord\} day/);
  assert.equal(SAMPLE_WORDS.eventWord, 'wedding');
  assert.match(hub, /invitationUrl=\{`\$\{siteOrigin\(\)\}\/sample\/hub\/\$\{guest\.guestKey\}`\}/);
  assert.match(hub, /fallbackCode=\{false\}/, 'the sample never draws the real guest’s cookie QR');
  const ticket = src('app/[slug]/_components/guest-ticket.tsx');
  assert.match(ticket, /fallbackCode = true,/, 'a real guest keeps the door code');
  assert.match(ticket, /\{pending \|\| !fallbackCode \? null : \(/);
});

test('A1-004 · every persona /sample offers opens a built view', () => {
  const s = src('app/sample/page.tsx');
  assert.doesNotMatch(s, /Opening soon/);
  assert.match(s, /<Link href=\{`\/sample\/hub\/\$\{p\.guestKey\}`\}/);
  assert.match(s, /sample\.personas\.filter\(/, 'a persona with no view is not offered');
  for (const key of ['sample-guest-bride-cousin']) assert.ok(readSampleGuest(key), `${key} opens a sample guest`);
});

test('A1-168 · Home names its example couple as a sample', () => {
  const s = src('app/_components/frontdoor/front-door-landing.tsx');
  assert.match(s, /A sample wedding, \{couple\.bride\.first\} and \{couple\.groom\.first\}&rsquo;s, as their guests see it\./);
});
