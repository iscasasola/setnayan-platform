'use client';
import { useState } from 'react';
import {
  BadgeFullscreen,
  RewardTicket,
  SealPlaque,
  StoryVideo,
  TICKET_SPECS,
  toneForTier,
  type StoryInput,
  type TicketKind,
} from '@/app/_components/award';
import { TIERS } from '@/lib/badge-tiers';

/** A plain sample badge and seal — drawn here in the current colour, so the lab needs no real shop's art and no colour of its own. */
const SAMPLE_BADGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="6"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="38" stroke-width="3"/><text x="60" y="70" text-anchor="middle" font-size="30" font-family="serif" fill="currentColor" stroke="none">10</text></svg>';
const SAMPLE_SEAL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="4"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="44" stroke-dasharray="4 4"/><text x="60" y="68" text-anchor="middle" font-size="18" font-family="serif" fill="currentColor" stroke="none">SEAL</text></svg>';

const SHOP = 'Petal & Pine';
const AWARDED = '12 Jan 2026';
/** The third rung of the shop's own ladder — the name comes from `lib/badge-tiers.ts`, never typed here. */
const TIER = TIERS[2]!;

export function AwardLab() {
  const [open, setOpen] = useState<null | 'badge' | 'seal'>(null);
  const [story, setStory] = useState<StoryInput | null>(null);
  const kinds = Object.keys(TICKET_SPECS) as TicketKind[];

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6" data-award-lab="">
      <h1 className="text-lg font-semibold">Award kit lab</h1>

      <section className="space-y-3" aria-label="Reward tickets">
        {kinds.map((kind, i) => (
          <RewardTicket
            key={kind}
            kind={kind}
            label={kind}
            state={i === 0 ? 'locked' : i === 1 ? 'new' : 'in_gifts'}
          />
        ))}
      </section>

      <div className="flex gap-3">
        <button type="button" className="fd-btn-terra" onClick={() => setOpen('badge')} data-award-lab-open="badge">
          Open a badge
        </button>
        <button type="button" className="fd-btn-quiet" onClick={() => setOpen('seal')} data-award-lab-open="seal">
          Open a seal
        </button>
      </div>

      {open === 'badge' ? (
        <BadgeFullscreen
          art={SAMPLE_BADGE}
          tier={{ index: 3, name: TIER.name }}
          title="Completed bookings"
          shopName={SHOP}
          awardedOn={AWARDED}
          onShare={(svg) => setStory({ svg, word: 'BADGE', tone: toneForTier(3), shopName: SHOP, line1: `${TIER.name} · Completed bookings`, line2: `Awarded on ${AWARDED}` })}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {open === 'seal' ? (
        <SealPlaque
          seal={SAMPLE_SEAL}
          eyebrow="Setnayan · 2026"
          title="Setnayan Verified"
          shopName={SHOP}
          awardedOn={AWARDED}
          onShare={(svg) => setStory({ svg, word: 'SEAL', tone: toneForTier(3), shopName: SHOP, line1: 'Setnayan Verified', line2: `Awarded on ${AWARDED}` })}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {story ? <StoryVideo input={story} label={`${story.line1} awarded to ${SHOP}`} onClose={() => setStory(null)} /> : null}
    </main>
  );
}
