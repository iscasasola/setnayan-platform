/**
 * /dev/you-lab — the first-run "You · How should we call you?" card (`/signup/you`) on fixtures: no
 * sign-in, no database. DEV-ONLY: production builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 2026-10-21: "i noticed some misalignment where they upload their first profile photo. on that
 * page. can you show me that step". This draws the REAL card (`YouCard`, the component the page renders)
 * and, for the supplier's first run, the REAL `/open-shop` wizard on its logo step — so the photo slot can
 * be walked at every phone width without an account.
 *
 *   ?state=new        a brand-new account: no photo, no @name, consent unanswered (default)
 *   ?state=returning  a returning account: photo on file, @name set, formal name filled (folded open)
 *   ?state=long       a brand-new account with a long display name
 *   ?door=open-shop   the supplier first run, step 1 (Shop logo)
 *
 * The photo's live moments (chosen and not saved yet · uploading · refused) are the REAL upload widget
 * driven by a walk that answers `/api/upload` locally — the lab itself sends nothing anywhere. Done posts to
 * a do-nothing stand-in, so a lab press never reaches the database.
 */
import { notFound } from 'next/navigation';
import { YouCard, type YouCardMe } from '@/app/signup/you/_components/you-card';
import { OpenShopWizard } from '@/app/open-shop/_components/open-shop-wizard';

export const dynamic = 'force-dynamic';

const LAB_PHOTO_REF = 'r2://media/profile-photo/lab-user/isabel.avif';
const LAB_PHOTO_URL = '/portraits/isabel-santos.avif';

const STATES: Record<string, { me: YouCardMe; email: string; photos: Record<string, string> }> = {
  new: { me: { display_name: 'Isabel', account_type: 'customer' }, email: 'isabel@example.com', photos: {} },
  long: {
    me: { display_name: 'Maria Isabel Concepcion Dela Cruz-Santos', account_type: 'customer' },
    email: 'maria.isabel.concepcion@example.com',
    photos: {},
  },
  returning: {
    me: {
      display_name: 'Isabel Santos',
      slug: 'isabel-santos',
      phone: '+63 917 555 0142',
      profile_photo_url: LAB_PHOTO_REF,
      account_type: 'customer',
      public_summary_consent_at: '2026-09-30T08:00:00Z',
      name_prefix: 'Ms.',
      first_name: 'Isabel',
      last_name: 'Santos',
    },
    email: 'isabel@example.com',
    photos: { [LAB_PHOTO_REF]: LAB_PHOTO_URL },
  },
};

/** The lab's Done: nothing is saved, nothing is sent — the card simply re-draws. */
async function labDone(): Promise<void> {
  'use server';
}

export default async function YouLabPage({ searchParams }: { searchParams: Promise<{ state?: string; door?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  if (sp.door === 'open-shop') {
    return (
      <main className="min-h-dvh bg-cream text-ink" data-you-lab="open-shop">
        <OpenShopWizard
          mode="create"
          eventTypeOptions={[
            { key: 'wedding', label: 'Wedding', emoji: '💍' },
            { key: 'debut', label: 'Debut', emoji: '👑' },
            { key: 'birthday', label: 'Birthday', emoji: '🎂' },
          ]}
          vendorProfileId={null}
          logoDisplayMap={{}}
          accountName="Isabel Santos"
          defaults={{
            shopName: '',
            logoUrl: '',
            primaryService: '',
            eventTypes: [],
            locationCity: '',
            hqAddress: '',
            contactName: '',
            contactPosition: '',
            contactPhone: '',
            contactEmail: '',
          }}
        />
      </main>
    );
  }

  const key = sp.state && sp.state in STATES ? sp.state : 'new';
  const s = STATES[key]!;
  return (
    <div data-you-lab={key}>
      <YouCard
        action={labDone}
        next="/dashboard"
        errorMessage={null}
        userId="lab-user"
        email={s.email}
        me={s.me}
        photoDisplayMap={s.photos}
      />
    </div>
  );
}
