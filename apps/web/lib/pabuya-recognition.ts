import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { viewerIsRecognised } from '@/lib/pabuya-recognition-rule';

/**
 * apps/web/lib/pabuya-recognition.ts (server-only)
 *
 * DOES THIS CELEBRATION RECOGNISE THE READER? — the single definition.
 *
 * ⚖ OWNER RULING 2026-09-15, twice: *"gate the account number"*, then *"gate
 * the gcash number too."* Every payment identifier on a gifts page — the bank
 * number, the wallet handle, AND the QR image — is shown to invited guests and
 * to hosts, never to the internet. A wallet handle is a mobile number; that it
 * can be changed in an app makes it recoverable, not public.
 *
 * 🔑 THE QR IS AN IDENTIFIER, NOT A PICTURE. A bank QR ENCODES the account the
 * number was hidden to protect. Gating the digits and printing the code beside
 * them is a gate with a window next to it.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO COPIES (2026-09-16) ───────────────────
 * The rule used to live inline in `app/[slug]/pabuya/page.tsx` alone, which was
 * enough while the page was the only thing that could hand out a QR: the image
 * arrived as a short-lived presigned URL the page minted only for a recognised
 * reader. Making the QR permanent (`/api/pabuya/qr/[publicId]`) created a
 * SECOND way to ask for the same bytes — and a route that asked a weaker
 * question would have re-opened exactly what the ruling closed, while the
 * page's own guard stayed green.
 *
 * ⚠ A GATE IS ONLY AS STRONG AS ITS WEAKEST DOOR. Both doors now import this.
 *
 * ── WHAT COUNTS AS RECOGNITION ─────────────────────────────────────────────
 *   • a guest session FOR THIS EVENT — the guest opened their personal link or
 *     scanned their invitation QR on this device; or
 *   • a signed-in HOST — an `event_members` row whose `member_type` passes
 *     `isHostMemberType`.
 *
 * ⚠ `isHostMemberType`, NEVER `Boolean(row)`. A `guest`-typed member row once
 * waved somebody into a private site because membership was tested for
 * existence and never compared.
 *
 * ⚠ Somebody the couple forwarded the link to is a PASSER-BY, deliberately.
 * Holding the link is how a relative abroad reaches the page at all; it is not
 * how they earn the account number.
 */
export async function viewerIsRecognisedForEvent(eventId: string): Promise<boolean> {
  /*
    I/O ONLY. Every decision below belongs to `viewerIsRecognised`
    (lib/pabuya-recognition-rule.ts), which is pure and is EXECUTED by its test.

    🔑 THIS FUNCTION USED TO BE BOTH, AND THAT IS WHY THE RULE WAS UNGUARDED.
    This module is `server-only`, so nothing can import it; the three tests that
    "covered" it were `assert.match` over its own source text, and a rename
    inside it passed all three. A rule the owner gave twice — protecting bank
    account numbers — was held by regexes over prose. The facts are gathered
    here; what they MEAN is decided somewhere a test can run.

    ⚠ `memberType` is handed over as the raw string, never as a `hasRow`
    boolean. host-scope.ts records the regression that shape caused once: a
    `guest`-typed member row waved somebody into a private site because
    membership was tested for existence and never compared.
  */
  const guestSession = await readGuestSession();

  let memberType: string | null = null;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) {
    const { data: member } = await sb
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    memberType =
      (member as { member_type?: string | null } | null)?.member_type ?? null;
  }

  return viewerIsRecognised({
    guestSessionEventId: guestSession?.event_id ?? null,
    eventId,
    memberType,
  });
}
