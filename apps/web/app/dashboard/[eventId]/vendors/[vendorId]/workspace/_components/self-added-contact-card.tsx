'use client';

/**
 * SelfAddedContactCard — what the couple typed about a supplier only they can
 * describe, shown back to them. (2026-09-20)
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
 * beside it, would have shipped the same defect one field wider.
 *
 * ── The address is the editable one ───────────────────────────────────────
 * Name and number are shown read-only here on purpose: they are not what the
 * owner asked for, and `updateManualVendor` — the action that rewrites all
 * three together — still has no UI caller, so a partial form posting to it
 * would blank the two columns it did not show. The address writes through
 * `updateSelfAddedSupplierAddress`, which touches exactly one column and
 * re-asks `checkManualVenueAddress` server-side.
 *
 * Marketplace suppliers never see this card — their address is theirs to
 * publish, and the server action refuses to write one.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, MapPin, Phone, User } from 'lucide-react';
import {
  MANUAL_VENUE_ADDRESS_HINT,
  MANUAL_VENUE_ADDRESS_MAX,
  MANUAL_VENUE_ADDRESS_PLACEHOLDER,
} from '@/lib/manual-venue-address';
import { useSaveLoader } from '@/components/sd-loader';
import { updateSelfAddedSupplierAddress } from '../actions';

export function SelfAddedContactCard({
  eventId,
  vendorId,
  displayName,
  contactPerson,
  contactNumber,
  initialAddress,
  addressRequired,
}: {
  eventId: string;
  vendorId: string;
  displayName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  initialAddress: string | null;
  /** TRUE for the reception and ceremony venues — the addresses guests use. */
  addressRequired: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [address, setAddress] = useState(initialAddress ?? '');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveLoader();

  const missing = addressRequired && address.trim().length === 0;

  function onSave() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        fd.set('address', address);
        await save.run(() => updateSelfAddedSupplierAddress(fd), {
          steps: ['Saving the address'],
          hint: 'Saving',
        });
        setSaved(true);
      } catch (e) {
        // The server action throws the couple-facing sentence itself, so the
        // rule's wording is identical here and in the add modal. A framework
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
          Your contact for {displayName}
        </h2>
        <p className="text-xs text-ink/55">
          You added {displayName} yourself, so this is what you told us about them.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-0.5">
          <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            <User aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Contact person
          </dt>
          <dd className="text-sm text-ink">{contactPerson?.trim() || '—'}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            <Phone aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Contact number
          </dt>
          {/* PLAIN TEXT, NOT A `tel:` LINK. Owner 2026-09-10: "our goal is to
              let them integrate their event with the vendor they find. not to
              let them communicate outside the app" — held by
              `lib/no-door-out-of-the-app.test.ts`, which caught exactly this.
              ⚖ The tension is real and the ruling still wins: a self-added
              supplier has no account, so there IS no in-app thread to route to
              — which is why the invite QR sits on this same page. Showing the
              couple the number they typed is not a door; authoring the dial
              link would be. */}
          <dd className="select-all text-sm text-ink">{contactNumber?.trim() || '—'}</dd>
        </div>
      </dl>

      <div className="space-y-1.5">
        <label
          htmlFor="self-added-address"
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50"
        >
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
          onChange={(e) => {
            setAddress(e.target.value);
            setSaved(false);
          }}
          className="w-full resize-y rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
        />
        <p className="text-[11px] leading-snug text-ink/55">
          {addressRequired
            ? MANUAL_VENUE_ADDRESS_HINT
            : 'Optional — handy for a commissary, showroom or studio.'}
        </p>
        {missing ? (
          <p className="text-[11px] leading-snug text-warn-800">
            This is a venue, so the exact address is what your guests and your other
            suppliers are sent to. Add it now so nothing downstream has to guess.
          </p>
        ) : null}
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
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Save address
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
