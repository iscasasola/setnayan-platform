'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { canOpenAnotherShop } from '@/lib/shop-limits';
import { resolvePickedLeaf } from '@/lib/open-shop-service-tree';
import { clipBusinessSlug, slugifyBusinessName } from '@/lib/business-slug';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { titleCasePersonName } from '@/lib/person-name-case';
import { findSlugConflict } from '@/lib/slug-availability';
import { VENDOR_SLUG_RE } from '@/lib/vendor-slug';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import {
  OPEN_SHOP_EMAIL_RE,
  OPEN_SHOP_ERRORS,
  OPEN_SHOP_LOGO_REQUIRED,
} from '@/lib/open-shop-validation';

/**
 * Vendor onboarding submit (owner 2026-07-03: "create a vendor onboarding. we
 * just need the basic"; owner 2026-07-05: keep onboarding to the SIX basics +
 * location — website + social move to the dashboard).
 *
 * Provisions the shop the same way the signup trigger does (bare
 * `vendor_profiles` + founding `vendor_team_members` admin seat — idempotent,
 * admin client after the auth check) and writes the onboarding basics onto it:
 *
 *   shop_name       → business_name        (required)
 *   logo_url        → logo_url              (OPTIONAL here since 2026-07-21 —
 *                     r2:// ref from the shared <FileUpload>, same as My Shop.
 *                     Owner decision 4 softened §2.1b from mandatory-at-
 *                     registration to mandatory-before-VERIFICATION: the gate
 *                     now lives in lib/vendor-verification.ts
 *                     `verificationSubmitMissing`, which reads
 *                     `businessProfileChecklist().complete`. Shared flag:
 *                     OPEN_SHOP_LOGO_REQUIRED in lib/open-shop-validation.)
 *   primary_service → services = [one of VENDOR_CATEGORIES]  (required)
 *   contact_name    → business_owner_name   (owner name · required)
 *   contact_phone   → contact_phone         (contact number · required)
 *   contact_email   → contact_email         (company email · required)
 *   location_city   → location_city         (optional)
 *
 * Website + social links, exact HQ pin, EST, portfolio + documents stay on My
 * Shop — the profile checklist + Get-verified journey ARE the rest of the
 * onboarding (the `website` column + the `social_media` verification slot are
 * editable there). Existing non-empty values are never clobbered by blanks
 * (safe to re-run on a half-filled shop).
 */

function clean(raw: FormDataEntryValue | null, max = 128): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * Logo column accepts an r2:// ref (from the shared <FileUpload>) or a legacy
 * http(s) URL — identical to My Shop's `parseLogoValue`. Anything else → null
 * so the column never accumulates junk.
 */
function cleanLogo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.startsWith('r2://')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

/** Light email shape check — enough to keep obviously-broken strings out.
 *  Regex is SHARED with the client gate (lib/open-shop-validation) so the two
 *  can never disagree about what "valid" means. */
function cleanEmail(raw: FormDataEntryValue | null): string | null {
  const t = clean(raw, 254)?.toLowerCase() ?? null;
  if (!t) return null;
  return OPEN_SHOP_EMAIL_RE.test(t) ? t : null;
}

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

