import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';

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

  // RLS decides. A caller who is not a party to this thread reads zero rows and
  // is answered exactly as if the message did not exist.
  const { data, error } = await supabase
    .from('chat_messages')
    .select('attachment_r2_key, attachment_url, attachment_name')
    .eq('message_id', messageId)
    .maybeSingle();

  if (error) {
    // ⚠ A refused read is not an empty one, and it must not read as "no such
    // file" in the logs — that is how a broken policy hides as a missing row.
    console.error('[chat-attachment] read failed', { messageId, error: error.message });
    return new NextResponse('Not found', { status: 404 });
  }

  const row = data as {
    attachment_r2_key: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
  } | null;
  // `attachment_url` is the legacy public column — no writer has set it since
  // 2026-09-09 and prod never had a row that used it, but a stored value there
  // is still somebody's file, so it is honoured rather than dropped.
  const stored = row?.attachment_r2_key ?? row?.attachment_url ?? null;
  if (!stored) return new NextResponse('Not found', { status: 404 });

  // Short TTL: this URL is handed to one browser for one render. The route is
  // cheap to call again, so there is no reason to mint a long-lived link.
  const url = await displayUrlForStoredAsset(stored, { ttlSeconds: 300 });
  if (!url) return new NextResponse('Not found', { status: 404 });

  return NextResponse.redirect(url, {
    status: 302,
    // Never let a shared cache hold a redirect to a signed URL: the next viewer
    // would be served a link minted for somebody else's session.
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
