/**
 * /dev/open-shop-lab — "Open your shop" on FIXTURES: no sign-in, no database. DEV-ONLY: production builds 404 it,
 * the same kill-switch as `/dev/onboarding-lab`.
 *
 * Mounts the REAL wizard (`OpenShopWizard`) and the REAL "Add your logo" screen, so the owner's 2026-11-06 gate-walk
 * fixes can be walked and photographed with a dummy env. The service tree is built from the in-code taxonomy
 * (`TAXONOMY_MAP`) — the same shape `getOpenShopServiceTree` hands the page. Never press "Open my shop" or "Save logo"
 * here: both call the real server actions.
 *
 *   ?step=1..5     which step is shown first
 *   ?guest=0       signed in (the account half of step 5 hidden); default signed out
 *   ?taken=1       step 5 after a "this email already has an account" refusal (A8)
 *   ?as=coordinator  the For Coordinators door (step 2 opens on the coordination services)
 *   ?error=<sentence>  a server refusal, drawn under the box that owns it
 *   ?check_inbox=<email>  the check-your-email state (A1)
 *   ?screen=logo   the "Add your logo" screen (A2; its autosave answers from a stand-in that writes nothing) · &framed=1 with a public image already in, so the align + zoom
 *                  control shows (an upload needs R2, which a dummy env does not have)
 */
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { OpenShopWizard } from '@/app/open-shop/_components/open-shop-wizard';
import { ClaimDoor } from '@/app/open-shop/_components/claim-door';
import type { ClaimDoorRecord } from '@/lib/claim-door';
import type { PickerParentView } from '@/app/open-shop/_components/service-picker';
import type { SpecialtyField } from '@/app/open-shop/_components/service-cards';
import { AddYourLogo } from '@/app/open-shop/logo/_components/add-your-logo';
import { bookingFeeJoinDisclosure } from '@/lib/booking-fee-disclosure';
import { OPEN_SHOP_ACCOUNT_ERRORS } from '@/lib/open-shop-account';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  WEDDING_TILE_LABEL,
  type WeddingFolder,
  type WeddingTile,
} from '@/lib/taxonomy';
import { categoryLadder } from '@/lib/vendor-tier-caps';
import { DEFAULT_LOGO_FRAME } from '@/lib/open-shop-logo';

export const dynamic = 'force-dynamic';

/**
 * A picture the app already serves — absolute, because a legacy http(s) logo value is its own display URL. The SAME
 * picture prototype v21's logo step frames (`ev/gala_night.jpg`), so a side-by-side compares like with like. Never a
 * screenshot of another screen: the Maker shot this used to be carried its own dashed guide box, which read as an
 * overlay drawn on the circle (controller review, 7 Nov).
 */
const LAB_LOGO_PATH = '/event-types/gala_night.webp';

const labelFor = (key: string) =>
  key
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

/**
 * Lab-only fixtures for v16 (never shipped — production reads `canonical_service_schemas`, the taxonomy's
 * `allowed_event_types` and the categories' photos). Words and event lists are the PROTOTYPE's (`FILTERS`,
 * `SVC_EVENTS`), so the lab's frames read like the contract's.
 */
