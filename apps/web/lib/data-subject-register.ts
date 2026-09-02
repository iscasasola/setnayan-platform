/**
 * The CATEGORIES OF DATA SUBJECTS register (RA 10173 / NPC registration sheet
 * field B.3 "Categories of data subjects").
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The register used to live in exactly one place: a single prose row in the
 * adopted NPC registration sheet (`NPC_Compliance/03_DPO_Designation_and_NPCRS`
 * line 185) reading
 *
 *     "Customers (couples / organizers) · Guests · Vendors (business
 *      representatives) · (internal: Setnayan team / admins)"
 *
 * — four categories, and the app itself listed none of them. On 2026-07-29 a
 * FIFTH category shipped: `papic_guest_orders` lets a person with NO Setnayan
 * account buy credits at the party. That person types a name, is handed a bearer
 * token, and uploads a screenshot of their bank or GCash confirmation. A row
 * declaring them was drafted the next day (`ROPA_Drafted_Rows_2026-07-30.md`
 * § 1, "Row 21a") and was never folded into any register — so the written
 * record named four kinds of person while the code collected from five.
 *
 * The fix is not "add the sentence once". It is to make the register DATA that
 * a test can hold against the schema, and to make that same data the thing the
 * regulator-facing screen renders — so there is no second list to drift.
 *
 * Two consumers, deliberately:
 *   1. `app/admin/compliance/data-sheet/page.tsx` renders it as field B.3.
 *   2. `lib/data-subject-register.test.ts` checks that no category can be
 *      dropped, that every identity anchor is a REAL table.column in
 *      `supabase/migrations`, that the data sheet actually renders it, and that
 *      no NEW account-less person-bearing table appears unclassified.
 *
 * ── HOUSE RULES OBSERVED ────────────────────────────────────────────────────
 * • NO INVENTED RETENTION. Each entry states only what the code enforces, with
 *   the enforcing module named. Where no automatic clock exists, it says so and
 *   `disposalDateSettled` is `false` — a flagged gap, never a guessed number.
 *   This is a regulator-facing document; a plausible-sounding number here is
 *   worse than an admitted blank.
 * • NO `server-only` / `next/*` IMPORT may enter this module — the guard runs
 *   under tsx, which cannot import them.
 */

export type DataSubjectCategoryKey =
  | 'customer'
  | 'vendor'
  | 'guest'
  | 'guest_buyer'
  | 'internal_staff';

export type DataSubjectCategory = {
  /** Short label as it should read on the NPC sheet. */
  label: string;
  /** Does this person hold a Setnayan account? Drives the "who can even ask us" question. */
  holdsAccount: boolean;
  /**
   * `table.column` anchors where this person is actually recorded. Verified
   * against the migration corpus by the guard, so a rename cannot leave the
   * register describing storage that no longer exists.
   */
  identityAnchors: readonly string[];
  /** Categories of personal data actually collected from this person. */
  personalData: readonly string[];
  /** Why we hold it. */
  purpose: string;
  /** What the CODE enforces. Name the module. Never a wish. */
  retention: string;
  /** True only when a definite disposal date exists in code. Otherwise flagged. */
  disposalDateSettled: boolean;
};

/**
 * The register. `Record<DataSubjectCategoryKey, …>` is exhaustive on purpose:
 * a new key will not typecheck until it is described here.
 */
