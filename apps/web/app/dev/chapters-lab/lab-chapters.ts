import type { Chapter, MomentLike, TaskRow } from '@/lib/schedule-chapters';
import type { ChapterMoment } from '@/app/dashboard/[eventId]/schedule/_components/chapters-host';

/**
 * 🧪 FAKE CHAPTERS FOR THE LAB (`/dev/chapters-lab`). A sample wedding on
 * 18 Dec with made-up venues — the SHAPE of a real run of show (preparations split by room in one hotel, a ceremony at
 * a parish, a reception and an after party back at the hotel, a reception egress past midnight), never anyone's data.
 * Nothing here is written anywhere.
 */
export const LAB_EVENT_DAY = '2026-12-18';
export const LAB_VENUES = ['Hotel Aurora', 'St. Mary’s Parish'];

const at = (hhmm: string, day = LAB_EVENT_DAY) => `${day}T${hhmm}:00.000Z`;

function chapter(id: string, label: string, start: string, end: string | null, location: string | null, spot: string | null, more: Partial<Chapter> = {}): Chapter {
  return {
    block_id: id,
    label,
    start_at: at(start),
    end_at: end ? (end < start ? at(end, '2026-12-19') : at(end)) : null,
    location,
    spot,
    notes: null,
    ingress_minutes_before: null,
    egress_minutes_after: null,
    call_lead_minutes: 60,
    on_invitation: false,
    photo_who: 'chapter',
    photo_when: 'right_away',
    is_public: false,
    moments: 0,
    ...more,
  };
}

export const LAB_CHAPTERS: Chapter[] = [
  chapter('00000000-0000-4000-8000-0000000000c1', 'Preparation · Bride', '06:00', '13:45', 'Hotel Aurora', 'Bridal suite', { moments: 3 }),
  chapter('00000000-0000-4000-8000-0000000000c2', 'Preparation · Bridesmaids', '08:00', '13:30', 'Hotel Aurora', '2F holding room', { call_lead_minutes: 30 }),
  chapter('00000000-0000-4000-8000-0000000000c3', 'Preparation · Groom', '10:30', '13:15', 'Hotel Aurora', 'Groom’s room'),
  chapter('00000000-0000-4000-8000-0000000000c4', 'Ceremony', '15:00', '16:30', 'St. Mary’s Parish', null, { on_invitation: true }),
  // Ingress from 12:00 AM the same day (1080 before 6 PM); egress until 1 AM the next day (420 after) — past midnight.
  chapter('00000000-0000-4000-8000-0000000000c5', 'Reception', '18:00', '23:00', 'Hotel Aurora', 'Ballroom', {
    on_invitation: true,
    ingress_minutes_before: 1080,
    egress_minutes_after: 420,
    photo_when: 'after_event',
  }),
  chapter('00000000-0000-4000-8000-0000000000c6', 'After party', '23:00', '02:00', 'Hotel Aurora', 'Foyer', { photo_who: 'tagged' }),
];

/**
 * 📖 Step 3a, the Schedule page: a chapter with no time yet on the day ("Time TBA"), and one before the day — a fitting —
 * which lives in Planning Stage.
 */
export const LAB_TBA_CHAPTER: Chapter = chapter('00000000-0000-4000-8000-0000000000c7', 'Send-off', '00:00', null, null, null, { time_tba: true });
export const LAB_PLANNING_CHAPTER: Chapter = chapter('00000000-0000-4000-8000-0000000000c8', 'Final fitting', '15:00', '16:00', 'Atelier Rosa', null, {
  start_at: '2026-12-05T15:00:00.000Z',
  end_at: '2026-12-05T16:00:00.000Z',
  moments: 1,
});
export const LAB_SCHEDULE_CHAPTERS: Chapter[] = [...LAB_CHAPTERS, LAB_TBA_CHAPTER, LAB_PLANNING_CHAPTER];

const m = (id: string, parent: string, label: string, hhmm: string, pub: boolean, who: string, day = LAB_EVENT_DAY, more: Partial<ChapterMoment> = {}): ChapterMoment => ({
  block_id: `00000000-0000-4000-8000-0000000m${id}`,
  parent_block_id: parent,
  label,
  start_at: `${day}T${hhmm}:00.000Z`,
  end_at: new Date(Date.parse(`${day}T${hhmm}:00.000Z`) + 30 * 60_000).toISOString(),
  location: null,
  spot: null,
  notes: null,
  is_optional: false,
  travel_from: null,
  travel_to: null,
  march_key: null,
  is_public: pub,
  who,
  vendor_ids: [],
  time_tba: false,
  follows_block_id: null,
  time_shape: 'at',
  time_or_minutes: null,
  ...more,
});