export async function becomeVendor(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out → the existing vendor signup handles account + shop together.
  if (!user) redirect('/signup?as=vendor');

  const shopName = clean(formData.get('shop_name'));
  const logoUrl = cleanLogo(formData.get('logo_url'));
  const primaryService = clean(formData.get('primary_service'), 64);
  // ── THE ADDRESS IS CHOSEN, NOT MINTED (owner 2026-08-10: "slug cannot be
  //    renamed so they need to pick their preferred slug") ─────────────────
  // Normalised through the SAME mirror the wizard previewed with, so what the
  // vendor read on screen is what the column receives. Falls back to the shop
  // name's own slug when the field arrives blank — an empty address is not a
  // choice, and the database would mint one anyway.
  const chosenSlug =
    clipBusinessSlug(slugifyBusinessName(clean(formData.get('business_slug'), 32))) ??
    clipBusinessSlug(slugifyBusinessName(shopName));
  // Capitalised at the SOURCE, not just on screen (owner 2026-08-10). This name
  // is read back by the shop page, the marketplace card and every message to a
  // couple — fixing it only in the input would leave "ana reyes" stored and
  // shown everywhere else.
  const contactName = titleCasePersonName(clean(formData.get('contact_name')) ?? '') || null;
  const contactPosition = clean(formData.get('contact_position'), 64);
  const contactPhone = clean(formData.get('contact_phone'), 32);
  const contactEmail = cleanEmail(formData.get('contact_email'));
  if (!shopName) redirect('/open-shop?step=1&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.shopName));
  // Logo gate reads the SHARED flag (client wizard reads the same one), so the
  // two layers can never disagree. Off since 2026-07-21 — see the flag's doc.
  if (OPEN_SHOP_LOGO_REQUIRED && !logoUrl) {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.logo));
  }
  // The address can never be renamed, so a bad one is permanent. Shape first,
  // then the reserved-word refusal: a reserved address is a DEAD address, not a
  // shadowed route — `app/[slug]/page.tsx` answers notFound() for reserved words
  // BEFORE it looks for a vendor, so the shop would be unreachable forever with
  // no way out.
  if (chosenSlug && !VENDOR_SLUG_RE.test(chosenSlug)) {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.slugShape));
  }
  if (chosenSlug && isReservedSlug(chosenSlug)) {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.slugTaken));
  }
  // ── ASK ALL FOUR NAMESPACES, NOT JUST OUR OWN TABLE ────────────────────────
  // The UNIQUE index covers `vendor_profiles.business_slug` and nothing else.
  // Weddings (`events.slug`), people (`users.slug`) and retired-but-still-
  // FORWARDING addresses share the one namespace at `setnayan.com/{word}` — and
  // `app/[slug]/page.tsx` resolves an EVENT BEFORE a vendor. So a shop that took
  // a wedding's word would pass the unique index, be written, and then be
  // permanently unreachable: its own page shadowed by the wedding, with no
  // rename to escape through because the address is now immutable.
  //
  // This inherits the contract `lib/slug-handout-paths.test.ts` used to hold
  // over the My Shop rename. The rename is gone (owner 2026-08-10); creation is
  // now the ONLY path that hands out a shop address, so the check moved here
  // with it rather than being deleted along with the path it guarded.
  //
  // Admin client because an anonymous or half-registered vendor cannot read the
  // other three tables under RLS, and "free" from a denied read is the `count: 0`
  // trap — an RLS denial and an empty result are the same value.
  if (chosenSlug) {
    const conflict = await findSlugConflict(createAdminClient(), chosenSlug);
    // `unverified` = a probe we could not run. It is NOT proof the word is free,
    // and this address can never be changed afterwards — so it fails closed.
    if (conflict) {
      redirect('/open-shop?error=' + encodeURIComponent(OPEN_SHOP_ERRORS.slugTaken));
    }
  }

  // ── ACCEPT A LEAF *OR* A COARSE CATEGORY ───────────────────────────────────
  // The picker (owner 2026-08-09) posts a canonical LEAF; the flat select it
  // falls back to still posts a coarse category. Both are valid, and the leaf is
  // RE-RESOLVED SERVER-SIDE against the same filtered tree the picker offered —
  // never trusted from the post. That single lookup is what makes a hand-rolled
  // POST unable to smuggle in:
  //   • a first-party `setnayan_*` key, which would set `is_setnayan_service` on
  //     vendor_market_stats and silently EXCLUDE the shop from /explore forever;
  //   • a retired or marketplace-hidden leaf, already pruned upstream;
  //   • a leaf paired with someone else's branch — the coarse category is
  //     derived from the tile the TREE says, not the one the form said.
  let pickedLeaf: string | null = null;
  let coarseService: string | null = null;
  if (primaryService && CATEGORY_SET.has(primaryService)) {
    coarseService = primaryService;
  } else if (primaryService) {
    const leaf = await resolvePickedLeaf(primaryService);
    if (leaf) {
      pickedLeaf = leaf.canonicalService;
      // Guaranteed non-'misc' for every live leaf by
      // tests/db/no-service-lands-in-misc.db.test.ts.
      coarseService = vendorCategoryForLeaf(leaf.canonicalService, leaf.tileId);
    }
  }
  if (!coarseService) {
    redirect('/open-shop?step=2&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.service));
  }
  // ── EVERY REJECTION NAMES THE STEP THAT OWNS THE FIELD (1–4) ──────────────
  // Without it the wizard remounts at step 1 and silently discards everything
  // typed on later steps, because none of it has been written to the DB the
  // `defaults` prop reads from. With four steps the cost of getting this wrong
  // quadrupled: a step-4 rejection landing on step 1 throws away three screens.
  // Needed even with the client gate, since the server rejects shapes the
  // client accepts (and any DB error redirects here too).
  if (!contactName)
    redirect('/open-shop?step=3&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactName));
  if (!contactPhone)
    redirect('/open-shop?step=3&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactPhone));
  if (!contactEmail)
    redirect('/open-shop?step=3&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactEmail));
  const locationCity = clean(formData.get('location_city'), 64);
  // Required as of 2026-07-21: a city-less listing cannot be ranked, filtered
  // by couples, or given a screen-name namespace — it is invisible in practice.
  if (!locationCity)
    redirect('/open-shop?step=4&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.locationCity));

  // Event types the shop serves — the signal that makes a NON-wedding vendor
  // discoverable (the marketplace ?event_type= filter reads vendor_profiles.
  // event_types). Without capturing it here, a new shop keeps the column's
  // ['wedding'] default and is invisible for every other event it serves.
  // Validate against the admin roster (same keys the column CHECK + the coverage
  // editor accept); empty/invalid → fall back to ['wedding'] so it is never
  // event-typeless (the column is NOT NULL). The wizard seeds its checkboxes
  // from the shop's current event_types, so a re-run reflects — never clobbers —
  // a richer set the vendor set in the coverage editor.
  const eventVocabKeys = new Set((await getEventTypeVocab()).map((e) => e.key));
  const submittedEventTypes = formData
    .getAll('event_types')
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => eventVocabKeys.has(v));
  const eventTypes =
    submittedEventTypes.length > 0 ? Array.from(new Set(submittedEventTypes)) : ['wedding'];

  const admin = createAdminClient();

  // Self-heal account_type: anyone opening a vendor shop IS a vendor. Corrects a
  // customer-typed row — e.g. an OAuth vendor signup whose callback promotion
  // didn't land (missing service-role key), or any legacy pre-fix OAuth vendor —
  // so their doorway routing + RLS match reality. The `account_type='customer'`
  // predicate makes it idempotent and NEVER touches an admin/existing-vendor row.
  await admin
    .from('users')
    .update({ account_type: 'vendor' })
    .eq('user_id', user.id)
    .eq('account_type', 'customer');

  // Find-or-create the OWNED shop (mirrors the signup trigger; idempotent).
  // Read the full owned set (not `.maybeSingle()`) so the multi-business dial
  // can be enforced by count: re-open the existing shop, or mint the first —
  // but never exceed MAX_SHOPS_PER_USER. Today the cap is 1 (also held by
  // `vendor_profiles.user_id UNIQUE`), so this only ever reuses or creates the
  // one shop; the guard becomes live enforcement when the cap is raised and
  // the UNIQUE constraint is dropped. See lib/shop-limits.ts.
  const { data: ownedRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, services, business_slug')
    .eq('user_id', user.id);
  const owned = (ownedRows ?? []) as Array<{
    vendor_profile_id: string;
    services?: string[];
    business_slug?: string | null;
  }>;
  const existing = owned[0] ?? null;
  let vendorProfileId = existing?.vendor_profile_id ?? null;
  if (!vendorProfileId) {
    if (!canOpenAnotherShop(owned.length)) {
      redirect(
        '/open-shop?error=' +
          encodeURIComponent("You've reached the maximum number of shops for your account."),
      );
    }
    const { data: inserted, error } = await admin
      .from('vendor_profiles')
      .insert({ user_id: user.id })
      .select('vendor_profile_id')
      .single();
    if (error || !inserted) {
      redirect(
        `/open-shop?error=${encodeURIComponent(error?.message ?? 'Could not open your shop.')}`,
      );
    }
    vendorProfileId = (inserted as { vendor_profile_id: string }).vendor_profile_id;
  }

  // Founding admin seat ('owner' → 'admin' per 20270401574089). Idempotent.
  await admin
    .from('vendor_team_members')
    .upsert(
      { vendor_profile_id: vendorProfileId, user_id: user.id, role: 'admin' },
      { onConflict: 'vendor_profile_id,user_id', ignoreDuplicates: true },
    )
    .then(
      () => undefined,
      () => undefined,
    );

  // Write the basics. Blanks never clobber existing values; the primary
  // service leads the services array (kept as the sole entry when the shop is
  // fresh — the full picker on My Shop adds more).
  const existingServices =
    ((existing as { services?: string[] } | null)?.services ?? []).filter(Boolean);
  // BOTH the coarse category and the specific leaf go in, coarse FIRST.
  //   • index 0 is read as "the primary service" by the shop hero, the
  //     marketplace card and the overview — and `?category=` filters with
  //     `.contains('services', [coarse])`, so the coarse value must be present
  //     or the shop is missing from its own category browse.
  //   • the leaf must ALSO be present: `?tile=` filters with `.overlaps()`
  //     against canonical leaf keys, so a coarse-only shop is invisible to every
  //     tile-scoped browse — the more specific the couple's search, the more
  //     certainly they would miss it.
  // Order is deliberate and de-duplicated; a re-run never grows the array.
  const wanted = [coarseService, ...(pickedLeaf ? [pickedLeaf] : [])];
  const services = [
    ...wanted,
    ...existingServices.filter((s) => !wanted.includes(s)),
  ];
  const patch: Record<string, unknown> = {
    business_name: shopName,
    business_owner_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    services,
    event_types: eventTypes,
    updated_at: new Date().toISOString(),
  };
  // Guarded like location_city: now that the logo is optional here, an
  // unconditional `logo_url: logoUrl` would NULL an existing logo whenever the
  // wizard is re-run (mode 'complete') without re-uploading — breaking this
  // module's own "blanks never clobber" contract and losing vendor data.
  // Optional and guarded the same way: a blank must not wipe a position an
  // existing shop already set when the wizard is re-run.
  // Written ALONGSIDE business_name, which is what stops the database trigger
  // minting its own: `tg_vendor_profiles_generate_business_slug` returns early
  // when NEW.business_slug is already set. Guarded like the rest — a blank
  // must not null an address an existing shop already holds.
  // ⛔ AN ADDRESS IS WRITTEN ONCE AND NEVER MOVED (owner 2026-08-10, twice:
  //    "slug cannot be renamed", "whatever they choose here will be permanent").
  //
  // The `existing?.business_slug` half is the load-bearing one. `chosenSlug`
  // falls back to the SHOP NAME's slug when the form posts none — which is
  // exactly what a re-run does, because the wizard renders the address
  // read-only once a shop has one and submits no field. Without this check the
  // fallback would quietly overwrite a live address with a fresh slug of the
  // name: every printed QR, save-the-date and shared link pointing at the old
  // one dies, silently, on a screen that promised the address was permanent.
  //
  // Unreachable through the UI today — `page.tsx` redirects any shop that has a
  // business_name away from the wizard, and the slug trigger only fires on a
  // named shop. But this is a server action reachable by direct POST, and
  // "unreachable" has been wrong here before. The database trigger added in
  // 20271125090000 is the real boundary; this is the polite refusal in front of
  // it.
  if (chosenSlug && !existing?.business_slug) patch.business_slug = chosenSlug;
  if (contactPosition) patch.business_owner_position = contactPosition;
  if (logoUrl) patch.logo_url = logoUrl;
  if (locationCity) patch.location_city = locationCity;
  // The address the vendor typed (owner 2026-08-10). Guarded like the rest — a
  // blank must not wipe an address an admin or a later edit already set.
  const hqAddress = clean(formData.get('hq_address'), 200);
  if (hqAddress) patch.hq_address = hqAddress;
  // ── The dropped pin, when there is one (owner 2026-08-10) ──────────────────
  // Guarded like the two above: the wizard only posts these when the vendor
  // actually placed a pin, and an absent pair must never NULL coordinates an
  // admin already set — this action's "blanks never clobber" contract.
  // Parsed and range-checked here rather than trusted: they arrive from a form,
  // and a NaN would be written straight into a numeric column.
  const lat = Number(formData.get('hq_latitude'));
  const lng = Number(formData.get('hq_longitude'));
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    patch.hq_latitude = lat;
    patch.hq_longitude = lng;
  }
  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update(patch)
    .eq('vendor_profile_id', vendorProfileId);
  if (updErr) {
    // A lost race on the address is the ONE failure here a vendor can fix
    // themselves, and the raw Postgres text ("duplicate key value violates
    // unique constraint …") tells them nothing. Availability was checked while
    // they typed, so this only fires when someone claimed it in between.
    const dup =
      updErr.code === '23505' || /duplicate key|unique constraint/i.test(updErr.message ?? '');
    redirect(
      '/open-shop?error=' +
        encodeURIComponent(dup ? OPEN_SHOP_ERRORS.slugTaken : updErr.message),
    );
  }

  revalidatePath('/vendor-dashboard');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/vendor-dashboard/shop');
}
