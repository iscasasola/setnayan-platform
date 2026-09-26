/**
 * /signup/you — "How should we call you?" The one card after a new account
 * exists (owner 2026-09-22, prototype `one_door_FINAL_2026-09-22.html`, approved).
 *
 * A first-run SUBSET of Profile & settings › Profile, in the same greige card
 * /signup and /login wear: photo (optional), display name (required), the
 * @account name with a live availability check (only while the account has
 * none), the formal name folded away (the five parts of the 2026-09-21 ruling:
 * self-declared, never verified, for guest lists and invitations), and a phone.
 * Done saves and continues to `next`; Later continues without saving. Every
 * field here also lives on the profile page, where it can be changed later —
 * this card exists so a brand-new person is not sent to Settings to be named.
 *
 * Reached from `signUp` (couples) and from the OAuth callback for a brand-new
 * customer account (`lib/signup-landing.ts`). Vendors skip it: /open-shop step 3
 * asks their name. A signed-out visitor is sent to /signup; a signed-in one who
 * types the URL later simply sees their current values.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { signInDestination } from '@/lib/sign-in-landing';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { PRESENCE_MARKERS } from '@/lib/profile-personal-info-patch';
import {
  FORMAL_NAME_FIELDS,
  FORMAL_NAME_LABELS,
  FORMAL_NAME_PART_MAX,
  type FormalNameField,
} from '@/lib/formal-name';
import { saveYou } from './actions';
import { AccountNameField } from './_components/account-name-field';
import '@/app/_components/home/home-reskin.css';

export const metadata: Metadata = {
  title: 'You',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ next?: string; error?: string }>;

/** A first suggestion for the @name, from the display name — the person edits it. */
function suggestHandle(displayName: string | null, email: string | null): string {
  const base = (displayName?.trim() || email?.split('@')[0] || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base.length >= 3 ? base : '';
}

export default async function YouPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Where Done and Later hand on to: the ONE sign-in rule — a real destination
  // (the event they came from, the onboarding resume) comes back whole; a bare
  // `/` becomes the dashboard, never the front door (audit 2026-09-25 §C).
  const next = signInDestination(safeNext(params.next));
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(next)}`);

  // Own row (RLS). Read exactly the columns the card shows; nothing else.
  const { data: profile } = await supabase
    .from('users')
    .select(
      'display_name, slug, name_prefix, first_name, middle_name, last_name, name_suffix, phone, profile_photo_url, account_type, public_summary_consent_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const me = (profile ?? {}) as {
    display_name?: string | null;
    slug?: string | null;
    phone?: string | null;
    profile_photo_url?: string | null;
    account_type?: string | null;
    public_summary_consent_at?: string | null;
  } & Partial<Record<FormalNameField, string | null>>;

  const currentSlug = me.slug ?? null;
  const storedPhoto = me.profile_photo_url ?? null;
  // A brand-new account has no photo; a returning one may. The try/catch is
  // load-bearing (the presign throws when R2 is unset) — a thumbnail is
  // decoration, the card is the product.
  const photoDisplayMap: Record<string, string> = {};
  if (storedPhoto?.startsWith('r2://')) {
    try {
      const url = await displayUrlForStoredAsset(storedPhoto);
      if (url) photoDisplayMap[storedPhoto] = url;
    } catch {
      /* no thumbnail */
    }
  }
  const displayName = me.display_name ?? '';
  // Couples only, and only while unanswered: a vendor is never asked about a
  // showcase, and a yes already given is not re-asked.
  const asksConsent = me.account_type !== 'vendor' && !me.public_summary_consent_at;
  const formalEmpty = FORMAL_NAME_FIELDS.every((f) => !(me[f] ?? '').trim());

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--m-paper)' }}>
      <div className="home-reskin-ov">
        <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
          <div className="hr-ov-eyebrow">You</div>
          <h1 className="hr-ov-title">How should we call you?</h1>

          {errorMessage ? (
            <p role="alert" className="hr-si-banner hr-si-banner--error">
              {errorMessage}
            </p>
          ) : null}

          <form action={saveYou} className="hr-si-form">
            <input type="hidden" name="next" value={next} />
            {/* The photo control posts nothing when cleared; the marker tells a
                cleared photo from a form without the control. */}
            <input type="hidden" name={PRESENCE_MARKERS.profile_photo_url} value="1" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 96, flexShrink: 0 }}>
                <FileUpload
                  bucket="media"
                  pathPrefix={`profile-photo/${user.id}`}
                  name="profile_photo_url"
                  unsavedHint="press Done below"
                  currentValue={storedPhoto}
                  initialDisplayUrls={photoDisplayMap}
                  maxSizeMB={2}
                  acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                  variant="square"
                  roundPreview
                  help="Optional"
                />
              </div>
              <div className="hr-si-field" style={{ flex: 1 }}>
                <label htmlFor="hr-you-name" className="hr-si-label">
                  Display name
                </label>
                <input
                  id="hr-you-name"
                  name="display_name"
                  defaultValue={displayName}
                  maxLength={128}
                  autoComplete="nickname"
                  placeholder="How you want to appear in the app"
                  required
                  className="hr-si-input"
                />
              </div>
            </div>

            {currentSlug === null ? (
              <AccountNameField suggested={suggestHandle(displayName, user.email ?? null)} />
            ) : (
              <div className="hr-si-field">
                <span className="hr-si-label">Account name</span>
                <p style={{ margin: 0 }}>
                  @{currentSlug}{' '}
                  <span className="hr-si-hint">
                    · change it under Profile &amp; settings › Privacy › Public profile
                  </span>
                </p>
              </div>
            )}

            {/* The formal name, folded — a <details> needs no script and opens
                itself when a part is already filled in. */}
            <details open={!formalEmpty} className="hr-si-field">
              <summary style={{ cursor: 'pointer' }}>
                Full name{' '}
                <span className="hr-si-hint">
                  · for guest lists and invitations · optional
                </span>
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                {FORMAL_NAME_FIELDS.map((f) => (
                  <div
                    key={f}
                    className="hr-si-field"
                    style={f === 'name_prefix' || f === 'name_suffix' ? undefined : { gridColumn: '1 / -1' }}
                  >
                    <label htmlFor={`hr-you-${f}`} className="hr-si-label">
                      {FORMAL_NAME_LABELS[f]}
                    </label>
                    <input
                      id={`hr-you-${f}`}
                      name={f}
                      defaultValue={me[f] ?? ''}
                      maxLength={FORMAL_NAME_PART_MAX}
                      placeholder={f === 'name_prefix' ? 'Mr., Atty.…' : f === 'name_suffix' ? 'Jr., II…' : undefined}
                      autoComplete={
                        f === 'first_name' ? 'given-name' : f === 'last_name' ? 'family-name' : 'off'
                      }
                      className="hr-si-input"
                    />
                  </div>
                ))}
              </div>
            </details>

            <div className="hr-si-field">
              <label htmlFor="hr-you-phone" className="hr-si-label">
                Phone <span style={{ textTransform: 'none', letterSpacing: 0 }}>· optional</span>
              </label>
              <input
                id="hr-you-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={me.phone ?? ''}
                maxLength={32}
                placeholder="+63 917 …"
                className="hr-si-input"
              />
            </div>

            {/* Public Event Summary consent — interim home (couples only, UNTICKED).
                Left /signup on 2026-09-22; moves to event creation, per event, in
                build 2. Field name, value and the 8 RA 10173 guardrails unchanged. */}
            {asksConsent ? (
              <label htmlFor="hr-you-consent" className="hr-si-remember" style={{ alignItems: 'flex-start' }}>
                <input
                  id="hr-you-consent"
                  type="checkbox"
                  name="public_summary_consent"
                  value="yes"
                  style={{ marginTop: 3 }}
                />
                <span>
                  Include my celebrations in Setnayan&rsquo;s Stories showcase. 30 days after each
                  event, its editorial page becomes publicly searchable on setnayan.com/realstories.
                  I can keep any of them private at any time.
                </span>
              </label>
            ) : null}

            <SubmitButton className="hr-si-submit" pendingLabel="Saving…">
              Done
            </SubmitButton>
          </form>

          <div className="hr-si-foot">
            <Link href={next} className="hr-si-link">
              Later
            </Link>{' '}
            · everything here lives under Profile &amp; settings
          </div>
        </div>
      </div>
    </main>
  );
}
