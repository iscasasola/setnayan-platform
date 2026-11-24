'use client';

/**
 * The lab's hub tools — the SHIPPED view (`HubToolPanelsView`) and the SHIPPED sets panel, handed sample rows and an
 * in-memory saver in place of the database, so every press works with no sign-in. The saver runs the dispatcher's own
 * decision (`parseHubToolEntryOp`), so a refusal here is the refusal a live write gets. DEV-ONLY.
 */
import { useMemo, useState } from 'react';
import { HubToolPanelsView, type HubToolReads } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view';
import { SetActionsContext, type SetActions } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/sets-panel';
import { dayQty, minuteQty, parseHubToolEntryOp, swapWithNeighbour, type HubToolEntry, type DietaryRead } from '@/lib/hub-tool-entries';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { VendorSet } from '@/lib/vendor-sets';
import type { Song } from '@/lib/songs';

const uuid = () => crypto.randomUUID();
const e = (label: string, over: Partial<HubToolEntry> = {}): HubToolEntry => ({ id: uuid(), label, note: '', done: false, qty: 0, ...over });

export type LabState =
  | 'band'
  | 'caterer'
  | 'souvenirs'
  | 'empty'
  | 'unread'
  | 'not-food'
  | 'rest'
  | 'rest-empty'
  | 'rest-unread'
  | 'timelines'
  | 'timelines-empty'
  | 'timelines-unread';

/** The free rest · part 1 (24 Nov): three checklists, four per-person sheets, three ordered lists. */
const REST: DayOfModuleId[] = [
  'ceremony_details',
  'proofs_and_approval',
  'safety_permit_and_cue',
  'fittings_and_measurements',
  'looks_per_person',
  'crew_roster',
  'room_list',
  'chair_schedule',
  'reservation_slots',
  'brackets_and_scoring',
];
const REST_ROWS: Record<string, HubToolEntry[]> = {
  ceremony_details: [e('Mass at 3:00 PM', { done: true }), e('Principal sponsors confirmed', { done: true }), e('First reading · Tita Lorna'), e('Banns posted')],
  proofs_and_approval: [e('Invitation proof 1', { done: true }), e('Invitation proof 2'), e('Menu card proof')],
  safety_permit_and_cue: [e('Fire permit in hand', { done: true }), e('Safe zone marked · 30 m'), e('Go cue · after the first dance')],
  fittings_and_measurements: [e('Maria Reyes', { note: 'Size M · fitting 2 of 3', done: true }), e('Jose Santos', { note: '40R · 12 Dec' }), e('Ana Cruz', { note: 'Size S · final fitting' })],
  looks_per_person: [e('Claire Santos', { note: 'Soft glam · bride', done: true }), e('Lea Lim', { note: 'Natural' }), e('Ana Cruz', { note: 'Soft glam' })],
  crew_roster: [e('Paolo Dizon', { note: 'Lead · 2:00 PM · chicken', done: true }), e('Jun Reyes', { note: 'Assist · 3:00 PM' })],
  room_list: [e('Claire & Indalecio', { note: 'Suite 1201', done: true }), e('Maria Reyes', { note: '1202' }), e('Jose Santos', { note: '1203' })],
  chair_schedule: [e('Claire Santos', { note: '6:00 AM' }), e('Maria Reyes', { note: '7:00 AM' }), e('Ana Cruz', { note: '7:45 AM' }), e('Lea Lim', { note: '8:30 AM' })],
  reservation_slots: [e('2:00 PM · Santos', { note: '6 people' }), e('3:00 PM · Reyes', { note: '4 people' }), e('4:30 PM · Cruz', { note: '8 people' })],
  brackets_and_scoring: [e('Team Reyes', { note: 'Group A', qty: 12 }), e('Team Santos', { note: 'Group A', qty: 9 }), e('Team Cruz', { note: 'Group B', qty: 7 })],
};

