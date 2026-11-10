'use server';

import { parseInBusinessSince } from '@/lib/in-business-since';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureBusinessAlaga } from '@/lib/business-alaga-ensure';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { getVendorServableEventTypes } from '@/lib/event-types-db';
import { canOpenAnotherShop } from '@/lib/shop-limits';
import { getOpenShopServiceTree, resolvePickedLeaf, type PickerLeaf } from '@/lib/open-shop-service-tree';
import {
  clipBusinessSlug,
  SHOP_NAME_MAX,
  SHOP_NAME_TOO_LONG,
  shopNameTooLong,
  slugifyBusinessName,
} from '@/lib/business-slug';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { titleCasePersonName } from '@/lib/person-name-case';
import { findSlugConflict } from '@/lib/slug-availability';
import {
  SHOP_NAME_HELD_MESSAGE,
  SHOP_NAME_UNVERIFIED_MESSAGE,
  checkShopNameHold,
  fileItsMyBusiness,
} from '@/lib/shop-name-hold';
import { parseCoordPair } from '@/lib/parse-coord';
import { locationStepError } from '@/lib/open-shop-location-gate';
import { parseVendorPhone } from '@/lib/phone-rules';
import { VENDOR_SLUG_RE } from '@/lib/vendor-slug';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import { getTaxonomy } from '@/lib/taxonomy-db';
import {
  EXTRA_SERVICES_FIELD,
  MAIN_SERVICE_EVENTS_FIELD,
  SPECIALTIES_FIELD,
  eventsForAddedService,
  parseEventListField,
  parseExtraServicesField,
  parseSpecialtiesField,
} from '@/lib/open-shop-more-services';
import { mergeServiceRefinements } from '@/lib/vendor-service-refinements-write';
import { ATTRIBUTE_FIELD_NAME_PREFIX } from '@/lib/vendor-service-attributes';
import { insertCoverage } from '@/lib/vendor-coverage-write';
import {
  OPEN_SHOP_EMAIL_RE,
  OPEN_SHOP_ERRORS,
  OPEN_SHOP_LOGO_REQUIRED,
} from '@/lib/open-shop-validation';
import { decideOpenShopAccount, OPEN_SHOP_ACCOUNT_ERRORS } from '@/lib/open-shop-account';
import { createVendorAccountForShop } from '@/lib/open-shop-account.server';
import { captchaTokenFromForm } from '@/lib/turnstile';
import { OPEN_SHOP_LOGO_PATH } from '@/lib/open-shop-logo';
import {
  TERMS_FIELD,
  TERMS_REQUIRED_MESSAGE,
  TERMS_VERSION,
  hasAgreedToTerms,
} from '@/lib/terms-agreement';
import { revalidateShopPage } from '@/lib/shop-page-cache';

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
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  // ── THE ACCOUNT IS CREATED INSIDE STEP 3 (owner 2026-09-22) ─────────────────
  // This used to be `if (!user) redirect('/signup?as=vendor')`: a stranger who had
  // filled four screens was sent to a different door and everything typed was gone.
  // Now the wizard runs signed OUT, step 3 carries a password beside the company
  // email, and ONE submit creates the account and then the shop. Whether to create
  // is a pure decision (`decideOpenShopAccount`, executed by its test); creating is
  // the I/O in `createVendorAccountForShop`, which reuses /signup's own helpers.
  // A signed-in person is 'existing' and the password / terms fields are ignored.
  const decision = decideOpenShopAccount({
    hasSession: !!sessionUser,
    email: cleanEmail(formData.get('contact_email')),
    password: String(formData.get('password') ?? ''),
    // ONE implementation of the agreement gate — lib/terms-agreement.ts — and its
    // own sentence. An unticked box posts nothing at all, so absence is refusal.
    termsAgreed: hasAgreedToTerms(formData.get(TERMS_FIELD)),
    termsError: TERMS_REQUIRED_MESSAGE,
  });
  if (decision.kind === 'refuse') {
    redirect(`/open-shop?step=${decision.step}&error=` + encodeURIComponent(decision.error));
  }
  // 📏 50 AT MOST (owner 2026-11-06). Read UNCLIPPED so a too-long name is REFUSED, never silently cut to fit —
  // `clean` would slice it, and the vendor would get a shop named something they never typed.
  const rawShopName = clean(formData.get('shop_name'), Number.MAX_SAFE_INTEGER);
  if (shopNameTooLong(rawShopName)) {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(SHOP_NAME_TOO_LONG));
  }
  const shopName = clean(rawShopName, SHOP_NAME_MAX);
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
  const typedName = titleCasePersonName(clean(formData.get('contact_name')) ?? '') || null;
  //
  // ── THE VENDOR'S NAME IS THEIR ACCOUNT NAME (owner-locked 2026-08-10) ──────
  // "vendor's name is their account name. so it should not be editable."
  //
  // 🔑 THE READ-ONLY BOX ON SCREEN WAS NEVER ENOUGH, AND HAD NEVER ONCE
  // ENGAGED. `readOnly` is a property of an input, not a rule: this action is a
  // server action reachable by direct POST, so the name arrived from the form
  // whatever the screen did. And it fell back to editable whenever the account
  // had no name — which, measured in production, is EVERY account: not one
  // `users.display_name` was set, including the owner's. A lock that only holds
  // when a column is populated, on a column nothing populates, is a lock that
  // has never been shut.
  //
  // So the rule is enforced here instead: the ACCOUNT NAME WINS, always, and
  // the form is only consulted when the account has none.
  const accountName = await (async () => {
    // A brand-new account (created below) has no name yet beyond the one typed here.
    if (!sessionUser) return null;
    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('user_id', sessionUser.id)
      .maybeSingle();
    return titleCasePersonName(
      ((data as { display_name?: string | null } | null)?.display_name ?? '').trim(),
    ) || null;
  })();
  const contactName = accountName ?? typedName;
  const contactPosition = clean(formData.get('contact_position'), 64);
  const contactPhoneRaw = clean(formData.get('contact_phone'), 32);
  // ── THE NUMBER MUST BELONG TO WHERE THE SHOP IS (owner 2026-08-10) ────────
  // Stored in its canonical `+63…` form rather than as typed, so the same
  // number written four ways is one value — which is what makes it comparable
  // later, and what stops a couple seeing a different spelling than an admin.
  // Checked against the country the pin landed in, via the one place that maps
  // a country to its rules. One entry today; a second country is a new entry
  // there rather than a change here.
  const phone = contactPhoneRaw
    ? parseVendorPhone(contactPhoneRaw, (clean(formData.get('hq_country'), 2) ?? '').toUpperCase())
    : null;
  const contactPhone = phone?.ok ? phone.e164 : contactPhoneRaw;
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
  let pickedLeafAllowed: string[] | null = null;
  let coarseService: string | null = null;
  if (primaryService && CATEGORY_SET.has(primaryService)) {
    coarseService = primaryService;
  } else if (primaryService) {
    const leaf = await resolvePickedLeaf(primaryService);
    if (leaf) {
      pickedLeaf = leaf.canonicalService;
      pickedLeafAllowed = leaf.allowedEventTypes;
      // Guaranteed non-'misc' for every live leaf by
      // tests/db/no-service-lands-in-misc.db.test.ts.
      coarseService = vendorCategoryForLeaf(leaf.canonicalService, leaf.tileId, await getTaxonomy());
    }
  }
  if (!coarseService) {
    redirect('/open-shop?step=2&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.service));
  }
  // The refusals run in the order of the screens (1 name · 2 what you do · 3 where · 4 you), so a vendor is sent to
  // the EARLIEST screen that needs them and walks forward from there.
  // ── AT LEAST ONE EVENT (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN APPROVED", call 3) ───────────────────────
  // Every event type starts ticked on step 2 and the supplier unticks what they don't do; unticking them ALL is
  // refused — a shop serving no event would never show to a couple. This used to fall back to ['wedding'] silently,
  // which turned "I cleared them" into "I serve weddings". Validated against the admin roster (the same keys the
  // column CHECK and the coverage editor accept), BEFORE the account exists, like every other field.
  const eventVocabKeys = new Set((await getVendorServableEventTypes()).map((e) => e.key));
  const submittedEventTypes = formData
    .getAll('event_types')
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => eventVocabKeys.has(v));
  if (submittedEventTypes.length === 0)
    redirect('/open-shop?step=2&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.events));
  const eventTypes = Array.from(new Set(submittedEventTypes));
  // ── EACH SERVICE'S OWN EVENTS (owner 2026-11-06, prototype v16 ④ "Events you serve") ─────────────────────────
  // Under every ticked event the supplier sees each picked service as a chip — all on, untick per event, greyed where
  // the service is not offered. So each service posts ITS events: the main in `primary_service_events`, every added
  // one inside `extra_services`. Each is read like the coverage editor reads them (roster ∩ the leaf's allowed set),
  // and kept inside the ticked set; a service left on for NO ticked event is refused, like an empty event set.
  // An older page that posts no per-service list falls back to the ticked events (the v8 "same events" rule).
  const tickedSet = new Set(eventTypes);
  const withinTicked = (list: readonly string[]) => list.filter((k) => tickedSet.has(k));
  let mainEvents = eventTypes;
  if (pickedLeaf) {
    const posted = parseEventListField(formData.get(MAIN_SERVICE_EVENTS_FIELD));
    const ev = eventsForAddedService(withinTicked(posted ?? eventTypes), eventVocabKeys, pickedLeafAllowed);
    if (!ev) redirect('/open-shop?step=2&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.extraEvents));
    mainEvents = ev;
  }
  // ── AND THE SERVICES ADDED UNDER THE MAIN (owner 2026-11-06, "SERVICES SIT TOGETHER, A METER NAMES THE PLAN";
  //    prototype v14–v16 category cards) ───────────────────────────────────────────────────────────────────────
  // Each is RE-RESOLVED against the same filtered tree the main is (never a first-party SKU, a retired leaf or a
  // smuggled key — an unknown one is dropped), de-duplicated, never the main again. ⚠ NO PLAN CAP HERE: every service
  // added at sign-up stays on until the first booking on Setnayan is done (DECISION_LOG 2026-11-06, "SERVICES LIFE
  // CYCLE") — the meter and the "Before you continue" sheet name the plan; the door refuses none.
  const addedServices: { leaf: PickerLeaf; events: string[] }[] = [];
  const postedExtras = pickedLeaf ? parseExtraServicesField(formData.get(EXTRA_SERVICES_FIELD)) : [];
  if (postedExtras.length > 0) {
    const leafByKey = new Map<string, PickerLeaf>();
    for (const p of await getOpenShopServiceTree())
      for (const b of p.branches) for (const l of b.leaves) leafByKey.set(l.canonicalService, l);
    const seen = new Set<string>([pickedLeaf as string]);
    for (const x of postedExtras) {
      const leaf = leafByKey.get(x.service);
      if (!leaf || seen.has(leaf.canonicalService)) continue;
      seen.add(leaf.canonicalService);
      const ev = eventsForAddedService(withinTicked(x.events ?? eventTypes), eventVocabKeys, leaf.allowedEventTypes);
      if (!ev) redirect('/open-shop?step=2&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.extraEvents));
      addedServices.push({ leaf, events: ev });
    }
  }
  const locationCity = clean(formData.get('location_city'), 64);
  // ── WHERE YOU ARE: A PIN, A YES, THEN THE CITY — REFUSED HERE TOO (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN —
  //    FOUR CALLS ANSWERED": "the server must refuse an unconfirmed pin") ─────────────────────────────────────────
  // The rule is `locationStepError` — the SAME function the wizard's step gate runs — fed from the posted fields.
  // Until 2026-11-06 only the browser asked for the pin and the "Yes, that's right"; this action required the city
  // alone, so a direct POST (or a page whose gate did not run) could open a shop at an address nobody confirmed.
  // `parseCoordPair` is the one that refuses 0,0 from a missing pair (the Null Island bug below), so an absent pin
  // can never pass as one. The step is 3 — "Where you are" now comes before "You".
  const locationError = locationStepError({
    hasPin: parseCoordPair(formData.get('hq_latitude'), formData.get('hq_longitude')) !== null,
    confirmed: formData.get('location_confirmed') === 'yes',
    city: locationCity ?? '',
  });
  if (locationError) redirect('/open-shop?step=3&error=' + encodeURIComponent(locationError));
  // ── EVERY REJECTION NAMES THE STEP THAT OWNS THE FIELD (1–4) ──────────────
  // Without it the wizard remounts at step 1 and silently discards everything
  // typed on later steps, because none of it has been written to the DB the
  // `defaults` prop reads from. With four steps the cost of getting this wrong
  // quadrupled: a step-4 rejection landing on step 1 throws away three screens.
  // Needed even with the client gate, since the server rejects shapes the
  // client accepts (and any DB error redirects here too).
  if (!contactName)
    redirect('/open-shop?step=4&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactName));
  if (!contactPhone)
    redirect('/open-shop?step=4&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactPhone));
  if (!phone?.ok)
    redirect(
      '/open-shop?step=4&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactPhoneNotPh),
    );
  // ⑤ The email is the account step's (5 · Your account, prototype v16) — name and number are 4 · About you.
  if (!contactEmail)
    redirect('/open-shop?step=5&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.contactEmail));

  // ── THE ACCOUNT IS CREATED ONLY ONCE EVERY FIELD ABOVE HAS PASSED (2026-11-06) ──────────────────────────────
  // It used to be created FIRST. With email verification on (A1) that ordering is a trap: a refusal on step 1/2/4
  // after the account exists sends the person back, the resubmit's signUp says "already has an account", and the
  // sign-in it offers is refused until the email link is tapped. So the shop's own checks run first.
  let user: { id: string; email?: string | null } | null = sessionUser;
  let checkEmail: string | null = null;
  if (decision.kind === 'create') {
    const created = await createVendorAccountForShop({
      email: decision.email,
      password: decision.password,
      // The name typed on step 4 ("You") becomes the account's name — the same rule the
      // signed-in path applies further down (`display_name` established once).
      displayName: titleCasePersonName(clean(formData.get('contact_name')) ?? '') || null,
      terms: { acceptedAt: new Date().toISOString(), version: TERMS_VERSION },
      // The bot check rides in THIS form (<TurnstileField action="signup" /> in the
      // wizard, guest only); this action is the form's target, so the token is
      // read here — where lib/captcha-is-wired.test.ts can pair reader and widget.
      captchaToken: captchaTokenFromForm(formData),
    });
    if (created.ok === false) {
      // `taken` → step 3's email box becomes a sign-in (A8); the step is still the module's own.
      const takenParam = created.taken ? '&taken=1' : '';
      redirect(`/open-shop?step=${created.step}${takenParam}&error=` + encodeURIComponent(created.error));
    }
    if (created.ok === 'check-email') {
      // 🔒 L3 (A1): verification is required, so nobody is signed in. The shop is opened on the new account below
      // and the page then says "We sent a link to <email> — tap it to finish"; the link lands on the dashboard.
      checkEmail = created.user.email;
    }
    if (created.ok === 'created-not-signed-in') {
      // The account exists; the shop is not opened yet. Same landing /signup uses
      // when its direct sign-in fails — they sign in and the wizard resumes.
      redirect(
        `/login?ready=${encodeURIComponent(created.email)}&next=${encodeURIComponent('/open-shop')}&as=vendor`,
      );
    }
    user = created.user;
  }
  if (!user) {
    // Unreachable by construction (every non-existing decision above either
    // redirected or produced a user); kept so the type narrows honestly.
    redirect('/open-shop?step=5&error=' + encodeURIComponent(OPEN_SHOP_ACCOUNT_ERRORS.accountFailed));
  }


  // Event types the shop serves — read and refused above, with the other fields (`eventTypes`). They are the signal
  // that makes a NON-wedding vendor discoverable (the marketplace ?event_type= filter reads vendor_profiles.event_types).

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
  const { data: ownedRows, error: ownedError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, services, business_slug, in_business_since_year, logo_url')
    .eq('user_id', user.id);
  // 🔒 A REFUSED READ IS NOT "NO SHOP". Read as empty, the insert below runs
  // over the shop that already exists, and the supplier is shown Postgres's
  // raw duplicate-key text. Say what happened and let them try again.
  if (ownedError) {
    redirect(
      '/open-shop?error=' +
        encodeURIComponent("We couldn't check your shop just now. Please try again."),
    );
  }
  const owned = (ownedRows ?? []) as Array<{
    vendor_profile_id: string;
    services?: string[];
    business_slug?: string | null;
  }>;
  const existing = owned[0] ?? null;
  const existingHasLogo = Boolean((existing as { logo_url?: string | null } | null)?.logo_url);

  // ── A HELD NAME HOLDS ITS CORE (owner 2026-11-06) ──────────────────────────
  // "Bulgogi 1" is refused while "Bulgogi Catering" is held — closed (its address still held), banned or suspended.
  // ONE question, asked of the database (`lib/shop-name-hold.ts`); the step-1 live check asks the same one. Asked of
  // the NAME and of the ADDRESS, because the address is the name in another spelling and is permanent.
  //
  // Never a dead end: "It's my business" posts `its_my_business` = the exact name. Then the shop opens WITHOUT that
  // name (and without an address made from it), and the name goes to the admin queue as a correction request. An
  // admin who has seen the papers applies it — the same door that already writes a verified shop's name.
  //
  // Fails CLOSED: a hold we could not check is not proof the name is free.
  const nameHold = await checkShopNameHold(admin, shopName, { vendorProfileId: existing?.vendor_profile_id });
  if (nameHold.state === 'unverified') {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(SHOP_NAME_UNVERIFIED_MESSAGE));
  }
  const claimsHeldName =
    nameHold.state === 'held' && clean(formData.get('its_my_business')) === shopName;
  if (nameHold.state === 'held' && !claimsHeldName) {
    redirect('/open-shop?step=1&error=' + encodeURIComponent(SHOP_NAME_HELD_MESSAGE));
  }
  if (chosenSlug && !claimsHeldName) {
    const addressHold = await checkShopNameHold(admin, chosenSlug, {
      vendorProfileId: existing?.vendor_profile_id,
    });
    if (addressHold.state === 'unverified') {
      redirect('/open-shop?step=1&error=' + encodeURIComponent(SHOP_NAME_UNVERIFIED_MESSAGE));
    }
    if (addressHold.state === 'held') {
      redirect('/open-shop?step=1&error=' + encodeURIComponent(OPEN_SHOP_ERRORS.slugTaken));
    }
  }

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

  // ── EACH SERVICE KEEPS ITS OWN EVENTS — `vendor_coverages`, through THE ONE coverage write ──────────────────────
  // Only when services were ADDED: then the main and each added one get a coverage row (the main's own events, each
  // added one's own), the same rows the dashboard's "What you do" panel writes. Written BEFORE the profile patch below,
  // because `insertCoverage` re-syncs `services` / `event_types` from the coverages and the patch must stay the last
  // word on them (index 0 = the coarse category). Admin client: a just-created account may have no session yet.
  // ⚠ Best-effort, like the team seat: a failed row is logged and never costs the vendor their shop — the services
  // are still listed on the profile by the patch.
  if (pickedLeaf && addedServices.length > 0) {
    const rows = [
      {
        canonicalService: pickedLeaf,
        eventTypes: mainEvents,
      },
      ...addedServices.map((a) => ({ canonicalService: a.leaf.canonicalService, eventTypes: a.events })),
    ];
    for (const row of rows) {
      const res = await insertCoverage(admin, vendorProfileId as string, { ...row, faiths: [] });
      if (res.status === 'error')
        console.error('[supabase-error] app/open-shop/actions.ts · from:vendor_coverages.insert', res.message);
    }
  }

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
  // The added services follow the main's pair, in the order they were added.
  const wanted = [
    coarseService,
    ...(pickedLeaf ? [pickedLeaf] : []),
    ...addedServices.map((a) => a.leaf.canonicalService),
  ];
  const services = [
    ...wanted,
    ...existingServices.filter((s) => !wanted.includes(s)),
  ];
  // ── AND THE FIRST NAME GIVEN ESTABLISHES THE ACCOUNT NAME ─────────────────
  // Every production account has a blank `display_name`, so "it comes from your
  // account" would otherwise be a promise about a field nobody has ever filled.
  // Opening a shop is the one place the app asks a vendor for their name, so
  // that answer becomes the account's name — and from then on this branch never
  // runs again and the name is read-only everywhere, changed only on the
  // account profile where it belongs.
  //
  // Best-effort: a failure here must not cost someone their shop. It only means
  // the account name is established on the next save instead of this one.
  if (!accountName && contactName) {
    await supabase
      .from('users')
      .update({ display_name: contactName })
      .eq('user_id', user.id);
  }

  const patch: Record<string, unknown> = {
    // A held name the vendor says is theirs is NOT written — it waits in the admin queue (filed below).
    ...(claimsHeldName ? {} : { business_name: shopName }),
    business_owner_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    services,
    // The main's events ∪ every added service's — what `syncProfileFromCoverages` would compute from the rows above.
    // An event where the supplier unticked EVERY service (④) is not served, so it is not listed.
    event_types: Array.from(new Set([...mainEvents, ...addedServices.flatMap((a) => a.events)])),
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
  // …and no address is chosen while the name waits: the address is the name, so the database mints it from the
  // name the admin approves (`tg_vendor_profiles_generate_business_slug` runs on that UPDATE of business_name).
  if (chosenSlug && !existing?.business_slug && !claimsHeldName) patch.business_slug = chosenSlug;
  if (contactPosition) patch.business_owner_position = contactPosition;
  // "In business since" — asked on step 2 (owner 2026-10-22, journey_fixes Supplier 2 · A). Optional, and
  // written ONCE: a year already on the shop is never moved from here, because changing it is what clears
  // the DTI experience check (`updateVendorProfileField`), and that belongs to Your details, not a re-run.
  const sinceYear = parseInBusinessSince(formData.get('in_business_since_year'), new Date().getFullYear());
  if (sinceYear && !(existing as { in_business_since_year?: number | null } | null)?.in_business_since_year) {
    patch.in_business_since_year = sinceYear;
  }
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
  //
  // 🔴 THIS IS WHERE NULL ISLAND CAME FROM. The guard here used to read
  // `Number(formData.get('hq_latitude'))` and then check finiteness and range —
  // which sounds thorough and is not, because `Number(null)` is 0, and 0 is
  // both finite and inside ±90. A vendor who never dropped a pin was written to
  // 0,0: open ocean off Ghana, ~10,000 km from every Philippine wedding, so the
  // shop silently vanished from every distance filter while its own dashboard
  // looked perfect. Measured in prod 2026-08-10.
  const pin = parseCoordPair(formData.get('hq_latitude'), formData.get('hq_longitude'));
  if (pin) {
    patch.hq_latitude = pin.lat;
    patch.hq_longitude = pin.lng;
    // The country of the pin, recorded rather than assumed. Only written
    // alongside real coordinates — a country with no pin is a claim about a
    // place nobody marked. Shape-checked here as well as by the column's CHECK,
    // because this is a server action reachable by direct POST.
    const country = (clean(formData.get('hq_country'), 2) ?? '').toUpperCase();
    if (/^[A-Z]{2}$/.test(country)) patch.hq_country = country;
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

  // ── AND THE BUSINESS BECOMES A RECORD, NOT JUST A LISTING ────────────────
  //
  // A business existed twice and the two halves had never met: this action wrote
  // `vendor_profiles`, and the People page's "A business" alaga was reachable
  // only by typing the same name in again on a different screen. So a supplier
  // who had just spent four screens naming their business was told, on People,
  // that they care for nothing — and the business had no page and no timeline,
  // because it had no record to hang one on.
  //
  // The write itself — gated on the People pair, read-then-write against the
  // idempotency key, a re-run renaming the record it already has — lives in
  // `ensureBusinessAlaga`, the ONE writer every shop-owning door calls (the claim
  // flow and My Shop's naming door too). `lib/business-alaga-ensure.test.ts`
  // holds both its behaviour and that every such door calls it.
  //
  // ⚠ BEST-EFFORT, ALWAYS. `ensureBusinessAlaga` never throws or redirects.
  // Opening a shop is the vendor's business; keeping a record-keeping row in step
  // is ours, and ours failing must never cost them theirs. Same posture as the
  // founding team seat and the account-name write above.
  //
  // ⚠ ADMIN CLIENT, AND THE OWNER IT WRITES IS THE AUTHENTICATED CALLER — never a
  // form value. RLS is off for this client, so that assignment IS the ownership
  // boundary, the same way it is in `resolveHonoreeDependentId`.
  // A shop whose name waits for the admin gets its business record when the name is applied — the corrections
  // queue calls `ensureBusinessAlaga` on an approved shop name. Writing it now would name the record after a name
  // the shop does not have.
  if (claimsHeldName) {
    // Best-effort like the record write: the shop is open either way, and the vendor can ask again from My Shop.
    await fileItsMyBusiness(admin, { vendorProfileId, name: shopName, currentValue: null });
  } else {
    await ensureBusinessAlaga(admin, {
      ownerUserId: user.id,
      vendorProfileId,
      shopName,
    });
  }

  // ── ③ THE SPECIALTIES PICKED AT SIGN-UP — through THE ONE refinement merge ──────────────────────────────────────
  // Each service's chips are the chip-shaped refinements of its own schema (`canonical_service_schemas`), so they are
  // written exactly as the card maker's "Details" fold writes them: `mergeServiceRefinements`, which re-validates every
  // key and value against the live schema and MERGES (never wipes). Only the services this submit opened the shop
  // with. ⚠ Best-effort, like the coverages: a refusal is logged and never costs the vendor their shop — the chips are
  // optional, and Shop › Services edits them later.
  const specialties = parseSpecialtiesField(formData.get(SPECIALTIES_FIELD));
  const opened = new Set([pickedLeaf, ...addedServices.map((a) => a.leaf.canonicalService)].filter(Boolean) as string[]);
  for (const [svc, fields] of Object.entries(specialties)) {
    if (!opened.has(svc)) continue;
    const fd = new FormData();
    fd.set('refinement_keys', Object.keys(fields).join(','));
    for (const [key, values] of Object.entries(fields))
      for (const v of values) fd.append(`${ATTRIBUTE_FIELD_NAME_PREFIX}${key}`, v);
    const err = await mergeServiceRefinements(admin, vendorProfileId as string, svc, fd).catch((e: unknown) =>
      e instanceof Error ? e.message : String(e),
    );
    if (err) console.error('[supabase-error] app/open-shop/actions.ts · from:vendor_service_attributes.upsert', err);
  }

  revalidateShopPage(vendorProfileId, chosenSlug); // ⚡ the address may hold a 404 copy from before the shop existed
  revalidatePath('/vendor-dashboard');
  revalidatePath('/vendor-dashboard/shop');
  // ✉ A1 — the shop is open, the account is not confirmed yet: say so, on this page, with the address.
  if (checkEmail) redirect(`/open-shop?check_inbox=${encodeURIComponent(checkEmail)}`);
  // 🖼 A2 (owner 2026-11-06: logo "if it does not want to upload, then it has no use here") — the logo is asked
  // RIGHT AFTER the shop opens, signed in, on its own screen. Skip → Today, where "Add your logo" stays a first step.
  // A shop that already has a logo (a re-run) goes straight to Today, as before.
  // 🧭 A NEW SHOP LANDS ON TODAY (first-timer fix 12, 2026-10-02) — through the logo screen, never past it.
  if (!logoUrl && !existingHasLogo) redirect(OPEN_SHOP_LOGO_PATH);
  redirect('/vendor-dashboard');
}
