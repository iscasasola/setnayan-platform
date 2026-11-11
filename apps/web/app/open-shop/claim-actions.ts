'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken, opensTheClaimDoor } from '@/lib/vendor-invites';
import { readClaimAccountVerdict } from '@/lib/claim-account-gate.server';
import { CLAIM_DOOR_FIELD, claimDoorHref, parseClaimDoorAnswers, splitClaimCards } from '@/lib/claim-door';
import { readClaimDoor } from '@/lib/claim-door.server';
import { titleCasePersonName } from '@/lib/person-name-case';
import { parseVendorPhone } from '@/lib/phone-rules';
import { resolvePickedLeaf } from '@/lib/open-shop-service-tree';
import { insertCoverage } from '@/lib/vendor-coverage-write';
import { mergeServiceRefinements } from '@/lib/vendor-service-refinements-write';
import { ATTRIBUTE_FIELD_NAME_PREFIX } from '@/lib/vendor-service-attributes';
import { createVendorService } from '@/app/vendor-dashboard/services/actions';
import { savePackage } from '@/app/vendor-dashboard/packages/actions';
import { ensureBusinessAlaga } from '@/lib/business-alaga-ensure';
import { captchaTokenFromForm } from '@/lib/turnstile';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE, TERMS_VERSION, hasAgreedToTerms } from '@/lib/terms-agreement';
import { decideOpenShopAccount } from '@/lib/open-shop-account';
import { createVendorAccountForShop } from '@/lib/open-shop-account.server';
import { isValidOpenShopEmail } from '@/lib/open-shop-validation';
import { revalidateShopPage } from '@/lib/shop-page-cache';

/**
 * THE CLAIM DOOR'S FINISH (controller A6, 7 Nov; owner 2026-11-06 "THE SAME DOOR, PRE-FILLED — THEN ONE SLIDE PER
 * SERVICE CARD, THEN THE BUNDLE. NO NEW MAKERS").
 *
 * 🔑 ONLY THE SCREENS CHANGED. The token check is the shipped `fetchClaimLandingByToken`; the account gate is the
 * shipped `claimAccountVerdict` (through the one reader finalize uses); the shop is opened by the shipped
 * `claim_ready_the_shop`; the cards are made by the shipped `createVendorService`, the bundle by the shipped
 * `savePackage`; and the CONSENT — the invite marked claimed, the couple's one access ask, the follows, the couple
 * seated as a customer — is the shipped `/vendor/claim/<token>/finalize`, which this hands over to at the end.
 *
 * Order matters and is the same as finalize's: refuse a couple's own account BEFORE any write, so the link stays
 * unspent. Every refusal lands where its sentence already lives (the door, or the finalize refusal pages).
 *
 * ✉ CONTINUE WITH EMAIL (owner 7 Nov: "Yes"). Signed out with the account slide's email + password, the account is made
 * by the SHIPPED `/open-shop` path — `decideOpenShopAccount` (email · password · Terms, in that order) then
 * `createVendorAccountForShop` (the breach check, which speaks only here on submit · blacklist · Turnstile · signUp ·
 * the L3 verification switch). Only after the invite is known to be usable, so a dead link never mints an account. With
 * verification on, nobody is signed in yet: the link brings them back to the account slide to press "Claim it".
 */
