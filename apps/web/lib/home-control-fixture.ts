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

const DAY = 86_400_000;
/** A calendar day `days` from `now` (yyyy-mm-dd). */
export function fixtureDay(days: number, now = Date.now()): string {
  return new Date(now + days * DAY).toISOString().slice(0, 10);
}

/** The four payments the prototype draws — they sum to the ₱44,550 owing. */
export function fixturePays(now = Date.now()): HomePayLine[] {
  return [
    { id: 'li-1', vendorId: 'v-lumiere', who: 'Lumière Catering', what: 'Deposit', owedPhp: 8000, dueDate: fixtureDay(-3, now), days: -3, state: 'overdue' },
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
    suppliers: { booked: 2, of: 6, toDecide: [{ name: 'Lumière Catering', vendorId: 'v-lumiere', tile: 'catering' }], replied: 2 },
    budget: { paidPhp: 120450, owingPhp: 44550, pays: fixturePays(now) },
    checklist: {
      done: 62,
      total: 100,
      open: 3,
      dueThisWeek: 1,
      next: [
        { id: 't1', title: 'Confirm the caterer’s menu', dueDate: fixtureDay(4, now), daysUntilDue: 4 },
        { id: 't2', title: 'Final headcount to the venue', dueDate: fixtureDay(20, now), daysUntilDue: 20 },
        { id: 't3', title: 'Choose the entourage’s colours', dueDate: fixtureDay(27, now), daysUntilDue: 27 },
      ],
    },
    ...over,
  };
}

/** The prototype's "guests + money reads failed" frame — every read that can fail, failed. */
export function fixtureControlUnread(eventId: string, over: Partial<HomeControlInput> = {}): HomeControlInput {
  return fixtureControl(eventId, { next: UNREAD_NEXT, guests: 'unread', hub: 'unread', suppliers: 'unread', budget: 'unread', checklist: 'unread', ...over });
}
