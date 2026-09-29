import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { CoupleLogo } from '@/app/_components/couple-logo';

/**
 * WHAT A DOOR'S SEAL HOLDS — the couple's LOGO when they have one, their
 * initials when they do not (owner 2026-09-28, looking at the RSVP: the Event
 * Hub hero drew their real logo, made in the Maker's Logo tool, and the door
 * drew a generic "I & C").
 *
 * 🔒 THE MARK ARRIVES SANITISED AND IS DRAWN INERT. `mark` is only ever
 * `heroMarkSvg(event)` — the read-time gate every surface uses
 * (`resolveEventMonogramSvg`) — and it is drawn by `BespokeMonogramMark`, the
 * hero's own renderer: a data-URI `<img>`, which runs no script and fetches
 * nothing. Never `dangerouslySetInnerHTML`.
 *
 * ▶ AND IT PLAYS when it moves and the animation is on (`plays`, from
 * `logoPlaysFor`; owner 2026-09-29, "all logos should animate if animation is
 * active") — through `CoupleLogo`, whose player builds the live tree from an
 * allowlist on the browser's own parse, never raw markup. Everything else: the
 * still `<img>` above, unchanged.
 */
export function SealMark({
  mark,
  monogram,
  px,
  plays = false,
}: {
  mark: string | null;
  monogram: string;
  px: number;
  plays?: boolean;
}) {
  if (!mark) return <>{monogram}</>;
  return (
    <CoupleLogo
      svg={mark}
      plays={plays}
      place="invite-seal"
      className="inline-flex shrink-0"
      style={{ width: px, height: px }}
      still={<BespokeMonogramMark svg={mark} px={px} />}
    />
  );
}
