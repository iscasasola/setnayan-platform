'use client';

import { ChevronRight } from 'lucide-react';
import { usePickedNav } from './picked-client-nav';

/**
 * 📝 "Forms · sent to <the event>" on Details (v113 `forms`; B1 step 6.8) — the couple's answers sit above it (the
 * shipped `CoupleAnswers`); this row opens the Forms page in place (the 9-page menu), where the forms themselves live.
 */
/** `eventName`: the event's own name ("Debut 18") — the words the Forms page already says ("Forms sent to …"); never
 * "this couple" on a debut (owner screenshot 17 Nov). Absent → "this client". */
export function DetailsFormsDoor({ eventName }: { eventName?: string | null }) {
  const who = eventName?.trim() || 'this client';
  const nav = usePickedNav();
  if (!nav) return null;
  return (
    <section data-details-forms="" aria-label={`Forms sent to ${who}`}>
      <p className="home-k2">Forms · sent to {who}</p>
      <button type="button" onClick={() => nav.select('forms')} className="sn-press flex min-h-12 w-full items-center gap-3 py-2 text-left" data-details-forms-open="">
        <span className="min-w-0 flex-1 text-sm text-ink">Open Forms</span>
        <ChevronRight aria-hidden className="h-4 w-4 text-ink/70" />
      </button>
    </section>
  );
}
