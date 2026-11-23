'use client';

/**
 * The lab's hub tools — the SHIPPED view (`HubToolPanelsView`) and the SHIPPED sets panel, handed sample rows and an
 * in-memory saver in place of the database, so every press works with no sign-in. The saver runs the dispatcher's own
 * decision (`parseHubToolEntryOp`), so a refusal here is the refusal a live write gets. DEV-ONLY.
 */
import { useMemo, useState } from 'react';
import { HubToolPanelsView, type HubToolReads } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view';
import { SetActionsContext, type SetActions } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/sets-panel';
import { parseHubToolEntryOp, swapWithNeighbour, type HubToolEntry, type DietaryRead } from '@/lib/hub-tool-entries';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { VendorSet } from '@/lib/vendor-sets';
import type { Song } from '@/lib/songs';

const uuid = () => crypto.randomUUID();
const e = (label: string, over: Partial<HubToolEntry> = {}): HubToolEntry => ({ id: uuid(), label, note: '', done: false, qty: 0, ...over });

export type LabState = 'band' | 'caterer' | 'souvenirs' | 'empty' | 'unread' | 'not-food';

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
};

function readsFor(state: LabState): HubToolReads {
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
