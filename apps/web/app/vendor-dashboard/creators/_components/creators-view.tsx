import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { formatAudienceCount } from '@/lib/creator-audience';
import { CreatorTierChip } from '@/app/_components/creator-tier-chip';
import { formatCount } from '@/lib/format-number';
import type { EligibleCreator, VendorSentOffer } from '@/lib/creator-offers';
import type { VendorCreatorRoiRow } from '@/lib/creator-analytics';
import { TemplateRows } from '@/app/_components/template-rows';
import { ToolChip, ToolEmpty, ToolLead, ToolPage, ToolPin, ToolRow, ToolSection, type ToolChipTone } from '../../_components/tool-page';
import { CreatorsReach, SendOfferButton } from './creators-tools';
import { ReadFailedNote } from '../../_components/set-two/read-failed';

/**
 * Creators — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 04). Look only:
 * the reach bar (now the thumb row's sliders), your offers with status and fulfilment, the collab ROI with inquiries
 * driven and the tier band, and Send offer (now one sheet) are the shipped page's. Presentational — the page and
 * `/dev/supplier-tools-lab` mount it.
 */
const STATUS_TONE: Record<VendorSentOffer['status'], ToolChipTone> = {
  pending: 'wait',
  accepted: 'ok',
  declined: 'quiet',
  expired: 'quiet',
};

const STATUS_LABEL: Record<VendorSentOffer['status'], string> = {
  pending: 'Awaiting response',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired · no reply',
};

export function CreatorsView({
  creators,
  sentOffers,
  roi,
  minReach,
  pendingCreatorIds,
  sendNeedsPro,
  flash,
}: {
  /** null = the creators read was refused — said, never "No creators match yet" (final check A5-G2-05). */
  creators: EligibleCreator[] | null;
  /** null = the offers read was refused — said, never an empty Sent list. */
  sentOffers: VendorSentOffer[] | null;
  roi: VendorCreatorRoiRow[];
  minReach: number;
  /** Creators this shop already has an OUTSTANDING offer to — "Offer pending" in place of Send. */
  pendingCreatorIds: ReadonlySet<string>;
  /** true = the plan asks at Send · 'unread' = the plan read was refused (said, never a plan ask). */
  sendNeedsPro: boolean | 'unread';
  flash: { error?: string; sent: boolean };
}) {
  return (
    <ToolPage name="creators">
      <ToolPin route="/vendor-dashboard/creators" title="Creators" />

      {flash.error ? (
        <FormFlash tone="error">{decodeURIComponent(flash.error)}</FormFlash>
      ) : null}
      {flash.sent ? (
        <FormFlash tone="success">
          Offer sent — it expires if they don&rsquo;t reply within 14 days.
        </FormFlash>
      ) : null}

      {/* Sent offers */}
      {sentOffers === null ? (
        <ReadFailedNote mark="creators-offers">Couldn&rsquo;t load your offers just now.</ReadFailedNote>
      ) : sentOffers.length > 0 ? (
        <ToolSection label="Your offers" count={sentOffers.length} data="creators-offers">
          <TemplateRows label="Your offers">
            {sentOffers.map((o) => (
              <ToolRow
                key={o.offerId}
                data={o.offerId}
                title={o.creatorSlug ? <Link href={`/u/${o.creatorSlug}`} className="hover:underline">{o.creatorName}</Link> : o.creatorName}
                lines={[
                  `Creator rate: ${o.creatorRateTerms}`,
                  o.audienceRateTerms ? `Audience rate: ${o.audienceRateTerms}` : null,
                  /* PR-C fulfillment state — fulfilled/unfulfilled + the discount↔chapter link is the WHOLE outcome
                     model (no clawback): an unfulfilled collab is simply visible, and you don't offer again. */
                  o.status === 'accepted' ? (o.fulfilledAt ? 'Fulfilled · chapter linked' : 'Unfulfilled · awaiting chapter') : null,
                ]}
                right={<ToolChip tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</ToolChip>}
              />
            ))}
          </TemplateRows>
        </ToolSection>
      ) : null}

      {/* Per-creator ROI (P3) — ledger facts for the creators you've collab'd
          with: the inquiries their chapters drove and where each collab
          stands. NO "discount given" — that
          settles off-platform between you and the creator, so Setnayan can't
          (and won't) report it. Renders only once you've sent an offer. */}
      {roi.length > 0 ? (
        <ToolSection
          label="Your collab ROI"
          tip="Inquiries driven is each creator’s all-time public number (the inquiries their chapters drove that a supplier unlocked). Discounts settle off-platform, so they’re not shown here."
          data="creators-roi"
        >
          <TemplateRows label="Your collab ROI">
            {roi.map((r) => (
              <RoiRow key={r.creatorUserId} row={r} />
            ))}
          </TemplateRows>
        </ToolSection>
      ) : null}

      {/* Eligible creators */}
      <ToolSection
        label="Eligible creators"
        count={creators?.length}
        right={minReach > 0 ? `${formatAudienceCount(minReach)}+ followers` : undefined}
        data="creators-eligible"
      >
        {creators === null ? (
          <ReadFailedNote mark="creators-eligible">Couldn&rsquo;t load creators just now.</ReadFailedNote>
        ) : creators.length === 0 ? (
          <ToolEmpty data="creators">
            No creators match{minReach > 0 ? ' this reach bar' : ' yet'}. A
            creator is any account with a published chapter on a public
            profile.
          </ToolEmpty>
        ) : (
          <TemplateRows label="Eligible creators">
            {creators.map((c) => (
              <CreatorRow
                key={c.userId}
                creator={c}
                hasPending={pendingCreatorIds.has(c.userId)}
                sendNeedsPro={sendNeedsPro}
              />
            ))}
          </TemplateRows>
        )}
      </ToolSection>

      {/* The reach bar — the thumb row's sliders round (its dot while a bar is set), opening the shipped field. */}
      <CreatorsReach minReach={minReach} />
    </ToolPage>
  );
}