export const DATA_SUBJECT_REGISTER: Record<DataSubjectCategoryKey, DataSubjectCategory> = {
  customer: {
    label: 'Customers — couples and event organizers',
    holdsAccount: true,
    identityAnchors: ['users.display_name', 'users.email'],
    personalData: [
      'name, email and the profile they fill in',
      'their event: names, date, venue, guest list, schedule, budget and paperwork',
      'payment records — reference code, amount and the payment screenshot they upload',
      'photos and video captured for their event',
    ],
    purpose:
      'Run the event the customer is planning: the account, the event page, the guest list, the suppliers they book, and the money they pay Setnayan for services.',
    retention:
      'No automatic clock on the account. Chat is purged at 5 years (lib/retention-sweep.ts), except where the event carries a payment record — those events are held under the 10-year BIR books-of-account floor. Photos: the full-resolution original is replaced by a compressed copy 6 months from first capture, never sooner than 3 months after the day the event ends — its end date where the celebration spans several days, else its start date (lib/papic-fullres-drop.ts); the photo itself is never deleted. Everything else is cleared on an erasure request (lib/erasure/purge.ts).',
    disposalDateSettled: false,
  },

  vendor: {
    label: 'Vendors — the business representative behind a supplier profile',
    holdsAccount: true,
    identityAnchors: ['users.display_name', 'users.email'],
    personalData: [
      'name, email and the business profile they publish',
      'business identifiers — TIN, registered address, DTI/SEC papers',
      'government ID and verification documents, held in a private bucket',
      'subscription and booking-fee payment records',
    ],
    purpose:
      'Let a supplier run a public profile, be verified, talk to couples, and be billed for their plan.',
    retention:
      'No automatic clock on the account itself. The raw identity uploads DO have one: government ID, live selfie, bank proof and portfolio samples are deleted 90 days after the approve/reject decision (lib/vendor-identity-retention.ts). DTI / BIR 2303 / Mayor’s Permit and the decision record are retained 7 years (BIR 235 + AMLC). Whatever remains — profile fields and any document still held — is scrubbed on an erasure request (lib/erasure/coverage.ts · VENDOR_VERIFICATION_DOC_SCRUB, VENDOR_PROFILE_PII_SCRUB). Billing records sit under the same 10-year BIR floor as any other payment.',
    disposalDateSettled: false,
  },

  guest: {
    label: 'Guests invited to an event',
    holdsAccount: false,
    identityAnchors: ['guests.first_name', 'guests.last_name', 'guests.display_name'],
    personalData: [
      'name and, where the couple enters it, contact details',
      'RSVP answers, seat and table assignment, dietary notes',
      'photos and video they appear in, and any tags on them',
      'a face vector, only where the guest gave biometric consent and affirmed 18+',
      'anything they write themselves — messages on a photo, a public column',
    ],
    purpose:
      'Deliver the invitation, the seating, the day-of experience, and the photos that belong to them.',
    retention:
      'No automatic clock on the guest record — it is deleted with the event or on request. Media follows the same 6-month full-resolution / never-deleted-photo rule as the customer (lib/papic-fullres-drop.ts). Face data DOES have a clock: the vector, the enrollment and the source selfie behind it are deleted 3 months after the day the event ends (lib/face-data-retention.ts), and sooner on a revocation or erasure request. Deleting it removes no photo and no tag.',
    disposalDateSettled: false,
  },

  /**
   * FOLDED IN 2026-08-09 from the row drafted 2026-07-30 (ROPA_Drafted_Rows
   * § 1, "Row 21a — sub-note on guest-purchased shots"), which had sat
   * undeclared since the feature shipped 2026-07-29.
   *
   * Everything below is read off the shipped code, not off the draft:
   *   · supabase/migrations/20271019639608_papic_guest_purchase_orders.sql
   *     — payer_name ("Name for your receipt", optional free text), access_token
   *       (>= 24 chars, one order), the seat/guest owner axis.
   *   · app/papic/buy/actions.ts — the proof upload, stored at
   *     `payments/<orderId>/<uuid>-guest-proof.<ext>`.
   *   · app/admin/payments/actions.ts:877 — NO email is collected: the receipt
   *     is issued to the placeholder `unknown@setnayan.com` and the typed name.
   */
  guest_buyer: {
    label: 'Guests who buy credits without a Setnayan account',
    holdsAccount: false,
    identityAnchors: [
      'papic_guest_orders.payer_name',
      'papic_guest_orders.access_token',
      'papic_guest_orders.seat_id',
      'papic_guest_orders.guest_id',
    ],
    personalData: [
      'a name they type themselves — optional, "Name for your receipt", never checked against anyone',
      'a bearer link that acts as their key to their own order, and to nothing else',
      'the screenshot of their bank or GCash confirmation, which is free-form and may show account names or numbers',
      'the order itself — what they bought, the amount, the reference code and the times',
      'which camera seat or guest QR they were holding when they bought',
    ],
    purpose:
      'Let someone standing at the party top up the shared shot pool or reload the camera in their hand, and let an admin match their payment to the right order before any shots are granted.',
    retention:
      'Split, and not in the direction the money trail suggests. The buyer record itself is DELETED WITH THE EVENT: papic_guest_orders.event_id is ON DELETE CASCADE (migration 20271019639608), and an admin deleting an event is a hard delete (app/admin/events/actions.ts · deleteEvent), so one admin pressing Delete removes that row and takes the typed name (payer_name) and the access link with it — no notice, no sweep, no schedule. What survives is the payment trail, because orders.event_id is ON DELETE SET NULL: the order, the payment row and the uploaded screenshot (payments.screenshot_url, plus the object itself in R2, which nothing deletes) stay, with the event link nulled. The typed NAME survives only where the payment had already been approved — approval copies it to receipts.issued_to_name (app/admin/payments/actions.ts), and receipts hang off the order, not the event. No sweep touches any of it: the only retention sweep in the app (chat, 5 years — lib/retention-sweep.ts) expressly skips any event carrying an order, on the 10-year BIR books-of-account floor. Erasing the GUEST record removes none of it either — papic_guest_orders.guest_id is ON DELETE SET NULL. The shots they buy follow the ordinary Papic media rule (lib/papic-fullres-drop.ts).',
    disposalDateSettled: false,
  },

  internal_staff: {
    label: 'Setnayan team — internal and admin accounts',
    holdsAccount: true,
    identityAnchors: ['users.is_internal', 'users.is_team_member'],
    personalData: [
      'name and email',
      'the audit trail of the admin actions they take',
    ],
    purpose: 'Run the platform: verification, payment reconciliation, moderation and support.',
    retention:
      'No automatic clock. Audit rows are deliberately kept — they are the record of who decided what.',
    disposalDateSettled: false,
  },
};

