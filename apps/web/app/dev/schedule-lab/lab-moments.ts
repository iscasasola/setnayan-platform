/**
 * The Schedule lab's day — the prototype's moments (`schedule_redesign_2026-09-25.html`) as fixture rows. A plain
 * module (no `'use client'`), so a server lab can read the SAME moments: the Suppliers lab derives its Team rows' call
 * times from them (`earliestTaggedBlock`), exactly as the page derives them from the real Schedule.
 */
import type { DayMoment } from '@/app/dashboard/[eventId]/schedule/_components/day-types';

export const PLAN_DATE = '2026-12-18';

type Seed = [
  id: string,
  label: string,
  type: DayMoment['block_type'],
  start: string,
  end: string | null,
  pub: boolean,
  extra?: Partial<DayMoment>,
];

export const SEEDS: Seed[] = [
  ['hmua', 'Hair & makeup', 'pre_ceremony', '08:00', '12:00', false, { responsible_vendor_ids: ['v-kat'], responsible_party: 'HMUA team', location: 'Bridal suite, Peninsula Manila', notes: 'Claire first, then the entourage. Mom at 10:30 AM.' }],
  ['ingress', 'Supplier ingress & styling', 'pre_ceremony', '10:00', '13:00', false, { responsible_vendor_ids: ['v-gaia'], location: 'San Agustin Church · Grand ballroom' }],
  ['arrive', 'Guests arrive', 'pre_ceremony', '13:30', '14:00', true, { location: 'San Agustin Church, Intramuros', notes: 'Ushers at both doors. Programs on the pews.' }],
  ['cer', 'Ceremony', 'ceremony', '14:00', '15:30', true, { responsible_vendor_ids: ['v-planner'], responsible_party: 'Coordinator', location: 'San Agustin Church, Intramuros', notes: 'Unplugged ceremony — ushers remind at the door.' }],
  ['cer-1', 'Procession', 'ceremony', '14:00', null, true, { parent_block_id: 'cer' }],
  ['cer-2', 'Vows & rings', 'ceremony', '14:25', null, true, { parent_block_id: 'cer' }],
  ['cer-3', 'Recessional', 'ceremony', '15:15', null, true, { parent_block_id: 'cer' }],
  ['cock', 'Cocktails', 'cocktails', '16:00', '17:00', true, { responsible_vendor_ids: ['v-casa'], responsible_party: 'Casa Catering', location: 'Garden terrace' }],
  ['rec', 'Reception & dinner', 'reception', '17:00', '19:30', true, { location: 'Grand ballroom' }],
  ['prog', 'Program', 'program', '19:30', '21:00', true, { responsible_party: 'Host / MC' }],
  ['dance', 'First dance', 'dancing', '21:00', '21:20', false, { notes: 'Song: "Ikaw" — band has the arrangement.' }],
  ['send', 'Send-off', 'send_off', '22:00', '22:30', true, { responsible_party: 'Coordinator', location: 'Driveway, main entrance' }],
];

/**
 * The seeded day. `tags` re-tags moments (moment id → the suppliers responsible) — the Suppliers lab tags its own
 * booked suppliers so its Schedule part and its Team rows agree.
 */
export function seedMoments(dateKey: string, nowMin: number | null, tags?: Readonly<Record<string, readonly string[]>>): DayMoment[] {
  return SEEDS.map(([id, label, type, start, end, pub, extra]) => {
    const startAt = `${dateKey}T${start}:00.000Z`;
    const endAt = end ? `${dateKey}T${end}:00.000Z` : null;
    const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
    const e = end ? Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) : s + 30;
    const run_state: DayMoment['run_state'] =
      nowMin === null ? 'upcoming' : e <= nowMin ? 'done' : s <= nowMin ? 'live' : 'upcoming';
    return {
      block_id: id,
      label,
      block_type: type,
      start_at: startAt,
      end_at: endAt,
      location: null,
      notes: null,
      is_public: pub,
      parent_block_id: null,
      run_state,
      staged: false,
      responsible_party: null,
      responsible_vendor_ids: [],
      ...extra,
      ...(tags ? { responsible_vendor_ids: [...(tags[id] ?? [])] } : {}),
    };
  });
}

