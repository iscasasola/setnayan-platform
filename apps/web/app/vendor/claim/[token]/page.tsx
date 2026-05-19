import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Phone } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken } from '@/lib/vendor-invites';
import { declineVendorInviteByToken } from '@/lib/vendor-invite-actions';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = {
  title: 'Claim your Setnayan profile',
  // Don't index claim pages — they're per-recipient.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function VendorClaimPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();
  const data = await fetchClaimLandingByToken(admin, token);
  if (!data) notFound();

  const { invite, parentVendor, event, existingVendor } = data;
  const categoryLabel =
    VENDOR_CATEGORY_LABEL[parentVendor.category as VendorCategory] ?? parentVendor.category;
  const eventDateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'their upcoming wedding';

  // ------------------------------------------------------------------
  // Terminal-state surfaces (status !== 'pending')
  // ------------------------------------------------------------------
  if (invite.status === 'claimed') {
    return (
      <ClaimShell>
        <TerminalCard
          eyebrow="Setnayan · Already claimed"
          title="This invite has already been claimed."
          body="If this wasn't you, please contact support."
        />
      </ClaimShell>
    );
  }
  if (invite.status === 'expired') {
    return (
      <ClaimShell>
        <TerminalCard
          eyebrow="Setnayan · Expired"
          title="This invite link has expired."
          body={`Ask ${event.couple_display_name} to send you a new one.`}
        />
      </ClaimShell>
    );
  }
  if (invite.status === 'revoked') {
    return (
      <ClaimShell>
        <TerminalCard
          eyebrow="Setnayan · No longer active"
          title="This invite is no longer active."
          body="If you believe this is a mistake, please contact support."
        />
      </ClaimShell>
    );
  }
  if (invite.status === 'declined') {
    return (
      <ClaimShell>
        <TerminalCard
          eyebrow="Setnayan · Declined"
          title="This invite was previously declined."
          body={`If you'd like to reconsider, please ask ${event.couple_display_name} to send a new invite.`}
        />
      </ClaimShell>
    );
  }

  // ------------------------------------------------------------------
  // Already-on-Setnayan branch — email matches an existing vendor account.
  // ------------------------------------------------------------------
  if (existingVendor) {
    const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
    const signInUrl = `/login?next=${encodeURIComponent(finalizeUrl)}`;
    return (
      <ClaimShell>
        <article className="space-y-6">
          <header className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700">
              Setnayan · Already a vendor
            </p>
            <h1 className="font-serif text-3xl font-medium leading-tight text-ink sm:text-4xl">
              You&rsquo;re already on Setnayan as{' '}
              <strong className="font-semibold">{existingVendor.business_name}</strong>.
            </h1>
            <p className="text-base text-ink/70">
              <strong className="text-ink">{event.couple_display_name}</strong> wants to
              connect their wedding ({eventDateLabel}) to your existing profile.
            </p>
          </header>

          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-ink/75 ring-1 ring-inset ring-emerald-200">
            <p className="leading-relaxed">
              On connect, this engagement appears in your Clients pipeline at the Inquiry
              stage. Chat unlocks immediately. <strong>No duplicate profile created.</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={signInUrl}
              className="inline-flex items-center justify-center rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-700"
            >
              Sign in &amp; connect
            </Link>
            <DeclineForm token={invite.claim_token} />
          </div>
        </article>
      </ClaimShell>
    );
  }

  // ------------------------------------------------------------------
  // Default branch — fresh signup path.
  // ------------------------------------------------------------------
  const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
  const signupUrl = `/signup?as=vendor&prefill_email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(finalizeUrl)}`;

  return (
    <ClaimShell>
      <article className="space-y-6">
        <header className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Setnayan · Couple invite
          </p>
          <h1 className="font-serif text-3xl font-medium leading-tight text-ink sm:text-4xl">
            <strong className="font-semibold">{event.couple_display_name}</strong> invited
            you to claim your free Setnayan profile.
          </h1>
          <p className="text-base text-ink/70">
            They&rsquo;ve added you as their{' '}
            <strong className="text-ink">{categoryLabel}</strong> for their wedding on{' '}
            <strong className="text-ink">{eventDateLabel}</strong>.
          </p>
        </header>

        {/* Identity snapshot — IDENTITY ONLY per the 2026-05-19 privacy lock.
            No package, inclusions, milestones, or meetings. Vendor sees those
            the moment they finish signup. */}
        <section className="rounded-xl bg-cream p-5 ring-1 ring-inset ring-ink/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What they&rsquo;ve recorded
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SnapshotField label="Business" value={parentVendor.vendor_name} bold />
            <SnapshotField label="Service" value={categoryLabel} />
            {parentVendor.contact_email ? (
              <SnapshotField
                label="Email"
                value={parentVendor.contact_email}
                icon={<Mail className="h-3.5 w-3.5" strokeWidth={1.75} />}
              />
            ) : null}
            {parentVendor.contact_phone ? (
              <SnapshotField
                label="Phone"
                value={parentVendor.contact_phone}
                icon={<Phone className="h-3.5 w-3.5" strokeWidth={1.75} />}
              />
            ) : null}
          </dl>
          <p className="mt-4 border-t border-dashed border-ink/10 pt-3 text-xs italic text-ink/55">
            Package &amp; payment details stay private until you finish signup.
          </p>
        </section>

        {/* Why-claim strip — vendor-value pitch. */}
        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What you get
          </p>
          <ul className="grid grid-cols-1 gap-2 text-sm text-ink/70 sm:grid-cols-2">
            <Perk>Free vendor profile + marketplace listing</Perk>
            <Perk>Chat with {event.couple_display_name} in-app</Perk>
            <Perk>Payment + contract tracking pre-filled</Perk>
            <Perk>Marketplace exposure to other PH couples</Perk>
            <Perk className="sm:col-span-2">No upfront cost · no credit card required</Perk>
          </ul>
        </section>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={signupUrl}
            className="inline-flex items-center justify-center rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-700"
          >
            Claim &amp; sign up
          </Link>
          <DeclineForm token={invite.claim_token} />
        </div>
        <p className="text-xs text-ink/50">
          Not the right vendor? Just ignore this page — we won&rsquo;t follow up.
        </p>
      </article>
    </ClaimShell>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-page py-12 px-4 sm:py-20">
      <div className="mx-auto max-w-xl">{children}</div>
    </main>
  );
}

function TerminalCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="space-y-3 rounded-xl bg-cream p-8 ring-1 ring-inset ring-ink/10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        {eyebrow}
      </p>
      <h1 className="font-serif text-2xl font-medium text-ink">{title}</h1>
      <p className="text-sm text-ink/70">{body}</p>
    </article>
  );
}

function SnapshotField({
  label,
  value,
  icon,
  bold,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </dt>
      <dd
        className={`mt-1 inline-flex items-center gap-1.5 text-sm text-ink ${
          bold ? 'font-semibold' : ''
        }`}
      >
        {icon}
        {value}
      </dd>
    </div>
  );
}

function Perk({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={`inline-flex items-start gap-2 rounded-md bg-cream px-3 py-2 ring-1 ring-inset ring-ink/10 ${className}`}
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-terracotta" strokeWidth={1.75} />
      <span>{children}</span>
    </li>
  );
}

function DeclineForm({ token }: { token: string }) {
  return (
    <form action={declineVendorInviteByToken}>
      <input type="hidden" name="claim_token" value={token} />
      <SubmitButton
        className="inline-flex items-center justify-center rounded-md bg-cream px-6 py-3 text-sm font-medium text-ink/70 ring-1 ring-inset ring-ink/15 hover:bg-ink/5"
        pendingLabel="…"
      >
        I&rsquo;m not this vendor
      </SubmitButton>
    </form>
  );
}
