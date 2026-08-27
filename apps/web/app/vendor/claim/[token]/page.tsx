import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Phone } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken } from '@/lib/vendor-invites';
import { declineVendorInviteByToken } from '@/lib/vendor-invite-actions';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell } from '@/app/_components/door/door-shell';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';

export const metadata = {
  title: 'Claim your Setnayan profile',
  // Don't index claim pages — they're per-recipient.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/** 'family' → 'Family'. Only the first letter, matching the guest tree. */
const capitalise = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

export default async function VendorClaimPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();
  const data = await fetchClaimLandingByToken(admin, token);
  if (!data) notFound();

  const { invite, parentVendor, event, existingVendor } = data;
  // Couple-source invites carry a category + event date; admin-source rows
  // don't. We fall back to the invite snapshot for both fields so the
  // claim surface still renders meaningful identity for either source.
  const categoryLabel = parentVendor
    ? (VENDOR_CATEGORY_LABEL[parentVendor.category as VendorCategory] ?? parentVendor.category)
    : (invite.service_category ?? 'Vendor');
  // THE SUPPLIER'S OWN DOOR, OPENED SIGNED OUT FROM AN EMAILED LINK — and it
  // said "They're planning their wedding on 3 September 2026" on every event
  // type. A funeral home invited by a family arranging a wake read that
  // sentence about the funeral it had just been booked for.
  //
  // ⚠ The invite carries `event_id`, so the type was always resolvable; nothing
  // was ever asked. `eventWordsForEvent` reads through the SERVICE-ROLE
  // resolver, which matters here because this page is reached with no session
  // and `public.events` admits no `anon` SELECT — the session-scoped read this
  // resolver used to make answered "wedding" for exactly this kind of visitor
  // (PR #4897). React-`cache()`d, so the four sentences below cost one read.
  //
  // 🔒 A WEDDING READS BYTE-IDENTICALLY (`eventWord` is 'wedding'). An
  // ADMIN-SOURCE invite carries no event at all, and now says "event" where it
  // used to assert a wedding it had no evidence for — the honest direction.
  const words = event ? await eventWordsForEvent(event.event_id) : null;
  const eventWord = words?.eventWord ?? 'event';
  // The eyebrow names WHO sent the invite. `hostNoun` is 'couple' for a wedding
  // (so "Couple invite" is unchanged), 'family' for a funeral, and 'host' for
  // the types whose organiser noun is the honoree — never the honoree itself,
  // which is why it reads `host` and not `organizer`.
  const inviterEyebrow = `${capitalise(words?.host ?? 'host')} invite`;
  const eventDateLabel = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : `their upcoming ${eventWord}`;
  const inviterName = event?.couple_display_name ?? 'Setnayan';

  // ------------------------------------------------------------------
  // Terminal-state surfaces (status !== 'pending')
  // ------------------------------------------------------------------
  if (invite.status === 'claimed') {
    return (
      <TerminalCard
        eyebrow="Already claimed"
        title="This invite has already been claimed."
        body="If this wasn't you, please contact support."
      />
    );
  }
  if (invite.status === 'expired') {
    return (
      <TerminalCard
        eyebrow="Expired"
        title="This invite link has expired."
        body={`Ask ${inviterName} to send you a new one.`}
      />
    );
  }
  if (invite.status === 'revoked') {
    return (
      <TerminalCard
        eyebrow="No longer active"
        title="This invite is no longer active."
        body="If you believe this is a mistake, please contact support."
      />
    );
  }
  if (invite.status === 'declined') {
    return (
      <TerminalCard
        eyebrow="Declined"
        title="This invite was previously declined."
        body={`If you'd like to reconsider, please ask ${inviterName} to send a new invite.`}
      />
    );
  }

  // ------------------------------------------------------------------
  // Auto-share-link branch (2026-05-22) — host locked a manual vendor.
  // Same shape as couple-source for everything except prefill_email
  // (no email captured at invite-create time — vendor enters their
  // own email at signup).
  // ------------------------------------------------------------------
  if (invite.source === 'auto_share_link') {
    const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
    const signupUrl = `/signup?as=vendor&next=${encodeURIComponent(finalizeUrl)}`;
    return (
      <DoorShell
        width="lg"
        eyebrow={inviterEyebrow}
        title={
          <>
            <strong className="font-semibold">{inviterName}</strong> locked you in as their{' '}
            <strong className="font-semibold">{categoryLabel}</strong>.
          </>
        }
        sub={
          <>
            They&rsquo;re planning their {eventWord} on{' '}
            <strong className="text-ink">{eventDateLabel}</strong>. Claim your free Setnayan
            profile to confirm the schedule and keep everything in one place.
          </>
        }
      >
        <article className="space-y-6">
          <section className="rounded-xl bg-cream p-5 ring-1 ring-inset ring-ink/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              What they&rsquo;ve recorded
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SnapshotField
                label="Business"
                value={parentVendor?.vendor_name ?? invite.business_name}
                bold
              />
              <SnapshotField label="Service" value={categoryLabel} />
              {parentVendor?.contact_phone ? (
                <SnapshotField
                  label="Phone"
                  value={parentVendor.contact_phone}
                  icon={<Phone className="h-3.5 w-3.5" strokeWidth={1.75} />}
                />
              ) : null}
            </dl>
            <p className="mt-4 border-t border-dashed border-ink/10 pt-3 text-xs italic text-ink/55">
              Package &amp; payment details stay private until you finish
              signup.
            </p>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              What you get
            </p>
            <ul className="grid grid-cols-1 gap-2 text-sm text-ink/70 sm:grid-cols-2">
              <Perk>Free vendor profile + marketplace listing</Perk>
              <Perk>Chat with {inviterName} in-app</Perk>
              <Perk>Calendar + payments + contracts tracking</Perk>
              <Perk>Marketplace exposure to other PH couples</Perk>
              <Perk className="sm:col-span-2">
                No upfront cost · no credit card required
              </Perk>
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href={signupUrl}
              className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
            >
              Claim &amp; sign up
            </Link>
            <DeclineForm token={invite.claim_token} />
          </div>
          <p className="text-xs text-ink/50">
            Not the right vendor? Just ignore this page — we won&rsquo;t
            follow up.
          </p>
        </article>
      </DoorShell>
    );
  }

  // ------------------------------------------------------------------
  // Admin-source branch (2026-05-21) — Setnayan team pre-created the
  // account. No couple, no event, no event_vendors row to link. Simpler
  // surface: "the Setnayan team set up a profile for you, claim it".
  // ------------------------------------------------------------------
  if (invite.source === 'admin') {
    const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
    // Admin invites always carry an email (enforced by the
    // vendor_invites_source_vendor_consistency CHECK), but we defend
    // against null just in case future drift relaxes the rule.
    const emailQs = invite.email
      ? `prefill_email=${encodeURIComponent(invite.email)}&`
      : '';
    const signupUrl = `/signup?as=vendor&${emailQs}next=${encodeURIComponent(finalizeUrl)}`;
    const signInUrl = `/login?next=${encodeURIComponent(finalizeUrl)}`;
    return (
      <DoorShell
        width="lg"
        eyebrow="Team invite"
        title={
          <>
            The Setnayan team set up a profile for{' '}
            <strong className="font-semibold">{invite.business_name}</strong>.
          </>
        }
        sub="Claim it now to add your photos, services, and pricing. Couples browsing the marketplace will see you once you publish."
      >
        <article className="space-y-6">
          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              What you get
            </p>
            <ul className="grid grid-cols-1 gap-2 text-sm text-ink/70 sm:grid-cols-2">
              <Perk>Free vendor profile + marketplace listing</Perk>
              <Perk>Chat with couples in-app</Perk>
              <Perk>Calendar + bookings dashboard</Perk>
              <Perk>0% commission on bookings</Perk>
              <Perk className="sm:col-span-2">No upfront cost · no credit card required</Perk>
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            {existingVendor ? (
              <Link
                href={signInUrl}
                className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
              >
                Sign in &amp; claim
              </Link>
            ) : (
              <Link
                href={signupUrl}
                className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
              >
                Claim &amp; sign up
              </Link>
            )}
            <DeclineForm token={invite.claim_token} />
          </div>
          <p className="text-xs text-ink/50">
            Not the right business? Just ignore this page — we won&rsquo;t follow up.
          </p>
        </article>
      </DoorShell>
    );
  }

  // ------------------------------------------------------------------
  // Already-on-Setnayan branch — email matches an existing vendor account.
  // (Couple-source only; admin-source already returned above.)
  // ------------------------------------------------------------------
  if (existingVendor) {
    const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
    const signInUrl = `/login?next=${encodeURIComponent(finalizeUrl)}`;
    return (
      <DoorShell
        width="lg"
        eyebrow="Already a vendor"
        title={
          <>
            You&rsquo;re already on Setnayan as{' '}
            <strong className="font-semibold">{existingVendor.business_name}</strong>.
          </>
        }
        sub={
          <>
            <strong className="text-ink">{inviterName}</strong> wants to connect their{' '}
            {eventWord} ({eventDateLabel}) to your existing profile.
          </>
        }
      >
        <article className="space-y-6">
          {/* The reassurance that used to be carried by a green eyebrow now
              lives here, where it can be a whole sentence instead of two
              words — and the eyebrow stays the one doorway colour. */}
          <div className="rounded-lg bg-success-50 p-4 text-sm text-ink/75 ring-1 ring-inset ring-success-200">
            <p className="leading-relaxed">
              On connect, this engagement appears in your Clients pipeline at the Inquiry
              stage. Chat unlocks immediately. <strong>No duplicate profile created.</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={signInUrl}
              className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
            >
              Sign in &amp; connect
            </Link>
            <DeclineForm token={invite.claim_token} />
          </div>
        </article>
      </DoorShell>
    );
  }

  // ------------------------------------------------------------------
  // Default branch — fresh signup path (couple source).
  // ------------------------------------------------------------------
  const finalizeUrl = `/vendor/claim/${invite.claim_token}/finalize`;
  // Couple-source invites always carry an email (enforced by the
  // vendor_invites_source_vendor_consistency CHECK), but we defend against
  // null with a fallback to a no-prefill signup just in case.
  const emailQs = invite.email
    ? `prefill_email=${encodeURIComponent(invite.email)}&`
    : '';
  const signupUrl = `/signup?as=vendor&${emailQs}next=${encodeURIComponent(finalizeUrl)}`;

  return (
    <DoorShell
      width="lg"
      eyebrow={inviterEyebrow}
      title={
        <>
          <strong className="font-semibold">{inviterName}</strong> invited you to claim your
          free Setnayan profile.
        </>
      }
      sub={
        <>
          They&rsquo;ve added you as their{' '}
          <strong className="text-ink">{categoryLabel}</strong> for their {eventWord} on{' '}
          <strong className="text-ink">{eventDateLabel}</strong>.
        </>
      }
    >
      <article className="space-y-6">

        {/* Identity snapshot — IDENTITY ONLY per the 2026-05-19 privacy lock.
            No package, inclusions, milestones, or meetings. Vendor sees those
            the moment they finish signup. */}
        <section className="rounded-xl bg-cream p-5 ring-1 ring-inset ring-ink/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What they&rsquo;ve recorded
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SnapshotField
              label="Business"
              value={parentVendor?.vendor_name ?? invite.business_name}
              bold
            />
            <SnapshotField label="Service" value={categoryLabel} />
            {parentVendor?.contact_email ? (
              <SnapshotField
                label="Email"
                value={parentVendor.contact_email}
                icon={<Mail className="h-3.5 w-3.5" strokeWidth={1.75} />}
              />
            ) : null}
            {parentVendor?.contact_phone ? (
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
            <Perk>Chat with {inviterName} in-app</Perk>
            <Perk>Payment + contract tracking pre-filled</Perk>
            <Perk>Marketplace exposure to other PH couples</Perk>
            <Perk className="sm:col-span-2">No upfront cost · no credit card required</Perk>
          </ul>
        </section>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={signupUrl}
            className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
          >
            Claim &amp; sign up
          </Link>
          <DeclineForm token={invite.claim_token} />
        </div>
        <p className="text-xs text-ink/50">
          Not the right vendor? Just ignore this page — we won&rsquo;t follow up.
        </p>
      </article>
    </DoorShell>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * The four terminal states (already claimed · expired · revoked · not found).
 *
 * Ported onto the shared <DoorShell> in `dead_end` tone (2026-08-17) so a
 * supplier who reaches the end of this link meets the same screen a guest meets
 * at the end of theirs. DoorShell renders the page frame itself, which is why
 * the local wrapper this file used to declare is gone rather than wrapped
 * around it — two nested page frames is what that would have produced.
 */
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
    <DoorShell tone="dead_end" eyebrow={eyebrow} title={title} sub={body} width="lg">
      <Link href="/" className="button-secondary">
        Back to Setnayan
      </Link>
    </DoorShell>
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
