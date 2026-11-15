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

/** A plain sample badge and seal — drawn here, so the lab needs no real shop's art. */
const SAMPLE_BADGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="54" fill="#C9A24A"/><circle cx="60" cy="60" r="42" fill="#F4E3B0"/><text x="60" y="70" text-anchor="middle" font-size="30" font-family="serif" fill="#5A3E12">10</text></svg>';
const SAMPLE_SEAL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="56" fill="#1B1B1B"/><circle cx="60" cy="60" r="46" fill="none" stroke="#C9A24A" stroke-width="4"/><text x="60" y="68" text-anchor="middle" font-size="18" font-family="serif" fill="#E8D08A">SEAL</text></svg>';

const SHOP = 'Petal & Pine';
const AWARDED = '12 Jan 2026';
/** The third rung of the shop's own ladder — the name comes from `lib/badge-tiers.ts`, never typed here. */
const TIER = TIERS[2]!;

export function AwardLab() {
  const [open, setOpen] = useState<null | 'badge' | 'seal'>(null);
  const [story, setStory] = useState<StoryInput | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
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
            state={i === 0 ? 'locked' : claimed[kind] ? 'claimed' : 'ready'}
            onClaim={() => setClaimed((c) => ({ ...c, [kind]: true }))}
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
