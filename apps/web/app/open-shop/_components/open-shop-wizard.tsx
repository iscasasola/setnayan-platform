'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Info, Mail, MailCheck, RotateCw } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import {
  OPEN_SHOP_ERRORS,
  OPEN_SHOP_LOGO_REQUIRED,
  OPEN_SHOP_PHONE_BOX_ERROR,
  isValidOpenShopEmail,
} from '@/lib/open-shop-validation';
import { openShopErrorField, openShopErrorWords, type OpenShopField } from '@/lib/open-shop-error-field';
import { InfoTip } from '@/app/_components/info-tip';
import { TakenSignIn } from './taken-sign-in';
import { formatPhoneDigits, phoneBoxState, phoneDigitsFromTyped } from '@/lib/open-shop-phone';
import { PhoneField } from './phone-field';
import { SERVICE_GROUPS, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { titleCasePersonName } from '@/lib/person-name-case';
import { AddressPreview } from './address-preview';
import { locationStepError } from '@/lib/open-shop-location-gate';
import { isPhPhone } from '@/lib/ph-phone';
import { CityPin } from './city-pin';
import { EventTiles, type EventTileOption } from './event-tiles';
import { ServiceCards, placeIndex, type PickedService, type SpecialtyField, type SpecialtyPicks } from './service-cards';
import { ServicesAtEvents } from './services-at-events';
import { PLAN_AGREE_ERROR, PlanPane, PlanSheet } from './plan-sheet';
import {
  EXTRA_SERVICES_FIELD,
  MAIN_SERVICE_EVENTS_FIELD,
  SPECIALTIES_FIELD,
  eventsForService,
  holdsMoreThanFree,
} from '@/lib/open-shop-more-services';
import { SignInHereLink } from '@/app/_components/auth/sign-in-here-link';
import { useStaleBuild } from './use-stale-build';
import { ServicePicker, type PickerParentView, type PickerLeafView } from './service-picker';
import { becomeVendor } from '../actions';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { NativeOAuthButtons } from '@/app/_components/native-oauth-buttons';
import { OAUTH_BUTTON_CLASS } from '@/app/_components/oauth-icons';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import { OPEN_SHOP_ACCOUNT_ERRORS, OPEN_SHOP_PASSWORD_MIN } from '@/lib/open-shop-account';
import {
  OPEN_SHOP_DRAFT_KEY,
  parseOpenShopDraft,
  restoresOnThisLoad,
  serializeOpenShopDraft,
} from '@/lib/open-shop-draft';
import { formatCount } from '@/lib/format-number';
import { useMediaQuery } from '@/lib/use-responsive';
import { PasswordField } from '@/app/_components/password-field';

/**
 * The supplier sign-up door — `/open-shop`. FIVE compact steps, one question each, on ONE always-mounted form
 * (inputs persist across steps; one submit at the end):
 *
 *   1 · Name your shop   — shop name · its permanent web address
 *   2 · What you do      — page 1: your services (category cards); page 2: the events you serve, and which of your
 *                          services you offer at each
 *   3 · Where you are    — the address, the pin that follows it, and "Is this your address?"
 *   4 · About you        — name · number · role at the shop (optional)
 *   5 · Your account     — Continue with Google / Apple / Email · Terms · Open my shop
 *
 * ── THE CONTRACT IS PROTOTYPE v16 (owner, 6 Nov: "those are the last fixes") ──────────────────────────────────────
 * `prototypes/open_shop_redesign_2026-11-06/open-shop-redesign-v16.html` in the specs repo, its "Click through it".
 * DECISION_LOG 2026-11-06: "FOUR CALLS ANSWERED" (account LAST; "In business since" and the logo leave the door; events
 * as photo tiles), "EVERY EVENT TYPE STARTS TICKED", "REDESIGN APPROVED" (every error under its own box), "SERVICES
 * SIT TOGETHER, A METER NAMES THE PLAN", "THE PLAN METER COUNTS CATEGORIES AND SERVICES PER CATEGORY". The v16 fixes:
 *   ① a third and fourth category always add (frame → tile → row); the card a pick lands in scrolls in and flashes;
 *   ② the plan explainer opens on Continue (sheet on a phone, the right pane when wide) when the picks are more than
 *     Free holds — one box to tick, then Continue; a one-line hint + ⓘ stays inline;
 *   ③ specialties compile — closed with picks = the picks + "+ Add"; open = the chips + Done;
 *   ④ under each ticked event, your services as chips (untick per event; greyed where not offered);
 *   ⑤ "About you" is its own step; "Your account" is three equal buttons, Email opening email + password in place.
 *
 * The logo is NOT asked here (A2, 2026-11-06 — signed out it could not upload); it is asked right after the shop
 * opens (`/open-shop/logo`). Website, social links, documents and the rest continue on Today's checklist.
 *
 * ── THE ACCOUNT IS CREATED INSIDE THE LAST STEP (owner 2026-09-22, the last step since 2026-11-06) ────────────────
 * With no session (`guest`), step 5 carries Google / Apple / Email; Email opens the email + password boxes in place,
 * and ONE submit creates the account and the shop (`becomeVendor` → `decideOpenShopAccount` →
 * `createVendorAccountForShop`). "Have an account? Sign in" opens the sign-in pane (a third pane at ≥768, a bottom
 * sheet on a phone — `SignInHereLink pane`): on success the server page re-renders with the account and this component
 * keeps its state, so everything typed stays and step 5 simply loses its account half.
 *
 * Google / Apple genuinely LEAVE the page, so the typed steps are parked in a one-hour, same-tab draft
 * (`lib/open-shop-draft.ts`, never the password) and restored when the OAuth callback lands back here.
 */
/** Five steps, one question each. */
export type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 5;
/** Step 2's two pages (prototype v13: "events you serve can be a next page?"). */
type Page2 = 'services' | 'events';

export function OpenShopWizard({
  mode,
  accountName = null,
  serviceLabels,
  serviceTree = [],
  savedServiceLabel = null,
  existingSlug = null,
  eventTypeOptions,
  logoDisplayMap,
  defaults,
  error,
  feeNotice = null,
  initialStep = 1,
  guest = false,
  coordinator = false,
  oauth = { show: false, desktop: false, native: false },
  signInHref = '/login?next=%2Fopen-shop&as=vendor',
  planCategories = [],
  specialties = {},
  emailTaken = false,
  sentTo = null,
}: {
  /**
   * "How many categories you can run depends on your plan ⓘ" — one line per plan, read from `TIER_CAPS` by
   * `categoryLadder()` on the server (never typed here). Empty = the ⓘ is not drawn.
   */
  planCategories?: { plan: string; categories: string }[];
  /**
   * ③ Each service's specialty questions — the chip-shaped refinements of its own schema (`canonical_service_schemas`,
   * read by `fetchCategoryChipRefinementsMany` on the server). A service with none shows no "+ Specialties".
   */
  specialties?: Record<string, SpecialtyField[]>;
  /** `?taken=1`: the email already has an account — step 5's email box becomes a sign-in, right here. */
  emailTaken?: boolean;
  /** `?check_inbox=`: the shop is open, the account waits for its email link — say so, with the address. */
  sentTo?: string | null;
  /**
   * "Free to join, and here is when you DO pay" — composed on the server by
   * `bookingFeeJoinDisclosure(await readBookingFeeJoinSchedule())`, so the rate
   * is the owner's live one and is NEVER typed in this file. Null when the fee
   * system is dark, and the wizard then says nothing about it.
   */
  feeNotice?: { headline: string; detail: string } | null;
  /** 'create' = no shop yet · 'complete' = shop exists but was never named. */
  mode: 'create' | 'complete';
  serviceLabels?: Record<string, string>;
  /** parent -> branch -> leaf tree (first-party SKUs already stripped).
   *  Empty = the taxonomy read failed; the wizard falls back to the flat
   *  select so a hiccup can never block a vendor from opening a shop. */
  serviceTree?: PickerParentView[];
  /** Display name for an already-saved pick, so a re-run shows a NAME. */
  savedServiceLabel?: string | null;
  /** The address this shop ALREADY holds. Present = it is settled and cannot
   *  be changed (owner 2026-08-10), so the picker renders read-only. */
  existingSlug?: string | null;
  /** The event types a vendor can serve (admin-driven roster), with the photo each one wears. */
  eventTypeOptions: EventTileOption[];
  /** Owned shop id (null before the row exists). */
  vendorProfileId?: string | null;
  /** r2Ref → 24h display URL, so an already-uploaded logo paints in "Your shop at a glance". */
  logoDisplayMap?: Record<string, string>;
  defaults: {
    shopName: string;
    logoUrl: string;
    primaryService: string;
    eventTypes: string[];
    locationCity: string;
    hqAddress: string;
    contactName: string;
    contactPosition: string;
    contactPhone: string;
    contactEmail: string;
  };
  error?: string;
  /** The signed-in account's own name. Shown READ-ONLY when present (owner
   *  2026-08-10: "your name (automatic from their account)") — presented, not
   *  asked. Falls back to an editable input when the account has none, because
   *  a locked EMPTY required field is a dead end. */
  accountName?: string | null;
  /** From `?step=` — the server sends `&step=N` when it rejects a field, so the
   *  wizard resumes on that step instead of discarding what was typed. */
  initialStep?: Step;
  /** No session: step 5 also creates the account (owner 2026-09-22). */
  guest?: boolean;
  /** `?as=coordinator` — step 2 opens on the coordination services (owner 2026-11-06). */
  coordinator?: boolean;
  /** OAuth visibility by shell, decided on the server exactly as /login does. */
  oauth?: { show: boolean; desktop: boolean; native: boolean };
  /** The no-JavaScript fallback for "Have an account? Sign in". */
  signInHref?: string;
}) {
  // Seeded from `?step=` so a SERVER rejection re-renders on the step that owns
  // the rejected field, instead of dumping the vendor back to the start with
  // everything they typed on later steps gone.
  const [step, setStep] = useState<Step>(
    initialStep && initialStep >= 1 && initialStep <= TOTAL_STEPS ? initialStep : 1,
  );
  const [shopName, setShopName] = useState(defaults.shopName);
  // 🖼 The logo is not asked here (A2) — it is asked right after the shop opens, signed in, where the upload works
  // (`/open-shop/logo`). What a re-run already holds is kept and re-posted, never cleared.
  const logoUrl = defaults.logoUrl;
  // ☎ The number's digits after the fixed +63 (A7, `PhoneField`). Lifted here so a restored draft refills it.
  const [phoneDigits, setPhoneDigits] = useState(phoneDigitsFromTyped(defaults.contactPhone));
  // 🔑 A8 — the submit was refused because the email has an account: step 5 signs in, right here.
  const [taken, setTaken] = useState(guest && emailTaken);
  const [takenEmail, setTakenEmail] = useState(defaults.contactEmail);
  const [service, setService] = useState(defaults.primaryService);
  // The picked leaf's LABEL, held alongside its key so the chosen card reads
  // as a name the moment it is tapped — the key alone would print
  // snake_case at the vendor.
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  // ✅ EVERY EVENT TYPE STARTS TICKED (owner 2026-11-06): the page hands in the full roster as the default (or the
  // richer set a re-run already holds). Never a weddings-only fallback.
  const [events, setEvents] = useState<string[]>(defaults.eventTypes ?? []);
  // 🧺 The services added under the main (owner 2026-11-06, prototype v14–v16) — one card per category with it.
  // Posted as one hidden JSON field with each one's own events; the server re-resolves every key.
  const [added, setAdded] = useState<PickedService[]>([]);
  // ④ The services unticked under an event (`{ event: [service keys] }`) — every chip starts on.
  const [evOff, setEvOff] = useState<Record<string, string[]>>({});
  // ③ The specialties picked, and the ONE service whose chips are open (opening one closes the others).
  const [picks, setPicks] = useState<SpecialtyPicks>({});
  const [openSpecialty, setOpenSpecialty] = useState<string | null>(null);
  // ① "Another category" is open (the tiles are under the cards).
  const [adding, setAdding] = useState(false);
  // ② The plan explainer: open, ticked, and its refusal.
  const [planOpen, setPlanOpen] = useState(false);
  const [planAgreed, setPlanAgreed] = useState(false);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const places = useMemo(() => placeIndex(serviceTree), [serviceTree]);
  const allowedOf = (key: string) => places.get(key)?.allowedEventTypes ?? null;
  const toggleEvent = (k: string) =>
    setEvents((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  // 🧭 `?as=coordinator`: "Not a coordinator? Search all services" turns the coordinator view off for this visit.
  const [allServices, setAllServices] = useState(false);
  const coordinating = coordinator && !allServices;
  /**
   * THE ONE REFUSAL ON SCREEN — seeded from the SERVER and owned by the client thereafter.
   *
   * 🔴 It is no longer drawn as a banner at the top (owner 2026-11-06, "REDESIGN APPROVED": every error sits under
   * its own box). `openShopErrorField` names the box the sentence belongs to, and that box draws it, tied to its
   * input by `aria-describedby`. A sentence no box owns (a failed account creation) is drawn above the button that
   * will try again.
   *
   * 🪤 It used to be TWO values rendered as `stepError ?? error`, where `error` is a bare prop fed from `?error=`
   * that nothing could clear — a vendor who fixed the field watched the identical sentence STAY. One value.
   */
  const [banner, setBanner] = useState<string | null>(error ?? null);
  const errorField: OpenShopField | null = taken ? null : openShopErrorField(banner);
  const errorWords = banner ? openShopErrorWords(banner) : null;
  const errorFor = (field: OpenShopField) => (errorField === field ? errorWords : null);
  /** The red line under a box, with the id its input names in `aria-describedby`. */
  const fieldError = (field: OpenShopField) => {
    const words = errorFor(field);
    return words ? (
      <span
        id={`open-shop-err-${field}`}
        className="flex items-start gap-1.5 text-xs"
        style={{ color: 'var(--m-mulberry-deep)' }}
        role="alert"
        data-open-shop-field-error={field}
      >
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>{words}</span>
      </span>
    ) : null;
  };
  const describedBy = (field: OpenShopField, ...more: string[]) =>
    [errorFor(field) ? `open-shop-err-${field}` : '', ...more].filter(Boolean).join(' ') || undefined;
  /** Step 2's page a refusal belongs to — the events and "each service" lines live on page 2. */
  const pageOf = (field: OpenShopField | null): Page2 => (field === 'events' || field === 'extras' ? 'events' : 'services');
  const [page2, setPage2] = useState<Page2>(pageOf(errorField));
  // ⑤ Google / Apple are drawn on this shell (the server's gate, and on the web row at least one provider switched on).
  const waysShown = oauth.show && (oauth.desktop || oauth.native || ANY_OAUTH_ENABLED);
  // "Continue with Email" was chosen — the email + password open in place. A server refusal about either (or the
  // taken-email sign-in) opens them; with no Google / Apple on this shell, Email is the only way and starts open.
  const [acctEmail, setAcctEmail] = useState(
    !waysShown || ['contact_email', 'password'].includes(errorField ?? '') || (guest && emailTaken),
  );

  /** The web address that would be submitted — printed in "Your shop at a glance". */
  const [slug, setSlug] = useState(existingSlug ?? '');
  /** The web address a submit-time refusal sent back (`restoresOnThisLoad`) — AddressPreview remounts holding it. */
  const [restoredSlug, setRestoredSlug] = useState<string | null>(null);
  /** The typed address a reload / OAuth round trip brought back — CityPin remounts holding it. */
  const [restoredAddress, setRestoredAddress] = useState<string | null>(null);
  const [address, setAddress] = useState(defaults.hqAddress);
  /** The city the vendor said "Yes, that's right" to — null until then. */
  const [confirmedCity, setConfirmedCity] = useState<string | null>(null);
  /** "Is this your address?" is waiting for an answer — at ≥768 the right column becomes that pane. */
  const [pinPending, setPinPending] = useState(false);
  const [who, setWho] = useState(titleCasePersonName(accountName ?? defaults.contactName));
  /** The right-hand column's slot the confirmation card is portalled into (≥768 only). */
  const [sideSlot, setSideSlot] = useState<HTMLElement | null>(null);
  const wide = useMediaQuery('(min-width: 768px)');
  // 🔄 Page left open across a deploy → the primary button becomes "Tap Reload to keep going" (owner 2026-11-06).
  const stale = useStaleBuild();
  // The form is ALWAYS MOUNTED (values survive step switches), so the gate can
  // read any step's inputs live instead of duplicating them all into state.
  const formRef = useRef<HTMLFormElement>(null);

  const serviceLabel = pickedLabel ?? (service ? (savedServiceLabel ?? serviceLabels?.[service] ?? null) : null);
  /** Every picked service, the main first (`PickedService` — key + name). */
  const picked: PickedService[] = service ? [{ key: service, label: serviceLabel ?? service }, ...added] : [];
  /** ② The picks hold more than Free does — Continue explains the plans first. */
  const overFree = holdsMoreThanFree(
    picked.map((p) => ({ categoryId: places.get(p.key)?.categoryId ?? p.key, categoryLabel: '' })),
  );
  /** ④ The services left on for NO ticked event — Continue (and the server) refuse them. */
  const serviceOnNoEvent = picked.some((p) => eventsForService(p.key, allowedOf(p.key), events, evOff).length === 0);

  /**
   * ── ONE QUESTION PER STEP ─────────────────────────────────────────────────────────────────────────────────────────
   * Validation is per-step and uses the SHARED strings, so a vendor is never told about a problem on a screen they
   * cannot see — and the order of the checks is the order of the boxes on the screen. The server stays
   * authoritative (it runs the same checks in the same order); this only saves the round trip.
   */
  const validateStep = (n: Step): string | null => {
    const read = (name: string) =>
      (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const el = (name: string) =>
      formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (n === 1) {
      if (!shopName.trim()) return OPEN_SHOP_ERRORS.shopName;
      // Same shared flag the server action gates on — the two can't drift.
      if (OPEN_SHOP_LOGO_REQUIRED && !logoUrl.trim()) return OPEN_SHOP_ERRORS.logo;
      return null;
    }
    if (n === 2) {
      if (!service) return OPEN_SHOP_ERRORS.service;
      // "Pick at least one event." (owner 2026-11-06) — the server refuses an empty set too.
      if (events.length === 0) return OPEN_SHOP_ERRORS.events;
      // ④ Every service must be on for at least one ticked event — the server refuses it too.
      if (serviceOnNoEvent) return OPEN_SHOP_ERRORS.extraEvents;
      return null;
    }
    if (n === 3) {
      // ── THE PIN IS REQUIRED, AND CONFIRMING IT COMPLETES THE STEP ──────────────────────────────────────────────
      // Owner-locked 2026-08-10: *"needs to have a pin on the map before they can continue. so you have to ask them
      // if the pin location is correct."* The rule lives in `locationStepError` so it can be RUN — and the server
      // now runs it too (2026-11-06), so a shop can no longer open without a confirmed pin.
      const location = locationStepError({
        hasPin: !!el('hq_latitude')?.value,
        confirmed: !!el('location_confirmed')?.value,
        city: el('location_city')?.value ?? '',
      });
      return location ?? null;
    }
    if (n === 4) {
      if (!read('contact_name').trim()) return OPEN_SHOP_ERRORS.contactName;
      if (!read('contact_phone').trim()) return OPEN_SHOP_ERRORS.contactPhone;
      // The box's own sentence (owner 2026-11-06): "Use 9XX XXX XXXX, or your landline with its area code."
      if (!isPhPhone(read('contact_phone'))) return OPEN_SHOP_PHONE_BOX_ERROR;
      return null;
    }
    // ⑤ Your account. Signed out, a way to sign in must be picked first (Google / Apple leave the page on the tap).
    if (guest && !acctEmail) return OPEN_SHOP_ACCOUNT_ERRORS.way;
    if (!isValidOpenShopEmail(read('contact_email'))) return OPEN_SHOP_ERRORS.contactEmail;
    // Same floor as /signup, same sentence — see lib/open-shop-account.ts.
    if (guest && read('password').length < OPEN_SHOP_PASSWORD_MIN) {
      return OPEN_SHOP_ACCOUNT_ERRORS.password;
    }
    // The agreement, only where an account is being CREATED. The server refuses
    // it too (`hasAgreedToTerms`); this only saves the round trip.
    if (guest && !el(TERMS_FIELD)?.checked) return TERMS_REQUIRED_MESSAGE;
    return null;
  };

  /** Put the cursor in the box a refusal is about, once its step is on screen. */
  const focusField = (message: string) => {
    const field = openShopErrorField(message);
    if (!field || field === 'submit' || field === 'way') return;
    window.requestAnimationFrame(() => {
      const target =
        field === 'events'
          ? formRef.current?.querySelector<HTMLInputElement>('input[name="event_types"]')
          : field === 'extras'
            ? document.getElementById('open-shop-err-extras')
            : document.getElementById(field === 'location' ? 'open-shop-hq_address' : `open-shop-${field}`);
      if (field === 'extras') target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else target?.focus({ preventScroll: false });
    });
  };

  /**
   * ── 🔴 ENTER MUST NOT SUBMIT THIS FORM ─────────────────────────────────────
   * Owner 2026-08-10: *"when i tried searching on the map and pressed enter, it
   * just completed without me seeing if the address was correct."* A form with
   * one submit on the LAST step implicitly submits on Enter from any box. Enter
   * now advances instead — the same thing Continue does, including its
   * validation — and on the LAST step it does nothing, so the shop is only ever
   * created by pressing the button that says so.
   */
  const onFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    // The sign-in pane is a PORTAL: its DOM is under <body>, but React still
    // bubbles its key events through this form. Only keys typed IN this form count.
    if (!e.currentTarget.contains(e.target as Node)) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
    e.preventDefault();
    if (step < TOTAL_STEPS) next();
  };

  /** Refuse with a sentence: drawn under its box, on its page, the cursor put there. */
  const refuse = (err: string) => {
    setBanner(err);
    if (step === 2) setPage2(pageOf(openShopErrorField(err)));
    focusField(err);
  };

  const next = () => {
    // Step 2, page 1 → the plan explainer (when due), then page 2.
    if (step === 2 && page2 === 'services') {
      if (!service) return refuse(OPEN_SHOP_ERRORS.service);
      if (overFree && !planAgreed) {
        // ② "Before you continue" — the sheet on a phone, the right pane when wide. Specialties and the add picker close.
        setOpenSpecialty(null);
        setAdding(false);
        setPlanErr(null);
        setPlanOpen(true);
        return;
      }
      setBanner(null);
      setPage2('events');
      window.scrollTo({ top: 0 });
      return;
    }
    const err = validateStep(step);
    if (err) return refuse(err);
    setBanner(null);
    setStep((n) => (n < TOTAL_STEPS ? ((n + 1) as Step) : n));
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    setBanner(null);
    setPlanOpen(false);
    if (step === 2 && page2 === 'events') {
      setPage2('services');
      return;
    }
    if (step === 3) setPage2('events');
    setStep((n) => (n > 1 ? ((n - 1) as Step) : n));
  };

  /** ② "Continue" inside the explainer: the box must be ticked. */
  const planContinue = () => {
    if (!planAgreed) {
      setPlanErr(PLAN_AGREE_ERROR);
      return;
    }
    setPlanOpen(false);
    setBanner(null);
    setPage2('events');
    window.scrollTo({ top: 0 });
  };

  /**
   * The final gate. Walks EVERY step, not just the last one — a vendor can go
   * back, clear a field, and jump forward. On a failure it moves to the step
   * that owns the field, so the message is never about a screen they cannot see.
   */
  const submitGate = (e: React.FormEvent<HTMLFormElement>) => {
    // Same portal rule: a submit inside the sign-in pane must not be gated here.
    if (e.target !== e.currentTarget) return;
    for (const n of [1, 2, 3, 4, 5] as Step[]) {
      const err = validateStep(n);
      if (err) {
        setBanner(err);
        setStep(n);
        if (n === 2) setPage2(pageOf(openShopErrorField(err)));
        focusField(err);
        e.preventDefault();
        return;
      }
    }
    setBanner(null);
    // 🧷 The form is going to the server: park what was typed, so a refusal there reloads with every field kept
    // (journey_fixes_later Supplier 4c). Restored only on the `?error=` reload; never the password.
    saveDraft({ atSubmit: true });
  };

  /**
   * Park the typed steps — before Google / Apple take the page away (`oauth`), before a reload onto the new build
   * (`reload`), and as the form leaves (`atSubmit`, with the address the form sends). Never the password.
   */
  const saveDraft = (at?: { atSubmit: true } | { reload: true }) => {
    const read = (name: string) =>
      (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    try {
      sessionStorage.setItem(
        OPEN_SHOP_DRAFT_KEY,
        serializeOpenShopDraft({
          // OAuth leaves from step 5 (the account step); a reload and a submit come back where they were.
          step: at ? step : 5,
          shopName,
          logoUrl,
          service,
          serviceLabel: pickedLabel,
          events,
          added: added.map((a) => ({
            key: a.key,
            label: a.label,
            events: eventsForService(a.key, allowedOf(a.key), events, evOff),
          })),
          evOff,
          specialties: picks,
          planAgreed,
          position: read('contact_position'),
          phone: read('contact_phone'),
          email: read('contact_email'),
          name: read('contact_name'),
          address,
          // The address box's own hidden field (`AddressPreview` renders it, not this file).
          ...(at && 'atSubmit' in at ? { atSubmit: true, slug: formRef.current?.querySelector<HTMLInputElement>('input[name="business_slug"]')?.value ?? '' } : {}),
        }),
      );
    } catch {
      // Storage refused (private mode, quota): the round trip loses the draft,
      // which is today's behaviour, not a new failure.
    }
  };
  /** "Tap Reload to keep going": the draft first, then the new build. */
  const reloadKeepingDraft = () => {
    saveDraft({ reload: true });
    window.location.reload();
  };
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || mode !== 'create') return;
    restoredRef.current = true;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(OPEN_SHOP_DRAFT_KEY);
      if (raw) sessionStorage.removeItem(OPEN_SHOP_DRAFT_KEY);
    } catch {
      return;
    }
    const d = parseOpenShopDraft(raw);
    if (!d || !restoresOnThisLoad(d, Boolean(error))) return;
    if (d.shopName) setShopName(d.shopName);
    if (d.service) {
      setService(d.service);
      setPickedLabel(d.serviceLabel);
    }
    if (d.events.length) setEvents(d.events);
    if (d.added?.length) setAdded(d.added.map((a) => ({ key: a.key, label: a.label })));
    if (d.evOff) setEvOff(d.evOff);
    if (d.specialties) setPicks(d.specialties);
    if (d.planAgreed) setPlanAgreed(true);
    const write = (name: string, value: string) => {
      const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
      if (el && value && !el.readOnly) el.value = value;
    };
    if (d.phone) setPhoneDigits(phoneDigitsFromTyped(d.phone));
    write('contact_email', d.email);
    write('contact_position', d.position);
    if (d.email) setTakenEmail(d.email);
    if (d.name) {
      write('contact_name', d.name);
      if (!accountName) setWho(d.name);
    }
    if (d.address) setRestoredAddress(d.address);
    // Parked at submit: the server's `?step=` already names the step that owns the refusal — keep it. The address it
    // refused comes back in its box, focused, so "Taken — try another." is the first thing read.
    if (d.atSubmit) {
      if (d.slug) setRestoredSlug(d.slug);
    } else {
      setStep(d.step);
      if (d.step > 2) setPage2('events');
    }
    // Re-render dependencies are deliberately empty: this runs ONCE, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✉ A1 — the shop is open on the new account, and the account waits for its email link (verification on).
  if (sentTo) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-lg rounded-2xl border p-5 text-center sm:p-7"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          data-open-shop-sent=""
        >
          <FirstRunBrand className="mb-4" color="var(--m-ink)" size={13} />
          <MailCheck aria-hidden className="mx-auto h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--m-orange-deep)' }} />
          <h1 className="mt-3 text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
            We sent a link to {sentTo} — tap it to finish
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--m-slate)' }}>
            Your shop is saved with everything you typed. The link signs you in and opens your shop&rsquo;s dashboard.
          </p>
          <p className="mt-4 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Not there? Check your spam folder, or{' '}
            <a href={`/login?check_email=${encodeURIComponent(sentTo)}&next=%2Fvendor-dashboard`} className="text-terracotta">
              sign in
            </a>{' '}
            once you have tapped it.
          </p>
        </div>
      </main>
    );
  }

  // ── THE WORDS AT THE TOP OF EACH STEP — the prototype's, verbatim ─────────────────────────────────────────────────
  const heads: Record<Step, [string, string | null]> = {
    1: [coordinator ? 'Name your coordination shop' : 'Name your shop', 'This becomes your page address.'],
    2:
      page2 === 'events'
        ? ['Events you serve', 'Couples find you by event.']
        : coordinating
          ? ['What you coordinate', service ? 'Your services. Add more if you do more.' : 'Pick your main coordination service.']
          : ['What you do', service ? 'Your services. Add more if you do more.' : 'Pick your main service.'],
    3: ['Where you are', 'Type your address; the pin follows. Then confirm it.'],
    4: ['About you', 'Who couples will talk to.'],
    5: ['Your account', guest ? 'Pick how you’ll sign in. This creates your Setnayan account.' : null],
  };
  const [title, line] = heads[step];
  const phoneOk = phoneBoxState(phoneDigits, true).state === 'ok';
  /** At ≥768 a pending "Is this your address?" opens in the right column — the third pane. */
  const confirmPane = wide && step === 3 && pinPending;
  /** ② At ≥768 the plan explainer is the right column too. */
  const planPane = wide && step === 2 && planOpen;

  const signInLine = guest ? (
    <>
      Have an account?{' '}
      <SignInHereLink href={signInHref} pane className="font-medium text-terracotta">
        Sign in
      </SignInHereLink>{' '}
      — what you typed stays.
    </>
  ) : null;

  const glanceRow = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex justify-between gap-2.5 border-t pt-2 text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
        <span className="shrink-0 whitespace-nowrap" style={{ color: 'var(--m-slate-3)' }}>{label}</span>
        <span className="min-w-0 text-right font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
          {value}
        </span>
      </div>
    ) : null;
  const logoSrc = logoUrl ? (logoDisplayMap?.[logoUrl] ?? null) : null;

  // The bottom bar's primary: Continue · the quiet "not yet" form of it · Open my shop · or, on a stale build,
  // "Tap Reload to keep going" (the draft is parked first).
  const quiet = (step === 2 && page2 === 'services' && !service) || (step === 3 && !confirmedCity);
  const planProps = {
    agreed: planAgreed,
    onAgree: (a: boolean) => {
      setPlanAgreed(a);
      setPlanErr(null);
    },
    error: planErr,
    onContinue: planContinue,
    onBack: () => {
      setPlanOpen(false);
      setPlanErr(null);
    },
  };

  return (
    <main className="flex min-h-[100dvh] flex-col md:block md:min-h-[70vh]" data-open-shop-wizard="">
      {/* ── THE TOP LINE (≥768): the wordmark, and "Have an account? Sign in — what you typed stays." ─────────── */}
      <div
        className="hidden h-[60px] items-center gap-4 border-b px-7 md:flex lg:px-8"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <FirstRunBrand color="var(--m-ink)" size={13} />
        <span className="flex-1" />
        {signInLine ? (
          <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
            {signInLine}
          </span>
        ) : null}
      </div>

      <div
        className={`grid flex-1 gap-7 px-4 pb-0 pt-6 md:px-7 md:pb-9 md:pt-6 lg:gap-14 lg:px-12 lg:pb-12 lg:pt-9 ${
          confirmPane
            ? 'md:grid-cols-2'
            : 'md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_380px]'
        }`}
      >
        <div className="flex min-w-0 flex-col gap-[18px] md:grid md:content-start">
          {/* ── PROGRESS, NOT PROSE (owner 2026-08-10) — on a phone, the wordmark over five segments that fill. At
              ≥768 the count is the last line of "Your shop at a glance". `aria-valuenow` + the label keep it for a
              screen reader at every size. */}
          <div className="grid gap-3 md:block">
            <FirstRunBrand className="md:hidden" color="var(--m-ink)" size={13} />
            <div
              className="flex gap-1.5 md:sr-only"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={step}
              aria-label={`Step ${formatCount(step)} of ${formatCount(TOTAL_STEPS)}`}
              data-open-shop-segments=""
            >
              {([1, 2, 3, 4, 5] as Step[]).map((n) => (
                <span key={n} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--m-line)' }}>
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: n <= step ? '100%' : '0%', background: 'var(--m-orange-deep)' }}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-[3px]">
            <h1 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.01em]" style={{ color: 'var(--m-ink)' }}>
              {title}
            </h1>
            {line ? (
              <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
                {line}
              </p>
            ) : null}
            {step === TOTAL_STEPS && signInLine ? (
              <p className="text-xs md:hidden" style={{ color: 'var(--m-slate-3)' }}>
                {signInLine}
              </p>
            ) : null}
          </div>

          {/* 🔄 THE PAGE WAS LEFT OPEN ACROSS A DEPLOY (owner 2026-11-06). Said once, at the top of the step; the
              button below carries the action. */}
          {stale ? (
            <div
              className="grid max-w-[620px] gap-2 rounded-[var(--m-r-md)] border px-3.5 py-3 text-sm"
              style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
              role="status"
              data-open-shop-stale=""
            >
              <b>This page is out of date.</b>
              <span>Setnayan was updated while this page was open. Tap Reload to keep going — everything you typed is saved.</span>
            </div>
          ) : null}

          {/* ── STEP 5, SIGNED OUT: ⑤ THREE EQUAL BUTTONS — Continue with Google / Apple / Email. Google / Apple sit
              OUTSIDE the wizard's own form element: the OAuth row renders its own forms (nested forms are invalid HTML
              and the browser drops the inner one). Email is a plain button that opens the email + password in place,
              inside the form below. */}
          {guest && step === TOTAL_STEPS ? (
            <div className="grid max-w-[620px] gap-2" onSubmitCapture={() => saveDraft()} data-open-shop-ways="">
              {waysShown && !taken ? (
                <>
                  {oauth.desktop ? (
                    <DesktopOAuthButtons next="/open-shop" />
                  ) : oauth.native ? (
                    <NativeOAuthButtons next="/open-shop" accountType="vendor" />
                  ) : (
                    <OAuthButtonRow next="/open-shop" withAccountType defaultAccountType="vendor" />
                  )}
                  <button
                    type="button"
                    className={OAUTH_BUTTON_CLASS}
                    style={acctEmail ? { borderColor: 'var(--m-ink)', boxShadow: 'inset 0 0 0 1px var(--m-ink)' } : undefined}
                    aria-pressed={acctEmail}
                    aria-describedby={describedBy('way')}
                    onClick={() => {
                      setAcctEmail(true);
                      if (errorField === 'way') setBanner(null);
                      window.requestAnimationFrame(() =>
                        document.getElementById('open-shop-contact_email')?.focus({ preventScroll: true }),
                      );
                    }}
                    data-open-shop-email-way=""
                  >
                    <Mail aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    {OAUTH_VERB} Email
                  </button>
                  {fieldError('way')}
                </>
              ) : null}
              {taken ? (
                <TakenSignIn
                  key={takenEmail}
                  email={takenEmail}
                  onSignedIn={() => {
                    setTaken(false);
                    setBanner(null);
                    // Signed in, everything kept: on to the last step and "Open my shop".
                    setStep(TOTAL_STEPS);
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {/* ⚠ `ref={formRef}` IS LOAD-BEARING, NOT DECORATION. `validateStep` reads
              steps 3, 4 and 5 off this element by name. Pinned by `four-steps.test.ts`. */}
          <form
            ref={formRef}
            action={becomeVendor}
            onSubmit={submitGate}
            onKeyDown={onFormKeyDown}
            className="flex flex-1 flex-col gap-[18px] md:grid md:flex-none"
            noValidate
          >
            {/* The bot check rides with the account creation, as on /signup.
                Graceful-off when the site key is unset. */}
            {guest ? <TurnstileField action="signup" /> : null}
            {logoUrl ? <input type="hidden" name="logo_url" value={logoUrl} /> : null}

            {/* 1 · Name your shop. Always mounted, like every panel — inputs persist across steps and there is ONE
                submit at the end. */}
            <div className={step === 1 ? 'space-y-4' : 'hidden'}>
              <label className="block max-w-[620px] space-y-1">
                <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Shop name
                </span>
                <input
                  id="open-shop-shop_name"
                  name="shop_name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  maxLength={128}
                  placeholder="e.g. Banawe Florals"
                  className="input-field"
                  autoComplete="organization"
                  enterKeyHint="next"
                  autoFocus
                  aria-invalid={errorFor('shop_name') ? true : undefined}
                  aria-describedby={describedBy('shop_name')}
                />
                {fieldError('shop_name')}
                {/* The shop name IS the web address (owner 2026-08-09). Showing it while they type is the only
                    moment a vendor can still choose a different name over it — afterwards it is permanent. */}
                <AddressPreview
                  key={restoredSlug ?? 'typed'}
                  shopName={shopName}
                  existingSlug={existingSlug}
                  initialValue={restoredSlug}
                  onAddress={setSlug}
                />
              </label>
            </div>

            {/* 2 · What you do — page 1 "Your services" (the category cards), page 2 "Events you serve" (prototype
                v13: events are step 2's own second page). Both pages are always mounted; one shows. */}
            <div className={step === 2 ? 'space-y-4' : 'hidden'}>
              <div
                className={page2 === 'services' ? `block space-y-1.5 ${service ? 'max-w-[620px] lg:max-w-none' : 'max-w-[620px]'}` : 'hidden'}
                data-open-shop-page="services"
              >
                {/* "Your services" once the main is picked — the main and every added one are one set of cards. */}
                <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  {service ? 'Your services' : 'Main service'}
                </span>
                {/* ── DRILL, DON'T SCROLL (owner 2026-08-09). The flat select survives as the FALLBACK for an empty
                    tree (a failed taxonomy read) — deleting it would turn a read hiccup into "you cannot open a
                    shop". */}
                {serviceTree.length > 0 ? (
                  <>
                    <input type="hidden" name="primary_service" value={service} />
                    {service ? (
                      <ServiceCards
                        tree={serviceTree}
                        places={places}
                        picked={picked}
                        onPickedChange={({ main, added: nextAdded }) => {
                          if (!main) {
                            setService('');
                            setPickedLabel(null);
                          }
                          setAdded(nextAdded);
                          if (errorField === 'extras') setBanner(null);
                        }}
                        specialties={specialties}
                        picks={picks}
                        onPicksChange={setPicks}
                        openSpecialty={openSpecialty}
                        onOpenSpecialty={setOpenSpecialty}
                        adding={adding}
                        onAddingChange={setAdding}
                      />
                    ) : (
                      <ServicePicker
                        tree={serviceTree}
                        coordinatorOnly={coordinating}
                        onSearchAll={() => setAllServices(true)}
                        excludeServices={new Set(added.map((a) => a.key))}
                        onPick={(leaf: PickerLeafView) => {
                          setService(leaf.canonicalService);
                          setPickedLabel(leaf.label);
                          if (errorField === 'service') setBanner(null);
                        }}
                      />
                    )}
                  </>
                ) : (
                  <select
                    id="open-shop-service"
                    name="primary_service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="input-field"
                    aria-describedby={describedBy('service')}
                  >
                    <option value="" disabled>
                      Pick the one thing you&rsquo;re known for
                    </option>
                    {SERVICE_GROUPS.map((g) => (
                      <optgroup key={g.key} label={g.label}>
                        {g.members.map((m) => (
                          <option key={m} value={m}>
                            {serviceLabels?.[m] ?? VENDOR_CATEGORY_LABEL[m]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                {/* 📏 A5 (owner 2026-11-06: the plan limit said AT the pick). The numbers are TIER_CAPS', read on
                    the server (`categoryLadder`), never typed here. Hidden while the coordinator list is up. Only
                    BEFORE the pick: once a service is chosen, the coverage line under the cards says it with the real
                    numbers. */}
                {service || coordinating ? null : (
                  <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }} data-open-shop-plan-hint="">
                    {planCategories.length > 0 ? (
                      <InfoTip
                        label="Add more later. How many categories you can run depends on your plan"
                        labelClassName="text-xs"
                        ariaLabel="Categories per plan"
                        align="start"
                      >
                        <span className="block space-y-0.5">
                          {planCategories.map((p) => (
                            <span key={p.plan} className="block">
                              {p.plan}: {p.categories}
                            </span>
                          ))}
                        </span>
                      </InfoTip>
                    ) : (
                      'Add more later. How many categories you can run depends on your plan'
                    )}
                  </span>
                )}
                {fieldError('service')}
                {/* What the server re-resolves: every added service with ITS events (④), the main's own events,
                    and the specialties (③). */}
                {service ? (
                  <>
                    <input
                      type="hidden"
                      name={EXTRA_SERVICES_FIELD}
                      value={JSON.stringify(
                        added.map((a) => ({ service: a.key, events: eventsForService(a.key, allowedOf(a.key), events, evOff) })),
                      )}
                    />
                    <input
                      type="hidden"
                      name={MAIN_SERVICE_EVENTS_FIELD}
                      value={JSON.stringify(eventsForService(service, allowedOf(service), events, evOff))}
                    />
                    <input type="hidden" name={SPECIALTIES_FIELD} value={JSON.stringify(picks)} />
                  </>
                ) : null}
              </div>

              <div className={page2 === 'events' ? 'block space-y-3' : 'hidden'} data-open-shop-page="events">
                <div className="block space-y-2">
                  {/* ✅ A6 — two text buttons right of the label. Each dims when it would do nothing. */}
                  <span className="flex items-baseline justify-between gap-2">
                    <span id="open-shop-events-label" className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                      Events you serve
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs font-medium" data-open-shop-events-bulk="">
                      <button
                        type="button"
                        onClick={() => {
                          setEvents(eventTypeOptions.map((e) => e.key));
                          if (errorField === 'events') setBanner(null);
                        }}
                        disabled={eventTypeOptions.every((e) => events.includes(e.key))}
                        className="text-terracotta disabled:opacity-40"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvents([])}
                        disabled={events.length === 0}
                        className="text-terracotta disabled:opacity-40"
                      >
                        Clear
                      </button>
                    </span>
                  </span>
                  {/* 🖼 Small photo tiles (owner 2026-11-06) — three across on a phone, every one ticked to start. */}
                  <EventTiles
                    options={eventTypeOptions}
                    value={events}
                    onToggle={(k) => {
                      toggleEvent(k);
                      if (errorField === 'events') setBanner(null);
                    }}
                    describedBy={describedBy('events', 'open-shop-events-label')}
                  />
                  {fieldError('events') ?? (
                    <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                      All are on to start. Untick any you don&rsquo;t do.
                    </span>
                  )}
                </div>
                {/* ④ Under each ticked event, your services as chips — untick per event; greyed where not offered. */}
                <ServicesAtEvents
                  events={eventTypeOptions}
                  ticked={events}
                  services={picked}
                  allowedOf={allowedOf}
                  off={evOff}
                  onOffChange={(nextOff) => {
                    setEvOff(nextOff);
                    if (errorField === 'extras') setBanner(null);
                  }}
                  refused={errorField === 'extras'}
                />
                {/* A refusal for a list this page no longer holds — drawn only when the block above cannot name one. */}
                {errorField === 'extras' && !serviceOnNoEvent ? fieldError('extras') : null}
              </div>
            </div>

            {/* 3 · Where you are. The map is the one element that needs full attention and cannot be made smaller. */}
            <div className={step === 3 ? 'space-y-4' : 'hidden'}>
              <div className="block space-y-1">
                <label htmlFor="open-shop-hq_address" className="block max-w-[620px] text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Address
                </label>
                {/* Owner 2026-08-10: "city should be the exact map location. which will provide their city." The
                    pin writes the city; a box to type it appears only when the lookup cannot name the spot. */}
                <CityPin
                  key={restoredAddress ?? 'typed'}
                  defaultCity={defaults.locationCity}
                  defaultAddress={restoredAddress ?? defaults.hqAddress}
                  /* The map is built inside a `display:none` panel, so it measures
                     0×0 and keeps believing it. This tells it the moment it is
                     actually on screen. */
                  active={step === 3}
                  error={errorFor('location')}
                  sideSlot={wide ? sideSlot : null}
                  onConfirmedChange={(c) => {
                    setConfirmedCity(c);
                    if (c && errorField === 'location') setBanner(null);
                  }}
                  onAddressChange={setAddress}
                  onPendingChange={setPinPending}
                />
              </div>
            </div>

            {/* 4 · About you (prototype v16 ⑤: "maybe the name number and role will be the slide before the login"). */}
            <div className={step === 4 ? 'space-y-4' : 'hidden'}>
              <label className="block max-w-[620px] space-y-1">
                <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Your name
                </span>
                <input
                  id="open-shop-contact_name"
                  name="contact_name"
                  // Owner 2026-08-10: "your name (automatic from their account)". READONLY, not disabled — a
                  // disabled input submits NOTHING. Falls back to editable when the account has no name.
                  readOnly={!!accountName}
                  // Capitalised on BLUR, not per keystroke: rewriting the box mid-word fights the typist.
                  onBlur={(e) => {
                    e.currentTarget.value = titleCasePersonName(e.currentTarget.value);
                    setWho(e.currentTarget.value);
                  }}
                  onInput={(e) => setWho(e.currentTarget.value)}
                  defaultValue={titleCasePersonName(accountName ?? defaults.contactName)}
                  maxLength={128}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="input-field"
                  style={accountName ? { background: 'var(--m-paper-2)', color: 'var(--m-slate)' } : undefined}
                  aria-invalid={errorFor('contact_name') ? true : undefined}
                  aria-describedby={describedBy('contact_name')}
                />
                {fieldError('contact_name')}
                {accountName ? (
                  <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                    From your account.
                  </span>
                ) : null}
              </label>

              <div className="block max-w-[620px] space-y-1">
                <label htmlFor="open-shop-contact_phone" className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Contact number
                </label>
                {/* ☎ A7: fixed +63 on the left; a mobile starting with 9 or a landline with its area code on the
                    right. Posts E.164 as `contact_phone`. Its refusal is drawn under it, by the box itself. */}
                <PhoneField digits={phoneDigits} onDigits={setPhoneDigits} error={errorFor('contact_phone')} />
              </div>

              {/* The role is FREE TEXT, optional — the shipped `contact_position` → `business_owner_position`. There is
                  no role list to reuse, so none is invented (prototype v16 `lvS4A`). */}
              <label className="block max-w-[620px] space-y-1">
                <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Your role at the shop{' '}
                  <small className="font-normal" style={{ color: 'var(--m-slate-3)' }}>
                    optional
                  </small>
                </span>
                <input
                  // field-ok: the door's own plain box, like "Your name" beside it — prototype v16 draws all three alike
                  id="open-shop-contact_position"
                  name="contact_position"
                  defaultValue={defaults.contactPosition}
                  maxLength={64}
                  placeholder="e.g. Owner"
                  autoComplete="organization-title"
                  className="input-field"
                />
              </label>
            </div>

            {/* 5 · Your account — signed out, the email + password open in place once "Continue with Email" is picked
                (kept MOUNTED either way, so a restored or typed value still posts). Signed in, the shop's email. */}
            <div className={step === 5 ? 'space-y-4' : 'hidden'}>
              {/* When `taken`, this box has turned into the sign-in above — kept mounted (hidden) so its value posts. */}
              <label className={taken || (guest && !acctEmail) ? 'hidden' : 'block max-w-[620px] space-y-1'}>
                <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  {guest ? (
                    <>
                      Email{' '}
                      <small className="font-normal" style={{ color: 'var(--m-slate-3)' }}>
                        you&rsquo;ll sign in with this
                      </small>
                    </>
                  ) : (
                    'Company email'
                  )}
                </span>
                <input
                  id="open-shop-contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={defaults.contactEmail}
                  maxLength={254}
                  placeholder="you@yourshop.ph"
                  autoComplete="email"
                  autoCapitalize="none"
                  inputMode="email"
                  className="input-field"
                  aria-invalid={errorFor('contact_email') ? true : undefined}
                  aria-describedby={describedBy('contact_email')}
                />
                {fieldError('contact_email')}
              </label>

              {guest ? (
                <label className={taken || !acctEmail ? 'hidden' : 'block max-w-[620px] space-y-1'}>
                  <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                    Password
                  </span>
                  {/* #7344's field, quiet (prototype v16: "one hint, no strength bar, no checklist — the leaked check
                      runs on submit and speaks only if it fails"): the eye, the one hint, the refusal under it. */}
                  <PasswordField
                    id="open-shop-password"
                    mode="new"
                    quiet
                    name="password"
                    autoComplete="new-password"
                    minLength={OPEN_SHOP_PASSWORD_MIN}
                    placeholder="At least 8 characters"
                    className="input-field"
                    aria-invalid={errorFor('password') ? true : undefined}
                    aria-describedby={describedBy('password', 'open-shop-password-hint')}
                  />
                  <span id="open-shop-password-hint" className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                    At least 8 characters
                  </span>
                  {fieldError('password')}
                </label>
              ) : null}

              {/* THE AGREEMENT, where an account is being created — on the step that carries the one button that
                  creates anything, above it, UNTICKED (clickwrap, CTRL-B3). The server refuses without it
                  (`hasAgreedToTerms`). */}
              {guest && step === TOTAL_STEPS ? (
                <div className="max-w-[620px] space-y-1">
                  <label className="flex cursor-pointer items-start gap-2 text-sm" style={{ color: 'var(--m-ink)' }}>
                    <input
                      id="open-shop-terms"
                      type="checkbox"
                      name={TERMS_FIELD}
                      required
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ accentColor: 'var(--m-mulberry)' }}
                      aria-describedby={describedBy('terms')}
                      onChange={(e) => {
                        if (e.currentTarget.checked && errorField === 'terms') setBanner(null);
                      }}
                    />
                    <span>
                      I agree to the{' '}
                      <a href="/terms" className="text-terracotta" target="_blank" rel="noreferrer">
                        Terms
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" className="text-terracotta" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  {fieldError('terms')}
                </div>
              ) : null}

              {/* WHAT "FREE" MEANS, SAID ON THE STEP WHERE THEY COMMIT. 🔴 Owner 2026-09-20, as a supplier who had
                  just been billed: "as a vendor i do not know i have to pay." ⓘ A10 / 2026-11-06: one line, the
                  numbers inside the ⓘ — `feeNotice` is composed by `bookingFeeJoinDisclosure` from the LIVE
                  schedule, never a rate typed here. (v16 dropped the prototype's "on us" footnote; this line is the
                  shipped disclosure the owner's 2026-09-20 ruling keeps, held by the-fee-finds-the-supplier.test.ts.) */}
              {feeNotice ? (
                <p data-testid="open-shop-fee-disclosure" className="max-w-[620px] text-sm" style={{ color: 'var(--m-slate)' }}>
                  <InfoTip
                    label="Free to open, free to run. You pay only when a couple books you through Setnayan"
                    labelClassName="text-sm"
                    ariaLabel="About the booking fee"
                    align="start"
                  >
                    <span className="block font-semibold">{feeNotice.headline}</span>
                    <span className="mt-0.5 block">{feeNotice.detail}</span>
                  </InfoTip>
                </p>
              ) : null}
            </div>

            {/* A refusal no box owns (the account could not be created just now) — above the button that retries. */}
            {fieldError('submit')}

            {/* One nav row for every step — a sticky bar at the bottom of a phone, under the step on wider screens.
                Back appears from step 2; the primary becomes the real submit only on the last one — a SubmitButton
                on an earlier step would post a half-filled form.
                🔘 THE HOUSE PRIMARY SHAPE IS A PILL (both-sign-up-doors-wear-one-button.test.ts). */}
            <div
              className="sticky bottom-0 z-10 -mx-4 mt-auto flex items-center gap-2.5 border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:mt-0 md:max-w-[620px] md:border-0 md:px-0 md:pb-0 md:pt-1"
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
              data-open-shop-bar=""
            >
              {step > 1 ? (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-ink/60 hover:bg-ink/5"
                  style={{ borderColor: 'var(--m-line)' }}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
              {stale ? (
                <button
                  type="button"
                  onClick={reloadKeepingDraft}
                  className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm md:w-auto md:min-w-[220px] md:px-6"
                  style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
                  data-open-shop-reload=""
                >
                  <RotateCw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Tap Reload to keep going
                </button>
              ) : step < TOTAL_STEPS ? (
                quiet ? (
                  /* Not yet — still a real press: it says what is missing, under its box. */
                  <button
                    type="button"
                    onClick={next}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm md:w-auto md:min-w-[220px] md:px-6 font-medium"
                    style={{ background: 'var(--m-paper-2)', color: 'var(--m-ink)' }}
                    data-open-shop-quiet=""
                  >
                    {step === 2 ? 'Pick a service to continue' : 'Continue'}
                  </button>
                ) : (
                  <button type="button" onClick={next} className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm md:w-auto md:min-w-[220px] md:px-6" data-open-shop-continue="">
                    Continue
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                )
              ) : (
                <SubmitButton className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm md:w-auto md:min-w-[220px] md:px-6" pendingLabel="Opening your shop…">
                  Open my shop — free
                </SubmitButton>
              )}
            </div>
          </form>
        </div>

        {/* ── THE RIGHT COLUMN (≥768): "Your shop at a glance" — or, while a pin waits for its answer, the third
            pane holding "Is this your address?" (CityPin portals it into the slot), or ② the plan explainer. Never on
            a phone. */}
        <aside className="hidden md:block">
          <div ref={setSideSlot} className={confirmPane ? 'sticky top-5' : 'hidden'} data-open-shop-pane="" />
          {confirmPane ? null : planPane ? (
            <PlanPane {...planProps} />
          ) : (
            <div
              className="sticky top-5 grid gap-3 rounded-2xl border p-[18px]"
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
              data-open-shop-glance=""
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--m-slate-3)' }}>
                Your shop at a glance
              </span>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- a 24h signed R2 URL, not an optimisable asset
                <img src={logoSrc} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : null /* no logo slot before the shop opens — the logo is asked after (owner, 6 Nov: "why do i see a logo") */}
              <span className="text-xl font-semibold leading-[1.1] [overflow-wrap:anywhere]" style={{ color: shopName.trim() ? 'var(--m-ink)' : 'var(--m-slate-3)' }}>
                {shopName.trim() || 'Your shop name'}
              </span>
              {glanceRow(
                'Address',
                slug ? (
                  <>
                    setnayan.com/<b>{slug}</b>
                  </>
                ) : null,
              )}
              {glanceRow('Main service', serviceLabel ? `${serviceLabel}${added.length ? ` +${added.length}` : ''}` : null)}
              {glanceRow('Page', step === 2 ? (page2 === 'events' ? 'Events you serve' : 'Your services') : null)}
              {glanceRow(
                'Events',
                step >= 2 && service && !(step === 2 && page2 === 'services')
                  ? `${formatCount(events.length)} of ${formatCount(eventTypeOptions.length)}`
                  : null,
              )}
              {glanceRow('Where', confirmedCity)}
              {glanceRow(
                'Contact',
                step >= 4 && who.trim() ? `${who.trim()}${phoneOk ? ` · +63 ${formatPhoneDigits(phoneDigits)}` : ''}` : null,
              )}
              <div className="flex justify-between gap-2.5 border-t pt-2 text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
                <span style={{ color: 'var(--m-slate-3)' }}>Step</span>
                <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                  {formatCount(step)} of {formatCount(TOTAL_STEPS)}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
      {/* ② On a phone the explainer rises as the shipped bottom sheet. */}
      <PlanSheet open={planOpen && !wide && step === 2} {...planProps} />
    </main>
  );
}
