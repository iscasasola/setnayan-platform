import { buildSupplierDay, changedSinceSeen, type SupplierBlockRow, type SupplierRequestRow } from '@/lib/supplier-schedule';
import { SupplierSchedule } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule';
import type { ScheduleAsk } from '@/lib/schedule-ask';
import { supplierOwnWhere, whereChaptersFrom } from '@/lib/supplier-where';
import { crewElsewhere, type CrewClash, type CrewStint } from '@/lib/crew-elsewhere';

/**
 * 🤝 `/dev/supplier-lab?s=schedule` — the supplier's part of the schedule (Step 4b) on a lab wedding: Lumina Studio
 * (photo + video), booked for Preparation · Bride and the Ceremony; the Reception is another supplier's. Fake data, doors
 * that write nothing (`lab`). States: `&state=week` (the final week: Confirm my times) · `confirmed` · `auto` (the host
 * chose Auto-agree) · `seen` (nothing new since Seen) · `unlinked` (no chapter linked yet) · `fail` (the read failed) ·
 * `hosttag` (👷 the HOST tagged Lumina's crew member Jubert on Glow's "Hair and make-up" from the moment sheet's Suppliers
 * and crew ▾ — the two writes `setMomentFor` makes: Lumina on the moment, and one line for Jubert) · `asked` (🗓 D2: the
 * host and the coordinator each asked Lumina to change a time — Accept / Decline in place) · `locked` (🔒 Lumina
 * locked their times — audit D7; Lock / Unlock write nothing here) · `clash` (🚗 slice 5: Lumina's crews are also booked
 * at Mia & Paolo's in Tagaytay the same day — Team A without time for the drive, the second shooter at the same time; the
 * real rule, `crewElsewhere`, at a lab speed of 30 km/h) · `clashfail` (the other events couldn't be checked). 📍 Where (owner 2026-11-04): every state shows Lumina's
 * own Where dropdown; `wherewait` (their pick waits for the host · Take back) · `askedwhere` (the host asked them to serve
 * the Reception) · `unlinked` (on no chapter: the trade's usual chapters start the dropdown).
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

const ASKED: ScheduleAsk[] = [
  { suggestion_id: 'ask1', block_id: 'p1', vendor_profile_id: 'vp-lumina', suggested_by_name: 'Cale', asked_as: 'host', proposed_start_at: T('09:30'), proposed_end_at: T('10:15'), note: 'Hair starts earlier now — could the detail shots too?', status: 'open', answer_note: null, created_at: T('08:00', '2026-11-02') },
  { suggestion_id: 'ask2', block_id: 'c2', vendor_profile_id: 'vp-lumina', suggested_by_name: 'Ana', asked_as: 'coordinator', proposed_start_at: T('16:10'), proposed_end_at: T('16:25'), note: 'The priest needs ten more minutes.', status: 'open', answer_note: null, created_at: T('08:30', '2026-11-02') },
];

/** 🏛 The shop's second booking on this event — as the Reception venue (lab only). */
const VENUE_BOOKING = 'ev-venue';

/** 🚗 `&state=clash` — the same day at another client of Lumina's, in Tagaytay. */
const QC = { lat: 14.6566, lon: 121.03 };
const TAGAYTAY = { lat: 14.1153, lon: 120.9621 };
function labElsewhere(): Record<string, CrewClash[]> {
  const here: CrewStint[] = [
    { eventId: 'lab', blockId: 'p1', crew: 'Team A', startIso: T('10:00'), endIso: T('10:45'), pin: QC, eventName: 'Cale & Ice' },
    { eventId: 'lab', blockId: 'c2', crew: 'Team A', startIso: T('16:00'), endIso: T('16:15'), pin: QC, eventName: 'Cale & Ice' },
    { eventId: 'lab', blockId: 'c2', crew: 'Second shooter', startIso: T('16:00'), endIso: T('16:15'), pin: QC, eventName: 'Cale & Ice' },
  ];
  const there: CrewStint[] = [
    { eventId: 'mia', blockId: 'x1', crew: 'Team A', startIso: T('12:00'), endIso: T('13:30'), pin: TAGAYTAY, eventName: 'Mia & Paolo' },
    { eventId: 'mia', blockId: 'x2', crew: 'Second shooter', startIso: T('15:30'), endIso: T('17:00'), pin: TAGAYTAY, eventName: 'Mia & Paolo' },
  ];
  return Object.fromEntries(crewElsewhere(here, there, 30));
}

