'use server';

/**
 * Budget "Build" — save/delete A/B/C build snapshots (Services takeover · Compare).
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`. Backs the `budget_builds`
 * table (migration 20260926000000). RLS enforces couple-own + created_by = uid;
 * these actions just shape + write. Consumed only behind BUDGET_BUILD_ENABLED.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isBuild3StateEnabled } from '@/lib/build-3state';
import { planSaveAs, type NamedBuildRow } from '@/lib/named-builds';

// (2026-06-12 cleanup) The original Lean/Fits/Stretch estimate model —
// BuildBasket · BuildSnapshotLeaf · BuildSnapshot · SavedBuild · the
// saveBudgetBuild action — is DELETED. PR F (#1185) retired the basket
// estimator for the named vendor-pick builds below; the old shapes had no
// remaining callers. `budget_builds.basket` (NOT NULL CHECK) is still
// satisfied by savePlanBuild's hardcoded 'fits'.
export type BuildSlot = 'A' | 'B' | 'C';

export type BuildActionResult = { ok: true } | { ok: false; error: string };

export async function deleteBudgetBuild(input: {
  eventId: string;
  buildId: string;
}): Promise<BuildActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const { error } = await supabase.from('budget_builds').delete().eq('build_id', input.buildId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

// ── Named plan builds (PR F) ────────────────────────────────────────────────
// The Compare tab is now the prototype's compose-real-vendors model: a "build"
// is a named snapshot of the couple's actual vendor picks per category, not a
// Lean/Fits/Stretch estimate. Reuses `budget_builds` with NO migration — the
// picks live in the `snapshot` JSONB; `basket` is forced to 'fits' only to
// satisfy that column's NOT NULL CHECK (it's no longer meaningful here). The
// 3 A/B/C slots become 3 named builds.

export type PlanBuildPick = {
  groupId: string;
  label: string;
  vendorName: string;
  costPhp: number | null;
  locked: boolean;
  // Optional so snapshots saved before PR-Compare-Modify still typecheck on read.
  vendorId?: string;
  inclusions?: string[];
};

export type PlanBuildSnapshot = {
  budgetPhp: number | null;
  totalPhp: number;
  picks: PlanBuildPick[];
  // Which dimension led the solve when this build was saved (Pin solver Phase
  // 3a). Optional + forward-compat: pre-3a snapshots have no pinMode.
  pinMode?: 'budget' | 'services' | 'date';
};

/** Row shape the Compare tab reads back (server-fetched with the snapshot). */
export type SavedPlanBuild = {
  build_id: string;
  // Nullable since migration 20261231010000 — a NULL label is a free-form NAMED
  // build (BUILD_3STATE_ENABLED). Legacy rows still carry 'A'|'B'|'C'.
  label: BuildSlot | null;
  title: string | null;
  budget_php: number | null;
  total_php: number | null;
  snapshot: PlanBuildSnapshot;
  // Present for named builds (ordering); optional for forward/backward compat.
  created_at?: string | null;
};

export async function savePlanBuild(input: {
  eventId: string;
  label: BuildSlot;
  title?: string | null;
  snapshot: PlanBuildSnapshot;
}): Promise<BuildActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to save a build.' };

  const { error } = await supabase.from('budget_builds').upsert(
    {
      event_id: input.eventId,
      created_by: user.id,
      label: input.label,
      title: input.title ?? `Plan ${input.label}`,
      budget_php: input.snapshot.budgetPhp,
      basket: 'fits', // forced — not meaningful in the vendor-pick model
      total_php: input.snapshot.totalPhp,
      snapshot: input.snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,label' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

// ── Named Save-As builds (BUILD_3STATE_ENABLED) ─────────────────────────────
// The fixed A/B/C 3-slot cap is replaced by N free-form NAMED builds: a build is
// identified by its build_id + free-form title, with `label` now nullable
// (migration 20261231010000 relaxes the CHECK + the (event_id,label) unique cap).
// This action is reachable ONLY behind BUILD_3STATE_ENABLED — when the flag is
// OFF it fails soft (returns an error) and the legacy A/B/C `savePlanBuild`
// (onConflict event_id,label) path stays the production experience byte-identical.
//
//   • CREATE  — insert a NEW row with `label = NULL` + the typed title (or null →
//               the UI auto-titles "Build N"). No A/B/C cap.
//   • OVERWRITE — update an EXISTING named build by build_id (RLS scopes it to the
//               couple's own event). A stale build_id fails soft to CREATE so a
//               save is never silently dropped (planSaveAs decides).

export async function savePlanBuildNamed(input: {
  eventId: string;
  rawName?: string | null;
  /** A build_id to overwrite, or null/omitted to create a new named build. */
  overwriteBuildId?: string | null;
  snapshot: PlanBuildSnapshot;
}): Promise<BuildActionResult> {
  if (!isBuild3StateEnabled()) {
    // Flag-dark guard: the named path must be unreachable in production.
    return { ok: false, error: 'Named builds are not enabled.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to save a build.' };

  // Existing named rows for this event — feeds the create-vs-overwrite decision
  // (RLS already scopes the read to the couple's own event).
  const { data: existingRows } = await supabase
    .from('budget_builds')
    .select('build_id, label, title')
    .eq('event_id', input.eventId);
  const existing = (existingRows ?? []) as NamedBuildRow[];

  const plan = planSaveAs({
    rawName: input.rawName,
    overwriteBuildId: input.overwriteBuildId ?? null,
    existing,
  });

  if (plan.mode === 'overwrite') {
    const { error } = await supabase
      .from('budget_builds')
      .update({
        title: plan.title,
        budget_php: input.snapshot.budgetPhp,
        total_php: input.snapshot.totalPhp,
        snapshot: input.snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('build_id', plan.buildId)
      .eq('event_id', input.eventId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('budget_builds').insert({
      event_id: input.eventId,
      created_by: user.id,
      label: null, // free-form named build — no A/B/C slot
      title: plan.title,
      budget_php: input.snapshot.budgetPhp,
      basket: 'fits', // forced — not meaningful in the vendor-pick model
      total_php: input.snapshot.totalPhp,
      snapshot: input.snapshot,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}
