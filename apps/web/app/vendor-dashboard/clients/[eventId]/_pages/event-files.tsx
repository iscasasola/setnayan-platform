import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readChatCollected, readEventSupplierFiles, readPortfolioPicks } from '@/lib/supplier-files.server';
import { readEventTagBoard } from '@/lib/inspiration-tags.server';
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
  const [picks, chat, tagBoard] = await Promise.all([
    mode === 'files' ? readPortfolioPicks(supabase, { vendorProfileId: ctx.vendorProfileId, quotedIds: read.quoted.map((q) => q.id) }) : null,
    // 📥 Piece 3c: what was shared in the chat, sorted by kind — Files only (the Hub shows filed service groups only).
    mode === 'files' ? readChatCollected(supabase, { threadId: ctx.threadId, filedMessageIds: read.filedMessageIds }) : null,
    // 🏷 Inspiration tags (DECISION_LOG 2026-11-14) — Files only. The service role, because `event_file_id` is granted
    // to nobody else; scoped to the shop this page already proved is the signed-in supplier's.
    mode === 'files'
      ? readEventTagBoard(createAdminClient(), { eventId: ctx.eventId, shop: ctx.vendorProfileId, files: read.files, quotedIds: read.quoted.map((q) => q.id) })
      : undefined,
  ]);
  return (
    <EventFilesBoard
      mode={mode}
      eventId={ctx.eventId}
      shopId={ctx.vendorProfileId}
      coupleName={ctx.eventName}
      eventDate={read.eventDate}
      quoted={read.quoted}
      serviceTitles={read.serviceTitles}
      files={chat && chat.status === 'ok' ? [...read.files, ...chat.files] : read.files}
      chatUnread={chat?.status === 'unread'}
      picks={picks && picks.status === 'ok' ? picks.picks : null}
      feeUnlocked={ctx.feeUnlocked}
      tags={tagBoard === undefined ? undefined : (tagBoard?.tags ?? null)}
      offered={tagBoard?.offered}
      returnPath={`/vendor-dashboard/clients/${ctx.eventId}`}
    />
  );
}
