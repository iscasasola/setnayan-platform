/**
 * ⏰ THE LAB'S DAY AS STUDIO › MOOD BOARD & DRESS CODE'S GUESTS ROW READS IT (`arrival`, `lib/guests-arrive.ts`, 2026-10-19) —
 * Studio › Schedule's lab day (`studio-lab-fixtures.tsx` `DAY`, maria-and-jose's date), typed: the arrival moment is the
 * Guests' call time. A plain module (the fixtures file is a client one, which a server page cannot call).
 * `none` = the programme opens on the Ceremony (no arrival yet → "Set when guests arrive").
 */
export const LAB_ARRIVAL_DATE = '2026-12-12';

const DAY: Array<[id: string, label: string, type: string, start: string, end: string | null, audience?: string]> = [
  ['m-photos', 'Entourage photos', 'custom', '14:00', '14:30', 'entourage'],
  ['m-arrive', 'Guests arrive by', 'pre_ceremony', '14:30', '15:00'],
  ['m-ceremony', 'Ceremony', 'ceremony', '15:00', '16:00'],
  ['m-cocktails', 'Cocktails', 'cocktails', '17:30', '18:30'],
  ['m-dinner', 'Dinner & dancing', 'reception', '19:00', '22:00'],
  ['m-sendoff', 'Send-off', 'send_off', '22:00', '22:30'],
];

export function labArrivalBlocks(none = false) {
  return DAY.filter(([id]) => !(none && id === 'm-arrive')).map(([id, label, type, start, end, audience], i) => ({
    block_id: id,
    label,
    block_type: type,
    start_at: `${LAB_ARRIVAL_DATE}T${start}:00.000Z`,
    end_at: end ? `${LAB_ARRIVAL_DATE}T${end}:00.000Z` : null,
    is_public: true,
    sort_order: i,
    parent_block_id: null,
    audience: audience ?? null,
  }));
}
