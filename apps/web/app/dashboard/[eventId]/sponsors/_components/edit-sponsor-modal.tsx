'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { useModalA11y } from '@/lib/use-modal-a11y';

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

  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });

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
        className="rounded-md p-1 text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 focus:outline-none sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink/10 bg-cream shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/80 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Edit details
                </p>
                <h2 id={headingId} className="font-display text-2xl italic text-ink">
                  {fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </header>

            <form action={formAction} className="space-y-4 px-5 py-4">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsorId} />

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Full name
                </span>
                <input
                  type="text"
                  name="full_name"
                  required
                  maxLength={200}
                  defaultValue={fullName}
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
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
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Email (optional)
                </span>
                <input
                  type="email"
                  name="email"
                  maxLength={200}
                  defaultValue={email ?? ''}
                  placeholder="marcel@example.com"
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Phone (optional)
                </span>
                <input
                  type="tel"
                  name="phone"
                  maxLength={40}
                  defaultValue={phone ?? ''}
                  placeholder="+63 917 123 4567"
                  className="input-field"
                />
              </label>

              <p className="text-xs text-ink/55">
                Their role and side stay as they are — moving someone to a different
                slot means removing them and adding them there.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
                >
                  Cancel
                </button>
                <SubmitButton pendingLabel="Saving…" className="btn-primary text-sm">
                  Save changes
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
