'use client';

import { useState } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Drawer } from '@/app/dashboard/[eventId]/guests/_components/overlay-primitives';
import { SubmitButton } from '@/app/_components/submit-button';
import { AddAlagaFields } from './add-alaga-fields';
import { addDependent } from '../dependent-actions';
import { StayForm } from '@/app/_components/stay-form';

/**
 * add-alaga-button.tsx — the alaga form stops living on the page.
 *
 * Owner, 2026-08-21: *"Add an alaga needs to be a button to generate the
 * wizard."* It used to sit open at all times, so a page whose job is to show you
 * your people led with an eight-field form for adding a pet.
 *
 * ── WHAT IS AND ISN'T NEW ──────────────────────────────────────────────────
 * NOTHING about the form changed. `<AddAlagaFields>` is the shipped component,
 * unmodified — including the part that already behaves like a wizard: choosing
 * a pet or a business HIDES relationship, debut year and religion, because
 * `addDependent` nulls all three for those kinds and asking was a question the
 * save always discarded (owner report 2026-08-20). All that moved is WHERE it
 * renders.
 *
 * The panel is the roster's own `<Drawer>` — right slide-in on a laptop, bottom
 * sheet on a phone — imported from the guest list rather than re-implemented, so
 * focus trapping, Esc, the scrim and the reduced-motion freeze are the same code
 * the guest sheet uses.
 *
 * ⚠ The form posts to a SERVER ACTION that redirects. There is no close-on-click,
 * deliberately: it would race the submit and could dismiss the sheet while the
 * save was still in flight. Since 2026-11-08 it saves IN PLACE (owner 2026-10-26,
 * "a save never resets the screen"): the `accPeople.addDependent` door answers,
 * and only a save that LANDED closes the drawer (`onSaved`) — a refusal stays
 * open, said under the form.
 */
export function AddAlagaButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionButton tone="neutral" icon={HeartHandshake} label="Add a loved one" onClick={() => setOpen(true)} />

      {open ? (
        <Drawer onClose={() => setOpen(false)} labelledById="add-alaga-heading">
          <StayForm door="accPeople.addDependent" action={addDependent} onSaved={() => setOpen(false)} className="space-y-4">
            <InfoTip
              label="Add a loved one"
              labelAs="h2"
              labelId="add-alaga-heading"
              labelClassName="text-base font-semibold text-ink"
              align="start"
            >
              Someone in your care — a child, an elder, a pet, or anything else you look after.
              Their profile lives inside yours until they take it over.
            </InfoTip>
            <AddAlagaFields />
            <div className="grid auto-cols-fr grid-flow-col gap-2 pt-1">
              <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} className="w-full !min-h-12" />
              <SubmitButton className={actionButtonClass('brand', { main: true, extra: 'w-full !min-h-12' })} pendingLabel="Adding…">
                Add
              </SubmitButton>
            </div>
          </StayForm>
        </Drawer>
      ) : null}
    </>
  );
}
