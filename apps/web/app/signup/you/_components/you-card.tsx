/**
 * YouCard — the "How should we call you?" card itself, drawn from what the
 * page read (`page.tsx` reads the account; this draws it). Split out on
 * 2026-10-21 so `/dev/you-lab` can draw the REAL card on fixtures — the owner
 * asked to SEE the first-photo step ("i noticed some misalignment where they
 * upload their first profile photo … can you show me that step"), and a page
 * that reads its own session cannot be drawn without one.
 *
 * Nothing here reads or writes: `action` is the form's one post — `saveYou` on
 * the page, a do-nothing stand-in in the lab, so a lab press never reaches the
 * database.
 */
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { PRESENCE_MARKERS } from '@/lib/profile-personal-info-patch';
import {
  FORMAL_NAME_FIELDS,
  FORMAL_NAME_LABELS,
  FORMAL_NAME_PART_MAX,
  type FormalNameField,
} from '@/lib/formal-name';
import { PrefixSelect } from '@/app/_components/formal-name-inputs';
import { AccountNameField } from './account-name-field';
import '@/app/_components/home/home-reskin.css';

/** The columns the card shows — exactly what the page selects, nothing else. */
export type YouCardMe = {
  display_name?: string | null;
  slug?: string | null;
  phone?: string | null;
  profile_photo_url?: string | null;
  account_type?: string | null;
  public_summary_consent_at?: string | null;
} & Partial<Record<FormalNameField, string | null>>;

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

export function YouCard({
  action,
  next,
  errorMessage,
  userId,
  email,
  me,
  photoDisplayMap,
}: {
  action: (formData: FormData) => void | Promise<void>;
  next: string;
  errorMessage: string | null;
  userId: string;
  email: string | null;
  me: YouCardMe;
  /** r2Ref → display URL, so a returning account's photo paints on load. */
  photoDisplayMap: Record<string, string>;
}) {
  const currentSlug = me.slug ?? null;
  const storedPhoto = me.profile_photo_url ?? null;
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

          <form action={action} className="hr-si-form">
            <input type="hidden" name="next" value={next} />
            {/* The photo control posts nothing when cleared; the marker tells a
                cleared photo from a form without the control. */}
            <input type="hidden" name={PRESENCE_MARKERS.profile_photo_url} value="1" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 96, flexShrink: 0 }}>
                <FileUpload
                  bucket="media"
                  pathPrefix={`profile-photo/${userId}`}
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
              <AccountNameField suggested={suggestHandle(displayName, email)} />
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
                    {f === 'name_prefix' ? (
                      /* 🪪 The guest side's Prefix dropdown (owner 2026-09-30). */
                      <PrefixSelect id={`hr-you-${f}`} defaultValue={me[f]} className="hr-si-input" />
                    ) : (
                      <input
                        id={`hr-you-${f}`}
                        name={f}
                        defaultValue={me[f] ?? ''}
                        maxLength={FORMAL_NAME_PART_MAX}
                        placeholder={f === 'name_suffix' ? 'Jr., II…' : undefined}
                        autoComplete={
                          f === 'first_name' ? 'given-name' : f === 'last_name' ? 'family-name' : 'off'
                        }
                        className="hr-si-input"
                      />
                    )}
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
