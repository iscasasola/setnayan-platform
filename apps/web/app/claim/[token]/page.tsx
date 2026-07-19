import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { claimAlaga } from './actions';

export const metadata = { title: 'Claim your profile' };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * The alaga claim/rehome landing (owner-locked 2026-07-16 ownership rule).
 * A guardian shares this link; the recipient signs in (or up) and redeems it:
 * a PERSON (≥18) takes ownership of their own profile; a pet/other transfers
 * care to a new guardian. Validation is read here with the service role (the
 * visitor has no RLS path to the row pre-claim); the redemption itself is the
 * atomic UPDATE in ./actions.
 */
export default async function ClaimAlagaPage({ params, searchParams }: Props) {
  if (!dependentPeopleEnabled()) redirect('/');
  const { token } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('dependents')
    .select('name, dependent_kind, claim_token_purpose, claim_token_expires_at, handed_over_at, owner_user_id')
    .eq('claim_token', token)
    .maybeSingle();

  const valid =
    !!row &&
    !row.handed_over_at &&
    !!row.claim_token_expires_at &&
    new Date(row.claim_token_expires_at) > new Date();

  if (!valid || search.error === 'invalid') {
    return (
      <Shell>
        <h1 className="font-medium text-ink">This link isn&rsquo;t active</h1>
        <p className="mt-2 text-sm text-ink/60">
          It may have expired, been revoked, or already been used. Ask the person who sent it to
          create a fresh one from their People page.
        </p>
      </Shell>
    );
  }

  const isClaim = row.claim_token_purpose === 'claim';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.id === row.owner_user_id) {
    return (
      <Shell>
        <h1 className="font-medium text-ink">This is your own link</h1>
        <p className="mt-2 text-sm text-ink/60">
          Share it with {isClaim ? `${row.name} so they can claim their profile` : `the person taking over ${row.name}'s care`} —
          it can&rsquo;t be redeemed by you.
        </p>
        <Link href="/dashboard/people" className="button-secondary mt-4 inline-flex">
          Back to People
        </Link>
      </Shell>
    );
  }

  const heading = isClaim ? `Claim your profile, ${row.name}` : `Take over ${row.name}'s care`;
  const body = isClaim
    ? `A guardian has kept your profile — your dates and milestones — inside their Setnayan account while you grew up. You're of age now: claiming it makes it yours. They'll keep the memories, read-only.`
    : `A guardian wants to hand ${row.name}'s profile over to you. Accepting moves it into your account — their dates and celebrations become yours to keep.`;

  return (
    <Shell>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink/40">Alaga</p>
      <h1 className="mt-1 font-medium text-ink">{heading}</h1>
      <p className="mt-2 text-sm text-ink/60">{body}</p>
      {user ? (
        <form action={claimAlaga} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="button-primary" pendingLabel="Claiming…">
            {isClaim ? 'Claim my profile' : `Take over ${row.name}'s care`}
          </SubmitButton>
        </form>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`} className="button-primary">
            Sign in to continue
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(`/claim/${token}`)}`} className="button-secondary">
            Create your account
          </Link>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
