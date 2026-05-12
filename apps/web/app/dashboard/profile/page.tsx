import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('public_id, email, display_name, phone, account_type, is_internal, is_team_member, locale, theme_preference, created_at')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to events
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile &amp; settings
        </h1>
        <p className="text-base text-ink/60">
          Minimal V1 — iteration 0025 ships the full 6-tab settings surface.
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row label="Display name" value={profile?.display_name ?? '—'} />
        <Row label="Email" value={profile?.email ?? user.email ?? '—'} />
        <Row label="Phone" value={profile?.phone ?? '—'} />
        <Row label="Account ID" value={profile?.public_id ?? '—'} mono />
        <Row label="Account type" value={profile?.account_type ?? '—'} />
        <Row label="Locale" value={profile?.locale ?? '—'} />
        <Row
          label="Internal account"
          value={
            profile?.is_internal
              ? '🟣 Yes (§ 10a — owner)'
              : profile?.is_team_member
                ? '🟢 Yes (§ 10b — team pool)'
                : 'No'
          }
        />
        <Row label="Theme preference" value={profile?.theme_preference ?? '—'} />
      </dl>

      <section className="mt-10 space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
        <p className="font-medium text-ink">Coming in iteration 0025 (Profile Settings):</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/60">
          <li>Edit display name, phone, profile photo</li>
          <li>Change theme (Setnayan Default / Victorian / Classy / iOS)</li>
          <li>Notification preferences</li>
          <li>URL &amp; slug for your public landing page</li>
          <li>Payment methods</li>
          <li>RA 10173 — data export, soft/hard account delete, face-data revocation</li>
        </ul>
      </section>

      <section className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form action="/auth/sign-out" method="post">
          <button className="button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 rounded-md border border-ink/10 bg-cream/60 p-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd className={`text-base text-ink ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
