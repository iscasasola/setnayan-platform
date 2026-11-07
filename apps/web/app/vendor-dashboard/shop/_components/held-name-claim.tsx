'use client';

import { useState, useTransition } from 'react';

import { HeldShopNameCard } from '@/app/_components/held-shop-name-card';
import { ITS_MY_BUSINESS_SENT } from '@/lib/shop-name-hold';
import { requestProfileCorrection } from '../../actions';

/**
 * My Shop's way out of a refused rename (owner 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE"): the shared card, with
 * "It's my business" filing the name to the admin queue on the spot. It files through `requestProfileCorrection` —
 * the existing door into /admin/corrections, which marks a held name for the admin — rather than a new action. The
 * shop already exists here, so unlike the wizard the request is really SENT when the button is pressed.
 */
export function HeldNameClaim({ name }: { name: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <HeldShopNameCard
      sent={sent}
      pending={pending}
      error={error}
      sentText={ITS_MY_BUSINESS_SENT}
      onClaim={() =>
        start(async () => {
          setError(null);
          const fd = new FormData();
          fd.set('field_key', 'business_name');
          fd.set('requested_value', name);
          const res = await requestProfileCorrection(null, fd);
          if (res.ok) setSent(true);
          else setError(res.error);
        })
      }
    />
  );
}
