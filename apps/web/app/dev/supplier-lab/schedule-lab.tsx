import { buildSupplierDay, changedSinceSeen, type SupplierBlockRow, type SupplierRequestRow } from '@/lib/supplier-schedule';
import { SupplierSchedule } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule';

/**
 * 🤝 `/dev/supplier-lab?s=schedule` — the supplier's part of the schedule (Step 4b) on a lab wedding: Lumina Studio
 * (photo + video), booked for Preparation · Bride and the Ceremony; the Reception is another supplier's. Fake data, doors
 * that write nothing (`lab`). States: `&state=week` (the final week: Confirm my times) · `confirmed` · `auto` (the host
 * chose Auto-agree) · `seen` (nothing new since Seen) · `unlinked` (no chapter linked yet) · `fail` (the read failed).
 */
const ME = 'ev-lumina';
const T = (hhmm: string, day = '2026-12-18') => `${day}T${hhmm}:00.000Z`;

const BLOCKS: SupplierBlockRow[] = [
  { block_id: 'prep', parent_block_id: null, label: 'Preparation · Bride', start_at: T('10:00'), end_at: T('13:00'), location: 'Seda Vertis North', spot: 'Bridal suite, 14F', time_tba: false, is_optional: false, responsible_vendor_ids: [ME, 'ev-glam'], created_at: T('08:00', '2026-11-01'), updated_at: T('09:00', '2026-11-02') },
  { block_id: 'p1', parent_block_id: 'prep', label: 'Detail shots: dress, rings, shoes', start_at: T('10:00'), end_at: T('10:45'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'p2', parent_block_id: 'prep', label: 'Hair and make-up', start_at: T('10:30'), end_at: T('12:30'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['ev-glam'], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'p3', parent_block_id: 'prep', label: 'Father’s reveal', start_at: T('12:40'), end_at: T('12:55'), location: null, spot: null, time_tba: false, is_optional: true, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'cer', parent_block_id: null, label: 'Ceremony', start_at: T('15:00'), end_at: T('16:15'), location: 'San Vicente Parish', spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'c1', parent_block_id: 'cer', label: 'Processional', start_at: T('15:00'), end_at: T('15:15'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'c2', parent_block_id: 'cer', label: 'Family photos at the altar', start_at: T('16:00'), end_at: T('16:15'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'rec', parent_block_id: null, label: 'Reception', start_at: T('18:00'), end_at: T('22:00'), location: 'Seda Vertis North', spot: 'Ballroom', time_tba: false, is_optional: false, responsible_vendor_ids: ['ev-band'], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  // A Time-TBA chapter Lumina is on: listed "Time TBA", never hidden, no call time (owner 2026-11-02). Stored at 00:00 = its day only.
  { block_id: 'send', parent_block_id: null, label: 'Send-off', start_at: T('00:00'), end_at: null, location: null, spot: null, time_tba: true, is_optional: false, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 's1', parent_block_id: 'send', label: 'Sparkler exit photos', start_at: T('00:00'), end_at: null, location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [ME], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
  { block_id: 'r1', parent_block_id: 'rec', label: 'First dance', start_at: T('19:30'), end_at: T('19:40'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['ev-band'], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') },
];

const REQUESTS: SupplierRequestRow[] = [
  { suggestion_id: 'w1', block_id: null, kind: 'new', proposed_label: 'Lumina arrives', proposed_start_at: T('14:00'), proposed_end_at: T('14:30'), proposed_parent_block_id: 'cer', proposed_crew: null, note: 'Lumina arrives', status: 'open', created_at: T('09:00', '2026-11-02') },
  { suggestion_id: 'w2', block_id: 'r1', kind: 'adjust', proposed_label: null, proposed_start_at: null, proposed_end_at: null, proposed_parent_block_id: null, proposed_crew: null, note: 'Could the first dance wait 5 minutes for the light?', status: 'open', created_at: T('09:10', '2026-11-02') },
  { suggestion_id: 'a1', block_id: null, kind: 'new', proposed_label: 'Bridal portraits', proposed_start_at: null, proposed_end_at: null, proposed_parent_block_id: 'prep', proposed_crew: null, note: 'x', status: 'accepted', created_at: T('09:00', '2026-11-01') },
];

export function ScheduleLab({ state }: { state?: string }) {
  const unlinked = state === 'unlinked';
  const day = buildSupplierDay({
    blocks: unlinked ? BLOCKS.map((b) => ({ ...b, responsible_vendor_ids: b.responsible_vendor_ids.filter((id) => id !== ME) })) : BLOCKS,
    myBookingIds: [ME],
    tasks: [
      { block_id: 'p1', vendor_id: ME, crew: 'Team A' },
      { block_id: 'c2', vendor_id: ME, crew: 'Team A' },
      { block_id: 'c2', vendor_id: ME, crew: 'Second shooter' },
    ],
    requests: unlinked ? [] : REQUESTS,
  });
  const seenAt = state === 'seen' || state === 'confirmed' ? T('12:00', '2026-11-02') : T('00:00', '2026-11-02');
  return (
    <main className="min-h-screen bg-cream px-4 pb-40 pt-6 text-ink">
      <h1 className="mb-4 text-xl font-semibold">Schedule · Cale &amp; Ice</h1>
      <SupplierSchedule
        eventId="lab"
        lab
        day={state === 'fail' ? null : day}
        autoAgree={state === 'auto'}
        marks={{ seenAt, confirmedAt: state === 'confirmed' ? T('12:00', '2026-12-12') : null }}
        changed={changedSinceSeen(day.stamps, seenAt)}
        finalWeek={state === 'week' || state === 'confirmed'}
        tasksRead
        answered={unlinked ? [] : REQUESTS.filter((r) => r.status !== 'open')}
      />
    </main>
  );
}
