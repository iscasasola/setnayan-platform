import { chaptersFromBlocks, type TaskRow } from '@/lib/schedule-chapters';
import { yourSchedule, type YourMoment } from '@/lib/guest-your-schedule';
import type { YourScheduleRead } from '@/app/[slug]/_lib/your-schedule.server';

/**
 * 📅 THE ME LAB'S SCHEDULE — fake chapters, moments and tasks drawn through the REAL rule (`yourSchedule`), the same
 * day as the §11b samples (`prototypes/schedule_chapters_2026-11-01/shots/me-*.jpg`). Lab only: no database.
 * `?stage=1&schedule=bridesmaid|guest` · `&released=1` after Release · `&free=1` an event without Pro · `&tba=1` the
 * bridesmaids' preparation with no time yet. Somebody else's lines are in the fixture ON PURPOSE (a groomsman's, the
 * ninong's) — the card must never draw them.
 */
const DAY = '2026-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00+00:00`;

export const LAB_GUEST_ID = 'g-pam';

function blocks(tba: boolean) {
  const ch = (id: string, label: string, start: string, end: string | null, location: string | null, spot: string | null, onInvitation: boolean, isPublic: boolean, extra: Record<string, unknown> = {}) => ({
    block_id: id, parent_block_id: null, label, start_at: at(start), end_at: end ? at(end) : null, location, spot, on_invitation: onInvitation, is_public: isPublic, call_lead_minutes: 60, time_tba: false, ...extra,
  });
  return [
    tba
      ? ch('c-prep', 'Preparation · Bridesmaids', '00:00', null, 'Seda Vertis North', 'Floor 12', false, false, { time_tba: true })
      : ch('c-prep', 'Preparation · Bridesmaids', '07:00', '12:00', 'Seda Vertis North', 'Floor 12', false, false),
    ch('c-groom', 'Preparation · Groomsmen', '08:00', '12:00', 'Seda Vertis North', 'Floor 9', false, false),
    ch('c-cer', 'Ceremony', '13:30', '15:30', 'San Vicente Parish', null, true, true),
    ch('c-rec', 'Reception', '17:00', '22:00', 'Seda Vertis North', null, true, true),
    ch('c-after', 'After party', '22:30', null, null, null, true, true),
  ];
}

const m = (id: string, parent: string, label: string, hhmm: string, isPublic: boolean): YourMoment => ({
  block_id: id, parent_block_id: parent, label, start_at: at(hhmm), end_at: null, location: null, spot: null, is_public: isPublic, audience: null, staged: false,
});

const MOMENTS: YourMoment[] = [
  m('m-hair', 'c-prep', 'Hair and makeup', '08:00', false),
  m('m-barong', 'c-groom', 'Barong fitting', '09:00', false),
  m('m-lineup', 'c-cer', 'Line up', '13:45', false),
  m('m-march', 'c-cer', 'Wedding March', '14:00', true),
  m('m-mass', 'c-cer', 'Mass', '14:10', true),
  m('m-reading', 'c-cer', 'First reading', '14:25', false),
  m('m-cocktails', 'c-rec', 'Cocktails', '17:00', true),
  m('m-entrance', 'c-rec', 'Grand Entrance', '18:00', true),
  m('m-dinner', 'c-rec', 'Dinner', '18:15', true),
  m('m-dance', 'c-rec', 'First dance', '20:00', true),
];

const t = (id: string, block: string, who: Partial<TaskRow>, what: string): TaskRow => ({
  task_id: id, block_id: block, vendor_id: null, crew: null, guest_id: null, group_id: null, role: null, who_label: null, what, call_at: null, place: null, sort_order: 0, ...who,
});

const TASKS: TaskRow[] = [
  t('t1', 'm-hair', { role: 'bridesmaid' }, 'With Sinag Beauty'),
  t('t2', 'm-lineup', { role: 'bridesmaid' }, 'For the march'),
  t('t3', 'm-march', { guest_id: LAB_GUEST_ID }, 'You walk 3rd, with Ana'),
  t('t4', 'm-entrance', { role: 'bridesmaid' }, 'You walk 1st'),
  // Somebody else's — never on Pam's card, nor on a plain guest's.
  t('t5', 'm-barong', { role: 'groomsman' }, 'Groomsmen fitting'),
  t('t6', 'm-reading', { guest_id: 'g-ninong' }, 'Ninong Ben reads'),
  t('t7', 'm-march', { role: 'groomsman' }, 'You walk 2nd, with Joy'),
];

export function labYourSchedule(sp: Record<string, string | string[] | undefined>): YourScheduleRead | null {
  const who = sp.schedule;
  if (who !== 'bridesmaid' && who !== 'guest') return null;
  const pro = sp.free !== '1';
  return {
    kind: 'ok',
    schedule: yourSchedule({
      chapters: chaptersFromBlocks(blocks(sp.tba === '1')),
      moments: MOMENTS,
      tasks: TASKS,
      viewer: who === 'bridesmaid' ? { guestId: LAB_GUEST_ID, roles: ['bridesmaid'], groupIds: [] } : { guestId: 'g-guest', roles: [], groupIds: [] },
      released: pro && sp.released === '1',
      pro,
      guestsArriveBy: '1:15 PM',
    }),
  };
}
