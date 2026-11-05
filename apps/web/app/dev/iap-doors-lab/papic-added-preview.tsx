'use client';

import { useId } from 'react';
import { PapicCreditsAdded } from '@/app/_components/iap/iap-papic-sheet';

/** Lab-only: the Add credits sheet's success screen, drawn without a purchase (`?door=papic-added`). */
export function PapicAddedPreview() {
  const id = useId();
  return (
    <div className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pb-6 pt-3.5 shadow-2xl" role="dialog" aria-labelledby={id}>
      <PapicCreditsAdded headingId={id} what="100 credits" onDone={() => {}} />
    </div>
  );
}
