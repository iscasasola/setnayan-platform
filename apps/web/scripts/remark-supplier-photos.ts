/**
 * scripts/remark-supplier-photos.ts — DRY RUN ONLY.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/remark-supplier-photos.ts --dry-run
 *
 * Counts the supplier photos whose public copy carries the wrong mark for its
 * shop's state now (verified ↔ Setnayan only) — `pendingRemarks` in
 * lib/supplier-photo-remark.server.ts — and prints the count per shop. It
 * reads two tables and WRITES NOTHING.
 *
 * 🛑 There is no apply mode in this slice, on purpose: re-marking rewrites
 * public bytes, and running that against production is the owner's call. Any
 * argument other than `--dry-run` is refused.
 */
import { createAdminClient } from '../lib/supabase/admin';
import { pendingRemarks, desiredMarkKind, type MarkKind, type OriginalRow } from '../lib/supplier-photo-remark.server';
import { shopMarkFromRow } from '../lib/supplier-mark-spec.server';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '--dry-run') {
    console.error('Refused: this script only counts. Run it with exactly `--dry-run`.');
    process.exit(2);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(2);
  }
  // The service role, through the app's one factory: the shop's renewal date is not readable by a signed-in session.
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from('supplier_photo_originals')
    .select('id, vendor_profile_id, public_ref, original_ref, frame, mark_kind');
  if (error) throw new Error(`supplier_photo_originals unreadable: ${error.message}`);
  const shopIds = [...new Set((rows ?? []).map((r) => r.vendor_profile_id as string))];
  const desired = new Map<string, MarkKind>();
  if (shopIds.length) {
    const { data: shops, error: shopErr } = await db
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, business_slug, logo_url, verification_state, next_renewal_due_at')
      .in('vendor_profile_id', shopIds);
    if (shopErr) throw new Error(`vendor_profiles unreadable: ${shopErr.message}`);
    for (const s of shops ?? []) desired.set(s.vendor_profile_id as string, desiredMarkKind(shopMarkFromRow(s).spec));
  }
  const pending = pendingRemarks((rows ?? []) as OriginalRow[], desired);
  const byShop = new Map<string, number>();
  for (const r of pending) byShop.set(r.vendor_profile_id, (byShop.get(r.vendor_profile_id) ?? 0) + 1);
  console.log(`supplier photos paired: ${rows?.length ?? 0} · pending re-mark: ${pending.length} (dry run, nothing written)`);
  for (const [shop, n] of byShop) console.log(`  ${shop}: ${n} → ${desired.get(shop)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
