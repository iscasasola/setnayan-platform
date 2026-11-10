/**
 * lib/home-control-fixture.ts — THE PROTOTYPE'S OWN SAMPLE for Home's control row (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html` "Guessed (not measured)": 51 days · 96 coming · 35 no reply · 131 on the
 * list · 2 of 6 · 1 quote · ₱120,450 / ₱44,550 · ₱8,000 three days late · 3 open · 62% done).
 *
 * ONE fixture, read by the dev lab (`/dev/home-lab`) and by the guards that render Home — so the lab and the tests can
 * never draw two different Homes. Sample data only: nothing here is ever shown to a real event.
 */
import type { HomeControlInput, HomePayLine } from '@/app/dashboard/[eventId]/_components/home-control-faces';
import { pickHomeNext, type HomeNext } from '@/lib/home-first-screen';
import type { HomeScheduleFacts } from '@/lib/home-schedule';

const DAY = 86_400_000;
/** A calendar day `days` from `now` (yyyy-mm-dd). */
export function fixtureDay(days: number, now = Date.now()): string {
  return new Date(now + days * DAY).toISOString().slice(0, 10);
}

/** The four payments the prototype draws — they sum to the ₱44,550 owing. */
export function fixturePays(now = Date.now()): HomePayLine[] {
  return [
    { id: 'li-1', vendorId: 'v-lumiere', who: 'Lumière Catering', what: 'First payment', owedPhp: 8000, dueDate: fixtureDay(-3, now), days: -3, state: 'overdue' },
    { id: 'li-2', vendorId: 'v-taal', who: 'Taal Vista', what: 'Balance · second half', owedPhp: 22275, dueDate: fixtureDay(4, now), days: 4, state: 'due_soon' },
    { id: 'li-3', vendorId: 'v-bloom', who: 'Bloom & Vine', what: 'Balance', owedPhp: 6500, dueDate: fixtureDay(13, now), days: 13, state: 'upcoming' },
    { id: 'li-4', vendorId: 'v-ocho', who: 'Studio Ocho', what: 'Balance', owedPhp: 7775, dueDate: fixtureDay(25, now), days: 25, state: 'upcoming' },
  ];
}

const INVITE_NEXT: HomeNext = pickHomeNext({ guide: null, hasDate: true, guests: { total: 131, unsent: 35 }, noun: 'wedding', papicReady: false, aiOffer: false });
/** What the picker says when the guest read failed — "We couldn't read your guest list", never "on track". */
const UNREAD_NEXT: HomeNext = pickHomeNext({ guide: null, hasDate: true, guests: null, noun: 'wedding', papicReady: false, aiOffer: false });

/** Every widget, every read measured — the prototype's clean frame. `over` replaces any widget's facts. */
export function fixtureControl(eventId: string, over: Partial<HomeControlInput> = {}, now = Date.now()): HomeControlInput {
  return {
    eventId,
    next: INVITE_NEXT,
    countdown: { value: '51', label: 'days to go', days: 51, hasDate: true, long: 'Saturday, December 12, 2026', placeLine: 'Tagaytay' },
    guests: { coming: 96, noReply: 35, toInvite: 35, declined: 4, total: 131 },
    hub: {
      stage: 'rsvp',
      publicUrl: 'https://setnayan.com/ana-and-miguel',
      where: 'setnayan.com/ana-and-miguel · Public',
      dayShort: 'Dec 12',
      guide: { stageTitle: 'The Day', left: 2, done: 9, total: 20 },
    },
    suppliers: { booked: 2, of: 6, toDecide: [{ name: 'Lumière Catering', vendorId: 'v-lumiere' }], replied: 2 },
    budget: { paidPhp: 120450, owingPhp: 44550, pays: fixturePays(now) },
    checklist: {
      done: 62,
      total: 100,
      open: 3,
      dueThisWeek: 1,
      next: [
        { id: 't1', tick: { kind: 'task', id: 't1' }, title: 'Confirm the caterer’s menu', dueDate: fixtureDay(4, now), daysUntilDue: 4 },
        { id: 't2', tick: { kind: 'task', id: 't2' }, title: 'Final headcount to the venue', dueDate: fixtureDay(20, now), daysUntilDue: 20 },
        { id: 't3', tick: { kind: 'task', id: 't3' }, title: 'Choose the entourage’s colours', dueDate: fixtureDay(27, now), daysUntilDue: 27 },
      ],
    },
    ...over,
  };
}

