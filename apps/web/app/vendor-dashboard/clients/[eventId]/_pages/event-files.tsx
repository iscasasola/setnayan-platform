import { createClient } from '@/lib/supabase/server';
import { readEventSupplierFiles, readPortfolioPicks } from '@/lib/supplier-files.server';
// ⚡ On-demand code (`./lazy`): the board is fetched with its page, never on the route's first load.
import { EventFilesBoard } from './lazy';
import type { PickedPageContext } from './context';

/**
 * 📁 THE SUPPLIER'S FILES FOR THIS EVENT — Files and Hub (Piece 3b · DECISION_LOG 2026-11-12). ONE batched read, then
 * the board. A refused read is SAID ("couldn't load"), never drawn as an event with no files.
 */
export async function EventFilesSection({ ctx, mode }: { ctx: PickedPageContext; mode: 'files' | 'hub' }) {
  const supabase = await createClient();
  const read = await readEventSupplierFiles(supabase, { eventId: ctx.eventId, vendorProfileId: ctx.vendorProfileId, eventDate: ctx.eventDate });
  if (read.status !== 'ok') {
    return (
      <p role="alert" className="text-sm text-ink/70" data-event-files-unread="">
        We couldn&rsquo;t load this event&rsquo;s files just now. Reload in a moment — nothing was lost.
      </p>
    );
  }
  const picks = mode === 'files' ? await readPortfolioPicks(supabase, { vendorProfileId: ctx.vendorProfileId, quotedIds: read.quoted.map((q) => q.id) }) : null;
  return (
    <EventFilesBoard
      mode={mode}
      eventId={ctx.eventId}
      shopId={ctx.vendorProfileId}
      coupleName={ctx.eventName}
      eventDate={read.eventDate}
      quoted={read.quoted}
      serviceTitles={read.serviceTitles}
      files={read.files}
      picks={picks && picks.status === 'ok' ? picks.picks : null}
      feeUnlocked={ctx.feeUnlocked}
      returnPath={`/vendor-dashboard/clients/${ctx.eventId}`}
    />
  );
}
