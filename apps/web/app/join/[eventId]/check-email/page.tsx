/**
 * /join/[eventId]/check-email — "we've emailed you a sign-in link".
 *
 * Ported onto the shared <DoorShell> (2026-08-17). It previously hand-copied
 * JoinShell's wrapper rather than importing it, and painted its icon in
 * `text-terracotta` — the atelier gold, 3.37:1 on cream.
 *
 * NO PROGRESS RAIL, deliberately. The wizard archetype's rail is for a flow
 * with 2+ DECISIONS; this screen asks for nothing. A rail here would promise a
 * sequence they are not in.
 *
 * ── 🔴 IT WAS A DEAD END, AND THE PRODUCT INVERTED ITS OWN REWARD ────────────
 * Until 2026-08-24 this page carried no link of any kind. Its only pressable
 * thing was the wordmark in the shell — described there as "the way out", and
 * pointing at the marketing site. Meanwhile the SAME server action, one
 * `if (email)` branch away, redirects a guest who declines to give an address
 * straight onto `/{slug}`. The person who asked for an account got the worse
 * ending than the person who did not.
 *
 * The sharpest of the four callers is `claimAccountAction`, which runs from a
 * box headed "Keep this on your phone" on the celebration page itself: a guest
 * standing on `/{slug}` typed their email and was thrown off the page they were
 * reading, with the browser Back button as the only way back.
 *
 * ⚖ THE HARM, STATED HONESTLY: the emailed link does eventually land them on
 * the celebration (`connect/route.ts`). So this was "the way back is minutes
 * away by email when it should be one tap away now" — not "they can never get
 * in". The fix is sized to that.
 *
 * ── ⚠ WHY THE LINK IS GATED ON THE SESSION, NOT MERELY ON THE SLUG ──────────
 * Rendering it whenever a slug exists would turn this route into a
 * UUID → public-address resolver, on a page that today discloses nothing about
 * the event; and it would paint the action colour for a visitor this page has
 * never established will be admitted, which on a private event delivers a lock
 * screen. That is the same class of lie the fix exists to remove.
 * All four callers mint or require a guest session for this exact event first,
 * so the gate costs a real guest nothing.
 *
 * ⛔ THE SIBLING'S `/dashboard` FALLBACK IS DELIBERATELY NOT COPIED. It is right
 * on `success`, whose visitor is signed in. This visitor is not — they are
 * waiting for the link — so `/dashboard` would bounce them to `/login`: a worse
 * dead end than the one being removed. No slug, no extra block.
 */
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';

export const metadata = { title: 'Check your email' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ params, searchParams }: Props) {
  const email = (await searchParams).email ?? '';
  const { eventId } = await params;

  // The destination comes from the DATABASE, never from the caller. Passing
  // `?slug=` in from the four call sites would be four edits instead of one AND
  // would re-open the open-redirect lesson `/[slug]/redeem` paid for on
  // 2026-08-06, which its own test still pins.
  let slug: string | null = null;
  const session = await readGuestSession();
  if (session?.event_id === eventId) {
    const { data: event } = await createAdminClient()
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    slug = event?.slug ?? null;
  }

  return (
    <DoorShell
      eyebrow={
        <>
          <MailCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Check your email
        </>
      }
      title="Your sign-in link is on its way."
      sub={
        <>
          We sent it{email ? <> to <span className="font-medium text-ink">{email}</span></> : null}.
          Tap it to finish setting up your Setnayan account — your event will be waiting there,
          on any device.
        </>
      }
    >
      <DoorNotice>
        You&rsquo;re already on the guest list — the link just lets you sign in later.
      </DoorNotice>
      {/* ⚠ The notice above used to end "You can close this tab." That sentence
          and this button cannot both stand: one says nothing is left to do, the
          other asks them to stay. The notice keeps the reassurance — the true
          and load-bearing half — and drops only the dismissal. */}
      {slug ? (
        <>
          <p className="text-sm text-ink/70">
            No need to wait for it, though — your invitation is open right now.
          </p>
          <Link className="button-primary w-full sm:w-auto" href={`/${slug}`}>
            Open your invitation
          </Link>
        </>
      ) : null}
    </DoorShell>
  );
}
