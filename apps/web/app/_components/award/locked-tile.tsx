'use client';
/**
 * 🔒 THE LOCKED LOOK (owner 15 Nov: *"i do not see the locked badge for all and the popup for setnayan verified"*;
 * ported from `badge-milestones_v86.html` `.lkt`). Every badge at its Bronze step, Setnayan Verified and the five seals
 * show here until earned: the art in grey under a lock, the group (Badge · Verified · Seal), the name, and what it
 * takes. Shown to the SHOP on its own badge page only — a locked one is never shown to couples (the caller's rule;
 * this tile only draws).
 *
 * Client-only like the rest of the kit (no state, no effect — it only draws).
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import s from './award.module.css';

export type LockedGroup = 'Badge' | 'Verified' | 'Seal';

/** What each locked thing takes — v86's words, verbatim, for the ones whose rule is not a number on a ladder. */
export const LOCKED_HOW = {
  shield: 'Bronze when 1 supplier recommends you',
  invite: 'Bronze when 1 supplier you invited has its first paid booking',
  verified: 'Send the three business papers; Setnayan checks the owner, the papers and the work',
} as const;

/** v86's line for a count badge's first step: "Bronze at 5 bookings". The step and the unit are the caller's data. */
export function bronzeAtLine(tierName: string, step: number, unit: string): string {
  return `${tierName} at ${step.toLocaleString('en-US')} ${unit}`;
}

export type LockedTileProps = {
  /** The badge/seal art, drawn in its own colours — the tile greys it. */
  art: ReactNode;
  group: LockedGroup;
  name: string;
  /** What it takes, in words. */
  how: string;
};

export function LockedTile({ art, group, name, how }: LockedTileProps) {
  return (
    <div className={s.lkt} role="img" aria-label={`${name}, locked. ${how}`} data-award-locked={group}>
      <span className={s.lktArt}>{art}</span>
      <span className={s.lktLock} aria-hidden="true">
        <Lock size={18} strokeWidth={2} />
      </span>
      <span className={s.lktGroup}>{group}</span>
      <b>{name}</b>
      <small>{how}</small>
    </div>
  );
}
