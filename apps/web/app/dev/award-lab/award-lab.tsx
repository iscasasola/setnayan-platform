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
import { CardBadgeCongrats } from '@/app/_components/award/card-badge-congrats';
import { CardBadgeRules } from '@/app/_components/award/card-badge-rules';
import { TIERS } from '@/lib/badge-tiers';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** A plain sample badge and seal — drawn here in the current colour, so the lab needs no real shop's art and no colour of its own. */
const SAMPLE_BADGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="6"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="38" stroke-width="3"/><text x="60" y="70" text-anchor="middle" font-size="30" font-family="serif" fill="currentColor" stroke="none">10</text></svg>';
const SAMPLE_SEAL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="4"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="44" stroke-dasharray="4 4"/><text x="60" y="68" text-anchor="middle" font-size="18" font-family="serif" fill="currentColor" stroke="none">SEAL</text></svg>';

const SHOP = 'Petal & Pine';
const AWARDED = '12 Jan 2026';
/** The third rung of the shop's own ladder — the name comes from `lib/badge-tiers.ts`, never typed here. */
const TIER = TIERS[2]!;
/** The five tiered families, each with its owner-given badge name (its tap show plays as the badge lands). */
const FAMILIES = [
  ['calendar', 'Completed bookings'],
  ['bubble', 'Five-star reviews'],
  ['giftbox', 'Gifts given'],
  ['shield', 'Trusted by'],
  ['invite', 'Invites'],
] as const;
type Family = (typeof FAMILIES)[number][0];

/** A sample card badge for the service-card screens — a plain star in the current colour; the real badges are J3's data. */
const SAMPLE_CARD_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />
  </svg>
);
const SAMPLE_CARD = 'Full-day photo & video';
const SAMPLE_CARD_COLOUR = 'darkgoldenrod';

export function AwardLab() {
  const [open, setOpen] = useState<null | 'badge' | 'seal' | 'top' | 'congrats' | 'rules'>(null);
  const [story, setStory] = useState<StoryInput | null>(null);
  const [family, setFamily] = useState<Family | undefined>(undefined);
  const [tierIx, setTierIx] = useState(3);
  const famName = FAMILIES.find(([k]) => k === family)?.[1] ?? 'Completed bookings';
  const tierName = TIERS[tierIx - 1]?.name ?? TIER.name;
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
            tier={i + 1}
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
        <button type="button" className="fd-btn-quiet" onClick={() => setOpen('top')} data-award-lab-open="top">
          Open the top seal
        </button>
      </div>

      <section className="space-y-2" aria-label="Service-card badges">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="fd-btn-quiet" onClick={() => setOpen('congrats')} data-award-lab-open="congrats">
            Card congratulations
          </button>
          <button type="button" className="fd-btn-quiet" onClick={() => setOpen('rules')} data-award-lab-open="rules">
            Card badge rules
          </button>
        </div>
      </section>

      <section className="space-y-2" aria-label="Tap shows">
        {/* The house dropdown, never a raw <select> (`every-back-goes-home.test.ts`). */}
        <PickMenu
          label="Tier"
          value={String(tierIx)}
          options={TIERS.slice(0, 7).map((t, i) => ({ key: String(i + 1), label: t.name }))}
          onPick={(k) => setTierIx(Number(k))}
          dataAttr="data-award-lab-tier"
          buttonText={`Tier · ${tierName}`}
        />
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map(([k, name]) => (
            <button
              key={k}
              type="button"
              className="fd-btn-quiet"
              data-award-lab-show={k}
              onClick={() => {
                setFamily(k);
                setOpen('badge');
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {open === 'congrats' ? (
        <CardBadgeCongrats
          cardName={SAMPLE_CARD}
          badgeName="Sample badge"
          tag="SAMPLE"
          rule="A sample rule, filled in by the card-badge build"
          color={SAMPLE_CARD_COLOUR}
          icon={SAMPLE_CARD_ICON}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'rules' ? (
        <CardBadgeRules
          cardLine={`${SAMPLE_CARD} · ${SHOP}`}
          badges={[
            { key: 'a', name: 'Sample badge', held: `Held since ${AWARDED}`, rule: 'A sample rule, filled in by the card-badge build.', color: SAMPLE_CARD_COLOUR, icon: SAMPLE_CARD_ICON },
            { key: 'b', name: 'Second sample', held: `Held since ${AWARDED}`, rule: 'Another sample rule.', color: SAMPLE_CARD_COLOUR, icon: SAMPLE_CARD_ICON },
          ]}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'badge' ? (
        <BadgeFullscreen
          art={SAMPLE_BADGE}
          tier={{ index: tierIx, name: tierName }}
          title={famName}
          family={family}
          shopName={SHOP}
          awardedOn={AWARDED}
          onShare={(svg) => setStory({ svg, word: 'BADGE', tone: toneForTier(tierIx), shopName: SHOP, line1: `${tierName} · ${famName}`, line2: `Awarded on ${AWARDED}` })}
          onClose={() => {
            setOpen(null);
            setFamily(undefined);
          }}
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

      {open === 'top' ? (
        // the No. 1 plaque: no `seal` handed in, so the kit fetches its art (import()) on this tap, for this year
        <SealPlaque
          variant="no1"
          year={2026}
          eyebrow="Setnayan · 2026"
          title="No. 1 Supplier of the Year"
          shopName={SHOP}
          awardedOn={AWARDED}
          onShare={(svg) => setStory({ svg, word: 'SEAL', tone: toneForTier(3), shopName: SHOP, line1: 'No. 1 Supplier of the Year', line2: `Awarded on ${AWARDED}`, reveal: true })}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {story ? <StoryVideo input={story} label={`${story.line1} awarded to ${SHOP}`} onClose={() => setStory(null)} /> : null}
    </main>
  );
}