/** The prototype's "guests + money reads failed" frame — every read that can fail, failed. */
export function fixtureControlUnread(eventId: string, over: Partial<HomeControlInput> = {}): HomeControlInput {
  return fixtureControl(eventId, { next: UNREAD_NEXT, guests: 'unread', hub: 'unread', suppliers: 'unread', budget: 'unread', checklist: 'unread', ...over });
}

/**
 * 👻 A NEW EVENT, EVERY READ ANSWERED AND EMPTY (Build 5 Lane H, prototype `empty_looks_user_event_2026-11-10/` frame
 * "Event · Today"): no guests, no Hub stage, nothing booked or agreed, no plan seeded, no chapters. Each widget draws
 * its honest face AND its greyed Example — the opposite of `fixtureControlUnread`, which must draw none.
 */
export function fixtureControlEmpty(eventId: string, over: Partial<HomeControlInput> = {}): HomeControlInput {
  return fixtureControl(eventId, {
    next: pickHomeNext({ guide: null, hasDate: false, guests: { total: 0, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false }),
    countdown: { value: '—', label: 'no date yet', days: null, hasDate: false, long: null, placeLine: null },
    guests: { coming: 0, noReply: 0, toInvite: 0, declined: 0, total: 0 },
    hub: { stage: null, publicUrl: null, where: 'No address yet', dayShort: null, guide: null },
    suppliers: { booked: 0, of: 6, toDecide: [], replied: 0 },
    budget: { paidPhp: 0, owingPhp: 0, pays: [] },
    checklist: { done: 0, total: 0, open: 0, dueThisWeek: 0, next: [] },
    schedule: { chapters: 0, now: [], next: [], then: [], toApprove: 0, needYou: 0, oweTimes: 0, pro: false },
    ...over,
  });
}

/**
 * 📅 THE SCHEDULE WIDGET'S SAMPLE — the approved prototype's own lines (`home_frames_where_you_act_2026-11-01/`, its
 * "Pretend it is" states; labelled there as sample data): 40 days out, one week out, the day at 9:15 AM.
 */
export type FixtureSchedulePhase = 'before' | 'week' | 'day';
export function fixtureSchedule(phase: FixtureSchedulePhase, pro = false): HomeScheduleFacts & { pro: boolean } {
  const doors = { toApprove: 2, needYou: 3, oweTimes: 6, pro };
  if (phase === 'day') {
    return {
      chapters: 7,
      now: [
        { chapterId: 'c-prep-bride', k: 'Preparation · Bride', v: '9:00 AM · Hair and makeup · Maria' },
        { chapterId: 'c-prep-groom', k: 'Preparation · Groom', v: '9:30 AM · Suit · Jose' },
      ],
      next: [{ chapterId: 'c-ceremony', k: 'Ceremony', v: '2:00 PM · San Agustin Church' }],
      then: [],
      ...doors,
    };
  }
  if (phase === 'week') {
    return {
      chapters: 7,
      now: [],
      next: [{ chapterId: 'c-rehearsal', k: 'Rehearsal', v: 'Fri, Dec 11 · 4:00 PM · San Agustin Church' }],
      then: [{ chapterId: 'c-prep-bride', k: 'Preparation · Bride', v: 'Sat, Dec 12 · 9:00 AM · Seda Vertis North · Floor 14' }],
      ...doors,
    };
  }
  return {
    chapters: 7,
    now: [],
    next: [{ chapterId: 'c-tasting', k: 'Food tasting', v: 'Sat, Nov 7 · 2:00 PM · Hain Catering' }],
    then: [{ chapterId: 'c-fitting', k: 'Final fitting · Maria', v: 'Sat, Nov 21 · 10:00 AM' }],
    ...doors,
  };
}