/** The free rest · part 2 (24 Nov): the seven live timelines and the Wellness plan. */
const TIMED: DayOfModuleId[] = [
  'pick_up_times_and_routes',
  'itinerary',
  'serving_times',
  'remembrance_schedule',
  'march_cue_sheet',
  'rehearsal_and_cues',
  'reveal_cue',
  'wellness_plan',
];
/** A sample row at a time of day ("14:00") — written through the one helper, as the live add box writes it. */
const at = (hhmm: string, label: string, over: Partial<HubToolEntry> = {}) => e(label, { qty: minuteQty(hhmm) ?? 0, ...over });
const on = (day: string, label: string, over: Partial<HubToolEntry> = {}) => e(label, { qty: dayQty(day) ?? 0, ...over });
const TIMED_ROWS: Record<string, HubToolEntry[]> = {
  pick_up_times_and_routes: [
    at('13:00', 'Bride · Hotel → Church', { note: 'Car 1 · white sedan', done: true }),
    at('13:30', 'Groom · Home → Church', { note: 'Car 2' }),
    at('16:45', 'Couple · Church → Reception', { note: 'Car 1' }),
  ],
  itinerary: [at('08:15', 'Flight PR 102 lands', { note: 'Terminal 2', done: true }), at('10:00', 'Hotel check-in', { note: 'Shangri-La' }), at('15:00', 'Island tour pick-up')],
  serving_times: [at('18:30', 'Soup course', { done: true }), at('18:50', 'Mains', { note: 'Stations A–C' }), at('19:40', 'Cake cutting'), at('20:00', 'Dessert bar')],
  remembrance_schedule: [at('09:00', 'Viewing opens', { note: 'Chapel 2', done: true }), at('15:00', 'Mass'), at('16:30', 'Cortège leaves'), at('17:15', 'Interment')],
  march_cue_sheet: [
    at('15:00', 'Principal sponsors', { note: 'Canon in D', done: true }),
    at('15:06', 'Secondary sponsors', { note: 'A Thousand Years' }),
    at('15:10', 'Bride', { note: 'Perfect' }),
  ],
  rehearsal_and_cues: [at('14:00', 'Rehearsal · full run', { done: true }), at('20:30', 'Couple’s first dance', { note: 'Perfect · step 3 lift' }), at('21:00', 'Entourage dance')],
  reveal_cue: [at('19:55', 'Countdown starts', { note: 'Emcee' }), at('20:00', 'The reveal', { note: 'Dad triggers the smoke' })],
  wellness_plan: [on('2026-11-14', 'Pilates session', { done: true }), on('2026-11-21', 'Facial'), on('2026-12-05', 'Massage')],
};

const REPERTOIRE: Song[] = [
  { song_id: 1, title: 'Canon in D', artist: 'Pachelbel' },
  { song_id: 2, title: 'A Thousand Years', artist: 'Christina Perri' },
  { song_id: 3, title: 'Perfect', artist: 'Ed Sheeran' },
  { song_id: 4, title: 'Signed, Sealed, Delivered', artist: 'Stevie Wonder' },
  { song_id: 5, title: 'Ikaw', artist: 'Yeng Constantino' },
];
const song = (id: number, position: number) => {
  const s = REPERTOIRE.find((x) => x.song_id === id)!;
  return { setSongId: uuid(), songId: id, title: s.title, artist: s.artist, position };
};
const SETS: VendorSet[] = [
  { setId: 'set-1', position: 1, name: 'Ceremony', slot: 'processional', slotLabel: 'Processional', songs: [song(1, 100), song(2, 200)], missingFromHost: [] },
  { setId: 'set-2', position: 2, name: 'Dinner · slow burn', slot: 'dinner', slotLabel: 'Dinner', songs: [song(5, 100), song(3, 200), song(4, 300)], missingFromHost: ['Through the Years'] },
];

const DIETARY: DietaryRead = {
  state: 'ok',
  withNote: 3,
  meals: [
    { meal: 'chicken', count: 61 },
    { meal: 'fish', count: 44 },
    { meal: 'vegetarian', count: 9 },
  ],
  guests: [
    { id: 'g1', name: 'Ana Cruz', meal: 'fish', dietary: 'Shellfish allergy', table: '4' },
    { id: 'g2', name: 'Paolo Dizon', meal: 'chicken', dietary: 'No pork · halal', table: '7' },
    { id: 'g3', name: 'Lea Lim', meal: 'vegetarian', dietary: 'Nut allergy', table: '2' },
    { id: 'g4', name: 'Jose Santos', meal: 'chicken', dietary: null, table: '7' },
  ],
};

const MODULES: Record<LabState, DayOfModuleId[]> = {
  band: ['tech_rider', 'set_list'],
  caterer: ['dietary_and_allergies', 'quantity_vs_guests'],
  souvenirs: ['personalisation_list', 'quantity_vs_guests'],
  empty: ['tech_rider', 'personalisation_list', 'quantity_vs_guests'],
  unread: ['tech_rider', 'personalisation_list', 'dietary_and_allergies', 'quantity_vs_guests', 'set_list'],
  'not-food': ['dietary_and_allergies'],
  rest: REST,
  'rest-empty': REST,
  'rest-unread': REST,
  timelines: TIMED,
  'timelines-empty': TIMED,
  'timelines-unread': TIMED,
};

/** The lab's groups of entry tools: which modules, and their sample rows. */
const GROUPS: Partial<Record<LabState, { modules: DayOfModuleId[]; rows: Record<string, HubToolEntry[]>; fill: 'rows' | 'empty' | 'unread' }>> = {
  rest: { modules: REST, rows: REST_ROWS, fill: 'rows' },
  'rest-empty': { modules: REST, rows: REST_ROWS, fill: 'empty' },
  'rest-unread': { modules: REST, rows: REST_ROWS, fill: 'unread' },
  timelines: { modules: TIMED, rows: TIMED_ROWS, fill: 'rows' },
  'timelines-empty': { modules: TIMED, rows: TIMED_ROWS, fill: 'empty' },
  'timelines-unread': { modules: TIMED, rows: TIMED_ROWS, fill: 'unread' },
};

