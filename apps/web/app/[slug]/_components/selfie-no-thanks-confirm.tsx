'use client';

import { useEffect, useRef, useState } from 'react';
import { FACE_TAGGING_FIELD, SELFIE_DELETE_CONFIRM, SELFIE_DELETE_FIELD } from '@/lib/face-tagging-wish';

/**
 * 🗑 THE ONE CONFIRM for "No thanks" after a selfie (owner 2026-09-29, DECISION_LOG
 * "OWNER ANSWERS — TEN OPEN QUESTIONS" (3)): a guest who already gave a selfie
 * and now picks "No thanks" is asked once — delete the selfie and the automatic
 * tags, or keep it. "Yes" posts `SELFIE_DELETE_FIELD=1` with the reply, and
 * `submitRsvp` runs the same erasure as "Delete my face data"; "Keep it" puts
 * the answer back on "Yes, tag me". Unconfirmed, the server deletes nothing.
 *
 * Rendered only for a guest who HAS a selfie; it listens to the tag question's
 * own radios in the same form, so the question itself stays server-drawn.
 */
export function SelfieNoThanksConfirm() {
  const ref = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.name !== FACE_TAGGING_FIELD) return;
      setConfirmed(false);
      setAsking(t.value === 'no');
    };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, []);

  const keep = () => {
    const form = ref.current?.closest('form');
    const yes = form?.querySelector<HTMLInputElement>(`input[name="${FACE_TAGGING_FIELD}"][value="yes"]`);
    if (yes) {
      yes.checked = true;
      yes.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setAsking(false);
    setConfirmed(false);
  };

  return (
    <div ref={ref} data-selfie-no-thanks="">
      <input type="hidden" name={SELFIE_DELETE_FIELD} value={confirmed ? '1' : '0'} />
      {asking && !confirmed ? (
        <div role="alertdialog" aria-labelledby="selfie-delete-title" className="space-y-3 rounded-2xl bg-ink/[0.05] p-4">
          <p id="selfie-delete-title" className="font-serif text-lg text-ink">
            {SELFIE_DELETE_CONFIRM.title}
          </p>
          <p className="text-sm text-ink/75">{SELFIE_DELETE_CONFIRM.body}</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setConfirmed(true)} className="button-primary min-h-[48px] w-full">
              {SELFIE_DELETE_CONFIRM.yes}
            </button>
            <button type="button" onClick={keep} className="min-h-[44px] text-sm font-medium text-ink/75 underline-offset-4 hover:underline">
              {SELFIE_DELETE_CONFIRM.keep}
            </button>
          </div>
        </div>
      ) : asking && confirmed ? (
        <p role="status" className="text-sm text-ink/75">
          Your selfie will be deleted when you save.
        </p>
      ) : null}
    </div>
  );
}
