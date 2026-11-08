'use client';

import { useRef, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { demoteMember, promoteMember } from '../../actions';
import { saveInPlace } from '@/app/_actions/save-in-place';

/**
 * member-actions-menu.tsx — an organizer's Promote · Demote · Remove for one member, as ONE dropdown.
 *
 * Owner rule: any set of choices is a dropdown (prototypes/group_samahan_2026-10-25, the Members list: "Promote ·
 * Demote · Remove are one ⋯ dropdown"). Nothing about the actions changed — the same three server actions, posted
 * by the same hidden fields (`community_id` + the bigserial `member_row_id`, never an auth uuid — RA 10173). The
 * list only picks which form submits.
 */
export function MemberActionsMenu({
  communityId,
  memberRowId,
  name,
  role,
}: {
  communityId: string;
  memberRowId: number | string;
  name: string;
  role: 'organizer' | 'member';
}) {
  const promoteRef = useRef<HTMLFormElement>(null);
  const demoteRef = useRef<HTMLFormElement>(null);
  /* Remove saves IN PLACE (owner 2026-10-26, "a save never resets the screen"): the `accGroup.removeMember` door, the
     same two fields; a refusal is said under the menu. */
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemove] = useTransition();
  const remove = () => {
    const fd = new FormData();
    fd.set('community_id', communityId);
    fd.set('member_row_id', String(memberRowId));
    setRemoveError(null);
    startRemove(async () => {
      const r = await saveInPlace('accGroup.removeMember', fd);
      if (!r.ok) setRemoveError(r.error);
    });
  };
  const fields = (
    <>
      <input name="community_id" type="hidden" value={communityId} />
      <input name="member_row_id" type="hidden" value={String(memberRowId)} />
    </>
  );

  return (
    <>
      <PickMenu
        label={`Manage ${name}`}
        value={null}
        buttonText="⋯"
        compact
        dataAttr="data-member-actions"
        options={[
          role === 'member'
            ? { key: 'promote', label: 'Promote', icon: <ArrowUp className="h-[18px] w-[18px]" strokeWidth={1.9} /> }
            : { key: 'demote', label: 'Demote', icon: <ArrowDown className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
          { key: 'remove', label: 'Remove', icon: <X className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
        ]}
        onPick={(k) => {
          if (k === 'remove') return remove();
          const form = k === 'promote' ? promoteRef.current : demoteRef.current;
          form?.requestSubmit();
        }}
      />
      <form ref={promoteRef} action={promoteMember} className="hidden">
        {fields}
      </form>
      <form ref={demoteRef} action={demoteMember} className="hidden">
        {fields}
      </form>
      {removeError ? (
        <p role="alert" className="text-[12.5px] leading-snug text-terracotta-700" data-stay-error="accGroup.removeMember">
          {removeError}
        </p>
      ) : null}
    </>
  );
}