function initials(name: string): string {
  const parts = name.replace(/&/g, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '·';
}

function CreatorRow({
  creator: c,
  hasPending,
  sendNeedsPro,
}: {
  creator: EligibleCreator;
  hasPending: boolean;
  /** The database's Pro floor on sending — see the page body. */
  sendNeedsPro: boolean | 'unread';
}) {
  return (
    <ToolRow
      data={c.userId}
      lead={<ToolLead>{initials(c.displayName)}</ToolLead>}
      title={c.slug ? <Link href={`/u/${c.slug}`} className="hover:underline">{c.displayName}</Link> : c.displayName}
      lines={[
        <>
          {formatAudienceCount(c.followersCount)} {c.followersCount === 1 ? 'follower' : 'followers'} ·{' '}
          {formatAudienceCount(c.viewCount)} views · {formatCount(c.chapterCount)} {c.chapterCount === 1 ? 'chapter' : 'chapters'}
        </>,
        /* PR-C — the one influence metric; renders nothing at 0. The P3 tier band renders the number (Nano/Micro/…). */
        c.inquiriesDriven > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {formatAudienceCount(c.inquiriesDriven)} {c.inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
            <CreatorTierChip inquiriesDriven={c.inquiriesDriven} />
          </span>
        ) : null,
      ]}
      right={
        hasPending ? (
          <ToolChip tone="quiet">Offer pending</ToolChip>
        ) : (
          <SendOfferButton creatorUserId={c.userId} creatorName={c.displayName} sendNeedsPro={sendNeedsPro} />
        )
      }
    />
  );
}

// ROI status chip reuses the sent-offer status vocabulary. An accepted +
// fulfilled collab reads "Fulfilled"; accepted-but-unfulfilled reads "Awaiting
// chapter" — the whole outcome model (no clawback).
function roiStatusLabel(row: VendorCreatorRoiRow): string {
  if (row.collabStatus === 'accepted') {
    return row.fulfilled ? 'Fulfilled · chapter linked' : 'Accepted · awaiting chapter';
  }
  return STATUS_LABEL[row.collabStatus];
}

function roiStatusTone(row: VendorCreatorRoiRow): ToolChipTone {
  if (row.collabStatus === 'accepted' && !row.fulfilled) return 'wait';
  return STATUS_TONE[row.collabStatus];
}

function RoiRow({ row }: { row: VendorCreatorRoiRow }) {
  return (
    <ToolRow
      data={row.creatorUserId}
      lead={
        <ToolLead>
          <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </ToolLead>
      }
      title={row.creatorSlug ? <Link href={`/u/${row.creatorSlug}`} className="hover:underline">{row.creatorName}</Link> : row.creatorName}
      lines={[
        <span key="n" className="inline-flex flex-wrap items-center gap-1.5">
          <b className="tabular-nums text-ink">{formatAudienceCount(row.inquiriesDriven)}</b>
          {row.inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
          {/* Same tier band as the browse card + /u — a rendering of the number to its left; hides at 0. */}
          <CreatorTierChip inquiriesDriven={row.inquiriesDriven} />
        </span>,
        <ToolChip key="s" tone={roiStatusTone(row)}>{roiStatusLabel(row)}</ToolChip>,
      ]}
    />
  );
}
