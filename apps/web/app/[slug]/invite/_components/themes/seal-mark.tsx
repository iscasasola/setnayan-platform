import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';

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
 */
export function SealMark({ mark, monogram, px }: { mark: string | null; monogram: string; px: number }) {
  if (!mark) return <>{monogram}</>;
  return <BespokeMonogramMark svg={mark} px={px} />;
}
