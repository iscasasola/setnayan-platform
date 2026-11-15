import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatAttachmentPolicy } from '@/lib/r2-client-ref';
import { presignClientRef } from '@/lib/r2-client-ref.server';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { chatOwnFileScope } from '@/lib/cleanup-delete-scope';
import { refusalFromError } from '@/lib/chat-file-removal';

/**
 * THE ONLY WAY TO READ A FILE SHARED IN A CONVERSATION.
 *
 * ── WHY THIS ROUTE EXISTS ───────────────────────────────────────────────────
 * Chat attachments used to be written to the PUBLIC bucket and the row stored
 * the public URL, which the stream rendered straight into an <img>/<a>. Anyone
 * who came by the link could open a couple's contract forever, signed in or
 * not. The bytes now live in the private bucket and the row carries a
 * stored-asset ref; this route is what turns that ref back into something a
 * browser can fetch, and it re-proves the caller on EVERY request.
 *
 * 🔑 WHY NOT SIGN THE URL AT RENDER AND PUT IT ON THE ROW. Two reasons, and the
 * second is the one that decides it:
 *   • the message stream is a CLIENT component fed by Realtime — a message that
 *     arrives while the page is open has no server pass to sign anything;
 *   • a signed URL minted once keeps working until it expires, so somebody
 *     removed from a thread keeps their last render's files. Membership is
 *     re-checked here, per request, which is the only shape that revokes.
 *
 * ⚠ THE READ IS THE CALLER'S OWN SESSION, DELIBERATELY. `chat_messages` RLS
 * already gates rows by thread membership, so a stranger's fetch returns no row
 * and gets a 404 — the same answer as a message id that does not exist, which
 * is what stops this route from confirming that someone else's file exists. An
 * admin client here would have made the app-side check the whole fence, and
 * that check is one `if` away from being forgotten.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });

  // 👈 `?removal=options` — what the swipe's sheet may offer on YOUR file (2026-11-13): is it part of the booking, and
  // how long ago was it sent by the SERVER's clock. The database answers for the sender only (`chat_file_removal_options`).
  if (new URL(_req.url).searchParams.get('removal') === 'options') {
    const { data, error } = await supabase.rpc('chat_file_removal_options', { p_message_id: messageId });
    const opt = (Array.isArray(data) ? data[0] : data) as { is_booking: boolean; sent_seconds_ago: number } | undefined;
    if (error || !opt) {
      console.error('[chat-attachment] removal options refused', { messageId, error: error?.message ?? 'no row' });
      return new NextResponse('Not found', { status: 404 });
    }
    return NextResponse.json(
      { booking: opt.is_booking, sentSecondsAgo: opt.sent_seconds_ago },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // RLS decides. A caller who is not a party to this thread reads zero rows and
  // is answered exactly as if the message did not exist.
  const { data, error } = await supabase
    .from('chat_messages')
    .select('thread_id, attachment_r2_key, attachment_url')
    .eq('message_id', messageId)
    .maybeSingle();

  if (error) {
    // ⚠ A refused read is not an empty one, and it must not read as "no such
    // file" in the logs — that is how a broken policy hides as a missing row.
    console.error('[chat-attachment] read failed', { messageId, error: error.message });
    return new NextResponse('Not found', { status: 404 });
  }

  const row = data as {
    thread_id: string;
    attachment_r2_key: string | null;
    attachment_url: string | null;
  } | null;
  if (!row) return new NextResponse('Not found', { status: 404 });

  // 🚪 ONLY OUR OWN STORAGE, ONLY THIS CONVERSATION'S FOLDER.
  // This route used to hand the stored value to `displayUrlForStoredAsset`,
  // which passes any non-`r2://` value through verbatim — so `https://wa.me/…`
  // or `viber://…` in `attachment_url` became a file card that redirected the
  // reader straight out of the app (and an open redirect on setnayan.com).
  // `presignClientRef` signs a thread-files ref under `chat/<this thread>/`
  // and returns null for everything else — a URL, another bucket, another
  // thread's folder, a traversal. Null is answered exactly like a missing
  // message. `attachment_url` is legacy: production never had a row that used
  // it, nothing can write it now (migration 20271221089848), and a value there
  // is signed only if it is itself such a ref.
  const stored = row.attachment_r2_key ?? row.attachment_url ?? null;
  if (!stored) return new NextResponse('Not found', { status: 404 });

  // Short TTL: this URL is handed to one browser for one render. The route is
  // cheap to call again, so there is no reason to mint a long-lived link.
  const url = await presignClientRef(stored, chatAttachmentPolicy(row.thread_id), {
    ttlSeconds: 300,
  });
  if (!url) return new NextResponse('Not found', { status: 404 });

  return NextResponse.redirect(url, {
    status: 302,
    // Never let a shared cache hold a redirect to a signed URL: the next viewer
    // would be served a link minted for somebody else's session.
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

/**
 * 👈 REMOVE YOUR OWN FILE FROM THE CHAT (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING…" + "CHAT FILE UNDO DRAWING
 * APPROVED"). `?mode=undo` is the ↺ ring (10 s), `?mode=everyone` the swipe's red choice (5 min), `?mode=me` hides it
 * for you only.
 *
 * A route method, not a server action: the server-action budget is at its ceiling, and this route already owns "a file
 * in a conversation". The DATABASE decides (`remove_my_chat_file`, migration 20271342335343 — the caller's own session,
 * so `auth.uid()` is theirs): only the sender, only a message that carries a file, only while they can still read the
 * chat, the windows against the row's own created_at, and never a booking file for undo or everyone. A booking file or a
 * closed window answers 409 with the reason so the sheet can say so; anything else is 404, exactly like a message that
 * does not exist. Never a silent success: the caller draws the removal only on a 200.
 *
 * The R2 object goes after the row, best-effort, and never for `me` (the other person and Setnayan keep it): the row
 * is what GET re-proves, so a lingering object is unreachable through the app. It goes through THE pinned choke point
 * (`cleanupDelete`, `every-cleanup-delete-is-pinned.test.ts`), held to the caller's OWN folder in this chat
 * (`chatOwnFileScope` — the send guard files each upload under `chat/<thread>/<sender>/`).
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await ctx.params;
  const mode = new URL(req.url).searchParams.get('mode');
  if (mode !== 'undo' && mode !== 'everyone' && mode !== 'me') return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });

  const { data, error } = await supabase.rpc('remove_my_chat_file', { p_message_id: messageId, p_mode: mode });
  if (error) {
    // A refused write is never silent in the logs either.
    console.error('[chat-attachment] remove refused', { messageId, mode, error: error.message });
    const reason = refusalFromError(error.message);
    if (reason === 'refused') return new NextResponse('Not found', { status: 404 });
    return NextResponse.json({ reason }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { outcome: string; thread_id: string; stored_ref: string | null; removed_at: string }
    | undefined;
  if (!row?.outcome) {
    console.error('[chat-attachment] remove answered no row', { messageId, mode });
    return new NextResponse('Not found', { status: 404 });
  }
  if (row.stored_ref) {
    try {
      const done = await cleanupDelete(row.stored_ref, chatOwnFileScope(row.thread_id, user.id));
      if (done === 'refused') console.error('[chat-attachment] r2 delete refused — not the caller’s own folder (file already removed)', { messageId });
    } catch (err) {
      console.error('[chat-attachment] r2 delete failed (file already removed)', { messageId, error: (err as Error).message });
    }
  }
  return NextResponse.json(
    { outcome: row.outcome, removedAt: row.removed_at },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