/** Display order for the NPC sheet — accounts first, then the people they bring. */
export const DATA_SUBJECT_REGISTER_ORDER: readonly DataSubjectCategoryKey[] = [
  'customer',
  'vendor',
  'guest',
  'guest_buyer',
  'internal_staff',
];

/**
 * The LOCKED minimum. A category may be added; none of these may quietly leave.
 * Four of them are the categories the adopted NPC registration sheet already
 * carries; `guest_buyer` is the one the code shipped and the paperwork missed.
 * Removing a category is a DPO decision, so it has to be made here, in a diff.
 */
export const REQUIRED_DATA_SUBJECT_CATEGORIES: readonly DataSubjectCategoryKey[] = [
  'customer',
  'vendor',
  'guest',
  'guest_buyer',
  'internal_staff',
];

/**
 * Tables that carry a free-text NAME column. The guard scans the migration
 * corpus for exactly that shape; each hit must be accounted for here or by a
 * register entry's `identityAnchors`.
 *
 * These are the ones whose "name" is NOT a person.
 *
 * ⚠ THE SCAN USED TO SKIP ANY TABLE WITH A FOREIGN KEY TO `public.users`, on the
 * theory that such a table describes an account holder and the account holder is
 * already a declared category. That theory hid the single biggest person table on
 * the platform: `public.people` carries `claimed_by_user_id` and
 * `created_by_user_id`, both NULLABLE, and its own comment says most Persons stay
 * unclaimed — "a guest, a relative, a lola who never signs up". An OPTIONAL link
 * to an account is not an account. The skip is gone. Measured before removing it,
 * it hid exactly FIVE tables: `users` (already anchored by the customer, vendor
 * and internal entries), `api_keys`, `events` and `setnayan_pay_methods` (now
 * declared below), and `people` (now in UNCLASSIFIED_PERSON_TABLES).
 */
