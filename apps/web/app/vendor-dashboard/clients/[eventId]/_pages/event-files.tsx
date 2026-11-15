import { cache } from 'react';
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
/**
 * ⚡ ONE READ PER REQUEST (wave 5 speed pass, 2026-11-15). The client page builds the Files body AND the Hub body on
 * every request (`switch.tsx`), and both mount this section — so the files, quotes and cards were read and every file
 * presigned TWICE. React `cache()` keys on the arguments, so the two mounts share the one read (primitives only: a
 * Supabase client object would never match). Same result, same "couldn't load" on a refusal.
 */
const readEventFilesOnce = cache(async (eventId: string, vendorProfileId: string, eventDate: string | null) =>
  readEventSupplierFiles(await createClient(), { eventId, vendorProfileId, eventDate }),
);

export async function EventFilesSection({ ctx, mode }: { ctx: PickedPageContext; mode: 'files' | 'hub' }) {
  const supabase = await createClient();
  const filesRead = readEventFilesOnce(ctx.eventId, ctx.vendorProfileId, ctx.eventDate);
  // 📥 ⚡ The chat's shared files start NOW, beside the files read — they need the filed ids only to filter, which they
  // wait for after their own query (wave 5). A failed files read still ends in the alert below; the chat promise is
  // made non-throwing so leaving it unawaited there can never surface as an unhandled rejection.
  const filedIds = filesRead.then((r) => (r.status === 'ok' ? r.filedMessageIds : new Set<string>()));
  const chatRead = mode === 'files' ? readChatCollected(supabase, { threadId: ctx.threadId, filedMessageIds: filedIds }).catch(() => ({ status: 'unread' as const })) : null;
  const read = await filesRead;
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
    chatRead,
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
