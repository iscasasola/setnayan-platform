import type { EventTableRow } from '@/lib/seating';
import type { Lab3DBooth } from '@/lib/seating-3d';

/** 🧪 `?part=seatview` fake room — four tables and one booked supplier's booth (lab data only). */
export const LAB_SEAT_TABLES: EventTableRow[] = [
  ['Sponsors', 'round_10', 30, 30],
  ['Family', 'round_10', 70, 30],
  ['Barkada', 'round_8', 30, 62],
  ['Choir', 'round_8', 70, 62],
].map(([label, type, x, y], i) => ({
  table_id: `lab-t-${i}`,
  public_id: `S89T-LAB000000${i}`,
  event_id: 'lab',
  table_label: label as string,
  table_type: type as EventTableRow['table_type'],
  capacity: type === 'round_10' ? 10 : 8,
  sort_order: i,
  x_pos: x as number,
  y_pos: y as number,
}));

export const LAB_SEAT_BOOTHS: Lab3DBooth[] = [
  {
    id: 'lab-booth-0',
    kind: 'live_cooking',
    label: 'Lechon station',
    xPct: 6,
    yPct: 62,
    offerings: 'Lechon de leche, carved at the station',
    cardItems: null,
    vendor: { name: 'Lab Lechon House', category: 'catering', logoUrl: null, tier: 'pro', slug: null, bookable: false, boothAddonActive: false },
  } as Lab3DBooth,
];

