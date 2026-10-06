/**
 * march-step.ts — ONE drafted Wedding March step, sent through the shipped
 * action that carries it.
 *
 * ⚖ Owner 2026-10-06, *"Wait for apply"*: the march maker no longer sends its
 * steps when a name is dropped — it drafts them (`lib/march-draft.ts`), and the
 * ✓ Apply of the Event Hub draft (`website/hub-draft-actions.ts`) replays them,
 * in order, through THIS dispatch. It is the maker's old `callStep`, moved to
 * the server: the same five shipped actions, one per step kind, and no other
 * door to the march.
 *
 * 🔑 NOT A SERVER ACTION. No `'use server'` here: this is a plain function the
 * one draft action calls (+0 to the route budget,
 * `scripts/lint-server-action-budget.mjs`). Each action it calls still asks
 * its own host gate and its own "may it go there?" on a fresh read.
 *
 * A refused step comes back as `{ ok: false, reason }` in the couple's words.
 * A step that THROWS is not a refusal — it was not carried out, and the replay
 * keeps it drafted for the next Apply (`runDraftedMarch`). The Guest list's
 * unpair is the one action that throws its refusal (in place, it has no
 * redirect to fall back to); it is turned into words here, as the maker did.
 */
import type { MarchStep } from '@/lib/march-drag';
import type { MarchResult } from '@/lib/march-result';
import { setEntourageLineOrder } from './entourage-order-actions';
import { joinEntourageLine, moveEntourageSection, resetEntourageSections, setMarchWalking, swapEntouragePlaces } from './march-actions';
import { unpairGuestAction } from './pair-actions';

/** The words for an unpair the server would not make (its own refusal is a thrown error). */
const UNPAIR_REFUSED = 'That did not go through — nothing was changed.';

export async function callMarchStep(eventId: string, step: MarchStep): Promise<MarchResult> {
  switch (step.kind) {
    case 'swap':
      return swapEntouragePlaces(eventId, step.section, step.a, step.b);
    case 'join':
      return joinEntourageLine(eventId, step.section, step.anchor, step.joiner);
    case 'order':
      return setEntourageLineOrder(eventId, step.section, step.leads);
    case 'section':
      return moveEntourageSection(eventId, step.section, step.direction);
    case 'sections-default':
      return resetEntourageSections(eventId);
    case 'walking':
      return setMarchWalking(eventId, step.guest, step.walks);
    case 'unpair':
      /* "they walk alone, right behind it" — the Guest list's own unpair, in place. */
      try {
        await unpairGuestAction(eventId, step.guest, 'in-place');
      } catch {
        return { ok: false, reason: UNPAIR_REFUSED };
      }
      return { ok: true, written: 1 };
  }
}
