import type { Chapter, MomentLike, TaskRow } from '@/lib/schedule-chapters';

/**
 * 🧪 FAKE CHAPTERS FOR THE LABS (`/dev/chapters-lab`, `/dev/home-lab?settings=1&row=chapters`). A sample wedding on
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

/* ── the run-of-show shape: ONE moment, THREE parallel tasks, TWO places ─────────────────────────────────────── */

export const LAB_MOMENT: MomentLike & { label: string } = {
  block_id: '00000000-0000-4000-8000-0000000000m1',
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
