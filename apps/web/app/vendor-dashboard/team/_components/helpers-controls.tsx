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
import { StayForm, useStaySubmit } from '@/app/_components/stay-form';

type Action = (formData: FormData) => void | Promise<void>;

/** The roles an admin may give, in the words the supplier reads (role key → "Name · what they can do"). */
export type RoleOption = { key: string; label: string };

function usePortal(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** 🧑‍🤝‍🧑 The roles that work at one location — Branch ▾ is asked only for these (drawing (c)). */
const BRANCH_ROLES: ReadonlySet<string> = new Set(['branch_manager', 'account_manager', 'event_crew', 'helper']);

/**
 * A member's Role ▾ and, when the shop has two or more locations and the role works at one, Branch ▾ (owner 19 Nov
 * 2026, drawing (b)/(c)). Picking either posts the SHIPPED `updateVendorTeamMember` with both.
 */
export function RolePick({
  memberId,
  name,
  role,
  branchKey,
  teamLabel,
  options,
  locations = [],
  action,
}: {
  memberId: string;
  name: string;
  /** The member's role (`duty`). */
  role: string;
  /** Where they work — a branch id or 'main'. */
  branchKey?: string;
  teamLabel: string | null;
  options: readonly RoleOption[];
  /** The shop's locations; Branch ▾ shows only with two or more. */
  locations?: readonly RoleOption[];
  /** The shipped `updateVendorTeamMember`. */
  action: Action;
}) {
  /* `StayForm` takes no ref — the form is the one this mark sits in. */
  const mark = useRef<HTMLSpanElement>(null);
  const target = useRef<HTMLInputElement>(null);
  const branch = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState(role);
  const showBranch = locations.length >= 2 && BRANCH_ROLES.has(picked);
  const submit = () => mark.current?.closest('form')?.requestSubmit();
  return (
    <StayForm door="supTeam.updateVendorTeamMember" action={action} className="flex min-w-0 max-w-full flex-wrap items-center gap-1" data-helpers-role={memberId}>
      <span ref={mark} hidden />
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <input type="hidden" name="team_label" value={teamLabel ?? ''} />
      <input ref={target} type="hidden" name="duty" defaultValue={role} />
      <input ref={branch} type="hidden" name="branch_id" defaultValue={branchKey ?? 'main'} />
      <PickMenu
        label={`${name}’s role`}
        value={picked}
        options={options}
        onPick={(k) => {
          if (k === picked || !target.current) return;
          target.current.value = k;
          setPicked(k);
          submit();
        }}
        dataAttr="data-helpers-role-pick"
        compact
        className="!min-h-11"
      />
      {showBranch ? (
        <PickMenu
          label={`Where ${name} works`}
          value={branchKey ?? 'main'}
          options={locations}
          onPick={(k) => {
            if (!branch.current || k === branch.current.value) return;
            branch.current.value = k;
            submit();
          }}
          dataAttr="data-helpers-branch-pick"
          compact
          className="!min-h-11"
        />
      ) : null}
    </StayForm>
  );
}

export function InviteHelperSheet({
  options,
  defaultRole,
  locations = [],
  defaultBranch = 'main',
  action,
  seatLine,
}: {
  options: readonly RoleOption[];
  defaultRole: string;
  /** The shop's locations (Main + branches); Branch ▾ is asked only with two or more, and only for a branch role. */
  locations?: readonly RoleOption[];
  /** A Branch Manager's own branch — the only one they may pick. */
  defaultBranch?: string;
  /** The shipped `inviteVendorTeamMember`. */
  action: Action;
  /** "1 of 3 used · 1 Helper free on every plan" — said under the heading, so the plan is known before Send. */
  seatLine: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [branchKey, setBranchKey] = useState(defaultBranch);
  const askBranch = locations.length >= 2 && BRANCH_ROLES.has(role);
  const mounted = usePortal();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const stay = useStaySubmit('supTeam.inviteVendorTeamMember', () => {
    setOpen(false);
    setEmail('');
    setLabel('');
    setRole(defaultRole);
    setBranchKey(defaultBranch);
  });

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-helpers-invite-sheet="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Invite to your team
        </h2>
        <p className="mt-1 text-[13.5px] text-[color:var(--m-slate-2)]">They sign in on their own phone with their Setnayan account. {seatLine}.</p>
        <form
          ref={form}
          action={action}
          className="mt-3"
          data-stay="supTeam.inviteVendorTeamMember"
          aria-busy={stay.pending || undefined}
          onSubmit={(e) => {
            if (!email.trim()) {
              e.preventDefault();
              nudgeFormRows(form.current ?? undefined);
              return;
            }
            // 💾 Saved in place (owner 2026-10-26 "a save never resets the screen"): the sheet closes on a landed
            // invite; a refusal is said under the form, the sheet still open with what was typed.
            stay.onSubmit(e);
          }}
        >
          <input type="hidden" name="duty" value={role} />
          {askBranch ? <input type="hidden" name="branch_id" value={branchKey} /> : null}
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
            <ChosenRow
              name="Role"
              value={role}
              options={options}
              onPick={(k) => setRole(k)}
              dataAttr="data-helpers-invite-role"
              note="Your shop’s name for each role, with the fixed role beside it · rename them on Team › Roles"
            />
            {askBranch ? (
              <ChosenRow
                name="Branch"
                value={branchKey}
                options={locations}
                onPick={(k) => setBranchKey(k)}
                dataAttr="data-helpers-invite-branch"
                note="Shop Manager and Marketing cover the whole shop"
              />
            ) : null}
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
        {stay.refusal}
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
          label="Invite to your team"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          data-testid="helpers-invite"
        />
      </SupplierThumbRow>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}
