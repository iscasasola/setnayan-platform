'use client';

import type { ReactNode } from 'react';
import { ApplyProSheet } from '@/app/dashboard/[eventId]/website/_components/apply-pro-sheet';
import { AddressField } from '@/app/dashboard/[eventId]/invitation/_components/slug-field';
import { ProQuietLine } from '@/app/dashboard/[eventId]/launch/_components/pro-quiet-line';
import { MakerContext, type MakerState } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import type { HubProEffectView } from '@/lib/hub-pro-effect-view';
import type { ApplySheetPricing } from '@/lib/apply-sheet-parts';
import type { HubPartId } from '@/lib/hub-parts';

/**
 * 🧪 THE PRO-PARTS LAB'S CLIENT HALF — the shipped Apply sheet, the Address field and the quiet line, mounted with
 * made-up facts so each prototype frame can be drawn at 375 px with no database (`/dev/pro-parts-lab?frame=…`).
 * The figures are the lab's SAMPLE (handed in by the page), never a catalogue read and never shipped.
 */
const noop = () => undefined;

const effect = (id: string, part: HubPartId, what: string, where: string): HubProEffectView =>
  ({ id, part, what, where, jump: { kind: 'look' }, removable: true }) as HubProEffectView;

const TWO = [
  effect('f', 'style', 'Font', 'Names on the Hero'),
  effect('s', 'style', 'Colour · Size', 'Schedule'),
  effect('a', 'motion', 'Animation', 'Schedule'),
  effect('t', 'motion', 'Transition', 'Scrub'),
];
const FOUR = [
  effect('r', 'reveal', 'Church doors', 'Save the Date'),
  effect('b', 'background', 'Your clip', 'behind the page'),
  effect('v', 'style', 'Theme', 'Velvet, with its Decorations'),
  effect('m', 'music', 'Your own song', 'Whole Event Hub'),
];

const APPLE = [
  effect('a', 'motion', 'Animation', 'Schedule'),
  effect('t', 'motion', 'Transition', 'Scrub'),
  effect('m', 'music', 'Your own song', 'Whole Event Hub'),
];

export function LabFrame({ frame, pricing, line }: { frame: string; pricing: ApplySheetPricing; line: MakerState['proLine'] }) {
  const backdrop = (body: ReactNode) => (
    <div className="relative min-h-dvh bg-gradient-to-b from-[#d6cab8] to-[#b9a78f]">
      <p className="pt-40 text-center font-serif text-5xl text-white/90">Ana &amp; Miguel</p>
      {body}
    </div>
  );
  if (frame.startsWith('sheet')) {
    const effects = frame === 'sheet-four' ? FOUR : frame === 'sheet-ready' ? [] : frame === 'sheet-apple' ? APPLE : TWO;
    return backdrop(
      <ApplyProSheet
        effects={effects}
        changeCount={5}
        changes={[
          { place: 'Look', what: 'Theme · Velvet', pro: true, held: false },
          { place: 'Hero', what: 'Font · Names', pro: true, held: false },
          { place: 'Event Details', what: 'Ceremony time', pro: false, held: false },
          { place: 'Invitation', what: 'Reply words', pro: false, held: false },
          { place: 'Love Story', what: 'Moment 3', pro: false, held: false },
        ]}
        priceLabel={null}
        proHref={frame === 'sheet-apple' ? '/dev/pro-parts-lab?frame=apple-parts&from=maker' : '/dev/pro-parts-lab?frame=parts-free&from=maker'}
        pending={false}
        onGo={noop}
        onRemove={noop}
        onApplyFree={noop}
        onClose={noop}
        pricing={pricing}
      />,
    );
  }
  if (frame.startsWith('address')) {
    const kept = frame === 'address-kept';
    return (
      <div className="min-h-dvh bg-cream px-4 py-6">
        <AddressField
          eventId="00000000-0000-4000-8000-000000000000"
          slug={kept ? 'claire-and-sam' : 'ana-and-miguel-1218'}
          saveAction={async () => undefined}
          owns={false}
          renamed={kept}
          pricePhp={pricing.partPricePhp.address ?? null}
          storeShell={false}
          drafted={frame === 'address-pick' ? 'ana-miguel-wedding' : null}
        />
      </div>
    );
  }
  /* The quiet line, over the Look sheet's first rows. */
  return (
    <MakerContext.Provider value={{ proLine: line } as MakerState}>
      <div className="min-h-dvh bg-cream px-4 py-6">
        <p className="mb-2 flex gap-6 text-[15px] text-ink/60">
          <span className="border-b-2 border-ink pb-1 font-semibold text-ink">Look</span>
          <span>Background</span>
          <span>Music</span>
        </p>
        <ProQuietLine part={frame === 'line-yours' ? 'style' : 'style'} />
        {['Theme · Velvet ◆ PRO', 'Candlelight ◆ PRO', 'Decorations ◆ PRO', 'Typeface · Fraunces', 'Background colour · Ivory'].map((r) => (
          <p key={r} className="flex min-h-14 items-center border-b border-ink/10 text-[15px] text-ink">
            {r}
          </p>
        ))}
      </div>
    </MakerContext.Provider>
  );
}
