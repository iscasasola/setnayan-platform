"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/server/guest-session";

interface EnqueueInput {
  event_id: string;
  template_id: string;
  selected_capture_ids: string[];
  duration_s: number;
  slug: string; // for redirect target
}

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function enqueuePersonalReelAction(
  input: EnqueueInput,
): Promise<ActionResult<{ reel_id: string }>> {
  const session = await readGuestSession();
  if (!session) return { ok: false, error: "Sign in via your invitation link first." };
  if (session.event_id !== input.event_id) return { ok: false, error: "Wrong event." };

  const ids = Array.from(new Set(input.selected_capture_ids));
  if (ids.length < 1 || ids.length > 5) {
    return { ok: false, error: "Pick 1–5 photos or clips." };
  }
  if (!Number.isInteger(input.duration_s) || input.duration_s < 1 || input.duration_s > 30) {
    return { ok: false, error: "Duration must be between 1 and 30 seconds." };
  }

  const admin = createAdminClient();

  // Validate the template is still production_ready.
  const { data: tpl, error: tplErr } = await admin
    .from("reel_templates")
    .select("template_id, duration_min_s, duration_max_s, production_ready, retired_at")
    .eq("template_id", input.template_id)
    .maybeSingle<{
      template_id: string;
      duration_min_s: number;
      duration_max_s: number;
      production_ready: boolean;
      retired_at: string | null;
    }>();
  if (tplErr || !tpl) return { ok: false, error: "Template not found." };
  if (!tpl.production_ready || tpl.retired_at) return { ok: false, error: "Template is no longer available." };
  if (input.duration_s < tpl.duration_min_s || input.duration_s > tpl.duration_max_s) {
    return {
      ok: false,
      error: `This template runs ${tpl.duration_min_s}–${tpl.duration_max_s}s.`,
    };
  }

  // Validate every selected capture belongs to this event and isn't hidden / rejected.
  const { data: capRows, error: capErr } = await admin
    .from("captures")
    .select("capture_id")
    .eq("event_id", input.event_id)
    .in("capture_id", ids)
    .is("hidden_by_couple_at", null)
    .neq("moderation_status", "rejected");
  if (capErr) return { ok: false, error: capErr.message };
  if (!capRows || capRows.length !== ids.length) {
    return { ok: false, error: "One or more selected captures aren't available." };
  }

  // Check unlock. 0003's wallet_spend() RPC is now schema-live, but the
  // wallet UI (pack picker + spend modal) hasn't been built yet, so couples
  // can't top up. To keep dev unblocked we auto-create the unlock instead
  // of charging. When the wallet UI ships, replace this block with:
  //
  //   const { data: spend } = await admin.rpc("wallet_spend", {
  //     p_event_id: input.event_id,
  //     p_service_key: "template_addon",
  //     p_ref_id: <new event_template_unlocks.id>,
  //   });
  //   if (!spend.ok) return { ok: false, error: spend.reason };
  const { data: unlockRow } = await admin
    .from("event_template_unlocks")
    .select("event_id")
    .eq("event_id", input.event_id)
    .eq("template_id", input.template_id)
    .maybeSingle();

  if (!unlockRow) {
    const { error: insErr } = await admin
      .from("event_template_unlocks")
      .insert({ event_id: input.event_id, template_id: input.template_id });
    if (insErr) {
      return { ok: false, error: `Template unlock failed: ${insErr.message}` };
    }
  }

  // Snapshot the monogram flag at enqueue time so already-rendered reels
  // don't change branding mid-flight if the couple buys the pack later.
  const { data: eventRow } = await admin
    .from("events")
    .select("custom_monogram_unlocked")
    .eq("event_id", input.event_id)
    .maybeSingle<{ custom_monogram_unlocked: boolean }>();

  const { data: reel, error: reelErr } = await admin
    .from("personal_reels")
    .insert({
      event_id: input.event_id,
      guest_id: session.guest_id,
      template_id: input.template_id,
      selected_capture_ids: ids,
      couple_clip_ids: [], // V1.1 will source these from a couple-curated pool.
      duration_s: input.duration_s,
      monogram_applied: eventRow?.custom_monogram_unlocked ?? false,
      status: "queued",
    })
    .select("reel_id")
    .single();

  if (reelErr || !reel) {
    return { ok: false, error: reelErr?.message ?? "Could not enqueue render." };
  }

  // Render-pipeline kickoff lives in a Cloudflare Worker; this row is the
  // signal it watches. Until that worker exists the row stays in 'queued'.
  revalidatePath(`/${input.slug}/reels`);
  redirect(`/${input.slug}/reels/${reel.reel_id}`);
}
