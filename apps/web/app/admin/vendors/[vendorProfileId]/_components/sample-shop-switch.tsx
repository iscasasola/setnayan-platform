'use client';

import { useState, useTransition } from 'react';

import { FormRows, SwitchRow } from '@/app/_components/form-row';
import { moderateServiceCard } from '../card-actions';

/**
 * The admin supplier page's "Sample shop" switch (owner, 6 Nov 2026). One switch, saves in place: it moves the moment
 * it is tapped, posts `op=sample_shop` with an explicit on/off, and puts itself back with a line if the save fails.
 * It never redirects, so the page does not reset (owner rule: a save never resets the screen).
 *
 * Writes `vendor_profiles.is_demo` — see `setSampleShop` in `../card-actions.ts` for why it is that column.
 */
export function SampleShopSwitch({ shopId, initial }: { shopId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <FormRows width="wide" data="sample-shop">
      <SwitchRow
        name="Sample shop"
        about={{
          words:
            'A sample shows how a shop looks on Setnayan. Its page and card say “Sample shop”, and it never reads as a real supplier: it leaves search, the marketplace and the sitemap, and its page opens only for its own team and for admins in demo mode. Nothing is deleted — switch it off to make it a real shop again.',
        }}
        line={on ? 'On — shown as a sample, not a real supplier' : 'Off — a real shop'}
        on={on}
        disabled={pending}
        problem={problem}
        attrs={{ 'data-sample-shop': on ? 'on' : 'off' }}
        onChange={(next) => {
          const was = on;
          setOn(next);
          setProblem(null);
          const fd = new FormData();
          fd.set('op', 'sample_shop');
          fd.set('vendor_profile_id', shopId);
          fd.set('sample', next ? 'on' : 'off');
          startTransition(async () => {
            try {
              await moderateServiceCard(fd);
            } catch {
              setOn(was);
              setProblem('Couldn’t save — nothing changed. Try again.');
            }
          });
        }}
      />
    </FormRows>
  );
}