const LAB_TILE_PHOTOS = new Set(['dance_floor', 'date_specialist', 'digital_services', 'editorial', 'fireworks', 'host_mc', 'led_wall', 'lights_sound', 'orchestra', 'trophies_awards', 'wellness_fitness']);
const LAB_ALLOWED: Record<string, string[]> = {
  reception_venue: ['anniversary', 'birthday', 'celebration', 'christening', 'corporate', 'debut', 'gala_night', 'gender_reveal', 'graduation', 'reunion', 'wedding'],
  catering: ['anniversary', 'birthday', 'celebration', 'christening', 'concert', 'corporate', 'debut', 'gala_night', 'gender_reveal', 'graduation', 'grand_opening', 'open_house', 'reunion', 'tournament', 'wake', 'wedding'],
  drone: ['anniversary', 'birthday', 'celebration', 'concert', 'corporate', 'debut', 'gala_night', 'graduation', 'grand_opening', 'open_house', 'reunion', 'tournament', 'travel', 'wedding'],
  tea_ceremony_master: ['wedding'],
  hearse_funeral_transport: ['wake'],
};
const chips = (key: string, label: string, values: string[]): SpecialtyField => ({
  key,
  label,
  options: values.map((v) => ({ value: v, label: v })),
  single: false,
});
const LAB_SPECIALTIES: Record<string, SpecialtyField[]> = {
  photography: [
    chips('shoot', 'Shoot', ['Boudoir', 'Engagement', 'Day-2 / family', 'Pre-nup', 'Studio portrait', 'Wedding day', 'Graduation / toga', 'Sports & action', 'Maternity / newborn']),
    chips('deliverable', 'Deliverable', ['Album', 'Save-the-date']),
    chips('look', 'Look', ['Photojournalistic', 'Classic', 'Editorial', 'Fine-art / film']),
  ],
  videography: [
    chips('deliverable', 'Deliverable', ['Highlight reel', 'Same-day edit', 'Save-the-date', 'Full film', 'Livestream', 'Tribute / memorial video']),
    chips('look', 'Look', ['Cinematic', 'Photojournalistic', 'Fine-art / film']),
  ],
  reception_venue: [
    chips('type', 'Type', ['Events place', 'Function hall', 'Garden', 'Hotel ballroom', 'Resort / destination', 'Heritage', 'Restaurant', 'Beach']),
    chips('also', 'Also', ['In-house catering', 'Outside caterers allowed', 'Overnight rooms']),
  ],
  catering: [
    chips('service_style', 'Service style', ['Plated', 'Buffet', 'Family-style', 'Stations']),
    chips('cuisine', 'Cuisine', ['Chinese lauriat', 'Filipino', 'Asian', 'International', 'Spanish', 'Italian', 'Fusion']),
  ],
};

function fixtureTree(): PickerParentView[] {
  const byFolder = new Map<
    string,
    Map<string, { canonicalService: string; label: string; tileId: string; allowedEventTypes: string[] | null }[]>
  >();
  for (const [key, meta] of Object.entries(TAXONOMY_MAP)) {
    const m = meta as { folder: string; tile: string };
    if (key.startsWith('setnayan_')) continue;
    const tiles = byFolder.get(m.folder) ?? new Map();
    const leaves = tiles.get(m.tile) ?? [];
    leaves.push({ canonicalService: key, label: labelFor(key), tileId: m.tile, allowedEventTypes: LAB_ALLOWED[key] ?? null });
    tiles.set(m.tile, leaves);
    byFolder.set(m.folder, tiles);
  }
  return WEDDING_FOLDER_ORDER.filter((f) => byFolder.has(f)).map((f) => ({
    folderId: f,
    label: WEDDING_FOLDER_LABEL[f as WeddingFolder],
    branches: [...byFolder.get(f)!.entries()].map(([tile, leaves]) => ({
      tileId: tile,
      photoUrl: LAB_TILE_PHOTOS.has(tile) ? `/taxonomy/tiles/${tile}.webp` : null,
      label: WEDDING_TILE_LABEL[tile as WeddingTile] ?? labelFor(tile),
      leaves: leaves.sort((a, b) => a.label.localeCompare(b.label)),
    })),
  }));
}

/** The prototype's roster (19 types; the last three have no photo yet, so they wear the placeholder gradient). */
const EVENTS = [
  { key: 'wedding', label: 'Wedding', emoji: '💍' },
  { key: 'debut', label: 'Debut', emoji: '👑' },
  { key: 'gender_reveal', label: 'Gender Reveal', emoji: '🎈' },
  { key: 'birthday', label: 'Birthday', emoji: '🎂' },
  { key: 'celebration', label: 'Celebration', emoji: '🥂' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'corporate', label: 'Corporate', emoji: '🏢' },
  { key: 'tournament', label: 'Tournament', emoji: '🏆' },
  { key: 'christening', label: 'Christening', emoji: '🕯️' },
  { key: 'anniversary', label: 'Anniversary', emoji: '💞' },
  { key: 'graduation', label: 'Graduation', emoji: '🎓' },
  { key: 'reunion', label: 'Reunion', emoji: '🤝' },
  { key: 'gala_night', label: 'Gala Night', emoji: '🌟' },
  { key: 'date', label: 'Date', emoji: '💕' },
  { key: 'hangout', label: 'Hangout', emoji: '🍿' },
  { key: 'wake', label: 'Wake', emoji: '🕊️' },
  { key: 'concert', label: 'Concert', emoji: '🎤' },
  { key: 'open_house', label: 'Open house', emoji: '🏡' },
  { key: 'grand_opening', label: 'Grand opening', emoji: '🎀' },
];