export async function finishClaimDoor(formData: FormData): Promise<void> {
  const token = String(formData.get('claim_token') ?? '').trim().slice(0, 200);
  if (!token) redirect('/open-shop');
  const door = claimDoorHref(token);

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const landing = await fetchClaimLandingByToken(admin, token).catch(() => null);
  if (!landing || landing.invite.status !== 'pending' || !opensTheClaimDoor(landing.invite.source)) {
    // Claimed · expired · revoked · declined · not found: the shipped page says which.
    redirect(`/vendor/claim/${encodeURIComponent(token)}`);
  }

  const accountSlide = `${door}&step=account`;
  let user: { id: string; email?: string | null } | null = sessionUser;
  if (!user) {
    // Signed out with no email + password posted (Google / Apple not finished) → back to the account slide; the
    // slides' answers are kept in this browser.
    if (!formData.has('password')) redirect(accountSlide);
    const typed = String(formData.get('contact_email') ?? '').trim().toLowerCase().slice(0, 254);
    const decision = decideOpenShopAccount({
      hasSession: false,
      email: isValidOpenShopEmail(typed) ? typed : null,
      password: String(formData.get('password') ?? ''),
      termsAgreed: hasAgreedToTerms(formData.get(TERMS_FIELD)),
      termsError: TERMS_REQUIRED_MESSAGE,
    });
    const emailRefusal = (error: string, taken = false) =>
      redirect(`${accountSlide}&way=email${taken ? '&taken=1' : ''}&error=${encodeURIComponent(error)}`);
    if (decision.kind === 'refuse') emailRefusal(decision.error);
    if (decision.kind === 'create') {
      const created = await createVendorAccountForShop({
        email: decision.email,
        password: decision.password,
        displayName: titleCasePersonName(parseClaimDoorAnswers(formData.get(CLAIM_DOOR_FIELD))?.who ?? '') || null,
        terms: { acceptedAt: new Date().toISOString(), version: TERMS_VERSION },
        // The widget rides in THIS form (<TurnstileField action="signup" /> on the account slide's email way).
        captchaToken: captchaTokenFromForm(formData),
        confirmNext: accountSlide,
      });
      if (created.ok === false) emailRefusal(created.error, created.taken === true);
      else if (created.ok === 'created-not-signed-in') {
        redirect(`/login?ready=${encodeURIComponent(created.email)}&next=${encodeURIComponent(accountSlide)}&as=vendor`);
      } else if (created.ok === 'check-email') {
        // Verification on: the account waits for its link, which signs them in and lands back on this slide.
        redirect(`${accountSlide}&check_inbox=${encodeURIComponent(created.user.email)}`);
      } else user = created.user;
    }
  }
  if (!user) redirect(accountSlide);

  // ── A COUPLE'S OWN ACCOUNT NEVER SPENDS THE LINK (2026-11-05) — asked before any write ─────────────────────────────
  const verdict = await readClaimAccountVerdict(admin, user.id, 'app/open-shop/claim-actions.ts');
  if (!verdict.ok) redirect(`/vendor/claim/${encodeURIComponent(token)}/finalize`); // finalize draws the refusal, writes nothing

  const answers = parseClaimDoorAnswers(formData.get(CLAIM_DOOR_FIELD));
  if (!answers) redirect(`${door}&error=${encodeURIComponent('Something went wrong. Please go through the steps again.')}`);

  // 🔒 THE COUPLE'S BUNDLE IS THE COUPLE'S RECORD (owner 7 Nov: "on the sign up the supplier can add more services but
  // not add them to the customers bundle"). Which services the couple recorded is read HERE, from the record — the
  // post only says which card is which. A refused read stops before any write (the link stays unspent).
  const recordRead = await readClaimDoor(token).catch(() => null);
  if (!recordRead?.open) redirect(`${door}&error=${encodeURIComponent('Could not read the invite. Please try again.')}`);
  const recorded = new Set(recordRead.record.services.map((s) => s.category));
  // `theirs` = the couple's bundle · `added` = the supplier's own cards (never bundled, never in the package).
  const { theirs, added } = splitClaimCards(answers.cards, recorded);

  // ── THE SHOP — the shipped find-or-open ──────────────────────────────────────────────────────────────────────────
  // A couple's link: `claim_ready_the_shop`, which fills only its BLANK name + service from the couple's record and
  // spends nothing (finalize spends the link). 🎁 Setnayan's own invite: `claim_ready_the_invited_shop` — the SAME call
  // finalize makes for it — which hands the staged shop over, seats the admin, applies THE OFFER, and marks the invite
  // claimed under its row lock (spent exactly once). So the offer is kept by the shipped mechanism, not re-made here.
  const fromSetnayan = landing.invite.source === 'admin';
  const { data: readied, error: readyErr } = await admin.rpc(fromSetnayan ? 'claim_ready_the_invited_shop' : 'claim_ready_the_shop', {
    p_user_id: user.id,
    p_claim_token: token,
  });
  if (readyErr || typeof readied !== 'string' || !readied) {
    redirect(`${door}&error=${encodeURIComponent(readyErr?.message ?? 'Could not open your shop. Please try again.')}`);
  }
  const vendorProfileId = readied as string;
  // After Setnayan's claim the link is spent, so the door would only say "already claimed": a refusal from here on
  // lands on Your details — the page that edits exactly these details, on the shop that is now theirs.
  const refusedAfterClaim = (message: string) =>
    redirect(fromSetnayan ? `/vendor-dashboard/profile` : `${door}&error=${encodeURIComponent(message)}`);

  // ── WHAT THE SUPPLIER CONFIRMED REPLACES WHAT THE COUPLE TYPED, ON THE SHOP (owner 2026-11-06) ─────────────────────
  const { data: shopRow, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('services, event_types, business_name')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  // A refused read must not pass for an empty shop — the merge below would drop the services it already offers.
  if (shopErr) {
    console.error('[supabase-error] app/open-shop/claim-actions.ts · from:vendor_profiles.select', shopErr);
    refusedAfterClaim('Could not read your shop. Please try again.');
  }
  const shop = (shopRow ?? {}) as { services?: string[] | null; event_types?: string[] | null; business_name?: string | null };
  // The couple's event type is ticked on the shop's events; Setnayan's invite has no event, so nothing is asked.
  const eventId = landing.parentVendor?.event_id ?? null;
  const { data: ev } = eventId
    ? await admin.from('events').select('event_type').eq('event_id', eventId).maybeSingle()
    : { data: null };
  const eventType = (ev as { event_type?: string | null } | null)?.event_type ?? null;

  // Each picked service, its leaf re-resolved server-side against the SAME tree the picker offered (never trusted).
  const leaves: string[] = [];
  const categories: string[] = [];
  for (const s of answers.services) {
    if (s.leaf) {
      const leaf = await resolvePickedLeaf(s.leaf).catch(() => null);
      if (leaf) leaves.push(leaf.canonicalService);
    }
    if (s.category) categories.push(s.category);
  }
  const wanted = [...new Set([...categories, ...leaves])];
  const services = [...wanted, ...(shop.services ?? []).filter((x) => x && !wanted.includes(x))];
  const phone = answers.phone ? parseVendorPhone(answers.phone, 'PH') : null;
  const patch: Record<string, unknown> = {
    services,
    // The account's own email — the door never asks for one (no Email field).
    contact_email: user.email ?? null,
    updated_at: new Date().toISOString(),
  };
  if (answers.name) patch.business_name = answers.name;
  const who = titleCasePersonName(answers.who);
  if (who) patch.business_owner_name = who;
  if (phone?.ok) patch.contact_phone = phone.e164;
  if (answers.role) patch.business_owner_position = answers.role;
  if (eventType) patch.event_types = [...new Set([...(shop.event_types ?? []), eventType])];
  const { error: updErr } = await admin.from('vendor_profiles').update(patch).eq('vendor_profile_id', vendorProfileId);
  if (updErr) {
    console.error('[supabase-error] app/open-shop/claim-actions.ts · from:vendor_profiles.update', updErr);
    const dup = updErr.code === '23505' || /duplicate key|unique constraint/i.test(updErr.message ?? '');
    refusedAfterClaim(dup ? 'That shop name is taken. Please pick another.' : updErr.message);
  }
  // The shop is this account's now (claim_ready_the_shop), under the name just confirmed — its business alaga follows
  // the name, as on every door that names an owned shop. Best-effort: it never throws or redirects. Finalize runs it
  // again on the same exactly-once key.
  await ensureBusinessAlaga(admin, {
    ownerUserId: user.id,
    vendorProfileId,
    shopName: answers.name || shop.business_name || null,
  });

  // The coverages + specialties, through the same writers the sign-up door uses (best-effort, logged, never fatal).
  for (const leaf of leaves) {
    const res = await insertCoverage(admin, vendorProfileId, { canonicalService: leaf, eventTypes: eventType ? [eventType] : [], faiths: [] });
    if (res.status === 'error') console.error('[supabase-error] app/open-shop/claim-actions.ts · from:vendor_coverages.insert', res.message);
  }
  for (const [svc, fields] of Object.entries(answers.specialties)) {
    if (!leaves.includes(svc)) continue;
    const fd = new FormData();
    fd.set('refinement_keys', Object.keys(fields).join(','));
    for (const [key, values] of Object.entries(fields)) for (const v of values) fd.append(`${ATTRIBUTE_FIELD_NAME_PREFIX}${key}`, v);
    const err = await mergeServiceRefinements(admin, vendorProfileId, svc, fd).catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
    if (err) console.error('[supabase-error] app/open-shop/claim-actions.ts · from:vendor_service_attributes.upsert', err);
  }

  // ── ONE SERVICE CARD PER SERVICE — through the SHIPPED card maker's own action ────────────────────────────────────
  // `createVendorService` answers with a redirect (to `?saved=1` or `?error=`); it is read, never followed, so the
  // finish goes on to the next card. Its refusals (the plan's category cap, a phone number in an inclusion) are the
  // maker's own, and a card it refused is simply not made — the Today checklist still asks for it.
  // The couple's cards, then the supplier's own — each added service is its own card on the shop, priced on its own.
  const made: string[] = [];
  for (const card of [...theirs, ...added]) {
    if (card.bundled || !card.price) continue;
    const fd = new FormData();
    fd.set('category', card.leaf ?? card.category);
    fd.set('title', card.name);
    fd.set('pricing_basis', 'fixed');
    fd.set('starting_price_php', String(card.price));
    for (const line of card.inclusions) {
      fd.append('inclusion_label', line);
    }
    try {
      await createVendorService(fd);
    } catch (e) {
      if (!isRedirectError(e)) throw e;
      const url = new URL(getURLFromRedirectError(e) ?? '', 'http://claim-door.local');
      if (url.searchParams.get('error')) {
        console.warn('[claim-door] a card was refused by the maker:', url.searchParams.get('error'));
        continue;
      }
    }
    made.push(card.name);
  }

  // ── THE BUNDLE — the couple's confirmed price, through the SHIPPED package maker (dark while its flag is off) ──────
  // Only the couple's recorded services, at their confirmed price, plus their own extra lines. A service the supplier
  // added is never in it.
  const total = theirs.find((c) => !c.bundled)?.price ?? null;
  if (answers.bundle?.name && total && theirs.length > 0) {
    const res = await savePackage({
      package_name: answers.bundle.name,
      total_price_centavos: total * 100,
      consumable_budget_centavos: 0,
      is_consumable_flexible: false,
      items: [
        ...theirs.map((c, i) => ({
          ref: `card-${i}`,
          service_description: c.name,
          canonical_service: c.leaf ?? c.category,
          is_default_included: true,
          is_required: true,
          replacement_value_centavos: 0,
          options: [],
        })),
        ...answers.bundle.extras.map((x, i) => ({
          ref: `extra-${i}`,
          service_description: x,
          canonical_service: theirs[0]?.leaf ?? theirs[0]?.category ?? '',
          is_default_included: true,
          is_required: false,
          replacement_value_centavos: 0,
          options: [],
        })),
      ],
    }).catch((e: unknown) => ({ status: 'error' as const, message: e instanceof Error ? e.message : String(e) }));
    if (res.status !== 'ok') console.warn('[claim-door] the bundle was not saved:', res.status);
  }

  revalidateShopPage(vendorProfileId);
  revalidatePath('/vendor-dashboard');
  // 🎁 Setnayan's invite is already claimed (above, by the shipped call) — it lands where finalize lands it: Shop ›
  // Your details (prototype frame B4). Finalize would only see "claimed by you" and send them to the dashboard.
  if (fromSetnayan) redirect('/vendor-dashboard/profile');
  // ── THE CONSENT IS THE SHIPPED ONE ──────────────────────────────────────────────────────────────────────────────
  redirect(`/vendor/claim/${encodeURIComponent(token)}/finalize`);
}
