/**
 * EligibilitySection — manages the per-voucher account allow-list for private
 * gift codes. Per 2026-05-29 owner request.
 *
 * Behavior:
 * - Empty (no eligible users): "Anyone with the code can redeem · max_uses
 *   still applies." This is the PUBLIC default.
 * - At least one row: ONLY those accounts can redeem. Adds a "Private code"
 *   header so admin sees the lock state at a glance.
 *
 * Admin adds via email lookup (case-insensitive). Add fails loudly if the
 * email isn't registered — by design. Gifts target real existing accounts.
 *
 * Mounts on /admin/discount-codes/[id]/edit ONLY. Cannot add eligibles to a
 * code that doesn't exist yet — admin first creates, then adds accounts.
 */

import Link from 'next/link';
import { addEligibleUser, removeEligibleUser } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

export type EligibleRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  added_at: string;
};

type Props = {
  discountCodeId: string;
  eligibleUsers: EligibleRow[];
};

export function EligibilitySection({ discountCodeId, eligibleUsers }: Props) {
  const isPrivate = eligibleUsers.length > 0;

  return (
    <div>
      <span
        className="block text-sm font-medium"
        style={{ color: 'var(--m-ink)' }}
      >
        {isPrivate ? (
          <>
            Private code · {eligibleUsers.length} account
            {eligibleUsers.length === 1 ? '' : 's'} can redeem
          </>
        ) : (
          'Anyone with the code can redeem'
        )}
      </span>
      <p
        className="mt-1 text-xs"
        style={{ color: 'var(--m-slate)' }}
      >
        Empty = public (anyone with the code can redeem · max_uses still
        applies). Add accounts to lock this code to specific people · gift
        cards for family members, birthday codes for one customer, etc.
      </p>

      <div
        className="mt-3 space-y-3 rounded-md border p-4"
        style={{
          background: 'var(--m-paper)',
          borderColor: 'var(--m-line)',
        }}
      >
        {/* Existing eligibles · list with remove */}
        {eligibleUsers.length > 0 ? (
          <ul className="space-y-1.5">
            {eligibleUsers.map((u) => (
              <li
                key={u.user_id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span
                  className="leading-tight"
                  style={{ color: 'var(--m-ink)' }}
                >
                  {u.full_name ? (
                    <>
                      {u.full_name}
                      <span
                        className="ml-1 font-mono text-xs"
                        style={{ color: 'var(--m-slate)' }}
                      >
                        ({u.email})
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs">{u.email}</span>
                  )}
                </span>
                <form action={removeEligibleUser}>
                  <input
                    type="hidden"
                    name="discount_code_id"
                    value={discountCodeId}
                  />
                  <input type="hidden" name="user_id" value={u.user_id} />
                  <SubmitButton
                    className="text-xs underline-offset-2 hover:underline"
                    pendingLabel="Removing…"
                    style={{ color: 'var(--m-slate)' }}
                  >
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-xs italic"
            style={{ color: 'var(--m-slate)' }}
          >
            No accounts yet · code is public.
          </p>
        )}

        {/* Add new */}
        <form
          action={addEligibleUser}
          className="flex flex-wrap items-end gap-2 border-t pt-3"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <input
            type="hidden"
            name="discount_code_id"
            value={discountCodeId}
          />
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor={`add_email_${discountCodeId}`}
              className="block text-xs font-medium"
              style={{ color: 'var(--m-ink)' }}
            >
              Add account by email
            </label>
            <input
              type="email"
              id={`add_email_${discountCodeId}`}
              name="email"
              required
              placeholder="customer@example.com"
              className="mt-1 block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                background: 'var(--m-paper)',
                borderColor: 'var(--m-line)',
                color: 'var(--m-ink)',
              }}
            />
          </div>
          <SubmitButton
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            pendingLabel="Adding…"
            style={{
              background: 'var(--m-orange-2)',
              color: 'var(--m-paper)',
            }}
          >
            Add
          </SubmitButton>
        </form>
        <p
          className="text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          The account must already exist on Setnayan — they sign up first,
          then you add their email here.{' '}
          <Link
            href="/admin/users"
            className="underline-offset-2 hover:underline"
          >
            Browse users →
          </Link>
        </p>
      </div>
    </div>
  );
}
