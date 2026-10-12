import { DoorShell } from '@/app/_components/door/door-shell';
import { hubDoorSkin } from '@/app/[slug]/invite/_components/hub-door-skin';
import { EDITOR_CANVAS_HIDES_APP_CHROME } from '@/app/[slug]/_lib/editor-canvas';
import type { EventWords } from '@/app/[slug]/_lib/event-words';
import type { GuestRow } from '@/app/[slug]/_lib/types';
import { RsvpLookStyle } from '@/app/[slug]/_components/rsvp-look-style';
import { RsvpWidget } from '@/app/[slug]/_components/rsvp-widget';
import { rsvpScreenLayout, type readRsvpLook } from '@/lib/rsvp-look';

/**
 * 🚪 THE LAB'S REPLY PAGE, AS A GUEST WALKS IT (`/dev/maker-lab/guest?rsvp=form&door=1`) — `invite/reply` without a
 * database: the real door (`DoorShell` + `hubDoorSkin`, the progress slot under the mark) and the real card for a
 * guest — nothing drawn ahead of its answer, the tagging question asked, one question at a time — so every step of
 * both paths can be walked and pictured (the owner's live faults of 2026-10-12: "1 of 3" → "2 of 4", and screen 2's
 * grey italic answers). The lab's own words and look are handed in by the lab page.
 *
 *   `&ask=all` every question on (else the owner's own event's: mobile and plus-ones) · `&plus=<n>` seats ·
 *   `&scene=question|ticket` · `&look=<json>` a stored look.
 *
 * Never press Send: the lab's save is the real one.
 */
export function LabReplyDoor({
  sp,
  words,
  look,
  config,
  board,
  guest,
  reply,
}: {
  sp: Record<string, string | string[] | undefined>;
  words: EventWords;
  look: ReturnType<typeof readRsvpLook>;
  config: unknown;
  board: readonly string[];
  guest: GuestRow;
  reply: (formData: FormData) => Promise<void>;
}) {
  const plus = Math.max(0, Math.min(4, Number(sp.plus) || 0));
  const sceneStyle = sp.scene === 'question' || sp.scene === 'ticket' ? sp.scene : null;
  return (
    <>
      <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
      <DoorShell
        brand="foot"
        eyebrow="You’re invited"
        title="Maria & Jose"
        titleIsNames
        meta="Saturday, December 12, 2026 · Seda Vertis North"
        width="lg"
        skin={hubDoorSkin({ mark: null, monogram: 'M & J' })}
        lead={<div data-rsvp-progress-slot="" />}
      >
        <p hidden data-rsvp-context-line="" className="truncate text-sm text-ink/70">
          Maria &amp; Jose · for Teresita Aquino
        </p>
        <div data-rsvp-context="">
          <p className="font-serif text-lg text-ink" data-reply-for="">
            Teresita Aquino
          </p>
        </div>
        <RsvpWidget
          words={words}
          guest={{ ...guest, plus_one_allowed: plus > 0, plus_one_count: plus } as GuestRow}
          eventId="lab"
          eventPublicId="lab"
          faceMode="mode_b"
          doorAction={reply}
          askTagging
          ask={sp.ask === 'all' ? {} : { meal: false, dietary: false, note: false, song_request: false, mobile: true, plus_ones: true }}
          termsOnSend
          oneAtATime
          sceneStyle={sceneStyle}
          answerWords={{ attending: 'Joyfully accepts', declined: 'Sadly can’t make it' }}
          lines={rsvpScreenLayout(look, 'rsvp')}
        />
      </DoorShell>
      <RsvpLookStyle config={config} board={board} parts={['rsvp']} />
    </>
  );
}
