'use client';

import { useState, useTransition } from 'react';

import { FormRows, SwitchRow } from '@/app/_components/form-row';
import { moderateServiceCard } from '../card-actions';

/**
 * The admin supplier page's "Demo shop" switch (owner, 6 Nov 2026; words per the later same-day ruling "DEMO SHOPS + DEMO
 * EVENTS" — a demo shop shows publicly, marked "(DEMO ONLY)", and no real event can find, message or book it). One switch, saves in place: it moves the moment
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
        name="Demo shop"
        about={{
          words:
            'A demo shop shows how a supplier looks on Setnayan. It stays in the marketplace with “(DEMO ONLY)” on its page and card, but no real event can find, message or book it, it never counts in real totals, and it stays out of the sitemap. Only demo events book it. Nothing is deleted — switch it off to make it a real shop again.',
        }}
        line={on ? 'On — marked (DEMO ONLY); only demo events can book it' : 'Off — a real shop'}
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
