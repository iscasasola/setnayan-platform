'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchAdminVendorContext } from '@/lib/vendor-team';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { cleanStoryNote, hasStoryPages, storyPageHref } from '@/lib/ultra-story-pages';
import { publishedStoriesOfShop } from '@/lib/ultra-story-pages.server';
import { branchCopyTargets, parseBranchCopyPrice, MAIN_BRANCH_KEY } from '@/lib/branch-copy';
import { fetchVendorBranches } from '@/lib/vendor-branches';

/**
 * SIMPLER SUPPLIER PLANS — the supplier's two new writes (owner-approved 2026-11-14, items 8 and 10), as ONE
 * dispatcher so the server-action budget grows by one, not two (`scripts/lint-server-action-budget.mjs`):
 *
 *   op=story_note     — Ultra: the shop's "In our words" note for one PUBLISHED event it worked
 *                       (`vendor_event_story_notes`). Blank deletes the note.
 *   op=branch_copy    — "Copy to another branch": the same service at another branch, at that branch's price
 *                       (`copy_vendor_service_to_branch`, which also gives it its own calendar and uses no card).
 *
 * Both are ADMIN-only (`fetchAdminVendorContext`), both re-check every fact on the server (a hidden field is hostile
 * input), and both answer in words — never a silent no-op.
 */
export type PlanExtraResult = { ok: boolean; message: string; href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function supplierPlanExtra(_prev: PlanExtraResult | null, formData: FormData): Promise<PlanExtraResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  const ctx = await fetchAdminVendorContext(supabase, user.id);
  if (!ctx) return { ok: false, message: 'Only an admin of this shop can do that.' };
  const op = formData.get('op');

  if (op === 'story_note') {
    if (!hasStoryPages(ctx.tierState)) return { ok: false, message: 'Story pages come with Ultra.' };
    const eventId = String(formData.get('event_id') ?? '');
    if (!UUID.test(eventId)) return { ok: false, message: 'That story was not found.' };
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, message: 'We could not save just now. Please try again.' };
    }
    const { stories } = await publishedStoriesOfShop(admin, ctx.vendorProfileId).catch(() => ({ stories: [] as { eventId: string; slug: string }[] }));
    const story = stories.find((s) => s.eventId === eventId);
    if (!story) return { ok: false, message: 'Only an event its host has published can have a story page.' };

    const body = cleanStoryNote(formData.get('body'));
    const write = body
      ? await supabase
          .from('vendor_event_story_notes')
          .upsert(
            { vendor_profile_id: ctx.vendorProfileId, event_id: eventId, body, updated_at: new Date().toISOString() },
            { onConflict: 'vendor_profile_id,event_id' },
          )
      : await supabase.from('vendor_event_story_notes').delete().eq('vendor_profile_id', ctx.vendorProfileId).eq('event_id', eventId);
    if (write.error) {
      logQueryError('supplierPlanExtra.story_note', write.error, { vendorProfileId: ctx.vendorProfileId }, 'graceful_degrade');
      return { ok: false, message: 'We could not save your note. Please try again.' };
    }
    revalidatePath('/vendor-dashboard/shop/promote');
    const { data: shop } = await supabase.from('vendor_profiles').select('business_slug').eq('vendor_profile_id', ctx.vendorProfileId).maybeSingle();
    const slug = (shop as { business_slug: string | null } | null)?.business_slug;
    if (slug) revalidatePath(storyPageHref(slug, story.slug));
    return { ok: true, message: body ? 'Saved. It shows on your story page.' : 'Note removed.' };
  }

  if (op === 'branch_copy') {
    const serviceId = String(formData.get('vendor_service_id') ?? '');
    if (!UUID.test(serviceId)) return { ok: false, message: 'That card was not found.' };
    const price = parseBranchCopyPrice(formData.get('price_php'));
    if (price === null) return { ok: false, message: 'Set the price there — a whole number of pesos.' };

    const { data: card, error: cardErr } = await supabase
      .from('vendor_services')
      .select('vendor_service_id, branch_id')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', ctx.vendorProfileId)
      .maybeSingle();
    if (cardErr || !card) return { ok: false, message: 'That card was not found.' };

    let branches: Awaited<ReturnType<typeof fetchVendorBranches>>;
    try {
      branches = await fetchVendorBranches(supabase, ctx.vendorProfileId, createAdminClient());
    } catch {
      return { ok: false, message: 'We could not check your branches just now. Please try again in a moment.' };
    }
    const targets = branchCopyTargets(
      branches.map((b) => ({ id: b.branch_id, label: b.branch_label, status: b.status })),
      (card as { branch_id: string | null }).branch_id,
    );
    const key = String(formData.get('branch') ?? '');
    const target = targets.find((t) => t.key === key);
    if (!target) return { ok: false, message: 'Pick one of your other branches. A branch must be active before a card can go there.' };

    const { data: newId, error } = await supabase.rpc('copy_vendor_service_to_branch', {
      p_vendor_profile_id: ctx.vendorProfileId,
      p_source_service_id: serviceId,
      p_branch_id: target.key === MAIN_BRANCH_KEY ? null : target.key,
      p_price_php: price,
    });
    if (error || typeof newId !== 'string') {
      logQueryError('supplierPlanExtra.branch_copy', error ?? { message: 'no id' }, { vendorProfileId: ctx.vendorProfileId }, 'graceful_degrade');
      return { ok: false, message: error?.message && /branch|price|Service/i.test(error.message) ? error.message : 'We could not copy the card. Please try again.' };
    }
    revalidatePath('/vendor-dashboard/services');
    revalidateShopPage(ctx.vendorProfileId);
    return { ok: true, message: `Copied to ${target.label}.`, href: `/vendor-dashboard/services/${newId}` };
  }

  return { ok: false, message: 'Unknown request.' };
}
