'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Info } from 'lucide-react';

import { previewShopAddress } from '@/lib/business-slug';
import { checkShopAddress, type AddressCheck } from '../address-actions';

/**
 * "your website: setnayan.com/banaweflorals" — live, under the Shop name field.
 *
 * Owner 2026-08-09: *"Shop name will be their slug as well. This means you will
 * show what their website address would look like… then a text under saying:
 * your website: www.setnayan.com/banaweflorals and a sign if available."*
 *
 * TWO LAYERS, ON PURPOSE:
 *  1. the ADDRESS itself renders instantly from `previewShopAddress`, a pure
 *     mirror of the SQL that mints it — no round trip, no flicker while typing;
 *  2. the AVAILABILITY sign arrives from the server, debounced.
 *
 * The address is the answer to "what will my link be"; availability is a nicety.
 * Making the whole line wait on a network call would leave the vendor staring at
 * nothing while they type their own shop's name.
 *
 * ⚠ NEVER A GATE. A taken address does not block the name — the database appends
 * a counter (`banaweflorals2`) inside the write transaction, and two vendors can
 * be typing the same name right now, so any answer here can be stale by submit.
 * Refusing a legitimate business name over a race the database already handles
 * would be the product being wrong on purpose. The copy therefore says what WILL
 * happen, never "pick another".
 */
export function AddressPreview({ shopName }: { shopName: string }) {
  const preview = previewShopAddress(shopName);
  const [check, setCheck] = useState<AddressCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const slug = preview.kind === 'ok' ? preview.slug : null;

  useEffect(() => {
    if (!slug) {
      setCheck(null);
      return;
    }
    // Stale-response guard: a slower answer for an earlier name must not
    // overwrite a newer one. Without it, typing "Banawe Flor" then "Banawe
    // Florals" can settle on the FIRST result — a sign about an address the
    // vendor is no longer proposing.
    let live = true;
    setChecking(true);
    const t = setTimeout(() => {
      checkShopAddress(shopName)
        .then((r) => {
          if (live) setCheck(r);
        })
        .catch(() => {
          if (live) setCheck({ state: 'unknown', slug });
        })
        .finally(() => {
          if (live) setChecking(false);
        });
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [shopName, slug]);

  if (preview.kind === 'empty') return null;

  // A 1–2 character name is legal; the address just cannot be previewed, because
  // the database builds it from an id the row does not have yet. Say that
  // plainly rather than inventing one or scolding the name.
  if (preview.kind === 'too_short') {
    return (
      <span className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        Short names get an address picked for you when your shop is created.
      </span>
    );
  }

  return (
    <span className="block space-y-0.5">
      <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
        Your website:{' '}
        <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
          setnayan.com/{slug}
        </span>
      </span>

      {checking ? (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--m-slate-3)' }}
          aria-live="polite"
        >
          <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} />
          Checking…
        </span>
      ) : check?.state === 'free' ? (
        <span
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: 'var(--m-sage-deep)' }}
          aria-live="polite"
        >
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          Available
        </span>
      ) : check?.state === 'taken' ? (
        <span
          className="flex items-start gap-1.5 text-xs"
          style={{ color: 'var(--m-orange-deep)' }}
          aria-live="polite"
        >
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {/* NOT "taken, choose another" — the name is fine and the address is
              still theirs, just numbered. Phrased as what will happen. */}
          Someone has that address — yours will be{' '}
          <span className="font-medium">setnayan.com/{check.suggestion}</span>
        </span>
      ) : null}
      {/* `unknown` renders NOTHING. A failed read is not "available", and it is
          not "taken" either — inventing either sign would be worse than silence,
          because the address line above is already correct on its own. */}
    </span>
  );
}
