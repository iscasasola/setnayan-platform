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
import { formatCount } from '@/lib/format-number';
import { FormRows } from '@/app/_components/form-row';
import { TemplateEmpty, TemplateRow, TemplateRows, TemplateSection } from '@/app/_components/template-rows';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { PostedFieldRow } from '@/app/admin/_components/posted-field-row';
import { actionButtonClass } from '@/components/action-button-class';

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

  // 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): the lock state is the section's label, both
  // explaining sentences sit behind its ⓘ, each account is ONE row with ONE action (Remove), and the add box is the
  // house Form row. Same two actions, same posted names (`discount_code_id`, `user_id`, `email`).
  return (
    <TemplateSection
      label={
        isPrivate
          ? `Private code · ${formatCount(eligibleUsers.length)} account${eligibleUsers.length === 1 ? '' : 's'} can redeem`
          : 'Anyone with the code can redeem'
      }
      tip={
        <>
          Empty = public (anyone with the code can redeem · max_uses still
          applies). Add accounts to lock this code to specific people · gift
          cards for family members, birthday codes for one customer, etc.{' '}
          The account must already exist on Setnayan — they sign up first,
          then you add their email here.
        </>
      }
      first
      data="voucher-eligibility"
    >
      {/* Existing eligibles · list with remove */}
      {eligibleUsers.length > 0 ? (
        <TemplateRows label="Accounts that can redeem">
          {eligibleUsers.map((u) => (
            <TemplateRow
              key={u.user_id}
              data={u.user_id}
              title={u.full_name ?? u.email}
              line={u.full_name ? `(${u.email})` : undefined}
              right={
                <form action={removeEligibleUser}>
                  <input
                    type="hidden"
                    name="discount_code_id"
                    value={discountCodeId}
                  />
                  <input type="hidden" name="user_id" value={u.user_id} />
                  <SubmitButton className={actionButtonClass('neutral')} pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              }
            />
          ))}
        </TemplateRows>
      ) : (
        <TemplateEmpty data="voucher-eligibility">No accounts yet · code is public.</TemplateEmpty>
      )}

      {/* Add new */}
      <form action={addEligibleUser} className={`${ADMIN_FRAME} mt-2.5 px-4 py-1`}>
        <input
          type="hidden"
          name="discount_code_id"
          value={discountCodeId}
        />
        <FormRows width="wide">
          <PostedFieldRow name="Add account by email" fieldName="email" empty="customer@example.com" />
        </FormRows>
        <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
          <Link
            href="/admin/accounts?tab=users"
            className="text-sm underline-offset-2 hover:underline"
            style={{ color: 'var(--m-slate)' }}
          >
            Browse users →
          </Link>
          <SubmitButton className={actionButtonClass('brand')} pendingLabel="Adding…">
            Add
          </SubmitButton>
        </div>
      </form>
    </TemplateSection>
  );
}
