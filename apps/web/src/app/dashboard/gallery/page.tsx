import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentEvent } from "@/lib/db/events";
import {
  fetchCoupleGalleryPage,
  fetchCoupleGuestIds,
  fetchGallerySummary,
  fetchSeatsForEvent,
  reviewWindowDaysLeft,
} from "@/lib/db/paparazzi";
import {
  CAPTURE_TYPES,
  PAPARAZZI_GALLERY_FILTERS,
  PAPARAZZI_GALLERY_FILTER_LABELS,
  type CaptureType,
  type PaparazziGalleryFilter,
} from "@/lib/db/types";
import { ReviewBanner } from "./_components/review-banner";
import { FilterPills } from "./_components/filter-pills";
import { CaptureGrid } from "./_components/capture-grid";
import { SeatsPanel } from "./_components/seats-panel";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    filter?: string;
    type?: string;
    showHidden?: string;
    cursor?: string;
  }>;
}

function parseFilter(raw: string | undefined): PaparazziGalleryFilter {
  if (raw && (PAPARAZZI_GALLERY_FILTERS as readonly string[]).includes(raw)) {
    return raw as PaparazziGalleryFilter;
  }
  return "chronological";
}

function parseTypeNarrow(raw: string | undefined): CaptureType | "all" {
  if (raw && (CAPTURE_TYPES as readonly string[]).includes(raw)) return raw as CaptureType;
  return "all";
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const event = await getCurrentEvent();
  if (!event) redirect("/dashboard");

  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const typeNarrow = parseTypeNarrow(sp.type);
  const showHidden = sp.showHidden === "1";
  const cursor = sp.cursor && /^\d{4}-\d{2}-\d{2}T/.test(sp.cursor) ? sp.cursor : null;

  const [summary, seats, coupleGuestIds] = await Promise.all([
    fetchGallerySummary(event.event_id),
    fetchSeatsForEvent(event.event_id),
    fetchCoupleGuestIds(event.event_id),
  ]);

  const { captures, nextCursor } = await fetchCoupleGalleryPage({
    eventId: event.event_id,
    filter,
    typeNarrow: filter === "type" ? typeNarrow : undefined,
    coupleGuestIds: filter === "photos_of_us" ? coupleGuestIds : undefined,
    includeHidden: showHidden,
    limit: 60,
    cursor,
  });

  const loadMoreHref = nextCursor
    ? buildHref({ filter, typeNarrow, showHidden, cursor: nextCursor })
    : null;

  const review = reviewWindowDaysLeft(event);
  const noTier = event.paparazzi_tier === null;

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="meta-label mb-2">Dashboard / Gallery</p>
            <h1 className="display-title">Paparazzi Gallery</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {summary.total} captures · {summary.photos} photos · {summary.clips} clips ·{" "}
              {summary.untagged} untagged
              {summary.hidden > 0 ? ` · ${summary.hidden} hidden` : ""}
              {summary.flagged > 0 ? ` · ${summary.flagged} flagged` : ""}
            </p>
          </div>
          {noTier && (
            <Link href="/dashboard/wallet" className="btn-accent text-[12px]">
              Buy Paparazzi tier
            </Link>
          )}
        </header>

        {review && !event.gallery_public_unlocked_at && (
          <ReviewBanner
            daysLeft={review.daysLeft}
            hoursLeft={review.hoursLeft}
            unlocksAt={review.unlocksAt.toISOString()}
            windowDays={event.gallery_review_window_days}
          />
        )}

        {event.gallery_public_unlocked_at && (
          <div className="rounded-2xl border border-rule bg-surface px-5 py-4 text-[13px] text-ink-soft">
            Gallery is publicly visible to all guests since{" "}
            {new Date(event.gallery_public_unlocked_at).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </div>
        )}

        <SeatsPanel seats={seats} tier={event.paparazzi_tier} />

        <FilterPills
          filter={filter}
          typeNarrow={typeNarrow}
          showHidden={showHidden}
          counts={{
            all: summary.total,
            untagged: summary.untagged,
            hidden: summary.hidden,
          }}
        />

        <CaptureGrid
          captures={captures}
          filter={filter}
          showHidden={showHidden}
          emptyHint={emptyHintFor(filter, summary)}
        />

        {loadMoreHref && (
          <div className="flex justify-center">
            <Link href={loadMoreHref} className="btn-default text-[12px]">
              Load more
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function buildHref(opts: {
  filter: PaparazziGalleryFilter;
  typeNarrow: CaptureType | "all";
  showHidden: boolean;
  cursor: string;
}): string {
  const sp = new URLSearchParams();
  if (opts.filter !== "chronological") sp.set("filter", opts.filter);
  if (opts.filter === "type" && opts.typeNarrow !== "all") sp.set("type", opts.typeNarrow);
  if (opts.showHidden) sp.set("showHidden", "1");
  sp.set("cursor", opts.cursor);
  return `?${sp.toString()}`;
}

function emptyHintFor(
  filter: PaparazziGalleryFilter,
  summary: { total: number; untagged: number },
): string {
  if (summary.total === 0) {
    return "No captures yet. Once your paparazzi start shooting, photos and 5-second clips appear here within seconds of upload.";
  }
  if (filter === "untagged" && summary.untagged === 0) {
    return "Every capture has at least one tag. Nice — no review queue today.";
  }
  if (filter === "photos_of_us") {
    return "No captures tagged with the couple yet. Tags fan out automatically when paparazzi scan a guest QR.";
  }
  return `No matches for the “${PAPARAZZI_GALLERY_FILTER_LABELS[filter]}” filter right now.`;
}
