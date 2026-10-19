import type { ComponentType, ReactNode } from 'react';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import type { RoleNames } from '@/lib/role-names';

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
  /** What the button says while the value is not one of the options (see `CardTitleProps`). */
  unlisted?: { key: string; text: string };
};
/**
 * 🪪 THE TITLE — one dropdown whose pick carries woman or man ("Atty. (Woman)" · "Atty. (Man)", owner 2026-10-17;
 * `lib/guest-title.ts`). Posts ONE hidden input, `name_title`, holding the pick's key ("Atty.|woman"); `updateGuest`
 * splits it into `name_prefix` (what prints) and `gender` (never printed). `unlisted` is what the button says while the
 * stored value is not one of the entries — the title alone, or the pending pick "Atty. — Woman or Man?".
 * The template kit adds "Other title…" (type your own; it comes back as two entries); the Maker's hand-drawn kit lists
 * a stored typed title as its two entries but has no box to type a new one (its first load has no room for one).
 */
export type CardTitleProps = {
  label: string;
  /** The stored pick's key — `titleKey(name_prefix, gender)`. */
  value: string;
  /** The stored title, so a typed one stays offered as its two entries. */
  current: string | null;
  options: readonly PickOption[];
  unlisted?: { key: string; text: string };
  /** Only the stored title's own entries — a linked person's name is theirs, so only its woman / man is picked here. */
  narrow?: boolean;
};
export type CardInvitedToProps = { roleSelectId: string; initialRole: string; initialBlocks?: string[] };
export type CardLockedProps = { label: string; value: string; note: string };
export type CardBoxProps = { className?: string; children: ReactNode };
/** A submit button of one of the card's own small forms (This is me · Send the sign-in link · Give the spot · Take the seat back). */
export type CardSubmitProps = { main?: boolean; pendingLabel: string; ariaLabel?: string; children: string };
/** A heading with its explanation behind an ⓘ. */
export type CardTipProps = { label: string; children: ReactNode };
/**
 * 🏷 "Rename this role" · "Rename this section" (owner 2026-09-30 / 2026-10-19), under the Role dropdown: the couple's own
 * word for this guest's ROLE ("Bride's Crew") and for the entourage SECTION it prints under ("Immediate Family" → "VIP").
 * Each keeps on its own, straight to `events.role_names` (it is the event's word, not this guest's) — never posted with
 * the card's form. Blank = the usual word.
 */
export type CardRenameProps = {
  eventId: string;
  /** The guest's role (`guests.role`, as saved) — the leaf works out its word and its section (the card's own load stays as it is). */
  role: string;
  /** `events.role_names` as the card has it. */
  names: RoleNames;
};

export type CardKit = {
  Field: ComponentType<CardFieldProps>;
  Toggle: ComponentType<CardToggleProps>;
  Fold: ComponentType<CardFoldProps>;
  Pick: ComponentType<CardPickProps>;
  /** The name's Title — the pick carries woman or man (`CardTitleProps`). */
  Title: ComponentType<CardTitleProps>;
  InvitedTo: ComponentType<CardInvitedToProps>;
  /** A fact the host cannot change here (the couple's role). */
  Locked: ComponentType<CardLockedProps>;
  /** One list of rows (the app's Form rows draw one list; the old kit a spaced column). */
  List: ComponentType<CardBoxProps>;
  /** The card's small forms' submit buttons — the old kit's hand classes, the new kit's ActionButton. */
  Submit: ComponentType<CardSubmitProps>;
  /** A heading with an ⓘ (the old ⓘ in the Maker's card, the approved Explain on the Guests pages). */
  Tip: ComponentType<CardTipProps>;
  /** The save line in the card's header: Saving… · Saved · Couldn’t save — Try again (never "Saved" for a failed save). `copy` is the card's sentence for each refusal code (the templated line says it). */
  SaveState: ComponentType<{ copy?: Record<string, string> }>;
  /** Fields that sit side by side in the old kit and are rows of the same list in the new one. */
  Cols: ComponentType<CardBoxProps>;
  /**
   * 🏷 The role's and the section's own words (`CardRenameProps`). Only the Guests pages' kit has it: the Maker's parent cards
   * (the hand-drawn kit) draw none — the Maker names its sections in the Wedding March's Edit.
   */
  Rename?: ComponentType<CardRenameProps>;
};
