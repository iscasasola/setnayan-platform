/**
 * The claim page's presentational parts — no data, no session, no action.
 *
 * `SnapshotField` and `Perk` were private to `page.tsx` and are moved here
 * unchanged, so the page and `CoupleLinkDoor` draw the SAME field and the same
 * perk. `CoupleLinkDoor` is the door a supplier meets on a COUPLE'S OWN LINK.
 */
import type { ReactNode } from 'react';
import { Phone, Sparkles, UserPlus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
      {/* THE CONTROLS (INTERACTION_RULES § 9 · the 2026-10-11 modern-app look):
          what is only READ sits on the page as rows with dividers between
          topics — no boxed "record" panel, no framed perks; the two presses are
          the one ActionButton (a link and the page's own decline form). */}
      <article className="space-y-6" data-claim-door="own-link">
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What they&rsquo;ve recorded
          </p>
          <dl className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
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
          <p className="mt-2 text-xs text-ink/55">
            Package &amp; payment details stay private until you finish signup.
          </p>
        </section>

        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            What you get
          </p>
          <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10 text-sm text-ink/70">
            <Perk>Free supplier profile + marketplace listing</Perk>
            <Perk>Chat with {inviterName} in-app</Perk>
            <Perk>Calendar + payments + contracts tracking</Perk>
            <Perk>Marketplace exposure to other PH couples</Perk>
            <Perk>No upfront cost · no credit card required</Perk>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <ActionButton tone="brand" main icon={UserPlus} label="Claim & sign up" href={signupUrl} />
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
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-ink/60">{label}</dt>
      <dd
        className={`inline-flex min-w-0 items-center gap-1.5 text-right text-sm text-ink ${
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
    <li className={`flex items-start gap-2 py-2.5 ${className}`}>
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sn-accent" strokeWidth={1.75} />
      <span>{children}</span>
    </li>
  );
}
