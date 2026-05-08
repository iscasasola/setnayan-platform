import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/server/guest-session";
import type { Capture, CaptureTag, Event, Guest } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const GUEST_FILTERS = ["photos_of_me", "my_table", "all"] as const;
type GuestFilter = (typeof GUEST_FILTERS)[number];

const GUEST_FILTER_LABEL: Record<GuestFilter, string> = {
  photos_of_me: "Photos of me",
  my_table: "My table",
  all: "All photos",
};

interface RouteParams {
  params: Promise<{ "event-slug": string }>;
  searchParams: Promise<{ filter?: string }>;
}

function parseFilter(raw: string | undefined): GuestFilter {
  if (raw && (GUEST_FILTERS as readonly string[]).includes(raw)) return raw as GuestFilter;
  return "all";
}

export default async function GuestGalleryPage({ params, searchParams }: RouteParams) {
  const { "event-slug": slug } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);

  const admin = createAdminClient();
  const { data: eventRow } = await admin
    .from("events")
    .select(
      "event_id, slug, bride_first_name, groom_first_name, " +
        "gallery_public_unlocked_at, custom_monogram_unlocked, photo_consent_required",
    )
    .ilike("slug", slug)
    .maybeSingle<
      Pick<
        Event,
        | "event_id"
        | "slug"
        | "bride_first_name"
        | "groom_first_name"
        | "gallery_public_unlocked_at"
        | "custom_monogram_unlocked"
      >
    >();

  if (!eventRow) notFound();

  const session = await readGuestSession();
  let guest: Guest | null = null;
  if (session && session.event_id === eventRow.event_id) {
    const { data } = await admin
      .from("guests")
      .select("*")
      .eq("guest_id", session.guest_id)
      .eq("qr_token", session.qr_token)
      .is("deleted_at", null)
      .maybeSingle<Guest>();
    if (data) guest = data;
  }

  const isPublic = !!eventRow.gallery_public_unlocked_at;

  if (!isPublic) {
    return (
      <main className="min-h-screen bg-page-bg">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="meta-label mb-3">Gallery</p>
          <h1 className="display-title text-balance">
            {eventRow.bride_first_name} &amp; {eventRow.groom_first_name}
          </h1>
          <p className="mt-4 text-[14px] text-ink-soft">
            The couple is still reviewing photos and clips. The full gallery unlocks
            soon — you&apos;ll get an email the moment it goes live.
          </p>
          <Link href={`/${slug}`} className="btn-default mt-6 inline-flex text-[12px]">
            Back to invitation
          </Link>
        </div>
      </main>
    );
  }

  // Photos-of-me / my-table need the guest session.
  if ((filter === "photos_of_me" || filter === "my_table") && !guest) {
    return (
      <main className="min-h-screen bg-page-bg">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="meta-label mb-3">Gallery</p>
          <h1 className="display-title">Sign in to use this filter</h1>
          <p className="mt-4 text-[14px] text-ink-soft">
            Open your invitation link to see photos tagged with you or your table.
          </p>
          <Link
            href={`/${slug}/gallery?filter=all`}
            className="btn-default mt-6 inline-flex text-[12px]"
          >
            See all photos instead
          </Link>
        </div>
      </main>
    );
  }

  // Resolve the guest_id set we want to filter by.
  let allowedCaptureIds: string[] | null = null; // null = no filter
  if (filter === "photos_of_me" && guest) {
    const { data: tagRows } = await admin
      .from("capture_tags")
      .select("capture_id")
      .eq("guest_id", guest.guest_id);
    allowedCaptureIds = Array.from(
      new Set(((tagRows as Pick<CaptureTag, "capture_id">[] | null) ?? []).map((r) => r.capture_id)),
    );
  } else if (filter === "my_table" && guest) {
    if (!guest.table_assignment_id) {
      allowedCaptureIds = [];
    } else {
      const { data: tableMates } = await admin
        .from("guests")
        .select("guest_id")
        .eq("event_id", eventRow.event_id)
        .eq("table_assignment_id", guest.table_assignment_id)
        .is("deleted_at", null);
      const guestIds = ((tableMates as { guest_id: string }[] | null) ?? []).map(
        (g) => g.guest_id,
      );
      if (guestIds.length === 0) {
        allowedCaptureIds = [];
      } else {
        const { data: tagRows } = await admin
          .from("capture_tags")
          .select("capture_id")
          .in("guest_id", guestIds);
        allowedCaptureIds = Array.from(
          new Set(((tagRows as Pick<CaptureTag, "capture_id">[] | null) ?? []).map((r) => r.capture_id)),
        );
      }
    }
  }

  // Build the capture query.
  let query = admin
    .from("captures")
    .select(
      "capture_id, type, captured_at, r2_thumbnail_key, " +
        "duration_seconds, flash_used, orientation, tags_count",
    )
    .eq("event_id", eventRow.event_id)
    .is("hidden_by_couple_at", null)
    .neq("moderation_status", "rejected")
    .order("captured_at", { ascending: false })
    .limit(120);

  if (allowedCaptureIds !== null) {
    if (allowedCaptureIds.length === 0) {
      // Skip the query entirely.
      return renderEmpty(eventRow, slug, guest, filter);
    }
    query = query.in("capture_id", allowedCaptureIds);
  }

  const { data: captureRows } = await query;
  const captures = (captureRows as Pick<
    Capture,
    | "capture_id"
    | "type"
    | "captured_at"
    | "r2_thumbnail_key"
    | "duration_seconds"
    | "flash_used"
    | "orientation"
    | "tags_count"
  >[] | null) ?? [];

  return (
    <main className="min-h-screen bg-page-bg">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
        <header>
          <p className="meta-label mb-2">
            <Link href={`/${slug}`} className="hover:text-ink">
              {eventRow.bride_first_name} &amp; {eventRow.groom_first_name}
            </Link>
            {" / "}Gallery
          </p>
          <h1 className="display-title">Gallery</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {captures.length} {captures.length === 1 ? "capture" : "captures"}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {GUEST_FILTERS.map((f) => {
            const active = filter === f;
            const disabled = (f === "photos_of_me" || f === "my_table") && !guest;
            return (
              <Link
                key={f}
                href={`/${slug}/gallery?filter=${f}`}
                aria-disabled={disabled}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "border border-rule-strong bg-surface text-ink-soft hover:text-ink"
                } ${disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                {GUEST_FILTER_LABEL[f]}
              </Link>
            );
          })}
          <Link
            href={`/${slug}/reels/new`}
            className="ml-auto btn-accent text-[12px]"
          >
            Make a personal reel ▶
          </Link>
        </div>

        {captures.length === 0 ? (
          <EmptyState filter={filter} guest={guest} slug={slug} />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {captures.map((c) => (
              <li
                key={c.capture_id}
                className="relative aspect-square overflow-hidden rounded-2xl border border-rule-strong"
              >
                <CaptureThumb capture={c} />
                {c.type === "clip" && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    ▶ 5s
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function renderEmpty(
  event: { bride_first_name: string; groom_first_name: string },
  slug: string,
  guest: Guest | null,
  filter: GuestFilter,
) {
  return (
    <main className="min-h-screen bg-page-bg">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
        <header>
          <p className="meta-label mb-2">
            {event.bride_first_name} &amp; {event.groom_first_name} / Gallery
          </p>
          <h1 className="display-title">Gallery</h1>
        </header>
        <EmptyState filter={filter} guest={guest} slug={slug} />
      </div>
    </main>
  );
}

function EmptyState({
  filter,
  guest,
  slug,
}: {
  filter: GuestFilter;
  guest: Guest | null;
  slug: string;
}) {
  const hint =
    filter === "photos_of_me"
      ? "No photos tagged with you yet. Photos appear here as paparazzi tag your QR through the night."
      : filter === "my_table"
        ? guest && !guest.table_assignment_id
          ? "You don't have a table assignment yet — once you do, photos tagged with anyone at your table will land here."
          : "No photos from your table yet."
        : "The gallery is empty right now. Photos and clips appear within seconds of upload.";
  return (
    <div className="rounded-2xl border border-dashed border-rule-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-soft">
      <p>{hint}</p>
      <Link href={`/${slug}/gallery?filter=all`} className="btn-default mt-4 inline-flex text-[12px]">
        See all photos
      </Link>
    </div>
  );
}

function CaptureThumb({
  capture,
}: {
  capture: Pick<Capture, "type" | "r2_thumbnail_key">;
}) {
  // Until R2 wiring lands (V1.5), render a tasteful placeholder. The grid
  // still demonstrates layout, the chip overlays, and the "▶ 5s" clip badge.
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center text-2xl text-ink-faint"
      style={{
        background:
          capture.type === "clip"
            ? "linear-gradient(135deg, var(--page-bg-soft), #e8e3d8)"
            : "linear-gradient(135deg, var(--surface-soft), var(--page-bg-soft))",
      }}
    >
      {capture.type === "clip" ? "▶" : "◇"}
    </div>
  );
}
