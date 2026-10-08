import type { ComponentType, ReactNode } from 'react';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

/**
 * guest-card-kit.ts — THE CARD'S LEAF CONTROLS, AS A KIT A PAGE MAY HAND IN (step 4B, 2026-10-09). TYPES ONLY — no runtime.
 *
 * `GuestCardBody` is drawn inside the Event Hub Maker's FIRST LOAD (Details › The Invitation draws each parent's own card), whose
 * JavaScript has ~1 KB of room (`check-maker-js-budget.mjs`: 505.7 of 507.0 KB, measured on 036f39c16). The app's templates —
 * the Form row, the chips, the fold, the switch — are NOT in that load, so the card cannot import them. It uses the seam it already
 * uses for the ticket, the ⋯ and the Invite pair: the Guests pages (`guests/page.tsx`, `[guestId]/page.tsx`, the lab) hand in a
 * kit built from the templates (`guest-card-template-kit.ts` → `guest-card-rows.tsx`); the Maker's parent cards hand in none and
 * get `OLD_KIT` (today's hand-drawn rows, in `guest-card-body.tsx`).
 *
 * ONE LAYOUT, TWO WAYS TO DRAW A LEAF. The body is ONE list of fields — which field, which label, which options, which of them a
 * couple row or a sideless event hides — and it calls these leaves; the kit only decides how each is DRAWN. So the two paths cannot
 * drift in WHAT they edit, and `the-card-posts-the-same-form.test.ts` holds that both POST the same form, every column, every
 * state. The props below are the same for both kits.
 */
export type CardFieldProps = {
  /** The posted name AND the DOM id (`first_name`). */
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue: string;
  placeholder?: string;
  /** A long message (the private note): a taller box. */
  long?: boolean;
  /** The sentence behind the row's ⓘ (the old kit prints it beside the control instead — the body decides). */
  about?: string;
};
export type CardToggleProps = { name: string; defaultChecked: boolean; label: string; note: string; soft?: boolean };
export type CardFoldProps = {
  summary: string;
  value: string | null;
  emptyValue?: string;
  open?: boolean;
  last?: boolean;
  children: ReactNode;
};
export type CardPickProps = {
  name: string;
  label: string;
  value: string;
  options: readonly PickOption[];
  multi?: boolean;
  emptyText?: string;
  about?: string;
};
export type CardInvitedToProps = { roleSelectId: string; initialRole: string; initialBlocks?: string[] };
export type CardLockedProps = { label: string; value: string; note: string };
export type CardBoxProps = { className?: string; children: ReactNode };
/** A submit button of one of the card's own small forms (This is me · Send the sign-in link · Give the spot · Take the seat back). */
export type CardSubmitProps = { main?: boolean; pendingLabel: string; ariaLabel?: string; children: string };
/** A heading with its explanation behind an ⓘ. */
export type CardTipProps = { label: string; children: ReactNode };

export type CardKit = {
  Field: ComponentType<CardFieldProps>;
  Toggle: ComponentType<CardToggleProps>;
  Fold: ComponentType<CardFoldProps>;
  Pick: ComponentType<CardPickProps>;
  InvitedTo: ComponentType<CardInvitedToProps>;
  /** A fact the host cannot change here (the couple's role). */
  Locked: ComponentType<CardLockedProps>;
  /** One list of rows (the app's Form rows draw one list; the old kit a spaced column). */
  List: ComponentType<CardBoxProps>;
  /** The card's small forms' submit buttons — the old kit's hand classes, the new kit's ActionButton. */
  Submit: ComponentType<CardSubmitProps>;
  /** A heading with an ⓘ (the old ⓘ in the Maker's card, the approved Explain on the Guests pages). */
  Tip: ComponentType<CardTipProps>;
  /** The save line in the card's header: Saving… · Saved · Couldn’t save — Try again (never "Saved" for a failed save). */
  SaveState: ComponentType;
  /** Fields that sit side by side in the old kit and are rows of the same list in the new one. */
  Cols: ComponentType<CardBoxProps>;
};