/** The lab's stand-in for the logo autosave: writes NOTHING and answers ok, so "Logo saved" can be seen on a dummy env. */
async function labSaveLogo(): Promise<{ ok: true }> {
  'use server';
  if (process.env.NODE_ENV === 'production') throw new Error('open-shop-lab: not in production');
  return { ok: true };
}

/** The prototype v21 record (`REC`, `COUPLE`) — the couple's sample event, the prototype's photographer. */
const LAB_CLAIM_RECORD: ClaimDoorRecord = {
  token: 'x7k2qp-sample',
  inviterName: 'Maria & Jose',
  hostNoun: 'couple',
  eventWord: 'wedding',
  eventType: 'wedding',
  datePhrase: 'on 12 December 2026',
  business: 'Banawe Florals',
  contactPerson: 'Ana Reyes',
  contactPhone: '+639178888889',
  services: [
    { category: 'photographer', tileId: 'photo_video', label: 'Photographer', price: 85000, inclusions: ['Full-day coverage', 'Two photographers', 'Same-day edit video', 'Online gallery'] },
    { category: 'photo_booth', tileId: 'photo_booth', label: 'Photo booth', price: null, inclusions: [] },
  ],
  price: 85000,
  inclusions: ['Full-day coverage', 'Two photographers', 'Same-day edit video', 'Online gallery'],
  plan: [
    { label: 'Reservation', due: null, amount: 25500 },
    { label: 'Balance', due: null, amount: 59500 },
  ],
};

export default async function OpenShopLabPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; guest?: string; taken?: string; check_inbox?: string; screen?: string; framed?: string; as?: string; error?: string; signed?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const LAB_LOGO = `http://${host}${LAB_LOGO_PATH}`;
  if (q.screen === 'logo') {
    return (
      <AddYourLogo
        vendorProfileId="lab-shop"
        shopName="Banawe Florals"
        storedLogoRef={q.framed === '1' ? LAB_LOGO : null}
        displayUrl={q.framed === '1' ? LAB_LOGO : null}
        frame={q.framed === '1' ? { x: 70, y: 35, zoom: 140 } : DEFAULT_LOGO_FRAME}
        saveAction={labSaveLogo}
      />
    );
  }
  if (q.screen === 'claim') {
    // 🔗 The claim door on the PROTOTYPE's record (v21 `REC` · `COUPLE`) — never a real token. `?signed=1` = signed in.
    return (
      <ClaimDoor
        record={LAB_CLAIM_RECORD}
        tree={fixtureTree()}
        specialties={LAB_SPECIALTIES}
        signedInAs={q.signed === '1' ? 'ana@banaweflorals.ph' : null}
        oauth={{ show: true, desktop: false, native: false }}
        signInHref="/login?next=%2Fopen-shop%3Fclaim%3Dx7k2qp-sample%26step%3Daccount&as=vendor"
      />
    );
  }
  const step = (['1', '2', '3', '4', '5'].includes(q.step ?? '') ? Number(q.step) : 1) as 1 | 2 | 3 | 4 | 5;
  const guest = q.guest !== '0';
  return (
    <OpenShopWizard
      mode="create"
      // No rate is typed in a lab: the disclosure's own "could not load the rate" wording.
      feeNotice={bookingFeeJoinDisclosure(null)}
      serviceTree={fixtureTree()}
      eventTypeOptions={EVENTS}
      defaults={{
        shopName: 'Banawe Florals',
        logoUrl: '',
        primaryService: '',
        // Every event type ticked to start (owner 2026-11-06), as the real page hands it in.
        eventTypes: EVENTS.map((e) => e.key),
        locationCity: '',
        hqAddress: '',
        contactName: 'Ana Reyes',
        contactPosition: '',
        contactPhone: '',
        contactEmail: 'ana@banaweflorals.ph',
      }}
      guest={guest}
      coordinator={q.as === 'coordinator'}
      oauth={{ show: true, desktop: false, native: false }}
      planCategories={categoryLadder()}
      specialties={LAB_SPECIALTIES}
      emailTaken={q.taken === '1'}
      error={q.taken === '1' ? OPEN_SHOP_ACCOUNT_ERRORS.emailTaken : (q.error ?? undefined)}
      sentTo={q.check_inbox ?? null}
      initialStep={step}
    />
  );
}
