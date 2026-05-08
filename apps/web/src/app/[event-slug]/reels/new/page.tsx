import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/server/guest-session";
import type {
  Capture,
  CaptureTag,
  Event,
  Guest,
  ReelTemplate,
} from "@/lib/db/types";
import { ReelBuilder } from "./_components/reel-builder";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ "event-slug": string }>;
}

export default async function NewReelPage({ params }: RouteParams) {
  const { "event-slug": slug } = await params;
  const admin = createAdminClient();

  const { data: eventRow } = await admin
    .from("events")
    .select(
      "event_id, slug, bride_first_name, groom_first_name, " +
        "gallery_public_unlocked_at, custom_monogram_unlocked",
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
  if (!session || session.event_id !== eventRow.event_id) {
    redirect(`/${slug}`);
  }

  const { data: guest } = await admin
    .from("guests")
    .select("*")
    .eq("guest_id", session.guest_id)
    .eq("qr_token", session.qr_token)
    .is("deleted_at", null)
    .maybeSingle<Guest>();
  if (!guest) redirect(`/${slug}`);

  if (!eventRow.gallery_public_unlocked_at) {
    return (
      <main className="min-h-screen bg-page-bg">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="meta-label mb-3">Personal Reels</p>
          <h1 className="display-title">Reels open after the couple unlocks the gallery</h1>
          <p className="mt-4 text-[14px] text-ink-soft">
            We&apos;ll email you the moment they release it.
          </p>
          <Link href={`/${slug}`} className="btn-default mt-6 inline-flex text-[12px]">
            Back to invitation
          </Link>
        </div>
      </main>
    );
  }

  // Templates (production-ready, not retired).
  const { data: templateRows } = await admin
    .from("reel_templates")
    .select(
      "template_id, slug, display_name, feel_category, manifest_json, " +
        "preview_video_key, paired_track_ids, duration_min_s, duration_max_s, " +
        "production_ready, retired_at, created_at, updated_at",
    )
    .eq("production_ready", true)
    .is("retired_at", null)
    .order("display_name");
  const templates = (templateRows as ReelTemplate[] | null) ?? [];

  // Captures the guest can pick from: their tagged photos + clips.
  const { data: tagRows } = await admin
    .from("capture_tags")
    .select("capture_id")
    .eq("guest_id", guest.guest_id);
  const myCaptureIds = Array.from(
    new Set(((tagRows as Pick<CaptureTag, "capture_id">[] | null) ?? []).map((t) => t.capture_id)),
  );

  let captures: Pick<
    Capture,
    "capture_id" | "type" | "captured_at" | "r2_thumbnail_key" | "duration_seconds"
  >[] = [];
  if (myCaptureIds.length > 0) {
    const { data } = await admin
      .from("captures")
      .select("capture_id, type, captured_at, r2_thumbnail_key, duration_seconds")
      .eq("event_id", eventRow.event_id)
      .in("capture_id", myCaptureIds)
      .is("hidden_by_couple_at", null)
      .neq("moderation_status", "rejected")
      .order("captured_at", { ascending: false })
      .limit(120);
    captures =
      (data as Pick<
        Capture,
        "capture_id" | "type" | "captured_at" | "r2_thumbnail_key" | "duration_seconds"
      >[] | null) ?? [];
  }

  return (
    <main className="min-h-screen bg-page-bg">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
        <header>
          <p className="meta-label mb-2">
            <Link href={`/${slug}`} className="hover:text-ink">
              {eventRow.bride_first_name} &amp; {eventRow.groom_first_name}
            </Link>
            {" / "}
            <Link href={`/${slug}/gallery`} className="hover:text-ink">
              Gallery
            </Link>
            {" / "}New reel
          </p>
          <h1 className="display-title">Make your Personal Reel</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            Pick a template, drop in 1–5 of your favourite photos or clips, and we&apos;ll
            render a 9:16 reel ready to post — ₱200 per template unlock.
          </p>
        </header>

        <ReelBuilder
          eventId={eventRow.event_id}
          slug={slug}
          templates={templates}
          captures={captures}
        />
      </div>
    </main>
  );
}
