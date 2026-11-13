/**
 * 🚶 ROUND 7 — W1's re-walk, 13 Nov 2026. Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { realNameOrNull, ROSTER_UNNAMED } from './no-name';
import { NEED_PRESET_LABEL } from './event-needs';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('RW-64 · a stand-in is never a name — "Someone —", "Someone", "—" are no name; a real name is kept', () => {
  for (const stand of ['Someone —', 'Someone', ' — ', '—', 'someone –', '', null, undefined]) {
    assert.equal(realNameOrNull(stand), null, `${JSON.stringify(stand)} read as a name`);
  }
  assert.equal(realNameOrNull('Ana Reyes'), 'Ana Reyes');
  assert.equal(realNameOrNull('Ana —'), 'Ana');
  assert.equal(realNameOrNull('Someone Reyes'), 'Someone Reyes', 'a real surname keeps the word');
  assert.equal(ROSTER_UNNAMED, 'Someone');
  assert.match(code('lib/people-you-can-invite.ts'), /if \(realNameOrNull\(p\.name\) === null\) continue;/, 'the picker');
  assert.match(code('app/[slug]/invite/reply/page.tsx'), /realNameOrNull\(\s*guestDisplayName\(/, 'the reply page');
  assert.match(code('app/_components/account-switcher/get-switcher-data.ts'), /displayName: realNameOrNull\(profile\?\.display_name\),/, 'the switcher');
});

test('RW-65 · plain words for the simple preset; the Get-together tile says supplier', () => {
  assert.equal(NEED_PRESET_LABEL.simple, 'Just photos and one QR for everyone');
  assert.doesNotMatch(JSON.stringify(NEED_PRESET_LABEL), /Simple event|Papic \+/);
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271345904117_rw65_get_together_says_supplier.sql'), 'utf8');
  assert.match(sql, /SET description = '[\s\S]*?No suppliers to book\.'/);
  assert.match(sql, /AND description = '[\s\S]*?No vendors, no marketplace\.'/, 'only the seed text is replaced — an admin edit stays');
});

test('RW-87 · before the event day the run of show says when it starts, never "Not started yet"', () => {
  const h = code('app/_components/run-of-show-header.tsx');
  assert.match(h, /startsOnWords \? `Starts on \$\{startsOnWords\}\.` : 'Not started yet\.'/, 'the card');
  assert.match(h, /startsOnWords \? `Starts on \$\{startsOnWords\}` : 'Not started yet'/, 'the strip');
  assert.match(
    code('app/vendor-dashboard/clients/[eventId]/page.tsx'),
    /props\.brief\.event\.event_date\.slice\(0, 10\) > manilaToday\(\)\s*\?\s*hubDayWords\(props\.brief\.event\.event_date\)/,
  );
});

test('RW-89 · a booked row offers no "Your request"; the category name keeps its width', () => {
  const s = code('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(s, /\{savedCanonical && rowState\?\.kind !== 'booked' \? \(/);
  assert.match(s, /\.slcat \.fold\.flat \.cat-nm\{[^}]*overflow-wrap:break-word;flex:1 1 auto;min-width:6ch\}/);
  assert.doesNotMatch(s, /\.slcat \.fold\.flat \.cat-nm\{[^}]*overflow-wrap:anywhere/, 'anywhere lets the name shrink to one letter');
});

test('RW-84 · Today\'s Booked stat says it counts events dated this month', () => {
  assert.match(code('app/vendor-dashboard/_components/today-stats.tsx'), /line: s\.booked === null \? UNREAD : 'events this month'/);
});

test('RW-67 · a service card says its daily limit once — the shared schedule\'s, when it shares one', () => {
  const c = code('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(c, /const scheduleLine = sharedSchedule \? `Shares \$\{sharedSchedule\.name\}` : 'Its own';/);
  assert.match(c, /that is the number that holds\./);
});

test('RW-57 · a closed onboarding sheet cannot be scrolled into view', () => {
  const css = readFileSync(join(process.cwd(), 'app/onboarding/wedding/_styles/onboarding.css'), 'utf8');
  assert.match(css, /\.onbw \.phone\{overflow:clip;\}/);
  assert.match(css, /\.onbw \.sheet\{visibility:hidden;/);
  assert.match(css, /\.onbw \.sheet\.open\{visibility:visible;/);
});

test('RW-108 · a claimed per-guest booking reads the couple’s figure and count on Details, never ₱0', async () => {
  const { agreedRows } = await import('./agreed-now');
  const base = {
    viewerUserId: 'v',
    quotes: [],
    event: { eventDate: '2027-05-01', estimatedPax: 150, finalPax: null },
    changes: [],
    meetings: [],
    names: new Map<string, string>(),
    booking: { isBooked: false, declined: false },
    quoteBy: 'You',
  };
  const rows = agreedRows({ ...base, perGuest: { totalPhp: 4000, guests: 4 } });
  const quote = rows.find((r) => r.key === 'quote')!;
  const count = rows.find((r) => r.key === 'guest_count')!;
  assert.equal(quote.label, 'Agreed price · per guest');
  assert.match(quote.value, /4,000 · 4 guests/);
  assert.equal(count.value, '4 guests');
  assert.equal(count.label, 'Guest count · billed');
  // Without a readable total: the count alone, never ₱0.
  const noTotal = agreedRows({ ...base, perGuest: { totalPhp: null, guests: 4 } }).find((r) => r.key === 'quote')!;
  assert.equal(noTotal.value, '4 guests');
  // Not a claimed per-guest booking: as shipped.
  assert.equal(agreedRows(base).find((r) => r.key === 'quote')!.value, 'No quote sent yet');

  const { detailsNumbers } = await import('../app/vendor-dashboard/clients/[eventId]/_components/details-numbers');
  const cells = detailsNumbers({
    isBooked: false, todayIso: '2026-11-14', eventDate: '2027-05-01', ledger: null, onPlan: false,
    sentQuotePhp: undefined, perGuest: { totalPhp: 4000, guests: 4 }, peso: (n) => `₱${n.toLocaleString('en-PH')}`,
  });
  const q = cells.find((c) => c.key === 'quote')!;
  assert.deepEqual([q.label, q.value, q.sub], ['Agreed', '₱4,000', '4 guests']);
  const zero = detailsNumbers({
    isBooked: false, todayIso: '2026-11-14', eventDate: null, ledger: null, onPlan: false,
    sentQuotePhp: undefined, perGuest: { totalPhp: 0, guests: 4 }, peso: (n) => `₱${n}`,
  }).find((c) => c.key === 'quote')!;
  assert.notEqual(zero.value, '₱0');
  // Both surfaces are wired to the read #7633 added.
  for (const f of ['app/_components/chat/agreed-now.tsx', 'app/vendor-dashboard/clients/[eventId]/page.tsx']) {
    const src = stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
    assert.match(src, /readShopPerGuest\(/, f);
    assert.match(src, /perGuest[:,]/, f);
  }
});
