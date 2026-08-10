'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Info, Lock } from 'lucide-react';

import { previewShopAddress, slugifyBusinessName, clipBusinessSlug } from '@/lib/business-slug';
import { checkShopAddress, type AddressCheck } from '../address-actions';

/**
 * The shop's permanent web address — CHOSEN here, not merely previewed.
 *
 * Owner 2026-08-10: *"slug cannot be renamed so they need to pick their
 * preferred slug."* This reverses the same day's earlier *"renaming can be for
 * free"*, and the reversal changes what this control has to be. A preview is
 * something you glance at; this is the only moment the vendor will ever get to
 * decide their address, so it has to be an input they can edit, with an
 * availability answer they can act on, and it has to SAY that it is permanent.
 *
 * ── HOW IT BEHAVES ──────────────────────────────────────────────────────────
 * It stays in step with the shop name until the vendor touches it. Type
 * "Banawe Florals" and the address follows to `banaweflorals`; edit the address
 * and it stops following, because from that point the vendor has an opinion and
 * silently overwriting it would be the control fighting them. There is no "reset
 * to match the name" button — that is a third state to explain for a case solved
 * by clearing the field.
 *
 * 🔑 IT IS NEVER BLANK ON SUBMIT. If the vendor clears it, the value falls back
 * to whatever the shop name produces (`previewShopAddress`). An empty address is
 * not a choice a vendor can meaningfully make — the database would mint one
 * anyway — so the field cannot be used to opt out of having one.
 *
 * ⚠ AVAILABILITY IS ADVISORY, AND THE SERVER IS THE AUTHORITY. Two vendors can
 * be typing the same word right now; the answer here can be stale by submit. The
 * unique index is what actually decides, and `becomeVendor` catches the collision
 * and sends the vendor back with the field intact. This control's job is to make
 * that outcome rare, not to guarantee it.
 */
export function AddressPreview({
  shopName,
  existingSlug = null,
}: {
  shopName: string;
  /** Already settled — render it, do not offer to change it. */
  existingSlug?: string | null;
}) {
  const derived = previewShopAddress(shopName);
  const derivedSlug = derived.kind === 'ok' ? derived.slug : '';

  const [touched, setTouched] = useState(false);
  const [value, setValue] = useState(derivedSlug);
  const [check, setCheck] = useState<AddressCheck | null>(null);
  const [checking, setChecking] = useState(false);

  // Follow the shop name until the vendor takes over.
  useEffect(() => {
    if (!touched) setValue(derivedSlug);
  }, [derivedSlug, touched]);

  // What actually gets submitted: their choice, or the name's slug if they
  // emptied it. Normalised through the same mirror the database uses, so what
  // they see is what the column will hold.
  const effective = clipBusinessSlug(slugifyBusinessName(value)) ?? derivedSlug;

  useEffect(() => {
    if (!effective) {
      setCheck(null);
      return;
    }
    // Stale-response guard: a slower answer for an earlier value must not
    // overwrite a newer one, or the sign describes an address that is no longer
    // on screen.
    let live = true;
    setChecking(true);
    const t = setTimeout(() => {
      checkShopAddress(effective)
        .then((r) => {
          if (live) setCheck(r);
        })
        .catch(() => {
          if (live) setCheck({ state: 'unknown', slug: effective });
        })
        .finally(() => {
          if (live) setChecking(false);
        });
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [effective]);

  // ── ALREADY SETTLED ────────────────────────────────────────────────────────
  // The wizard can be re-run on a shop that was never finished (mode
  // 'complete'), and that shop may already hold an address. It cannot be
  // renamed, so an editable box would offer a change that is refused — the
  // database returns early on its own for the same reason. Read-only, and no
  // hidden field: `becomeVendor` guards the write with `if (chosenSlug)`, but
  // sending nothing is the clearer contract.
  //
  // ⚠ PLACED AFTER EVERY HOOK, DELIBERATELY. It sat above them first, which
  // reads fine and is a rules-of-hooks violation: `existingSlug` is a prop, so a
  // render that returned early and a later render that ran four hooks would
  // change the hook order. `tsc` cannot see it; the lint rule can.
  if (existingSlug) {
    return (
      <span className="flex items-baseline gap-1.5 text-xs" style={{ color: 'var(--m-slate)' }}>
        Your website
        <span className="font-mono text-[12px] font-medium" style={{ color: 'var(--m-ink)' }}>
          setnayan.com/{existingSlug}
        </span>
      </span>
    );
  }

  if (derived.kind === 'empty' && !touched) return null;

  return (
    <span className="block space-y-1.5">
      <span className="flex items-baseline gap-1 text-xs" style={{ color: 'var(--m-slate)' }}>
        Your website
        <span className="inline-flex items-center gap-1" style={{ color: 'var(--m-slate-3)' }}>
          <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
          you can&rsquo;t change this later
        </span>
      </span>

      <span
        className="flex items-center overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        <span
          className="shrink-0 pl-2.5 font-mono text-[12px]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          setnayan.com/
        </span>
        <input
          value={value}
          onChange={(e) => {
            setTouched(true);
            // Typed straight into the address, so hold it to the address
            // alphabet as they go — a space or an apostrophe would silently
            // disappear at submit and look like the field ate it.
            //
            // 🔴 THE HYPHEN USED TO BE ALLOWED HERE, AND IT IS THE ONE
            // CHARACTER THAT BROKE THE PROMISE THIS LINE EXISTS TO KEEP.
            // `slugifyBusinessName` strips it (`[^a-z0-9]+`), so someone typing
            // `banawe-florals` saw `setnayan.com/banawe-florals`, saw the green
            // Available tick, read "you can't change this later" — and got
            // `banaweflorals`. **A permanent address, agreed to in one form and
            // created in another**, with no rename to put it right.
            //
            // Two alphabets for one value is the whole defect. There is now a
            // test that types real strings through both and fails if what
            // survives this box is not already a fixed point of the mirror.
            setValue(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
          }}
          maxLength={32}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Your web address"
          className="w-full border-0 bg-transparent py-2 pl-0 pr-2.5 font-mono text-[13px] outline-none"
          style={{ color: 'var(--m-ink)' }}
        />
      </span>

      {/* Submitted separately from the visible box: the vendor may have cleared
          it, and `effective` is the value the server should actually receive. */}
      <input type="hidden" name="business_slug" value={effective} />

      {checking ? (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} />
          Checking…
        </span>
      ) : check?.state === 'free' ? (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--m-sage-deep)' }} aria-live="polite">
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          Available
        </span>
      ) : check?.state === 'taken' ? (
        <span className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-orange-deep)' }} aria-live="polite">
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {/* Now that the address is a CHOICE, "taken" is genuinely actionable —
              unlike the earlier auto-minted model, where the database numbered it
              and telling the vendor to pick another would have been noise. */}
          Taken — try another.
        </span>
      ) : check?.state === 'auto' || (!effective && touched) ? (
        <span className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Needs at least 3 letters or numbers.
        </span>
      ) : null}
      {/* `unknown` shows nothing: a lookup we could not run is not proof the
          address is free, and it is not proof it is taken either. */}
    </span>
  );
}
