/**
 * lab-challenges.tsx — `/dev/papic-camera-lab?lane=challenges`: the REAL Challenges-page rows (`ChallengeRow` from
 * studio/papic/couple-challenges-manager.tsx) on fixture missions — a couple's own (swipe-to-delete, owner 2026-11-03
 * "SWIPE LEFT TO DELETE ON EVERY LIST ROW"), a hidden couple's own, and a Setnayan one (no delete). No sign-in, no
 * database: a Delete here reaches the real in-place door after the Undo window and is REFUSED — the row comes back.
 */
import { ChallengeRow, type MissionRow } from '@/app/dashboard/[eventId]/studio/papic/couple-challenges-manager';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

const ROWS: MissionRow[] = [
  { mission_id: 'lab-m1', source: 'couple', prompt: 'Catch the lola dancing', is_active: true, board_slot: 1, capture_kind: 'photo' },
  { mission_id: 'lab-m2', source: 'setnayan', prompt: 'The first look at the cake', is_active: true, board_slot: 2, capture_kind: 'photo' },
  { mission_id: 'lab-m3', source: 'couple', prompt: 'Tell us how you met the couple', is_active: false, board_slot: null, capture_kind: 'clip' },
];

export function LabChallenges() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-cream px-4 pb-24 pt-4" data-lab="papic-challenges">
      <UndoToastHost />
      <ul className="space-y-2">
        {ROWS.map((m) => (
          <ChallengeRow key={m.mission_id} m={m} eventId="lab" armed={{ measured: true, armed: null }} timeZone="Asia/Manila" />
        ))}
      </ul>
    </main>
  );
}
