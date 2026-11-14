import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { formatBytes, formatFileCount, partFingerprint } from '@/lib/papic-download-all-core';
import { readDownloadPlan, ZIP_KEEP_HOURS } from '@/lib/papic-download-all.server';
import { DownloadAllParts, type PartRow } from './download-all-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Download all' };

/**
 * 📦 /dashboard/[eventId]/memories/download-all — the event's photos and clips as zips BY CHAPTER, in ~2 GB numbered
 * parts, with the count and size of each shown before anything downloads, and a ✓ on each part once it was saved
 * (owner 2026-11-03, DECISION_LOG "THE PHOTO RULE": "zips by chapter, ~2 GB numbered parts, count + sizes shown up
 * front, per-zip ✓"). Hosts only — the same couple check the zip routes make.
 *
 * Replaces the one-zip Download all (`studio/papic/gallery-zip`, kept for old links): that one held the whole event in
 * the phone's memory before saving, and stopped at 1,000 photos per source.
 */
export default async function DownloadAllPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/${eventId}/memories/download-all`)}`);

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') notFound();

  const read = await readDownloadPlan(supabase, eventId);

  if (!read.ok) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <PageMasthead title="Download all" />
        <div role="alert" data-download-all="unreadable">
          <InfoTip labelAs="p" label="We couldn&rsquo;t read your photos just now, so there is nothing to download yet." labelClassName="text-[15px] text-danger-700" align="start">
            Please try again in a moment.
          </InfoTip>
        </div>
      </div>
    );
  }

  const { plan, missing } = read;
  const rows: PartRow[] = plan.parts.map((p) => ({
    chapterKey: p.chapterKey,
    chapterLabel: p.chapterLabel,
    part: p.part,
    of: p.of,
    countWords: formatFileCount(p.files),
    sizeWords: formatBytes(p.bytes),
    fp: partFingerprint(p),
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <PageMasthead title="Download all" />
      <div className="mb-4">
        <p className="flex items-center gap-1.5 text-[17px] font-semibold text-ink">
          Download all
          <InfoTip label="About these zips" align="start">
            One zip set per chapter, then Unsorted (photos in no chapter). A chapter bigger than about 2 GB comes in numbered
            parts. Photos are the originals while we keep them — 3 months after your event&rsquo;s last day — then the 720p
            copies; location data is removed. A photo in two chapters is in both. Each zip is made when you press it and is
            deleted from our side after {ZIP_KEEP_HOURS} hours; the ✓ is kept on this device.
          </InfoTip>
        </p>
        <p className="text-[14px] text-ink/70" data-download-all="summary">
          {plan.parts.length === 0
            ? 'No photos or clips to download yet.'
            : `${plan.count.toLocaleString('en-PH')} photos and clips · about ${formatBytes(plan.bytes)} in ${plan.parts.length} ${plan.parts.length === 1 ? 'zip' : 'zips'}.`}
        </p>
        {missing > 0 ? (
          <p className="mt-1 text-[13px] text-warn-800" data-download-all="missing">
            {missing.toLocaleString('en-PH')} {missing === 1 ? 'file is' : 'files are'} missing from storage and can&rsquo;t be
            included.
          </p>
        ) : null}
      </div>
      <DownloadAllParts eventId={eventId} rows={rows} />
    </div>
  );
}