function readsFor(state: LabState): HubToolReads {
  const group = GROUPS[state];
  if (group) {
    const entries = new Map(
      group.modules.map((k) => [
        k as string,
        group.fill === 'unread' ? { state: 'unread' as const } : { state: 'ok' as const, entries: group.fill === 'rows' ? group.rows[k] ?? [] : [] },
      ]),
    );
    return { entries, dietary: null, setList: null };
  }
  if (state === 'unread') {
    const u = { state: 'unread' as const };
    return { entries: new Map([['tech_rider', u], ['personalisation_list', u], ['quantity_vs_guests', u]]), dietary: u, setList: u };
  }
  const empty = state === 'empty';
  return {
    entries: new Map([
      ['tech_rider', { state: 'ok' as const, entries: empty ? [] : [e('2× wireless mic', { done: true }), e('Power 220V near the stage', { done: true }), e('Sound check · 3:00 PM'), e('Two monitor speakers')] }],
      ['personalisation_list', { state: 'ok' as const, entries: empty ? [] : [e('Maria Reyes', { note: '“Ninang Maria” · gold script', done: true }), e('Jose Santos', { note: 'J.S. · 12.12.26' }), e('Ana Cruz', { note: 'Ana · lavender tag' })] }],
      ['quantity_vs_guests', { state: 'ok' as const, entries: empty ? [] : state === 'caterer' ? [e('Plates out', { qty: 96 }), e('Desserts', { qty: 142 })] : [e('Giveaways', { qty: 120 })] }],
    ]),
    dietary: state === 'not-food' ? { state: 'not_food' } : DIETARY,
    setList: { state: 'ok', sets: SETS, repertoire: REPERTOIRE },
  };
}

/** The dispatcher's decision, in memory: refuses what the live one refuses, saves the rest. */
async function labSave(_eventId: string, input: unknown) {
  const parsed = parseHubToolEntryOp(input);
  if (!parsed.ok) return parsed;
  await new Promise((r) => setTimeout(r, 120));
  return parsed.op.op === 'add' ? { ok: true as const, entryId: uuid() } : { ok: true as const };
}

export function LabHubTools({ state, attending }: { state: LabState; attending: number | null }) {
  const reads = useMemo(() => readsFor(state), [state]);
  const [sets, setSets] = useState<VendorSet[]>(SETS);
  const ok = async () => ({ ok: true });
  const setActions: SetActions = {
    createVendorEventSet: async (_e, name, slotType) => {
      setSets((s) => [...s, { setId: uuid(), position: s.length + 1, name, slot: slotType as VendorSet['slot'], slotLabel: slotType, songs: [], missingFromHost: [] }]);
      return ok();
    },
    deleteVendorEventSet: async (_e, setId) => {
      setSets((s) => s.filter((x) => x.setId !== setId));
      return ok();
    },
    addSongToVendorEventSet: async (_e, setId, songId) => {
      setSets((s) => s.map((x) => (x.setId === setId ? { ...x, songs: [...x.songs, song(songId, (x.songs.at(-1)?.position ?? 0) + 100)] } : x)));
      return ok();
    },
    updateVendorEventSet: async (_e, setId, patch) => {
      setSets((s) =>
        s.map((x) => {
          if (x.setId !== setId) return x;
          if (patch.removeSong) return { ...x, songs: x.songs.filter((y) => y.setSongId !== patch.removeSong) };
          if (patch.moveSong) {
            const sw = swapWithNeighbour(x.songs.map((y) => ({ id: y.setSongId, position: y.position })), patch.moveSong.setSongId, patch.moveSong.dir);
            if (!sw) return x;
            const pos = new Map([[sw.a.id, sw.a.position], [sw.b.id, sw.b.position]]);
            const songs = x.songs.map((y) => ({ ...y, position: pos.get(y.setSongId) ?? y.position })).sort((p, q) => p.position - q.position);
            return { ...x, songs };
          }
          return { ...x, name: patch.name ?? x.name };
        }),
      );
      return ok();
    },
  };
  const live: HubToolReads = reads.setList?.state === 'ok' ? { ...reads, setList: { ...reads.setList, sets } } : reads;
  return (
    <SetActionsContext.Provider value={setActions}>
      <HubToolPanelsView eventId="00000000-0000-4000-8000-00000000e001" modules={MODULES[state]} attending={attending} reads={live} save={labSave} />
    </SetActionsContext.Provider>
  );
}
