'use client';

import { useEffect, useState } from 'react';

import { HeldShopNameCard } from '@/app/_components/held-shop-name-card';
import { ITS_MY_BUSINESS_QUEUED } from '@/lib/shop-name-hold';
import { checkShopAddress } from '../address-actions';

/**
 * Step 1's answer to "is this NAME held?" (owner 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE").
 *
 * Asks `checkShopAddress(name, 'name')` — the same database function `becomeVendor` asks at submit — as the vendor types, so a
 * held name is refused on the screen that owns it instead of after four steps. Advisory: the submit is the authority.
 *
 * "It's my business" here does not file anything yet: a signed-out stranger has no account and no shop until step 3
 * submits. So it QUEUES the claim — the hidden `its_my_business` field carries the exact name, and `becomeVendor`
 * files it with the shop (opening the shop without that name). The sent state says exactly that.
 */
export function NameHold({
  shopName,
  claimed,
  onClaim,
  onHeldChange,
}: {
  shopName: string;
  /** The vendor pressed "It's my business" for THIS exact name. */
  claimed: boolean;
  onClaim: () => void;
  onHeldChange: (held: boolean) => void;
}) {
  const [held, setHeld] = useState(false);
  const name = shopName.trim();

  useEffect(() => {
    if (!name) {
      setHeld(false);
      onHeldChange(false);
      return;
    }
    // Stale-response guard, as in AddressPreview: a slower answer for an earlier name must not describe this one.
    let live = true;
    const t = setTimeout(() => {
      checkShopAddress(name, 'name')
        .then((r) => {
          if (!live) return;
          // A check that could not run reads as not held — the submit checks again and fails closed.
          const isHeld = r.state === 'name_held';
          setHeld(isHeld);
          onHeldChange(isHeld);
        })
        .catch(() => undefined);
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  if (!held) return null;
  return (
    <>
      <HeldShopNameCard sent={claimed} sentText={ITS_MY_BUSINESS_QUEUED} onClaim={onClaim} />
      {claimed ? <input type="hidden" name="its_my_business" value={name} /> : null}
    </>
  );
}
