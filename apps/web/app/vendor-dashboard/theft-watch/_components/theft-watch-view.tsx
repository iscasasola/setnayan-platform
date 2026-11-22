import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import type { RepostFlagStatus, RepostSurface, VendorRepostFlag } from '@/lib/vendor-theft-watch';
import { TemplateRows } from '@/app/_components/template-rows';
import { ToolChip, ToolEmpty, ToolFail, ToolLine, ToolPage, ToolPin, ToolRow, ToolSection, type ToolChipTone } from '../../_components/tool-page';

/**
 * Theft Watch — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 05). Look
 * only: every row, status and word is the shipped page's. Presentational — the page and `/dev/supplier-tools-lab` mount
 * it. `reposts === null` is a read that did not run: said, never drawn as clean (controller 21 Nov).
 */
const STATUS: Record<RepostFlagStatus, { label: string; tone: ToolChipTone }> = {
  open: { label: 'Under review', tone: 'wait' },
  escalated: { label: 'Escalated to our team', tone: 'wait' },
  confirmed_theft: { label: 'Confirmed repost', tone: 'no' },
  dismissed: { label: 'Cleared — no theft', tone: 'quiet' },
};

const SURFACE_LABEL: Record<RepostSurface, string> = {
  service_primary: 'Service cover photo',
  portfolio: 'Portfolio photo',
  moodboard_library: 'Inspiration photo',
  service_showcase: 'Service card photo',
};

function formatDate(iso: string): string {
  // The drawing's "12 Nov 2026" — day, short month, year.
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

export function TheftWatchView({ reposts }: { reposts: VendorRepostFlag[] | null }) {
  return (
    <ToolPage name="theft-watch">
      <ToolPin route="/vendor-dashboard/theft-watch" title="Theft Watch" />

      <ToolSection
        label="Reposts flagged"
        count={reposts && reposts.length > 0 ? reposts.length : undefined}
        tip="We fingerprint every photo you upload and scan the marketplace for copies. Our team reviews each match."
        data="theft-watch"
      >
        {reposts === null ? (
          <ToolFail
            data="theft-watch"
            title="We couldn’t check for reposts just now."
            line="This is not a clean result."
            retryHref="/vendor-dashboard/theft-watch"
          />
        ) : reposts.length === 0 ? (
          <ToolEmpty data="theft-watch">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={1.75} />
            <span>No reposts flagged — your work is clean. We&rsquo;ll keep watching.</span>
          </ToolEmpty>
        ) : (
          <TemplateRows label="Reposts flagged">
            {reposts.map((flag) => {
              const status = STATUS[flag.status];
              // `source_r2_ref` carries whichever shape its surface stored — an
              // `r2://` ref for a service cover, a portfolio entry for the other.
              // Null means "not addressable"; the tile stays an empty swatch
              // rather than a broken image, and the row still names the flag.
              const thumbUrl = publicUrlForStoredAsset(flag.r2Ref);
              return (
                <ToolRow
                  key={flag.publicId}
                  data={flag.publicId}
                  lead={
                    <span className="relative block h-12 w-12 overflow-hidden rounded-xl bg-[color:var(--surface-soft)]">
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt="Your photo that was reposted"
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                  }
                  title={`${SURFACE_LABEL[flag.surface]} reposted`}
                  lines={[`Flagged ${formatDate(flag.createdAt)}`, <span key="s" className="mt-1 inline-flex"><ToolChip tone={status.tone}>{status.label}</ToolChip></span>]}
                />
              );
            })}
          </TemplateRows>
        )}
      </ToolSection>

      <ToolLine
        label="Only you and our review team can see these flags."
        tip="We never name another supplier on an unconfirmed match — reposts are adjudicated by our team, not automatically."
      >
        Only you and our review team can see these flags.
      </ToolLine>
    </ToolPage>
  );
}
