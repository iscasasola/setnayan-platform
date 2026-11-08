'use client';

import { ChevronRight } from 'lucide-react';
import { usePickedNav } from './picked-client-nav';

/**
 * 📝 "Forms · sent to this couple" on Details (v113 `forms`; B1 step 6.8) — the couple's answers sit above it (the
 * shipped `CoupleAnswers`); this row opens the Forms page in place (the 9-page menu), where the forms themselves live.
 */
export function DetailsFormsDoor() {
  const nav = usePickedNav();
  if (!nav) return null;
  return (
    <section data-details-forms="" aria-label="Forms sent to this couple">
      <p className="home-k2 pb-1">Forms · sent to this couple</p>
      <button type="button" onClick={() => nav.select('forms')} className="sn-press flex min-h-12 w-full items-center gap-3 py-2 text-left" data-details-forms-open="">
        <span className="min-w-0 flex-1 text-[14px] text-ink">Open Forms</span>
        <ChevronRight aria-hidden className="h-4 w-4 text-ink/60" />
      </button>
    </section>
  );
}
