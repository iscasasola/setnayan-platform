/**
 * 📇 A TASK CARRIES A CONTACT — a name and a phone for someone who is not a supplier (owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (3); migration 20271303218631, whose RLS is held by
 * tests/db/a-task-can-carry-a-contact.db.test.ts).
 *
 * Shown only to the host and that moment's crew — as text, never a tel: link (owner 2026-09-10, no way out of the app):
 *   · the host's moment sheet: Contact · Phone on a PERSON's task (a supplier's line carries none), saved as one;
 *   · a supplier's Schedule view: only what RLS handed them (moments they are on) — drawn on that moment;
 *   · a guest's "Your schedule": only on their own moments, never on an everyone line, never in the shared text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contactFrom, contactLine, phoneProblem } from '../../../../lib/task-contact';
import { MOMENT_OPS, type Chapter, type TaskRow } from '../../../../lib/schedule-chapters';
import { yourSchedule, yourScheduleText, type YourMoment } from '../../../../lib/guest-your-schedule';
import { buildSupplierDay, type SupplierBlockRow } from '../../../../lib/supplier-schedule';

const DAY = '2099-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;
const CH = 'c0000000-0000-4000-8000-000000000003';

test('the rules: both or neither; a phone as written; the words', () => {
  assert.deepEqual(contactFrom('', ''), { ok: true, contact: null });
  assert.deepEqual(contactFrom(' Mang Ben ', ' 0917 123 4567 '), { ok: true, contact: { name: 'Mang Ben', phone: '0917 123 4567' } });
  assert.equal(contactFrom('Mang Ben', '').ok, false);
  assert.equal(contactFrom('', '0917 123 4567').ok, false);
  assert.equal(phoneProblem('call me'), 'Only numbers, spaces, +, ( ) and dashes.');
  assert.equal(phoneProblem('12'), 'Type the whole number.');
  assert.equal(phoneProblem('+63 917 123 4567'), null);
  assert.equal(contactLine({ name: 'Mang Ben', phone: '0917 123 4567' }), 'Mang Ben · 0917 123 4567');
  assert.ok((MOMENT_OPS as readonly string[]).includes('contact_set'), 'the moment sheet has no door to keep a contact');
});

const chapter: Chapter = {
  block_id: CH, label: 'Preparation', start_at: at('10:00'), end_at: at('15:00'), location: 'Seda', spot: null, notes: null,
  ingress_minutes_before: null, egress_minutes_after: null, call_lead_minutes: 60, on_invitation: true, photo_who: 'chapter',
  photo_when: 'right_away', is_public: true, moments: 2, time_tba: false,
};
const car = { block_id: 'm-car', parent_block_id: CH, label: 'Bridal car leaves', start_at: at('14:15'), end_at: at('14:30') };
const toast = { block_id: 'm-toast', parent_block_id: CH, label: 'Family photo', start_at: at('13:00'), end_at: at('13:30') };
const contacts = [{ block_id: 'm-car', name: 'Mang Ben', phone: '0917 123 4567' }, { block_id: 'm-toast', name: 'Kuya Jun', phone: '0917 765 4321' }];

test('"Your schedule": a contact only on the guest\'s OWN moment — never on an everyone line, never in the shared text', () => {
  const guestId = 'g-bride';
  const moments: YourMoment[] = [car, toast].map((m) => ({ ...m, location: null, is_public: true, audience: null, staged: false }));
  const task: TaskRow = { task_id: 't1', block_id: 'm-car', vendor_id: null, crew: null, guest_id: guestId, group_id: null, role: null, who_label: null, what: 'Rides to church', call_at: null, place: null, sort_order: 0 };
  const out = yourSchedule({ chapters: [chapter], moments, tasks: [task], viewer: { guestId, roles: [], groupIds: [] }, released: true, pro: true, guestsArriveBy: null, contacts });
  assert.equal(out.kind, 'ok');
  const lines = out.kind === 'ok' ? out.chapters[0]!.lines : [];
  const carLine = lines.find((l) => l.id === 'm-car');
  const toastLine = lines.find((l) => l.id === 'm-toast');
  assert.deepEqual(carLine?.contacts, [{ name: 'Mang Ben', phone: '0917 123 4567' }]);
  assert.equal(toastLine?.contacts, undefined, 'a phone reached a guest on a moment they are not on');
  assert.doesNotMatch(out.kind === 'ok' ? yourScheduleText(out, 'M & J') : '', /0917/, 'a phone went into the shared text');
});

test('the supplier\'s Schedule view: the contacts RLS handed them, on that moment', () => {
  const rows: SupplierBlockRow[] = [
    { block_id: CH, parent_block_id: null, label: 'Preparation', start_at: chapter.start_at, end_at: chapter.end_at, location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['v'], created_at: null, updated_at: null },
    ...[car, toast].map((m) => ({ ...m, location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: m.block_id === 'm-car' ? ['v'] : [], created_at: null, updated_at: null })),
  ];
  // RLS returned only the car's contact (they are on it) — the view draws what it was given, where it belongs.
  const day = buildSupplierDay({ blocks: rows, myBookingIds: ['v'], tasks: [], requests: [], contacts: [{ task_id: 't1', ...contacts[0]! }] });
  const ms = day.chapters[0]!.moments;
  assert.deepEqual(ms.find((m) => m.block_id === 'm-car')?.contacts, [{ name: 'Mang Ben', phone: '0917 123 4567' }]);
  assert.deepEqual(ms.find((m) => m.block_id === 'm-toast')?.contacts, []);
});

test('the host\'s moment sheet: Contact · Phone on a person\'s task, never on a supplier\'s line, saved through contact_set', () => {
  const sheets = readFileSync(join(__dirname, '_components/moment-sheets.tsx'), 'utf8');
  assert.match(sheets, /task && whoF && whoF\.who_kind !== 'supplier' \? \(\s*<ContactRows/, 'a contact is offered on a supplier\'s line, or before the task exists');
  assert.match(sheets, /doors\.task\('contact_set'/);
  assert.match(sheets, /name="Contact"[\s\S]{0,80}about=\{\{ words: CONTACT_ABOUT \}\}/, 'the detail is not in the ⓘ');
  const server = readFileSync(join(__dirname, '../../../../lib/schedule-chapters.server.ts'), 'utf8');
  assert.match(server, /op === 'contact_set'[\s\S]{0,300}setTaskContact\(/);
});

test('the guest\'s read is fenced in code: the service-role read of contacts feeds ONLY yourSchedule', () => {
  const read = readFileSync(join(__dirname, '../../../[slug]/_lib/your-schedule.server.ts'), 'utf8');
  assert.equal((read.match(/event_schedule_task_contacts/g) ?? []).length, 1, 'a second read of contacts appeared on the guest side');
  const card = readFileSync(join(__dirname, '../../../[slug]/_components/your-schedule-card.tsx'), 'utf8');
  assert.match(card, /\(l\.contacts \?\? \[\]\)\.map/);
});
