import { PauseCircle, Undo2 } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { TypedRow } from '@/app/_components/form-row';
import {
  SUSPEND_DURATIONS,
  SUSPEND_REASONS,
  holdDateWords,
  isSuspendReason,
} from '@/lib/account-suspension';
import { accountHold } from '../../suspend-actions';

/**
 * ⏸ ACCOUNT HOLD — Suspend / Unsuspend on the Person page (owner 2026-11-13, "Yes, add both"). PORTED from the
 * approved prototype `prototypes/admin_pub/people.html`: the Suspended row with its reason and Until (`person`
 * state `suspended`), `cfm-suspend-person` (reason · Until · a note for admins they never see · what happens / what
 * doesn't), `date-suspend` (7 days · 30 days · until lifted) and `cfm-unsuspend-person` (Unsuspend, then Undo).
 *
 * The ONE write on an otherwise read-only card, by the drawing's own placement (Person › Actions). Internal accounts
 * (§ 10a) show the lock instead of a button, as drawn.
 */
export function AccountHoldSection({
  userId,
  name,
  isInternal,
  suspendedAt,
  suspendedUntil,
  suspendedReason,
  flash,
}: {
  userId: string;
  name: string;
  isInternal: boolean;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  flash: {
    suspended: boolean;
    unsuspended: boolean;
    undoReason: string | null;
    undoUntil: string | null;
    error: string | null;
  };
}) {
  const onHold = Boolean(suspendedAt);
  const canUndo =
    !onHold && flash.unsuspended && isSuspendReason(flash.undoReason) && Boolean(flash.undoUntil);

  return (
    <section className="sn-tile p-5" aria-labelledby="account-hold-h">
      <h2 id="account-hold-h" className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
        <PauseCircle className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
        Account hold
      </h2>

      {flash.error ? (
        <p role="alert" className="mb-3 rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
          {flash.error}
        </p>
      ) : null}
      {flash.suspended && onHold ? (
        <p role="status" className="mb-3 rounded-lg bg-ink/[0.04] px-3 py-2 text-sm text-ink">
          Suspended. They were signed out and told in the app.
        </p>
      ) : null}

      {isInternal ? (
        <p className="text-sm text-ink/60">
          This is an internal account (§ 10a) — it is never suspended.
        </p>
      ) : onHold ? (
        <>
          <p className="text-sm text-ink">
            On hold {suspendedUntil ? `until ${holdDateWords(suspendedUntil)}` : 'until lifted'}
            {suspendedReason ? ` · ${suspendedReason}` : ''}
          </p>
          <p className="mt-1 text-xs text-ink/55">
            Since {holdDateWords(suspendedAt!)}. They can&rsquo;t sign in. Any shop they own is hidden and takes no
            bookings. Nothing is deleted; money stays as it stands.
            {suspendedUntil ? ' It lifts itself on the Until date unless you lift it first.' : ''}
          </p>
          <ConfirmForm
            action={accountHold}
            title={`Unsuspend ${name}`}
            confirmLabel="Unsuspend"
            message={
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>They can sign in and act again.</li>
                <li>Their events carry on where they were.</li>
                <li>
                  A shop they run comes back hidden — listing it again is Verify&rsquo;s call, as the supplier unsuspend
                  does today.
                </li>
                <li>They are told, in words, in the app.</li>
              </ul>
            }
            className="mt-3"
          >
            <input type="hidden" name="op" value="unsuspend" />
            <input type="hidden" name="user_id" value={userId} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-cream hover:bg-ink/90"
            >
              <Undo2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              Unsuspend
            </button>
          </ConfirmForm>
        </>
      ) : (
        <>
          {canUndo ? (
            <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-ink/[0.04] px-3 py-2">
              <span className="text-sm text-ink">Unsuspended. They were told in the app.</span>
              <form action={accountHold}>
                <input type="hidden" name="op" value="undo" />
                <input type="hidden" name="user_id" value={userId} />
                <input type="hidden" name="reason" value={flash.undoReason ?? ''} />
                <input type="hidden" name="until" value={flash.undoUntil ?? ''} />
                <button type="submit" className="button-secondary min-h-[44px]">
                  Undo
                </button>
              </form>
            </div>
          ) : null}
          <p className="mb-3 text-xs text-ink/55">
            The gentler step before Ban and Delete — reversible, and nothing is deleted.
          </p>
          <ConfirmForm
            action={accountHold}
            title={`Suspend ${name}`}
            confirmLabel="Suspend"
            destructive
            message={
              <div className="space-y-2 text-sm">
                <ul className="list-disc space-y-1 pl-5">
                  <li>They can&rsquo;t sign in or act until it ends — they are signed out now.</li>
                  <li>Any shop they run is hidden (the supplier suspension).</li>
                  <li>Every record is kept as it is.</li>
                </ul>
                <p className="text-ink/70">
                  Not: nothing is deleted · money stays as it stands — paid stays paid, owed stays owed.
                </p>
                <p className="text-ink/70">They are told why, in words, in the app.</p>
              </div>
            }
          >
            <input type="hidden" name="op" value="suspend" />
            <input type="hidden" name="user_id" value={userId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-ink/60">Reason</span>
                <select name="reason" required defaultValue="" className="input-field w-full">
                  <option value="" disabled>
                    Choose a reason…
                  </option>
                  {SUSPEND_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-ink/60">Until</span>
                <select name="duration" required defaultValue="30d" className="input-field w-full">
                  {SUSPEND_DURATIONS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <TypedRow name="Note for admins (they don’t see this)" value="" fieldName="note" long maxLength={2000} />
              </div>
            </div>
            <button
              type="submit"
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ink/20 px-4 text-sm font-medium text-ink hover:bg-ink/5"
            >
              <PauseCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
              Suspend…
            </button>
          </ConfirmForm>
        </>
      )}
    </section>
  );
}
