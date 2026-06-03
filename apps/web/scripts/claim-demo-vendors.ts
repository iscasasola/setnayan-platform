/**
 * scripts/claim-demo-vendors.ts
 *
 * Claim ONE demo vendor to a vendor user account so it can RECEIVE + REPLY to
 * couple inquiries (the customer↔vendor round-trip). Demo vendors are seeded
 * UNCLAIMED (`user_id = NULL`), so a couple can start a thread but no vendor
 * ever receives it — this assigns one demo vendor to a real vendor user.
 *
 * WHY ONE: vendor_profiles → user is 1:1 — `fetchOwnVendorProfile` uses
 * `.eq('user_id').maybeSingle()`, so a user must own AT MOST one profile.
 * Claiming a second to the same user would break that user's dashboard.
 *
 * WHAT IT SETS on the picked demo vendor:
 *   user_id       = the target vendor user
 *   is_demo       = FALSE        (a real listing now; survives "Cleanup ALL Demo Vendors")
 *   demo_batch_id = NULL         (detached from per-batch cleanup)
 *   contact_email = the user's email   (all demo vendors share one contact_email,
 *                   which makes startThreadByVendorEmail's `.maybeSingle()`
 *                   lookup ambiguous — a unique one is required for the couple's
 *                   "Message" flow to resolve to exactly this vendor)
 *
 * USAGE (non-prod only — same project-ref guard as the seed)
 *   pnpm -F @setnayan/web exec tsx scripts/claim-demo-vendors.ts --to-email=vendor@test.com
 *   pnpm -F @setnayan/web exec tsx scripts/claim-demo-vendors.ts --to=<userId> --category=photography
 *   pnpm -F @setnayan/web exec tsx scripts/claim-demo-vendors.ts --to-email=vendor@test.com --slug=demo-... --dry-run
 *
 * ENV: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PROD_PROJECT_REF = process.env.DEMO_VENDORS_PROD_REF ?? 'njrupjnvkjkitfctetvi';

function assertNotProd(url: string): void {
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(
      `\nREFUSING TO RUN. Detected prod project ref "${PROD_PROJECT_REF}".\n` +
        `Claiming flips is_demo=FALSE (injects a real listing) — non-prod only.\n`,
    );
    process.exit(2);
  }
}

type Args = {
  toUserId: string | null;
  toEmail: string | null;
  category: string | null;
  slug: string | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { toUserId: null, toEmail: null, category: null, slug: null, dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--to-email=')) a.toEmail = arg.slice('--to-email='.length);
    else if (arg.startsWith('--to=')) a.toUserId = arg.slice('--to='.length);
    else if (arg.startsWith('--category=')) a.category = arg.slice('--category='.length);
    else if (arg.startsWith('--slug=')) a.slug = arg.slice('--slug='.length);
    else if (arg === '--dry-run') a.dryRun = true;
  }
  return a;
}

async function resolveUser(
  admin: SupabaseClient,
  args: Args,
): Promise<{ userId: string; email: string }> {
  if (args.toUserId) {
    const { data, error } = await admin
      .from('users')
      .select('user_id, email')
      .eq('user_id', args.toUserId)
      .maybeSingle();
    if (error) throw new Error(`user lookup failed: ${error.message}`);
    if (!data) throw new Error(`No user with user_id=${args.toUserId}`);
    const row = data as { user_id: string; email: string };
    return { userId: row.user_id, email: row.email };
  }
  if (args.toEmail) {
    const { data, error } = await admin
      .from('users')
      .select('user_id, email')
      .ilike('email', args.toEmail)
      .maybeSingle();
    if (error) throw new Error(`user lookup failed: ${error.message}`);
    if (!data) throw new Error(`No user with email=${args.toEmail}`);
    const row = data as { user_id: string; email: string };
    return { userId: row.user_id, email: row.email };
  }
  throw new Error('Pass --to-email=<email> or --to=<userId> to identify the vendor user.');
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('\nMissing env. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.\n');
    process.exit(2);
  }
  assertNotProd(url);
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const args = parseArgs(process.argv);

  const { userId, email } = await resolveUser(admin, args);

  // 1:1 guard — refuse if this user already owns a profile.
  const { data: existing, error: exErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_slug')
    .eq('user_id', userId)
    .maybeSingle();
  if (exErr) throw new Error(`ownership check failed: ${exErr.message}`);
  if (existing) {
    const owned = existing as { business_slug: string | null };
    throw new Error(
      `User ${userId} already owns vendor_profile "${owned.business_slug}". The vendor ` +
        `dashboard is 1:1 — claiming a second would break it. Use a fresh vendor user.`,
    );
  }

  // Pick one demo vendor (optionally by category / slug).
  let q = admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug')
    .eq('is_demo', true);
  if (args.slug) q = q.eq('business_slug', args.slug);
  if (args.category) q = q.contains('services', [args.category]);
  const { data: candidates, error: cErr } = await q.limit(1);
  if (cErr) throw new Error(`demo vendor lookup failed: ${cErr.message}`);
  const picked = (candidates ?? [])[0] as
    | { vendor_profile_id: string; business_name: string; business_slug: string }
    | undefined;
  if (!picked) {
    throw new Error(
      `No demo vendor found` +
        `${args.category ? ` for category "${args.category}"` : ''}` +
        `${args.slug ? ` with slug "${args.slug}"` : ''}. Seed demo vendors first.`,
    );
  }

  console.log(`\nWill claim demo vendor:`);
  console.log(`  ${picked.business_name}  (${picked.business_slug})`);
  console.log(`  → user_id=${userId} · email=${email} · is_demo=FALSE · demo_batch_id=NULL`);
  if (args.dryRun) {
    console.log(`\nDry run — no writes.\n`);
    return;
  }

  const { error: uErr } = await admin
    .from('vendor_profiles')
    .update({ user_id: userId, is_demo: false, demo_batch_id: null, contact_email: email })
    .eq('vendor_profile_id', picked.vendor_profile_id);
  if (uErr) throw new Error(`claim update failed: ${uErr.message}`);

  console.log(`\n✓ Claimed. Test the customer↔vendor round-trip:`);
  console.log(`  1. Log in as the vendor (${email}) → /vendor-dashboard (this profile now appears).`);
  console.log(
    `  2. As a couple (different account, with an event): open /v/${picked.business_slug} → Follow → Message → send an inquiry.`,
  );
  console.log(
    `  3. Back as the vendor: /vendor-dashboard/messages shows the inquiry → Accept → the vendor name reveals + 2-way chat opens.\n`,
  );
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