export function ScheduleLab({ state }: { state?: string }) {
  const unlinked = state === 'unlinked';
  const hostTag = state === 'hosttag';
  // 🏛 `&state=venue` — this shop is the VENUE booked to Reception: it sets the chapter's hours. `&state=held` — they are
  // approved and held (2026-11-04).
  const venue = state === 'venue' || state === 'held';
  const blocks = hostTag
    ? BLOCKS.map((b) => (b.block_id === 'p2' ? { ...b, responsible_vendor_ids: [...b.responsible_vendor_ids, ME] } : b))
    : venue
      ? BLOCKS.map((b) =>
          b.block_id === 'rec'
            ? {
                ...b,
                responsible_vendor_ids: [...b.responsible_vendor_ids, VENUE_BOOKING],
                ingress_minutes_before: 300,
                egress_minutes_after: 330,
                hours_vendor_id: state === 'held' ? VENUE_BOOKING : null,
              }
            : b,
        )
      : BLOCKS;
  // 🎭 …and the venue's own setup moment in Reception's Ingress (backstage, 2026-11-04).
  const withSetup = venue
    ? [...blocks, { block_id: 'r0', parent_block_id: 'rec', label: 'Ballroom set-up', start_at: T('14:00'), end_at: T('17:00'), location: null, spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: [VENUE_BOOKING], created_at: T('08:00', '2026-11-01'), updated_at: T('08:00', '2026-11-01') }]
    : blocks;
  const day = buildSupplierDay({
    blocks: unlinked ? BLOCKS.map((b) => ({ ...b, responsible_vendor_ids: b.responsible_vendor_ids.filter((id) => id !== ME) })) : withSetup,
    myBookingIds: venue ? [ME, VENUE_BOOKING] : [ME],
    venueBookingIds: venue ? [VENUE_BOOKING] : [],
    tasks: [
      { block_id: 'p1', vendor_id: ME, crew: 'Team A' },
      { block_id: 'c2', vendor_id: ME, crew: 'Team A' },
      { block_id: 'c2', vendor_id: ME, crew: 'Second shooter' },
      ...(hostTag ? [{ block_id: 'p2', vendor_id: ME, crew: 'Jubert' }] : []),
    ],
    requests: unlinked ? [] : REQUESTS,
  });
  // 📍 Lumina's own Where — the same pure builder the page uses.
  const whereBlocks = unlinked ? BLOCKS.map((b) => ({ ...b, responsible_vendor_ids: b.responsible_vendor_ids.filter((id) => id !== ME) })) : blocks;
  const where = supplierOwnWhere({
    bookings: [{ vendorId: ME, category: 'photographer', status: 'contracted', label: 'Lumina Studio' }],
    chapters: whereChaptersFrom(whereBlocks.map((b) => ({ ...b, block_type: b.block_id === 'prep' ? 'pre_ceremony' : b.block_id === 'cer' ? 'ceremony' : null }))),
    requests:
      state === 'wherewait'
        ? [{ suggestion_id: 'wh1', kind: 'where', status: 'open', direction: 'to_host', where_vendor_id: ME, proposed_block_ids: ['prep', 'cer', 'rec'] }]
        : [],
    tradeDefault: () => ['prep', 'cer'],
  });
  const askedWhere: ScheduleAsk[] = [
    { suggestion_id: 'askw', block_id: null, vendor_profile_id: 'vp-lumina', suggested_by_name: 'Cale', asked_as: 'host', proposed_start_at: null, proposed_end_at: null, note: 'Asks you to work Reception', status: 'open', answer_note: null, created_at: T('08:00', '2026-11-03'), kind: 'where', proposed_block_ids: ['rec'] },
  ];
  const seenAt = state === 'seen' || state === 'confirmed' ? T('12:00', '2026-11-02') : T('00:00', '2026-11-02');
  return (
    <main className="min-h-screen bg-cream px-4 pb-40 pt-6 text-ink">
      <h1 className="mb-4 text-xl font-semibold">Schedule · Cale &amp; Ice</h1>
      <SupplierSchedule
        eventId="lab"
        lab
        day={state === 'fail' ? null : day}
        autoAgree={state === 'auto'}
        marks={{ seenAt, confirmedAt: state === 'confirmed' ? T('12:00', '2026-12-12') : null, lockedAt: state === 'locked' ? T('03:00', '2026-11-02') : null }}
        changed={changedSinceSeen(day.stamps, seenAt)}
        finalWeek={state === 'week' || state === 'confirmed'}
        tasksRead
        answered={unlinked ? [] : REQUESTS.filter((r) => r.status !== 'open')}
        asked={state === 'asked' ? ASKED : state === 'askedwhere' ? askedWhere : state === 'askedfail' ? null : []}
        elsewhere={state === 'clash' ? labElsewhere() : state === 'clashfail' ? null : {}}
        where={state === 'fail' ? null : where}
      />
    </main>
  );
}
