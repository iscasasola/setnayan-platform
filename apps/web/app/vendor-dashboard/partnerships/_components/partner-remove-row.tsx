'use client';

import { useRef, useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { StayForm } from '@/app/_components/stay-form';
import { removePartnership } from '../actions';

/**
 * 🤝 Either side removes a partnership — swipe the row left, no confirm (Invite a supplier v3, owner 16 Nov; specs
 * cb1affde frame 4 "either side removes"). THE ONE SWIPE (`SwipeToDelete`), word "Remove"; the press posts the row's
 * own stay door (`svPartnerships.removePartnership`), so the list re-draws in place and the row leaves both shop pages.
 */
export function PartnerRemoveRow({ id, name, children }: { id: number; name: string; children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <SwipeToDelete
      as="li"
      label={`Remove ${name}`}
      word="Remove"
      busy={busy}
      surfaceClass="bg-white"
      className="m-card"
      onDelete={(close) => {
        setBusy(true);
        form.current?.requestSubmit();
        close();
      }}
    >
      {children}
      <StayForm
        ref={form}
        door="svPartnerships.removePartnership"
        action={removePartnership}
        onRefused={() => setBusy(false)}
        hidden
      >
        <input type="hidden" name="partnership_id" value={id} />
      </StayForm>
    </SwipeToDelete>
  );
}
