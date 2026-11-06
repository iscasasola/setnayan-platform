/**
 * /dev/open-shop-lab — "Open your shop" on FIXTURES: no sign-in, no database. DEV-ONLY: production builds 404 it,
 * the same kill-switch as `/dev/onboarding-lab`.
 *
 * Mounts the REAL wizard (`OpenShopWizard`) and the REAL "Add your logo" screen, so the owner's 2026-11-06 gate-walk
 * fixes can be walked and photographed with a dummy env. The service tree is built from the in-code taxonomy
 * (`TAXONOMY_MAP`) — the same shape `getOpenShopServiceTree` hands the page. Never press "Open my shop" or "Save logo"
 * here: both call the real server actions.
 *
 *   ?step=1..4     which step is shown first
 *   ?guest=0       signed in (the account half of step 4 hidden); default signed out
 *   ?taken=1       step 4 after a "this email already has an account" refusal (A8)
 *   ?as=coordinator  the For Coordinators door (step 2 opens on the coordination services)
 *   ?error=<sentence>  a server refusal, drawn under the box that owns it
 *   ?check_inbox=<email>  the check-your-email state (A1)
 *   ?screen=logo   the "Add your logo" screen (A2) · &framed=1 with a public image already in, so the align + zoom
 *                  control shows (an upload needs R2, which a dummy env does not have)
 */
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { OpenShopWizard } from '@/app/open-shop/_components/open-shop-wizard';
import type { PickerParentView } from '@/app/open-shop/_components/service-picker';
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

/** A picture the app already serves — absolute, because a legacy http(s) logo value is its own display URL. */
const LAB_LOGO_PATH = '/feature-shots/logo-maker-0.jpg';

const labelFor = (key: string) =>
  key
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

function fixtureTree(): PickerParentView[] {
  const byFolder = new Map<string, Map<string, { canonicalService: string; label: string; tileId: string }[]>>();
  for (const [key, meta] of Object.entries(TAXONOMY_MAP)) {
    const m = meta as { folder: string; tile: string };
    if (key.startsWith('setnayan_')) continue;
    const tiles = byFolder.get(m.folder) ?? new Map();
    const leaves = tiles.get(m.tile) ?? [];
    leaves.push({ canonicalService: key, label: labelFor(key), tileId: m.tile });
    tiles.set(m.tile, leaves);
    byFolder.set(m.folder, tiles);
  }
  return WEDDING_FOLDER_ORDER.filter((f) => byFolder.has(f)).map((f) => ({
    folderId: f,
    label: WEDDING_FOLDER_LABEL[f as WeddingFolder],
    branches: [...byFolder.get(f)!.entries()].map(([tile, leaves]) => ({
      tileId: tile,
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

export default async function OpenShopLabPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; guest?: string; taken?: string; check_inbox?: string; screen?: string; framed?: string; as?: string; error?: string }>;
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
        frame={q.framed === '1' ? { focal: 3, zoom: 120 } : DEFAULT_LOGO_FRAME}
      />
    );
  }
  const step = (['1', '2', '3', '4'].includes(q.step ?? '') ? Number(q.step) : 1) as 1 | 2 | 3 | 4;
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
      emailTaken={q.taken === '1'}
      error={q.taken === '1' ? OPEN_SHOP_ACCOUNT_ERRORS.emailTaken : (q.error ?? undefined)}
      sentTo={q.check_inbox ?? null}
      initialStep={step}
    />
  );
}
