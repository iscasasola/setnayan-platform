/**
 * 🧪 `&chapters=1` — the Step 5 lab: maria-and-jose's INVITATION BY CHAPTER, fake data only (no database).
 * Ceremony (timed, a venue) · Reception (no venue yet — "Venue TBA") · After party (Time TBA), and on the Schedule each
 * chapter's moments — public ones, plus a private one and an Entourage-only one that the part must never draw.
 *   `&chapters=partial` — the guest is coming to the Ceremony only (Reception: can't make it), After party new.
 *   `&notices=1` (with `&chapters=…`) — the after-invites notices: After party added, "Rehearsal dinner" taken off.
 */
import { invitationChapters, type StoredChapterReply } from '@/lib/invitation-chapters';

const C = (id: string) => `00000000-0000-4000-8000-00000000${id}`;
export const LAB_CH = { ceremony: C('0c01'), reception: C('0c02'), after: C('0c03'), rehearsal: C('0c04') };

const row = (over: Record<string, unknown>) => ({
  public_id: 'lab', event_id: 'lab', block_type: 'custom', end_at: null, location: null, notes: null, is_public: true,
  sort_order: 0, parent_block_id: null, created_at: '2026-10-01T00:00:00Z', run_state: 'upcoming', actual_start_at: null,
  actual_end_at: null, audience: null, time_tba: false, on_invitation: false, spot: null, ...over,
});

export const LAB_INVITE_BLOCKS = [
  row({ block_id: LAB_CH.ceremony, label: 'Ceremony', start_at: '2026-12-12T15:00:00Z', end_at: '2026-12-12T16:30:00Z', location: 'Santuario de San Antonio', on_invitation: true, is_public: false }),
  row({ block_id: LAB_CH.reception, label: 'Reception', start_at: '2026-12-12T18:00:00Z', end_at: '2026-12-12T22:00:00Z', on_invitation: true, is_public: false }),
  row({ block_id: LAB_CH.after, label: 'After party', start_at: '2026-12-12T00:00:00Z', location: 'Seda Rooftop', time_tba: true, on_invitation: true, is_public: false }),
  row({ block_id: 'lab-m1', parent_block_id: LAB_CH.ceremony, label: 'Guests arrive', start_at: '2026-12-12T14:30:00Z', location: 'Santuario de San Antonio', block_type: 'pre_ceremony' }),
  row({ block_id: 'lab-m2', parent_block_id: LAB_CH.ceremony, label: 'Processional', start_at: '2026-12-12T15:00:00Z' }),
  row({ block_id: 'lab-m3', parent_block_id: LAB_CH.ceremony, label: 'Family huddle before vows', start_at: '2026-12-12T15:20:00Z', is_public: false }),
  row({ block_id: 'lab-m4', parent_block_id: LAB_CH.ceremony, label: 'Entourage photo call', start_at: '2026-12-12T16:20:00Z', audience: 'entourage' }),
  row({ block_id: 'lab-m5', parent_block_id: LAB_CH.reception, label: 'Grand entrance', start_at: '2026-12-12T18:30:00Z' }),
  row({ block_id: 'lab-m6', parent_block_id: LAB_CH.reception, label: 'Dinner', start_at: '2026-12-12T19:00:00Z' }),
  row({ block_id: 'lab-m7', parent_block_id: LAB_CH.reception, label: 'First dance', start_at: '2026-12-12T20:30:00Z' }),
];

export const LAB_INVITE_CHAPTERS = invitationChapters(LAB_INVITE_BLOCKS as never);

export function labChapterReplies(mode: unknown): StoredChapterReply[] | null {
  if (mode !== 'partial') return null;
  return [
    { block_id: LAB_CH.ceremony, attending: true, removal_seen_at: null },
    { block_id: LAB_CH.reception, attending: false, removal_seen_at: null },
    { block_id: LAB_CH.rehearsal, attending: true, removal_seen_at: null },
  ];
}

export const LAB_REMOVED = new Map([[LAB_CH.rehearsal, 'Rehearsal dinner']]);
