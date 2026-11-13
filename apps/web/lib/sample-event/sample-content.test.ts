/**
 * 🎭 THE MARIA AND JOSE SAMPLE'S CONTENT (slice S2) — what the brief promises,
 * measured on the fixtures through the shipped builders (corpus
 * SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md items 1–6, 10):
 *
 *   · the day is derived, never stored — a FROZEN CLOCK at two dates puts the
 *     wedding on the nearest Saturday on or after today + 3 months, so the
 *     sample is ALWAYS before the day (preparation), and every time sits on it;
 *   · 50 guests: the entourage of 17 exactly as listed (ROLE_LABELS keys), the
 *     33 others in GROUP_CATEGORY_LABELS groups (Family 12 · Friends 10 · Work 6
 *     · School 4 · Officiant 1), across the sides;
 *   · the two personas as described (the cousin: Family, bride's side, a named
 *     +1, a middle table, no role · the bride's sister: maid of honor, Family,
 *     bride's side, the VIP table, "You walk 4th");
 *   · 5–6 tables with a VIP table, every guest seated once, no seat taken twice,
 *     seats shown by the sample's PUBLISHED override (never a faked date);
 *   · the words literal equals the shipped wedding words;
 *   · nothing personal: no email, no phone, no photo; no id shaped like a real row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { GROUP_CATEGORY_LABELS, ROLE_LABELS } from '@/lib/guests';
import { isUuid } from '@/lib/is-uuid';
import { marchPlaceLine } from '@/lib/march-place';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { seatDayHasCome } from '@/lib/guests-may-see-seats';

import { sampleEventDate, sampleToday } from './date';
import {
  SAMPLE_DAY_ONLY,
  SAMPLE_WORDS,
  sampleChapters,
  sampleDay,
  sampleEntourage,
  sampleGuests,
  sampleMarchPlace,
  sampleScheduleBlocks,
  sampleSeat,
  sampleSnapshot,
} from './hub';
import { readSampleGuest } from './snapshot';
import { samplePrintPass } from './pass';

const FROZEN = [new Date('2026-11-02T03:00:00Z'), new Date('2027-05-31T20:30:00Z')];

test('📅 a frozen clock at two dates: the wedding is the nearest Saturday on or after today + 3 months — always ahead', () => {
  // 2 Nov 2026 (Mon) + 3 months = 2 Feb 2027 (Tue) → Sat 6 Feb 2027.
  assert.equal(sampleEventDate(FROZEN[0]!), '2027-02-06');
  // 31 May 2027 20:30 UTC is 1 June 2027 in Manila; + 3 months = 1 Sep 2027 (Wed) → Sat 4 Sep 2027.
  assert.equal(sampleToday(FROZEN[1]!), '2027-06-01', 'today is read on the venue’s clock');
  assert.equal(sampleEventDate(FROZEN[1]!), '2027-09-04');
  // A month end clamps: 30 Nov + 3 months is the end of February, never March.
  assert.equal(sampleEventDate(new Date('2026-11-30T04:00:00Z')), '2027-03-06', '28 Feb 2027 is a Sunday → Sat 6 Mar');

  for (const now of FROZEN) {
    const day = sampleDay(now);
    assert.equal(new Date(`${day.date}T00:00:00Z`).getUTCDay(), 6, 'the wedding is a Saturday');
    assert.ok(day.daysToGo >= 89 && day.daysToGo <= 98, `the wedding is about three months out (${day.daysToGo} days)`);
    assert.ok(day.date > day.today, 'the sample is always BEFORE the day — preparation, never the day or after');
    assert.equal(sampleSnapshot().stage, 'preparation');
    // Every time on the sample sits on that one derived day.
    for (const b of sampleScheduleBlocks(now)) {
      assert.equal(b.start_at.slice(0, 10), day.date, `${b.label} is not on the wedding day`);
      if (b.end_at) assert.ok(b.end_at >= b.start_at, `${b.label} ends before it starts`);
    }
    for (const c of sampleChapters(now)) assert.equal(c.start_at.slice(0, 10), day.date);
    assert.ok(day.replyBy < day.date && day.replyBy > day.today, 'the reply-by date sits between today and the day');
  }
});

test('📅 nothing in the fixture stores a date', () => {
  const raw = JSON.stringify(sampleSnapshot());
  assert.doesNotMatch(raw, /\b20\d\d-\d\d-\d\d\b/, 'a stored date would let the sample drift into the day or past it');
});

test('👥 50 guests: the entourage of 17 as listed, and 33 others in the predesigned groups across the sides', () => {
  const all = sampleGuests();
  assert.equal(all.length, 50);
  for (const g of all) {
    assert.ok(g.role in ROLE_LABELS, `${g.guestKey}: role ${g.role} is not a ROLE_LABELS key`);
    assert.ok(g.group_category in GROUP_CATEGORY_LABELS, `${g.guestKey}: group ${g.group_category} is not a GROUP_CATEGORY_LABELS key`);
  }
  const entourage = all.filter((g) => g.role !== 'guest' && g.role !== 'officiant');
  assert.equal(entourage.length, 17, 'the entourage is 17');
  const count = (role: string) => entourage.filter((g) => g.role === role).length;
  assert.equal(count('principal_sponsor_ninong') + count('principal_sponsor_ninang'), 4, '2 principal-sponsor couples');
  assert.equal(count('principal_sponsor_ninong'), 2);
  assert.equal(count('groomsman'), 2);
  assert.equal(count('bridesmaid'), 2);
  assert.equal(count('best_man'), 1);
  assert.equal(count('maid_of_honor'), 1);
  assert.equal(count('candle_sponsor') + count('veil_sponsor') + count('cord_sponsor'), 3, '3 secondary sponsors');
  assert.equal(count('flower_girl'), 1);
  assert.equal(count('ring_bearer') + count('bible_bearer') + count('coin_bearer'), 3, '3 bearers');
  // The sponsor couples are paired both ways.
  for (const g of all.filter((x) => x.couple_with_guest_id)) {
    const partner = all.find((x) => x.guest_id === g.couple_with_guest_id)!;
    assert.equal(partner.couple_with_guest_id, g.guest_id, `${g.guestKey}'s partner does not point back`);
  }

  const others = all.filter((g) => !entourage.includes(g));
  assert.equal(others.length, 33);
  const byGroup = (k: string) => others.filter((g) => g.group_category === k).length;
  assert.deepEqual(
    { family: byGroup('family'), friends: byGroup('friends'), work: byGroup('work'), school: byGroup('school'), officiant: byGroup('officiant') },
    { family: 12, friends: 10, work: 6, school: 4, officiant: 1 },
  );
  for (const side of ['bride', 'groom'] as const) assert.ok(others.filter((g) => g.side === side).length >= 10, `the ${side}’s side is thin`);
  // The printed entourage holds every one of the 17 (plus the officiant under the ceremony).
  const printed = new Set(sampleEntourage().flatMap((gr) => gr.rows.flatMap((r) => r.map((p) => p?.id ?? null))).filter(Boolean));
  for (const g of entourage) assert.ok(printed.has(g.guest_id), `${g.guestKey} is missing from the entourage`);
});

test('🎭 the cousin and the bride’s sister are who the brief says, and never read as one another', () => {
  const cousin = readSampleGuest('sample-guest-bride-cousin')!;
  const sister = readSampleGuest('sample-guest-maid-of-honor')!;
  const s = sampleSnapshot();

  assert.equal(cousin.role, 'guest', 'the cousin holds no role');
  assert.equal(cousin.group_category, 'family');
  assert.equal(cousin.side, 'bride');
  assert.equal(cousin.plus_one_allowed, true);
  assert.ok(cousin.plus_one_name, 'the cousin’s +1 is named');
  const plusOne = sampleGuests().find((g) => g.plus_one_of_guest_id === cousin.guest_id);
  assert.ok(plusOne, 'the cousin’s +1 is a guest of their own');
  assert.equal(`${plusOne.first_name} ${plusOne.last_name}`, cousin.plus_one_name);
  const cousinTable = s.tables.find((t) => t.key === cousin.table)!;
  assert.equal(cousinTable.vip, false, 'the cousin sits at a middle table, not the VIP table');
  assert.equal(sampleMarchPlace(cousin), null, 'the cousin does not walk');

  assert.equal(sister.role, 'maid_of_honor');
  assert.equal(sister.group_category, 'family');
  assert.equal(sister.side, 'bride');
  assert.equal(sister.last_name, s.couple.bride.last, 'the maid of honor is the BRIDE’S sister');
  assert.equal(s.tables.find((t) => t.key === sister.table)!.vip, true, 'the maid of honor sits at the VIP table');
  const place = sampleMarchPlace(sister);
  assert.ok(place, 'the maid of honor walks');
  assert.match(marchPlaceLine(place), /^You walk 4th\b/, 'the maid of honor walks 4th');

  assert.notEqual(cousin.last_name, sister.last_name, 'different surnames — never read as duplicates');
  assert.notEqual(cousin.table, sister.table, 'different tables');
});

test('🪑 six tables, one VIP; every guest seated once; seats shown by the published override, never a faked date', () => {
  const s = sampleSnapshot();
  assert.ok(s.tables.length >= 5 && s.tables.length <= 6);
  assert.equal(s.tables.filter((t) => t.vip).length, 1);
  const taken = new Set<string>();
  for (const g of sampleGuests()) {
    const t = s.tables.find((x) => x.key === g.table);
    assert.ok(t, `${g.guestKey} sits at no table`);
    assert.ok(g.seat >= 1 && g.seat <= t.capacity, `${g.guestKey}'s seat ${g.seat} is not a seat of ${t.label}`);
    const k = `${g.table}:${g.seat}`;
    assert.ok(!taken.has(k), `seat ${k} is taken twice`);
    taken.add(k);
  }
  for (const t of s.tables) assert.ok(sampleGuests().filter((g) => g.table === t.key).length <= t.capacity, `${t.label} is over capacity`);

  // The override is the sample's own fact. The real rule says the seats are NOT shown yet (it is not the day) —
  // which is exactly why the sample carries an override instead of a date.
  assert.equal(s.seatsPublished, true);
  for (const now of FROZEN) {
    const date = sampleDay(now).date;
    assert.equal(seatDayHasCome(date, 'day', now), false, 'the real rule would hide the seat — the sample did not fake the day');
  }
  const sister = readSampleGuest('sample-guest-maid-of-honor')!;
  const seat = sampleSeat(sister)!;
  assert.equal(seat.tableLabel, 'VIP Table');
  assert.match(seat.plan, /^<svg/, 'the seat plan is the shipped renderer’s SVG');
  const pass = samplePrintPass(sister);
  assert.equal(pass.seat, 'VIP Table', 'the ticket shows the table');
  assert.equal(pass.seatNumber, String(sister.seat), 'the ticket shows the seat');
  assert.equal(pass.arrive, '1:00 PM', 'the maid of honor’s own call time');
  assert.equal(samplePrintPass(readSampleGuest('sample-guest-bride-cousin')!).arrive, '2:30 PM', 'a guest arrives when the doors open');
});

test('🗓 chapters and a minute-level run of show; the dress code with real hex colours; day-only doors say so', () => {
  const s = sampleSnapshot();
  assert.ok(s.chapters.length >= 2, 'at least the ceremony and the reception');
  for (const c of s.chapters) {
    assert.ok(c.moments.length >= 5, `${c.label} needs a minute-level run of show`);
    assert.ok(c.moments.some((m) => !/:00$|:30$/.test(m.at)), `${c.label}’s moments are not minute-level`);
  }
  const palette = (s.dressCode as { palette: { hex: string }[] }).palette;
  assert.ok(palette.length >= 4);
  for (const p of palette) assert.match(p.hex, /^#[0-9A-F]{6}$/i);
  assert.deepEqual(
    palette.map((p) => p.hex.toUpperCase()),
    [s.colours.ivory, s.colours.blush, s.colours.plum, s.colours.gold].map((h) => h.toUpperCase()),
    'ivory · blush · plum · gold',
  );
  assert.deepEqual(SAMPLE_DAY_ONLY.map((d) => d.key), ['check-in', 'live-watch', 'papic', 'reveal']);
  assert.equal(SAMPLE_DAY_ONLY.find((d) => d.key === 'reveal')!.pro, 'Reveal', 'the Reveal is an Event Pro part (◆)');
});

test('🔤 the sample’s words are the shipped wedding words', () => {
  assert.deepEqual({ ...SAMPLE_WORDS }, { ...eventWordsFromProfile(WEDDING_PROFILE) });
});

test('🔒 nothing personal and no id shaped like a real row', () => {
  for (const g of sampleGuests()) {
    const row = g as unknown as Record<string, unknown>;
    for (const k of ['email', 'mobile', 'photo_url', 'qr_token']) assert.equal(row[k], undefined, `${g.guestKey} carries ${k}`);
    assert.ok(g.guest_id.startsWith('sample:'), `${g.guestKey}'s id is not a sample id`);
    assert.equal(isUuid(g.guest_id), false);
  }
  const raw = JSON.stringify(sampleSnapshot());
  assert.doesNotMatch(raw, /@[a-z0-9-]+\.[a-z]/i, 'an email address in the sample');
  assert.doesNotMatch(raw, /(\+?63|0)9\d{9}/, 'a phone number in the sample');
});
