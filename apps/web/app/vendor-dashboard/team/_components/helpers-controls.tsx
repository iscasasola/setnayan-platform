'use client';

/**
 * HELPERS — the two controls the Helpers screen needs on the client (simpler supplier dashboard step 6; prototype
 * `supplier_easy_dashboard_2026-10-14_fable.html` SCREENS.helpers + SHEETS.invite).
 *
 *   · `RolePick` — a member's role as ONE dropdown (Admin · runs the shop / Team member · own work / Helper · sees
 *     the schedule). Picking posts the SHIPPED `updateVendorTeamMember` (the label rides along unchanged), the same
 *     form-plus-hidden-input shape as Dates' `ShareTeamPick`.
 *   · `InviteHelperSheet` — "Invite a helper": email · They can ▾ · What they do. Posts the SHIPPED
 *     `inviteVendorTeamMember`. Opens from the screen's one terracotta button in the thumb row.
 *
 * Every write is handed in; this file imports no action.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, UserPlus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';

type Action = (formData: FormData) => void | Promise<void>;

/** The roles an admin may give, in the words the supplier reads (role key → "Name · what they can do"). */
export type RoleOption = { key: string; label: string };

function usePortal(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function RolePick({
  memberId,
  name,
  role,
  teamLabel,
  options,
  action,
}: {
  memberId: string;
  name: string;
  role: string;
  teamLabel: string | null;
  options: readonly RoleOption[];
  /** The shipped `updateVendorTeamMember`. */
  action: Action;
}) {
  const form = useRef<HTMLFormElement>(null);
  const target = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={action} className="flex-none" data-helpers-role={memberId}>
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <input type="hidden" name="team_label" value={teamLabel ?? ''} />
      <input ref={target} type="hidden" name="role" defaultValue={role} />
      <PickMenu
        label={`What ${name} can do`}
        value={role}
        options={options}
        onPick={(k) => {
          if (k === role || !target.current) return;
          target.current.value = k;
          form.current?.requestSubmit();
        }}
        dataAttr="data-helpers-role-pick"
        compact
        className="!min-h-11"
      />
    </form>
  );
}

export function InviteHelperSheet({
  options,
  defaultRole,
  action,
  seatLine,
}: {
  options: readonly RoleOption[];
  defaultRole: string;
  /** The shipped `inviteVendorTeamMember`. */
  action: Action;
  /** "1 of 3 used · 1 Helper free on every plan" — said under the heading, so the plan is known before Send. */
  seatLine: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [role, setRole] = useState(defaultRole);
  const mounted = usePortal();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-helpers-invite-sheet="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Invite a helper
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">They sign in on their own phone with their Setnayan account. {seatLine}.</p>
        <form
          ref={form}
          action={action}
          className="mt-3"
          onSubmit={(e) => {
            if (!email.trim()) {
              e.preventDefault();
              nudgeFormRows(form.current ?? undefined);
            }
          }}
        >
          <input type="hidden" name="role" value={role} />
          <FormRows width="wide">
            <TypedRow
              name="Their email"
              value={email}
              required
              maxLength={200}
              inputMode="email"
              fieldName="email"
              empty="Add"
              onKeep={(t) => setEmail(t.trim())}
              note="The email of their Setnayan account"
            />
            <ChosenRow name="They can" value={role} options={options} onPick={(k) => setRole(k)} dataAttr="data-helpers-invite-role" />
            <TypedRow
              name="What they do"
              value={label}
              maxLength={64}
              fieldName="team_label"
              empty="Optional"
              onKeep={(t) => setLabel(t)}
              note="Couples see this when they reply for you · e.g. Front desk"
            />
          </FormRows>
          <div className="mt-4">
            <SupplierSubmit
              tone="brand"
              main
              icon={<Send aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              label="Send the invite"
              pendingLabel="Adding them…"
              className="w-full"
            />
          </div>
        </form>
      </div>
    </Sheet>
  );

  return (
    <>
      <SupplierThumbRow name="helpers" label="Helper actions">
        <ActionButton
          tone="brand"
          main
          icon={UserPlus}
          label="Invite a helper"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          data-testid="helpers-invite"
        />
      </SupplierThumbRow>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}
