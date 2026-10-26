import type { ReactNode } from 'react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { hubDoorSkin } from '@/app/[slug]/invite/_components/hub-door-skin';
import { landingTopStandsDown } from '@/lib/guest-landing';

/**
 * 🚪 THE LAB'S THANK-YOU DOOR (`/dev/maker-lab/guest?rsvp=thanks&guest=1`) — the REAL door `invite/enter` draws after a
 * Yes (`DoorShell` + `hubDoorSkin`, the couple's initials as the crest), with the full ticket below: so its top stands
 * down exactly as the page's does (`landingTopStandsDown`, owner 2026-10-26 — no mark, no names over "You're on the
 * list."). The lab page hands in the note, the ticket and the rest.
 */
export function LabThanksDoor({ names, monogram, children }: { names: string; monogram: string; children: ReactNode }) {
  return (
    <DoorShell brand="foot" title={names} skin={hubDoorSkin({ mark: null, monogram })} quietTop={landingTopStandsDown({ reply: 'yes', ticket: 'full' })}>
      {children}
    </DoorShell>
  );
}
