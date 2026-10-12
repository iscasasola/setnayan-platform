'use client';

/**
 * SupplierToast — THE OUTCOME OF AN ANSWER, SAID AS A TOAST (supplier redesign
 * S-PR1, corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Outcome
 * notices (lock/date/deposit answers via query params) — Keep as a toast, not a
 * tile").
 *
 * A supplier answers on the page (Agree · Move · Unlock · "it never arrived")
 * and the action redirects back with its status in the query string. The
 * sentence for that status used to sit in a tile above the first screen; it is
 * a dark pill above the bottom bar now, and the words are exactly the same.
 *
 * 🔴 A REFUSAL IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT NEVER HAPPENED, so
 * this is built to be seen, not to be clever:
 *   · the server renders the pill IN THE PAGE, at the top of the column, so it
 *     is there with JavaScript off and before hydration;
 *   · once mounted it floats above the bottom dock (portalled to `<body>`, so
 *     nothing that wraps the page can pin it somewhere off screen);
 *   · a plain outcome leaves after 8 s; a REFUSAL stays until the supplier
 *     leaves the page — it is the reason the thing they pressed did not work;
 *   · it holds nothing to press, so the Next card is still the first tap.
 *
 * Loaded only by the supplier's Today.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** How long a plain outcome stays up. A refusal never leaves by itself. */
export const TOAST_MS = 8000;

const PILL =
  'pointer-events-auto max-w-[min(34rem,calc(100vw-2rem))] rounded-2xl bg-ink px-4 py-2.5 text-center text-[13px] leading-snug text-cream';

export function SupplierToast({ text, refused = false }: { text: string; refused?: boolean }) {
  const [where, setWhere] = useState<'page' | 'floating' | 'gone'>('page');

  useEffect(() => {
    setWhere('floating');
    if (refused) return;
    const t = setTimeout(() => setWhere('gone'), TOAST_MS);
    return () => clearTimeout(t);
  }, [refused, text]);

  if (where === 'gone') return null;

  const pill = (
    <div role="status" data-supplier-toast={refused ? 'refused' : 'said'} className={PILL}>
      {text}
    </div>
  );

  if (where === 'page') return <div className="mb-3 flex justify-center">{pill}</div>;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: 'calc(var(--sn-bottomdock-h, calc(env(safe-area-inset-bottom) + 64px)) + 12px)' }}
    >
      {pill}
    </div>,
    document.body,
  );
}
