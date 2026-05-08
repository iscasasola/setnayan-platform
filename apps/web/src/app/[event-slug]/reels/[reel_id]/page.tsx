import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/server/guest-session";
import type { PersonalReel, ReelTemplate } from "@/lib/db/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ "event-slug": string; reel_id: string }>;
}

export default async function ReelDetailPage({ params }: RouteParams) {
  const { "event-slug": slug, reel_id: reelId } = await params;
  const admin = createAdminClient();

  const session = await readGuestSession();
  if (!session) redirect(`/${slug}`);

  const { data: row } = await admin
    .from("personal_reels")
    .select(
      "reel_id, event_id, guest_id, template_id, " +
        "selected_capture_ids, couple_clip_ids, duration_s, " +
        "music_track_id, monogram_applied, status, " +
        "r2_output_key, preview_thumb_key, " +
        "enqueued_at, rendering_started_at, rendered_at, failure_reason, " +
        "created_at, updated_at",
    )
    .eq("reel_id", reelId)
    .maybeSingle<PersonalReel>();
  if (!row) notFound();
  if (row.guest_id !== session.guest_id) redirect(`/${slug}`);

  const { data: tplRow } = await admin
    .from("reel_templates")
    .select(
      "template_id, slug, display_name, feel_category, manifest_json, " +
        "preview_video_key, paired_track_ids, duration_min_s, duration_max_s, " +
        "production_ready, retired_at, created_at, updated_at",
    )
    .eq("template_id", row.template_id)
    .maybeSingle<ReelTemplate>();

  const status = row.status;
  const downloadable = status === "ready" && !!row.r2_output_key;

  return (
    <main className="min-h-screen bg-page-bg">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
        <header>
          <p className="meta-label mb-2">
            <Link href={`/${slug}/gallery`} className="hover:text-ink">
              Gallery
            </Link>
            {" / "}Personal Reel
          </p>
          <h1 className="display-title">{tplRow?.display_name ?? "Personal Reel"}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {row.duration_s}s · {row.selected_capture_ids.length} clips ·{" "}
            {row.monogram_applied ? "Couple monogram" : "Tayo logo"}
          </p>
        </header>

        <section className="rounded-2xl border border-rule-strong bg-surface p-5">
          <p className="meta-label mb-2">Status</p>
          <StatusBlock status={status} reel={row} />
        </section>

        {downloadable && (
          <section className="rounded-2xl border border-rule bg-surface p-5">
            <p className="meta-label mb-3">Share</p>
            <div className="flex flex-wrap gap-2">
              {(["IG Reels", "IG Stories", "Facebook", "TikTok", "X", "WhatsApp"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    disabled
                    className="btn-default text-[12px] cursor-not-allowed opacity-60"
                  >
                    {t}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled
                className="btn-accent text-[12px] cursor-not-allowed opacity-60"
              >
                Download MP4
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              Native share targets land when the render worker is wired (V1.5).
            </p>
          </section>
        )}

        <Link href={`/${slug}/gallery`} className="btn-default mt-2 inline-flex self-start text-[12px]">
          ← Back to gallery
        </Link>
      </div>
    </main>
  );
}

function StatusBlock({
  status,
  reel,
}: {
  status: PersonalReel["status"];
  reel: Pick<PersonalReel, "enqueued_at" | "rendering_started_at" | "rendered_at" | "failure_reason">;
}) {
  if (status === "queued") {
    return (
      <p className="text-[13px] text-ink-soft">
        Queued for render. We&apos;ll email you when it&apos;s ready (typically 30–90
        seconds after rendering starts).
      </p>
    );
  }
  if (status === "rendering") {
    return (
      <p className="text-[13px] text-ink-soft">
        Rendering — started{" "}
        {reel.rendering_started_at
          ? new Date(reel.rendering_started_at).toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "just now"}
        .
      </p>
    );
  }
  if (status === "ready") {
    return (
      <p className="text-[13px] text-ink-soft">
        Rendered{" "}
        {reel.rendered_at
          ? new Date(reel.rendered_at).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "moments ago"}
        .
      </p>
    );
  }
  return (
    <p className="text-[13px] text-[var(--accent-deep)]">
      Render failed: {reel.failure_reason ?? "unknown error"}. Try a different template
      or contact support.
    </p>
  );
}
