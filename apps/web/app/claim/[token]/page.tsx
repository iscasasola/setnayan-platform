/**
 * /claim/[token] — the Alaga claim / rehome landing (owner-locked 2026-07-16
 * ownership rule). A guardian shares this link; the recipient signs in (or up)
 * and redeems it: a PERSON (≥18) takes ownership of their own profile; a
 * pet/other transfers care to a new guardian.
 *
 * Ported onto the shared <DoorShell> (2026-08-17). It carried its own local
 * `Shell()` — one of six hand-rolled door wrappers — on a `bg-white/70` card,
 * the same translucent-white fill design#6 had already removed from the eight
 * public doorways.
 *
 * Validation is still read with the service role (the visitor has no RLS path
 * to the row pre-claim); the redemption itself is the atomic UPDATE in
 * ./actions. None of that moved.
 */
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorActions } from '@/app/_components/door/door-shell';
import { claimAlaga } from './actions';
import { actionButtonClass } from '@/components/action-button-class';

export const metadata = { title: 'Claim your profile' };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ClaimAlagaPage({ params, searchParams }: Props) {
  if (!dependentPeopleEnabled()) redirect('/');
  const { token } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from('dependents')
    .select('name, dependent_kind, claim_token_purpose, claim_token_expires_at, handed_over_at, owner_user_id')
    .eq('claim_token', token)
    .maybeSingle();

  // 🔌 A4-04: the profile moved to this account, its godparent records did not (the claim cleared the token, so this
  // address now reads as used — the message comes first).
  if (search.error === 'godparents_pending') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Loved ones"
        title="Your profile is yours — one part didn’t finish."
        sub="The profile moved to your account, but its godparent records didn’t come with it. Contact Setnayan support and we’ll move them for you."
      >
        <Link className={actionButtonClass('neutral', { extra: '!h-11' })} href="/dashboard?seg=people">
          Go to your people
        </Link>
      </DoorShell>
    );
  }

  // 🔌 A4-03: a failed read is not a dead link — a valid link is never called dead.
  if (rowErr || search.error === 'unreadable') {
    if (rowErr) console.error('[supabase-error] app/claim/[token]/page.tsx · dependents.select', rowErr);
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Loved ones"
        title="We couldn’t check this link just now."
        sub="Your link is probably fine. Give it a moment and try again."
      >
        <Link className={actionButtonClass('brand', { main: true, extra: '!h-11' })} href={`/claim/${encodeURIComponent(token)}`}>
          Try again
        </Link>
      </DoorShell>
    );
  }

  const valid =
    !!row &&
    !row.handed_over_at &&
    !!row.claim_token_expires_at &&
    new Date(row.claim_token_expires_at) > new Date();

  if (!valid || search.error === 'invalid') {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Loved ones"
        title="This link isn't active."
        sub="It may have expired, been revoked, or already been used. Ask the person who sent it to create a fresh one from their People page."
      >
        <Link className={actionButtonClass('neutral', { extra: '!h-11' })} href="/">
          Back home
        </Link>
      </DoorShell>
    );
  }

  const isClaim = row.claim_token_purpose === 'claim';
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (user && user.id === row.owner_user_id) {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Loved ones"
        title="This is your own link."
        sub={
          isClaim
            ? `Share it with ${row.name} so they can claim their profile — it can't be redeemed by you.`
            : `Share it with the person taking over ${row.name}'s care — it can't be redeemed by you.`
        }
      >
        <Link href="/dashboard?seg=people" className={actionButtonClass('neutral', { extra: '!h-11' })}>
          Back to People
        </Link>
      </DoorShell>
    );
  }

  const heading = isClaim ? `Claim your profile, ${row.name}` : `Take over ${row.name}'s care`;
  const body = isClaim
    ? `A guardian has kept your profile — your dates and milestones — inside their Setnayan account while you grew up. You're of age now: claiming it makes it yours. They'll keep the memories, read-only.`
    : `A guardian wants to hand ${row.name}'s profile over to you. Accepting moves it into your account — their dates and events become yours to keep.`;

  return (
    <DoorShell eyebrow="Loved ones" title={heading} sub={body}>
      {user ? (
        <form action={claimAlaga}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Claiming…">
            {isClaim ? 'Claim my profile' : `Take over ${row.name}'s care`}
          </SubmitButton>
        </form>
      ) : (
        <DoorActions>
          <Link href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`} className={actionButtonClass('brand', { main: true, extra: '!h-11' })}>
            Sign in to continue
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(`/claim/${token}`)}`} className={actionButtonClass('neutral', { extra: '!h-11' })}>
            Create your account
          </Link>
        </DoorActions>
      )}
    </DoorShell>
  );
}
