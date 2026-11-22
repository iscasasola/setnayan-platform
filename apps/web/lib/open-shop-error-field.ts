/**
 * open-shop-error-field.ts — WHICH BOX A REFUSAL BELONGS UNDER (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN
 * APPROVED"; prototype `prototypes/open_shop_redesign_2026-11-06/`, "Every error under its box").
 *
 * The door used to draw every refusal — the browser's and the server's `?error=&step=` redirect alike — as ONE
 * banner at the top of the card, far from the box it was about. Now each sentence sits in its own box's line
 * (`aria-describedby`), so this pure map is the one place that says which box owns which sentence. Pure, so a test
 * can execute it against every sentence the server can send (`open-shop-error-field.test.ts`).
 *
 * `submit` is the honest leftover: a refusal no box owns (a database error, "We could not create your account just
 * now") — drawn right above the button that made it, never at the top of the screen.
 */
import { OPEN_SHOP_ERRORS, OPEN_SHOP_PHONE_BOX_ERROR } from '@/lib/open-shop-validation';
import { OPEN_SHOP_ACCOUNT_ERRORS } from '@/lib/open-shop-account';
import { TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';

export type OpenShopField =
  | 'shop_name'
  | 'service'
  | 'events'
  | 'extras'
  | 'location'
  | 'contact_name'
  | 'contact_phone'
  | 'contact_email'
  | 'password'
  | 'terms'
  | 'way'
  | 'submit';

const OWNER: ReadonlyArray<readonly [string, OpenShopField]> = [
  [OPEN_SHOP_ERRORS.shopName, 'shop_name'],
  [OPEN_SHOP_ERRORS.logo, 'shop_name'],
  [OPEN_SHOP_ERRORS.slugShape, 'shop_name'],
  [OPEN_SHOP_ERRORS.slugTaken, 'shop_name'],
  [OPEN_SHOP_ERRORS.service, 'service'],
  [OPEN_SHOP_ERRORS.events, 'events'],
  [OPEN_SHOP_ERRORS.extraEvents, 'extras'],
  [OPEN_SHOP_ERRORS.locationPin, 'location'],
  [OPEN_SHOP_ERRORS.locationConfirm, 'location'],
  [OPEN_SHOP_ERRORS.locationCity, 'location'],
  [OPEN_SHOP_ERRORS.contactName, 'contact_name'],
  [OPEN_SHOP_ERRORS.contactPhone, 'contact_phone'],
  [OPEN_SHOP_ERRORS.contactPhoneNotPh, 'contact_phone'],
  [OPEN_SHOP_PHONE_BOX_ERROR, 'contact_phone'],
  [OPEN_SHOP_ERRORS.contactEmail, 'contact_email'],
  [OPEN_SHOP_ACCOUNT_ERRORS.blacklisted, 'contact_email'],
  [OPEN_SHOP_ACCOUNT_ERRORS.emailTaken, 'contact_email'],
  [OPEN_SHOP_ACCOUNT_ERRORS.password, 'password'],
  [OPEN_SHOP_ACCOUNT_ERRORS.passwordLeaked, 'password'],
  [TERMS_REQUIRED_MESSAGE, 'terms'],
  [OPEN_SHOP_ACCOUNT_ERRORS.way, 'way'],
];

/** The box a refusal belongs under; `submit` (above the button) when no box owns it. */
export function openShopErrorField(error: string | null | undefined): OpenShopField | null {
  if (!error) return null;
  for (const [sentence, field] of OWNER) if (sentence === error) return field;
  return 'submit';
}

/**
 * What the box SAYS for a refusal. Identical to the refusal, with one exception the owner ruled: under the fixed +63
 * box the shared `09XX` sentence reads as the door's own "Use 9XX XXX YYYY, …" (the +63 is already on screen).
 */
export function openShopErrorWords(error: string): string {
  return error === OPEN_SHOP_ERRORS.contactPhoneNotPh ? OPEN_SHOP_PHONE_BOX_ERROR : error;
}

/** The step that owns a box — the redirect's `?step=` must agree with it (`four-steps.test.ts`). */
export const OPEN_SHOP_FIELD_STEP: Readonly<Record<Exclude<OpenShopField, 'submit'>, 1 | 2 | 3 | 4 | 5>> = {
  // 🚪 The supplier onboarding's five screens (owner 19 Nov, `lib/supplier-onboarding.ts` ONBOARDING_STEP):
  // 1 · Open your shop — the name and the main service on one screen
  shop_name: 1,
  service: 1,
  // 3 · Check your shop — each of these is a sheet over the list (`FIELD_FACT` names which)
  events: 3,
  extras: 3,
  location: 3,
  contact_name: 3,
  contact_phone: 3,
  // 2 · Create your account — SECOND, never last
  contact_email: 2,
  password: 2,
  terms: 2,
  way: 2,
};

/**
 * W1-B3 (walk 16 Nov 2026) — the step a refusal is DRAWN on: the step that owns its box, so the sentence is never about
 * a screen the supplier cannot see; the server's `?step=` only for a sentence no box owns (`submit`), and step 1 when
 * neither says.
 */
export function refusalStep(field: OpenShopField | null, fromServer: number | undefined): 1 | 2 | 3 | 4 | 5 {
  if (field && field !== 'submit') return OPEN_SHOP_FIELD_STEP[field];
  return fromServer && fromServer >= 1 && fromServer <= 5 ? (fromServer as 1 | 2 | 3 | 4 | 5) : 1;
}
