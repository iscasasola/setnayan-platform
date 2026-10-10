/**
 * The claim page's presentational parts — no data, no session, no action.
 *
 * `SnapshotField` and `Perk` were private to `page.tsx` and are moved here
 * unchanged, so the page and `CoupleLinkDoor` draw the SAME field and the same
 * perk. `CoupleLinkDoor` is the door a supplier meets on a COUPLE'S OWN LINK.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Phone, Sparkles } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';

/**
 * The door on a couple's own link (`vendor_invites.source = 'auto_share_link'`
 * — the link "Add your own" makes).
 *
 * WHO INVITED THEM, AND THE DATE (owner 2026-10-10, "3 yes" — supersedes the
 * 2026-05-19 identity-only lock for a couple's own link, for these two facts
 * only). The words are the emailed couple invite's own: the title this replaces
 * said the supplier had been "locked in", about a record the couple's page
 * calls "your record, not a booking".
 *
 * 🔒 STILL PRIVATE UNTIL THEY JOIN: the price, what is included and the payment
 * plan. They are NAMED here ("What they wrote … after you join"), never shown —
 * this component is not given them.
 */
export function CoupleLinkDoor({
  eyebrow,
  inviterName,
  categoryLabel,
  eventWord,
  datePhrase,
  businessName,
  contactPerson,
  contactPhone,
  signupUrl,
  decline,
}: {
  eyebrow: string;
  /** The inviters' first names. */
  inviterName: string;
  categoryLabel: string;
  eventWord: string;
  /** Null when the couple has not set a date — the sentence then ends at the event. */
  datePhrase: { preposition: 'on' | 'in'; label: string } | null;
  businessName: string;
  /** Who the couple said they talk to — the supplier's own name, as typed. */
  contactPerson: string | null;
  contactPhone: string | null;
  signupUrl: string;
  /** The "I'm not this supplier" control — the page's own form. */
  decline: ReactNode;
}) {
  return (
    <DoorShell
      width="lg"
      eyebrow={eyebrow}
      title={
        <>
          <strong className="font-semibold">{inviterName}</strong> invited you to claim your
          free Setnayan profile.
        </>
      }
      sub={
        <>
          They&rsquo;ve added you as their{' '}
          <strong className="text-ink">{categoryLabel}</strong> for their {eventWord}
          {datePhrase ? (
            <>
              {' '}
              {datePhrase.preposition} <strong className="text-ink">{datePhrase.label}</strong>
            </>
          ) : null}
          .
        </>
      }
    >
      <article className="space-y-6" data-couple-link-door="">
        <section className="rounded-xl bg-cream p-5 ring-1 ring-inset ring-ink/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What they&rsquo;ve recorded
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SnapshotField label="Business" value={businessName} bold />
            <SnapshotField label="Service" value={categoryLabel} />
            {contactPerson ? <SnapshotField label="Who they talk to" value={contactPerson} /> : null}
            {contactPhone ? (
              <SnapshotField
                label="Phone"
                value={contactPhone}
                icon={<Phone className="h-3.5 w-3.5" strokeWidth={1.75} />}
              />
            ) : null}
            {/* Named, not shown: what they wrote opens once the supplier has joined. */}
            <SnapshotField
              label="What they wrote"
              value="Price · what’s included · your payment plan — after you join"
            />
          </dl>
          <p className="mt-4 border-t border-dashed border-ink/10 pt-3 text-xs italic text-ink/55">
            Package &amp; payment details stay private until you finish signup.
          </p>
        </section>

        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What you get
          </p>
          <ul className="grid grid-cols-1 gap-2 text-sm text-ink/70 sm:grid-cols-2">
            <Perk>Free supplier profile + marketplace listing</Perk>
            <Perk>Chat with {inviterName} in-app</Perk>
            <Perk>Calendar + payments + contracts tracking</Perk>
            <Perk>Marketplace exposure to other PH couples</Perk>
            <Perk className="sm:col-span-2">No upfront cost · no credit card required</Perk>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={signupUrl}
            className="inline-flex items-center justify-center rounded-md bg-mulberry px-6 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
          >
            Claim &amp; sign up
          </Link>
          {decline}
        </div>
        <p className="text-xs text-ink/50">
          Not the right supplier? Just ignore this page — we won&rsquo;t follow up.
        </p>
      </article>
    </DoorShell>
  );
}

export function SnapshotField({
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

export function Perk({
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