/** The moments inside the lab's chapters — the Ceremony's run of show, the Reception's ingress and egress. */
export const LAB_CHAPTER_MOMENTS: ChapterMoment[] = [
  m('0001', LAB_CHAPTERS[0]!.block_id, 'Hair and make-up starts', '06:30', false, 'Glow HMUA'),
  m('0002', LAB_CHAPTERS[0]!.block_id, 'Gown on', '11:30', false, ''),
  m('0003', LAB_CHAPTERS[0]!.block_id, 'Bride’s portraits', '12:30', false, 'Lightbox Studio'),
  m('0004', LAB_CHAPTERS[3]!.block_id, 'Guests arrive', '15:00', true, ''),
  m('0005', LAB_CHAPTERS[3]!.block_id, 'Line up', '15:15', false, 'The Planning Desk'),
  m('0006', LAB_CHAPTERS[3]!.block_id, 'Wedding march', '15:30', true, 'Lightbox Studio', LAB_EVENT_DAY, { march_key: 'entourage' }),
  m('0007', LAB_CHAPTERS[3]!.block_id, 'Mass', '15:40', true, ''),
  m('0012', LAB_CHAPTERS[3]!.block_id, 'Father’s reveal', '16:15', false, '', LAB_EVENT_DAY, { is_optional: true }),
  m('0013', LAB_CHAPTERS[3]!.block_id, 'Bridal car to the hotel', '16:30', false, '', LAB_EVENT_DAY, { travel_from: 'St. Mary’s Parish', travel_to: 'Hotel Aurora' }),
  m('0008', LAB_CHAPTERS[4]!.block_id, 'Florist sets the stage', '12:00', false, 'Bloom & Co.'),
  m('0009', LAB_CHAPTERS[4]!.block_id, 'Dinner is served', '19:00', true, 'Hotel Aurora banquets'),
  m('0010', LAB_CHAPTERS[4]!.block_id, 'Strike and load-out', '23:30', false, 'Bloom & Co.'),
  m('0011', LAB_PLANNING_CHAPTER.block_id, 'Last pinning', '15:15', false, '', '2026-12-05'),
];

/* ── the run-of-show shape: ONE moment, THREE parallel tasks, TWO places ─────────────────────────────────────── */

export const LAB_MOMENT: MomentLike & { label: string; parent_block_id: string } = {
  block_id: '00000000-0000-4000-8000-0000000000m1',
  parent_block_id: '00000000-0000-4000-8000-0000000000c1',
  label: 'Entourage hair and make-up starts',
  start_at: at('08:00'),
  end_at: at('08:30'),
  location: null, // follows its chapter: Hotel Aurora
  spot: 'Bridal suite',
};

export const LAB_SUPPLIERS: Record<string, string> = {
  'v-hmua': 'Glow HMUA',
  'v-coord': 'The Planning Desk',
  'v-photo': 'Lightbox Studio',
};

const task = (id: string, who: Partial<TaskRow>, what: string, place: string | null, sort: number): TaskRow => ({
  task_id: id,
  block_id: LAB_MOMENT.block_id,
  vendor_id: null,
  crew: null,
  guest_id: null,
  group_id: null,
  role: null,
  who_label: null,
  call_at: null,
  place,
  sort_order: sort,
  ...who,
  what,
});

/** Three tasks at once: two in the bridal suite (the moment's room), one in the 2F holding room. */
export const LAB_TASKS: TaskRow[] = [
  task('t1', { role: 'Bride' }, 'Final make-up; changes into her robe', null, 0),
  task('t2', { vendor_id: 'v-hmua', crew: 'Team B' }, 'Bridesmaids’ hair and make-up, one chair each', '2F holding room', 1),
  task('t3', { vendor_id: 'v-coord', crew: 'Coord A' }, 'Hands out the timeline; checks the florals against the list', null, 2),
];

/** A clash, for the flag: the planner's Coord A is ALSO asked to be in the lobby at the same time. */
export const LAB_CLASH_TASK: TaskRow = task('t4', { vendor_id: 'v-coord', crew: 'Coord A' }, 'Receives the florist at the lobby', 'Lobby', 3);

/** The run-of-show moment as the chapter's page lists it: 8:00 in Preparation · Bride, its room the bridal suite. */
export const LAB_MOMENT_ROW: ChapterMoment = {
  ...LAB_MOMENT,
  location: null,
  spot: LAB_MOMENT.spot,
  notes: null,
  is_optional: false,
  travel_from: null,
  travel_to: null,
  // 🚶 The lab's run-of-show moment is one of the couple's own marches — its sheet shows "This is a march" picked.
  march_key: 'own_labentr001',
  is_public: false,
  who: '',
  // 👷 Its supplier lines put it on those suppliers' days (`setMomentFor` links them first).
  vendor_ids: ['v-hmua', 'v-coord'],
  end_at: LAB_MOMENT.end_at,
  time_tba: false,
  follows_block_id: null,
  time_shape: 'at',
  time_or_minutes: null,
};

/** 🚶 The couple's own marches (Guests › March) — made-up names only. */
export const LAB_MARCHES = [
  { key: 'own_labentr001', label: 'Grand Entrance' },
  { key: 'own_labparade1', label: 'Flower girls’ parade' },
];

/** Who a lab task can name — made-up names only. */
export const LAB_WHO = {
  suppliers: Object.entries(LAB_SUPPLIERS).map(([id, name]) => ({ id, name })),
  people: {
    guests: [
      { id: 'g-ana', name: 'Ana Cruz', role: 'bride' },
      { id: 'g-ben', name: 'Ben Santos', role: 'groom' },
      { id: 'g-cara', name: 'Cara Lim', role: 'bridesmaid' },
    ],
    groups: [{ id: 'grp-bridesmaids', name: 'Bridesmaids' }],
    roles: [
      { key: 'bride', name: 'Bride' },
      { key: 'bridesmaid', name: 'Bridesmaid' },
      { key: 'groom', name: 'Groom' },
    ],
  },
};
