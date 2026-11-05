import type { TaskRow } from '@/lib/schedule-chapters';
import type { ViewAsInput, ViewMoment } from '@/lib/schedule-view-as';
import { LAB_CHAPTER_MOMENTS, LAB_CHAPTERS, LAB_EVENT_DAY, LAB_TBA_CHAPTER } from './lab-chapters';

/**
 * 🧪 FAKE DATA FOR VIEW AS (Step 3c, `/dev/chapters-lab`): the lab's chapter moments with the fields a view filters on,
 * a few parallel tasks (two suppliers' crews in the bride's and groom's rooms at once, a bridesmaids' task, the florist
 * and the banquet team overlapping at the reception) and made-up suppliers. Never anyone's data; nothing is written.
 */
const at = (hhmm: string) => `${LAB_EVENT_DAY}T${hhmm}:00.000Z`;
const BRIDE = LAB_CHAPTERS[0]!.block_id;
const BRIDESMAIDS = LAB_CHAPTERS[1]!.block_id;
const GROOM = LAB_CHAPTERS[2]!.block_id;

/** How long each lab moment runs, and who is tagged on it (the moment's `who` words are the lab's own). */
const MORE: Record<string, Partial<ViewMoment>> = {
  '00000000-0000-4000-8000-0000000m0001': { end_at: at('09:30'), responsible_vendor_ids: ['v-hmua'] },
  '00000000-0000-4000-8000-0000000m0002': { end_at: at('12:00') },
  '00000000-0000-4000-8000-0000000m0003': { end_at: at('13:15'), responsible_vendor_ids: ['v-photo'] },
  '00000000-0000-4000-8000-0000000m0004': { end_at: at('15:30') },
  // A private line: the coordinator's line-up — never on the guests' schedule.
  '00000000-0000-4000-8000-0000000m0005': { end_at: at('15:30'), responsible_vendor_ids: ['v-coord'] },
  '00000000-0000-4000-8000-0000000m0006': { end_at: at('15:40'), responsible_vendor_ids: ['v-photo'] },
  '00000000-0000-4000-8000-0000000m0007': { end_at: at('16:30') },
  '00000000-0000-4000-8000-0000000m0008': { end_at: at('17:00'), responsible_vendor_ids: ['v-flor'] },
  '00000000-0000-4000-8000-0000000m0009': { end_at: at('20:30'), responsible_vendor_ids: ['v-banq'] },
  '00000000-0000-4000-8000-0000000m0010': { end_at: '2026-12-19T00:30:00.000Z', responsible_vendor_ids: ['v-flor'] },
};

const extra: ViewMoment[] = [
  // Two more moments: the bridesmaids' and the groom's prep, for the crews' parallel work.
  { block_id: 'lab-m-bm', parent_block_id: BRIDESMAIDS, label: 'Bridesmaids get ready', start_at: at('08:00'), end_at: at('10:00'), is_public: false, staged: false, audience: 'entourage', responsible_vendor_ids: [], location: null, spot: null, travel_from: null, travel_to: null },
  { block_id: 'lab-m-gr', parent_block_id: GROOM, label: 'Groom’s grooming', start_at: at('10:30'), end_at: at('11:30'), is_public: false, staged: false, audience: null, responsible_vendor_ids: [], location: null, spot: null, travel_from: null, travel_to: null },
  // A coordinator's staged moment that IS marked shown to guests — still never on the guests' schedule until released.
  // The Send-off chapter is Time TBA: its suppliers are listed "Time TBA" in Suppliers by time, never hidden (2 Nov).
  { block_id: 'lab-m-tba', parent_block_id: LAB_TBA_CHAPTER.block_id, label: 'Sparkler send-off', start_at: LAB_TBA_CHAPTER.start_at, end_at: null, is_public: false, staged: false, audience: null, responsible_vendor_ids: ['v-coord', 'v-photo'], location: null, spot: null, travel_from: null, travel_to: null },
  { block_id: 'lab-m-staged', parent_block_id: LAB_CHAPTERS[3]!.block_id, label: 'Ring bearer rehearsal', start_at: at('15:05'), end_at: at('15:15'), is_public: true, staged: true, audience: null, responsible_vendor_ids: [], location: null, spot: null, travel_from: null, travel_to: null },
];

const moments: ViewMoment[] = [
  ...LAB_CHAPTER_MOMENTS.map((m) => ({
    block_id: m.block_id,
    parent_block_id: m.parent_block_id,
    label: m.label,
    start_at: m.start_at,
    end_at: null,
    is_public: m.is_public,
    staged: false,
    audience: null,
    responsible_vendor_ids: [],
    location: null,
    spot: null,
    travel_from: null,
    travel_to: null,
    ...MORE[m.block_id],
  })),
  ...extra,
];

