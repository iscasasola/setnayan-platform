'use client';

/**
 * SelfAddedContactCard — the couple's own service card for a supplier only
 * they can describe. (2026-09-20)
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `event_manual_vendors` has captured `contact_person` and `contact_number`
 * since 2026-06-04 and **NOTHING IN THE APP EVER RENDERED EITHER OF THEM**
 * (grep `contact_person` across `app/` — before this file, every hit was the
 * write path, a docblock, or an unrelated `vendor_profiles` comment). A couple
 * typed their venue coordinator's mobile number into a required field and
 * could never read it back.
 *
 * 🔑 THE MEASUREMENT MUST REACH THE RENDER. Adding an `address` column and
 * demanding it at the door, while leaving it as invisible as the phone number
 * beside it, would have shipped the same defect one field wider. The same goes
 * for the two payment notes.
 *
 * ── The payment notes are NOTES ───────────────────────────────────────────
 * Owner: *"payment method and payment option can be entered manually. but this
 * is just manual … no connection to the user's event. it needs to be imported
 * to a vendor first."* and *"payment options doesn't need to be a qr. just a
 * note so the user can rely on the payment method."*
 *
 * So: free text, no QR upload, no structure, and nothing downstream reads
 * them. They create no payment plan, no instalment, no obligation. The copy
 * says so out loud, because a field that LOOKS like a payment schedule but
 * moves no money is worse than no field at all.
 *
 * Marketplace suppliers never see this card — once a supplier claims their
 * account their published details are the truth, and the server action refuses
 * to write here at all.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, MapPin, Phone, User, Wallet } from 'lucide-react';
import {
  MANUAL_VENUE_ADDRESS_HINT,
  MANUAL_VENUE_ADDRESS_MAX,
  MANUAL_VENUE_ADDRESS_PLACEHOLDER,
} from '@/lib/manual-venue-address';
import { useSaveLoader } from '@/components/sd-loader';
import { saveSelfAddedServiceCard } from '../actions';

/** Matches PAYMENT_NOTE_MAX in the server action — one cap, two places. */
const NOTE_MAX = 400;

const FIELD =
  'w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60';
const LEGEND =
  'flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50';