export const NAME_COLUMNS_THAT_ARE_NOT_PEOPLE: Readonly<Record<string, string>> = {
  api_keys: 'The label an integration is given ("Zapier prod"), not a person.',
  communities: 'The name of a Samahan community, not of a person.',
  events:
    'The title of an event ("Ice & Claire\'s Wedding"). It can contain the customers\' names, but the customer is already a declared category and the event record is listed among their personal data — the event is not a separate data subject.',
  event_clusters:
    'The name one person gives a GROUP of their own celebrations — "Our year", "The Cruz wedding" (item 7 phase 7a, migration 20271189765490). Exactly the settled line already drawn for `events` above and `households` below: it can contain the owner\'s own name, but the owner is a declared category, the row is readable by nobody else, and it is exported to them as `years_you_grouped`. A grouping is not a separate data subject. ⚠ It names no THIRD party — the celebrations it groups are joined by uuid, and each carries its own subjects.',
  households: 'A household label the couple types ("The Cruz Family") — a grouping, not an individual.',
  moodboard_theme_templates:
    'The display name of a curated admin-authored starter theme ("Rustic Filipiniana Heritage"), not a person. Admin content — no couple/customer row.',
  panood_screens: 'The name of a livestream screen/output, not of a person.',
  patiktok_music_tracks: 'A music track title.',
  service_catalog: 'The display name of a purchasable service.',
  setnayan_pay_methods: 'The display name of a payment rail ("GCash"), not a person.',
  supplier_vendor_skus: 'The display name of a supplier SKU.',
  vendor_event_sets: 'The name of a vendor-authored set of event offerings.',
  venue_directory: 'The name of a venue (a place).',
  wedding_destinations: 'The name of a destination (a place).',
};

/**
 * PEOPLE the app can record who are NOT yet assigned a register category. This
 * is a RATCHET, not a clean bill of health: the guard asserts it never GROWS, so
 * a new person-bearing table cannot land unnoticed — but every name on it is an
 * open question for the DPO, not a settled exclusion.
 *
 * ⚠ Do not add to this list to make CI green. Adding a row here is a statement
 * that a real person's data is stored with no declared category, which is the
 * exact defect this file was written to end.
 */
export const UNCLASSIFIED_PERSON_TABLES: Readonly<Record<string, string>> = {
  people:
    'The durable Person node (migration 20270513460125) and the largest person store on the platform: display_name, first_name, last_name, email, phone, profile photo and birth_date. The table\'s own comment says a Person exists with or without an account and that most stay unclaimed — "a guest, a relative, a lola who never signs up" — so this is a named third party who may never touch the app and whose record does not end when any event does. It was invisible to the scan until 2026-08-09 because its OPTIONAL claimed_by_user_id / created_by_user_id links made it look like an account holder. DPO: an unclaimed Person is not obviously any of the five categories; it needs its own, and birth_date makes the minors question live before Phase-2 connections ship.',
  couple_waitlist_signups:
    'A prospective customer who joined the pre-launch waitlist: full name + email, submitted from the public form before any account exists. Not a customer yet, and not covered by any of the five categories. DPO: declare, or fold into "customers".',
  dependents:
    'A guardian-held person — a child under 18 or an elder — whose birthdate, sex and religion a user stores. The most sensitive record on the platform and counsel-gated: the table exists but every write is held behind a default-OFF flag, so it is empty in production. DPO: this needs its own category and almost certainly its own DPIA before the flag is ever flipped.',
  event_sponsors:
    'A principal or secondary sponsor (ninong / ninang) named by the couple: full name, and the role they carry at the ceremony. A real named third party who never touches the app. DPO: likely folds into "guests", but it has never been said so in writing.',
};
