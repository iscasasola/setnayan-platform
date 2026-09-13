import { createClient } from '@/lib/supabase/server';
import { resolveOfferedServiceCard } from '@/lib/offered-service-card';

/**
 * GET /api/chat/offered-service/[messageId]
 *
 * The card for a message that offers one of the thread supplier's services —
 * cover photo, showcase clip, price, what is included.
 *
 * ── WHY THIS IS A ROUTE AND NOT A PROP ─────────────────────────────────────
 * `chat-message-stream.tsx` is a CLIENT component and messages arrive over
 * realtime, so a card resolved once on the server would be missing on exactly
 * the offer that just landed — the one the couple is looking at. Every other
 * card type in that stream (proposal · appointment · amendment) fetches itself
 * per id for the same reason. Those can read their table straight from the
 * browser; this one cannot, because a presigned URL can only be signed with a
 * secret, server-side. So the fetch goes through here.
 *
 * ⚠ THE MEDIA MUST NEVER BE HANDED OUT AS A PLAIN URL. What this returns are
 * short-lived presigned links produced by `displayUrlForStoredAsset`, not the
 * stored `r2://…` refs and not permanent public addresses.
 *
 * Membership is proved by the resolver's first read — the message is read under
 * THIS caller's cookie session and the chat_messages SELECT policy admits only
 * the two parties to the conversation. Nothing here re-derives it.
 *
 * 🔑 A REFUSED READ AND AN ABSENT CARD GET DIFFERENT STATUS CODES (404 vs 502),
 * because the stream draws them differently: an absence is a plain bubble, a
 * refusal says so. Collapsing them is how "we couldn't load it" becomes
 * "they never sent one" in a conversation where someone is waiting on it.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const result = await resolveOfferedServiceCard(supabase, messageId);
  if (result.status === 'error') {
    return Response.json({ error: 'error' }, { status: 502 });
  }
  if (result.status === 'not_found') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  // Presigned links expire; never let a shared cache hold them.
  return Response.json(
    { card: result.card },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
