'use client';

/**
 * TEMPORARY, LOCAL-ONLY — screenshot harness for the top-right Restore/Undo/
 * Apply buttons (rd/maker-top-right-actions). Not part of the deliverable;
 * deleted before the PR opens. No auth, no Supabase — renders the real
 * `MakerShell` + `HubDraftToolbar` with mock props so the actual shipped
 * components can be screenshotted at phone and desktop widths without a
 * logged-in event.
 */

import { useSearchParams } from 'next/navigation';
import { MakerShell } from '@/app/dashboard/[eventId]/launch/_components/maker-shell';
import { HubDraftToolbar } from '@/app/dashboard/[eventId]/website/_components/hub-draft-bar';
import type { HubDraftSummary } from '@/lib/hub-draft';

const NO_CHANGES: HubDraftSummary = { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
const SOME_CHANGES: HubDraftSummary = { hasChanges: true, changeCount: 3, proCount: 0, canUndo: true };
const ONLY_PRO: HubDraftSummary = { hasChanges: true, changeCount: 2, proCount: 2, canUndo: false };

export default function DevPreviewMakerToolbar() {
  const sp = useSearchParams();
  const state = sp.get('state') ?? 'changes';
  const summary = state === 'none' ? NO_CHANGES : state === 'pro' ? ONLY_PRO : SOME_CHANGES;

  return (
    <MakerShell
      eventId="preview"
      slug={null}
      liveStage="rsvp"
      initialStage="rsvp"
      storeShell={state === 'store'}
      priceLabel={state === 'store' ? null : '₱5,000'}
      firstVisit={false}
      completeTourAction={async () => {}}
      renderStamp="preview"
      more={<div className="text-sm text-ink/70">More content.</div>}
      hasWork
      applySlot={
        <HubDraftToolbar
          eventId="preview"
          summary={summary}
          storeShell={state === 'store'}
          priceLabel={state === 'store' ? null : '₱5,000'}
          proHref={state === 'store' ? null : '/dashboard/preview/studio/website-pro'}
          readError={state === 'error'}
        />
      }
    >
      <div className="flex h-full items-center justify-center text-ink/40">Canvas placeholder</div>
    </MakerShell>
  );
}
