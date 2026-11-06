/**
 * lab-playlist.tsx — `/dev/schedule-lab?view=playlist`: the REAL playlist moment sections (`PlaylistSlotSection` →
 * `PlaylistPickRow`) on fixture picks, so the pick row's swipe-to-delete (owner 2026-11-03, "SWIPE LEFT TO DELETE ON
 * EVERY LIST ROW") can be seen at 390 px with no sign-in and no database. A delete here reaches the real action after
 * the Undo window and is REFUSED (no sign-in) — the row comes back and says so. DEV-ONLY (the page 404s in production).
 */
import { PlaylistSlotSection } from '@/app/dashboard/[eventId]/studio/playlist/_components/playlist-slot-section';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PLAYLIST_SLOT_HINTS, PLAYLIST_SLOT_LABELS, type PlaylistPickRow, type PlaylistSlotType } from '@/lib/playlist';

const at = '2026-10-01T00:00:00Z';
function pick(id: string, slot: PlaylistSlotType, song: string, artist: string | null, notes: string | null = null): PlaylistPickRow {
  return {
    pick_id: id,
    public_id: id,
    event_id: 'lab',
    slot_type: slot,
    song_label: song,
    artist,
    notes,
    sort_order: 0,
    created_by_user_id: 'lab',
    created_at: at,
    updated_at: at,
    song_id: null,
  };
}

const FIRST_DANCE = [
  pick('lab-p1', 'first_dance', 'Perfect', 'Ed Sheeran', 'Start at the second verse'),
  pick('lab-p2', 'first_dance', 'Ikaw', 'Yeng Constantino'),
];
const BANNED = [pick('lab-p3', 'banned_songs', 'Macarena', 'Los del Río', 'Please, no')];

export function LabPlaylist() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-5 bg-cream px-4 pb-24 pt-3 sm:px-6" data-lab="playlist">
      <UndoToastHost />
      <PlaylistSlotSection
        eventId="lab"
        slotType="first_dance"
        label={PLAYLIST_SLOT_LABELS.first_dance}
        hint={PLAYLIST_SLOT_HINTS.first_dance}
        picks={FIRST_DANCE}
        isBannedSlot={false}
        vibe={null}
      />
      <PlaylistSlotSection
        eventId="lab"
        slotType="banned_songs"
        label={PLAYLIST_SLOT_LABELS.banned_songs}
        hint={PLAYLIST_SLOT_HINTS.banned_songs}
        picks={BANNED}
        isBannedSlot
        vibe={null}
      />
    </main>
  );
}