export function SelfAddedContactCard({
  eventId,
  vendorId,
  displayName,
  contactPerson,
  contactNumber,
  initialAddress,
  initialPaymentMethodNote,
  initialPaymentTermsNote,
  addressRequired,
  hasContactCard,
}: {
  eventId: string;
  vendorId: string;
  displayName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  initialAddress: string | null;
  initialPaymentMethodNote: string | null;
  initialPaymentTermsNote: string | null;
  /** TRUE for the reception and ceremony venues — the addresses guests use. */
  addressRequired: boolean;
  /**
   * FALSE when the booking has no `event_manual_vendors` row yet. Two real
   * production rows are in that state (`source = 'host_manual'`, 2026-09-15
   * and 2026-06-18), created outside the Add-a-contact modal's two-step. The
   * card still renders — saving CREATES the row — but the contact fields are
   * then required, because they are NOT NULL on the table.
   */
  hasContactCard: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [person, setPerson] = useState(contactPerson ?? '');
  const [number, setNumber] = useState(contactNumber ?? '');
  const [address, setAddress] = useState(initialAddress ?? '');
  const [methodNote, setMethodNote] = useState(initialPaymentMethodNote ?? '');
  const [termsNote, setTermsNote] = useState(initialPaymentTermsNote ?? '');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveLoader();

  const missingAddress = addressRequired && address.trim().length === 0;

  function touched(set: (v: string) => void) {
    return (v: string) => {
      set(v);
      setSaved(false);
    };
  }

  function onSave() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        fd.set('contact_person', person);
        fd.set('contact_number', number);
        fd.set('address', address);
        fd.set('payment_method_note', methodNote);
        fd.set('payment_terms_note', termsNote);
        await save.run(() => saveSelfAddedServiceCard(fd), {
          steps: ['Saving their details'],
          hint: 'Saving',
        });
        setSaved(true);
      } catch (e) {
        // The action throws the couple-facing sentence itself, so the address
        // rule is worded identically here and in the add modal. A framework
        // error (a digest with no message) falls back to something true.
        const msg = e instanceof Error ? e.message : '';
        setErr(msg && !msg.startsWith('An error occurred') ? msg : 'Could not save — try again.');
      }
    });
  }

  return (
    <section
      id="self-added-contact"
      aria-labelledby="self-added-contact-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6"
    >
      <header className="space-y-1">
        <h2 id="self-added-contact-heading" className="font-display text-lg italic text-ink">
          Your details for {displayName}
        </h2>
        <p className="text-xs text-ink/55">
          You added {displayName} yourself, so this is yours to keep up to date. Only you
          can see it.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="self-added-person" className={LEGEND}>
            <User aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Contact person
            {hasContactCard ? null : <span className="text-terracotta-700">*</span>}
          </label>
          <input
            id="self-added-person"
            type="text"
            maxLength={128}
            disabled={pending}
            value={person}
            placeholder="e.g. Maria Santos"
            onChange={(e) => touched(setPerson)(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="self-added-number" className={LEGEND}>
            <Phone aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Contact number
            {hasContactCard ? null : <span className="text-terracotta-700">*</span>}
          </label>
          {/* PLAIN INPUT, NEVER A `tel:` LINK. Owner 2026-09-10: "our goal is
              to let them integrate their event with the vendor they find. not
              to let them communicate outside the app" — held by
              `lib/no-door-out-of-the-app.test.ts`, which caught exactly that
              here. ⚖ The tension is real (a self-added supplier has no in-app
              thread) and the ruling still wins; the invite QR further down this
              page is the answer to it. */}
          <input
            id="self-added-number"
            type="text"
            inputMode="tel"
            maxLength={32}
            disabled={pending}
            value={number}
            placeholder="+63 9XX XXX XXXX"
            onChange={(e) => touched(setNumber)(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="self-added-address" className={LEGEND}>
          <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          {addressRequired ? 'Exact address' : 'Address'}
          {addressRequired ? <span className="text-terracotta-700">*</span> : null}
        </label>
        <textarea
          id="self-added-address"
          rows={2}
          maxLength={MANUAL_VENUE_ADDRESS_MAX}
          disabled={pending}
          value={address}
          placeholder={MANUAL_VENUE_ADDRESS_PLACEHOLDER}
          onChange={(e) => touched(setAddress)(e.target.value)}
          className={`${FIELD} resize-y`}
        />
        <p className="text-[11px] leading-snug text-ink/55">
          {addressRequired
            ? MANUAL_VENUE_ADDRESS_HINT
            : 'Optional — handy for a commissary, showroom or studio.'}
        </p>
        {missingAddress ? (
          <p className="text-[11px] leading-snug text-warn-800">
            This is a venue, so the exact address is what your guests and your other
            suppliers are sent to. Add it now so nothing downstream has to guess.
          </p>
        ) : null}
      </div>

      {/* ── Payment notes ──────────────────────────────────────────────────
          Two plain text boxes on purpose. The copy tells the couple exactly
          what these are and are not; see the docblock. */}
      <div className="space-y-3 rounded-xl border border-ink/10 bg-paper p-3.5">
        <p className={LEGEND}>
          <Wallet aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          How you pay them
        </p>
        <p className="-mt-1.5 text-[11px] leading-snug text-ink/55">
          Notes for you — so you are not digging through messages on the day. Setnayan
          does not send or track this money, and nothing here creates a payment or a due
          date.
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="self-added-payment-method"
            className="block text-[11px] font-medium text-ink/70"
          >
            Payment method
          </label>
          <textarea
            id="self-added-payment-method"
            rows={2}
            maxLength={NOTE_MAX}
            disabled={pending}
            value={methodNote}
            placeholder={'e.g. GCash 0917 555 1234 (Maria Santos)\nor BPI 1234-5678-90'}
            onChange={(e) => touched(setMethodNote)(e.target.value)}
            className={`${FIELD} resize-y`}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="self-added-payment-terms"
            className="block text-[11px] font-medium text-ink/70"
          >
            Payment terms
          </label>
          <textarea
            id="self-added-payment-terms"
            rows={2}
            maxLength={NOTE_MAX}
            disabled={pending}
            value={termsNote}
            placeholder="e.g. 50% to reserve the date, balance on the day"
            onChange={(e) => touched(setTermsNote)(e.target.value)}
            className={`${FIELD} resize-y`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-terracotta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-60"
        >
          {pending ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Save their details
        </button>
        {saved && !pending ? (
          <span className="inline-flex items-center gap-1 text-xs text-success-800">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
            Saved
          </span>
        ) : null}
      </div>

      {err ? (
        <p role="alert" className="text-[11px] leading-snug text-danger-900">
          {err}
        </p>
      ) : null}
    </section>
  );
}
