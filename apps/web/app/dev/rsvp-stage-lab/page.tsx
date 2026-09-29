/**
 * /dev/rsvp-stage-lab — the Maker's RSVP stage (owner 2026-09-30 re-plan) on
 * fixture data, with no sign-in and no database. DEV-ONLY: production builds
 * 404 this route, the same kill-switch as `/dev/hero-lab`.
 *
 * It draws the REAL `MakerRsvpStage` — its scene list, its kept frames, the
 * REAL `MakerRsvpSettings` by scene — with two stand-ins, said here so a green
 * is not over-read:
 *   · the frames are `/dev/rsvp-stage-lab/frame?scene=…`, which compose the
 *     guest pages' own parts (`DoorShell`, the REAL `RsvpWidget` on the Maker's
 *     all-questions canvas, the REAL `RsvpCanvasBridge`) on a fixture sample —
 *     the real `invite/reply` · `invite/enter` need a signed-in host;
 *   · the saves are dev-only server actions that write nothing
 *     (`actions.ts`) — a real round trip to the dev server, so "saved" is the
 *     stage's own mechanics (the 350 ms batch beat + one request), not the
 *     database's time.
 *
 * `window.__rsvpLab` (see `lab.tsx`) records edit → visible (the frame's text
 * changed) and edit → saved (the save answered) for the timing report.
 *
 *   ?solemn=1   a wake's words
 *   ?fail=1     every draft save is refused (the field goes back, and says so)
 */
import { notFound } from 'next/navigation';
import { RsvpStageLab } from './lab';
import { labRsvpDraftFail, labRsvpDraftSave, labRsvpReplyBy } from './actions';

export default async function RsvpStageLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  return <RsvpStageLab solemn={sp.solemn === '1'} draftAction={sp.fail === '1' ? labRsvpDraftFail : labRsvpDraftSave} replyByAction={labRsvpReplyBy} />;
}
