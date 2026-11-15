'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton, actionButtonClass } from '@/components/action-button';

type Props = {
  eventId: string;
  sponsorId: string;
  fullName: string;
  relationshipNote: string | null;
  email: string | null;
  phone: string | null;
  /** Form action — the updateSponsor server action. */
  formAction: (formData: FormData) => Promise<void>;
};

/**
 * Fix a sponsor's details in place.
 *
 * ── WHY THIS EXISTS AT ALL, WHEN REMOVE + RE-ADD "WORKS" ───────────────────
 *
 * It does not work. `removeSponsor` is a hard DELETE, so re-adding a corrected
 * row loses `invitation_status` and `invitation_sent_at` (the couple no longer
 * knows they already asked this person), loses `responded_at` and the accept /
 * decline itself, and — worst — abandons `linked_guest_id`. `markResponse`
 * auto-creates a guests row on acceptance and deliberately does NOT delete it
 * when the sponsor goes, so the correction leaves an orphaned guest behind and
 * mints a SECOND one when the ninong accepts again.
 *
 * 🔑 A typo in a name is the single likeliest edit on this page, and until now
 * the only route to it destroyed the record of a yes.
 *
 * ── WHAT IT DELIBERATELY CANNOT CHANGE ─────────────────────────────────────
 *
 * Tier and side are immutable post-insert (`updateSponsor`'s own docblock says
 * so, and the action never reads them off the form). Moving somebody between
 * tiers really is remove-and-re-add, because the pair structure and the guest
 * role derived from it change with them. This modal therefore does not offer
 * those fields rather than offering them and silently dropping the change.
 */
export function EditSponsorModal({
  eventId,
  sponsorId,
  fullName,
  relationshipNote,
  email,
  phone,
  formAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[name="full_name"]')?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${fullName}`}
        className="rounded-md p-1 text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      {open ? (
        /* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 9): the house Sheet — handle, title, ✕, Esc and Back. */
        <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
          <div ref={dialogRef}>
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-4 pr-14">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Edit details
                </p>
                <h2 id={headingId} className="text-[17px] font-semibold text-ink">
                  {fullName}
                </h2>
              </div>
            </header>

            <StayForm door="sponsors.updateSponsor" action={formAction} onSaved={() => setOpen(false)} className="space-y-4 px-5 py-4">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsorId} />

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Full name
                </span>
                <input
                  autoComplete="off"
                  type="text"
                  name="full_name"
                  required
                  maxLength={200}
                  defaultValue={fullName}
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Relationship (optional)
                </span>
                <input
                  type="text"
                  name="relationship_note"
                  maxLength={200}
                  defaultValue={relationshipNote ?? ''}
                  placeholder="Tito Mike (Mom's brother)"
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Email (optional)
                </span>
                <input
                  autoComplete="off"
                  type="email"
                  name="email"
                  maxLength={200}
                  defaultValue={email ?? ''}
                  placeholder="marcel@example.com"
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Phone (optional)
                </span>
                <input
                  autoComplete="off"
                  type="tel"
                  name="phone"
                  maxLength={40}
                  defaultValue={phone ?? ''}
                  placeholder="+63 917 123 4567"
                  className="input-field"
                />
              </label>

              <div className="text-xs text-ink/70">
                <InfoTip label="Their role and side stay as they are." labelAs="span" labelClassName="text-ink/70" align="start">
                  Moving someone to a different slot means removing them and adding them there.
                </InfoTip>
              </div>

              <div className="grid auto-cols-fr grid-flow-col gap-2 pt-2">
                <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} />
                <SubmitButton pendingLabel="Saving…" className={actionButtonClass('brand', { main: true })}>
                  Save changes
                </SubmitButton>
              </div>
            </StayForm>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