const task = (id: string, block: string, who: Partial<TaskRow>, what: string, place: string | null, callAt: string | null = null): TaskRow => ({
  task_id: id,
  block_id: block,
  vendor_id: null,
  crew: null,
  guest_id: null,
  group_id: null,
  role: null,
  who_label: null,
  call_at: callAt,
  place,
  sort_order: 0,
  ...who,
  what,
});

const tasks: TaskRow[] = [
  task('lab-t1', '00000000-0000-4000-8000-0000000m0001', { vendor_id: 'v-hmua', crew: 'Team A' }, 'Bride’s hair and make-up', null, at('06:15')),
  task('lab-t2', 'lab-m-bm', { vendor_id: 'v-hmua', crew: 'Team B' }, 'Bridesmaids’ hair and make-up, one chair each', null),
  task('lab-t3', 'lab-m-bm', { role: 'bridesmaid' }, 'In robes, hair first', null),
  task('lab-t4', 'lab-m-gr', { vendor_id: 'v-photo', crew: 'Second shooter' }, 'Groom’s details and getting ready', null),
  task('lab-t5', '00000000-0000-4000-8000-0000000m0003', { vendor_id: 'v-photo', crew: 'Lead' }, 'Bride’s portraits by the window', 'Hotel Aurora, garden'),
  task('lab-t6', '00000000-0000-4000-8000-0000000m0005', { vendor_id: 'v-coord' }, 'Lines up the entourage at the church door', null),
  task('lab-t7', '00000000-0000-4000-8000-0000000m0008', { vendor_id: 'v-flor' }, 'Stage florals and centrepieces', null),
  task('lab-t8', '00000000-0000-4000-8000-0000000m0009', { vendor_id: 'v-banq' }, 'Plated dinner, table by table', null),
  task('lab-t9', '00000000-0000-4000-8000-0000000m0009', { vendor_id: 'v-photo', crew: 'Lead' }, 'Candids during dinner', null),
  // 🧭 Slice 9: the Host / MC and the bride, so Side by side draws their columns too.
  task('lab-t10', '00000000-0000-4000-8000-0000000m0009', { vendor_id: 'v-mc' }, 'Hosts the program', null),
  task('lab-t11', '00000000-0000-4000-8000-0000000m0003', { guest_id: 'g-ana' }, 'Portraits with her mother', null),
];

/**
 * 👤 Slice 6: three made-up guests for View as › a named guest — a bridesmaid (the bridesmaids' task is hers), a plain
 * guest, and one the hosts took off the Reception (she is asked to the Ceremony only) — and `released` for "after Release"
 * (`?released=1`).
 */
export const LAB_RECEPTION = LAB_CHAPTERS[4]!.block_id;
export const LAB_PEOPLE = [
  { guest_id: 'g-ana', name: 'Ana Cruz', roles: ['bride'], groupIds: [], notInvited: [] },
  { guest_id: 'g-cara', name: 'Cara Lim', roles: ['bridesmaid'], groupIds: [], notInvited: [] },
  { guest_id: 'g-rey', name: 'Tito Rey Santos', roles: [], groupIds: [], notInvited: [] },
  { guest_id: 'g-nena', name: 'Lola Nena Cruz', roles: [], groupIds: [], notInvited: [LAB_RECEPTION] },
];

export function labViewAs(pro: boolean, released = false): ViewAsInput {
  return {
    pro,
    proHref: '/dev/chapters-lab?upgrade=1',
    data: {
      moments,
      tasks,
      suppliers: [
        { vendor_id: 'v-hmua', name: 'Glow HMUA', booked: true },
        { vendor_id: 'v-photo', name: 'Lightbox Studio', booked: true },
        { vendor_id: 'v-coord', name: 'The Planning Desk', booked: true, everyChapter: true },
        { vendor_id: 'v-flor', name: 'Bloom & Co.', booked: true },
        { vendor_id: 'v-banq', name: 'Hotel Aurora banquets', booked: true },
        { vendor_id: 'v-mc', name: 'Ate Jen', booked: true, host: true, trade: 'Host / MC' },
      ],
      groups: {},
      roleNames: { bridesmaid: 'Bridesmaid' },
      people: LAB_PEOPLE,
      released: pro && released,
      guestsArriveBy: '1:00 PM',
    },
  };
}
