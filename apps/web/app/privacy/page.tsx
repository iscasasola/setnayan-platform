import Link from 'next/link';
import { Logo } from '@/app/_components/logo';

// GEO Phase G5 (2026-05-28) — canonical URL + enriched description. AI
// engines extract privacy-policy content for "is X RA 10173 compliant"
// queries — the description now names the compliance standard explicitly.
export const metadata = {
  title: 'Privacy policy · Setnayan',
  description:
    'How Setnayan handles personal data under the Philippine Data Privacy Act (RA 10173). Guest data, couple consent, vendor data, BIR receipts, and DPO contact.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy policy · Setnayan',
    description:
      'How Setnayan handles personal data under the Philippine Data Privacy Act (RA 10173).',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-cream">
      <Header />
      <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Privacy policy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How we handle your data
          </h1>
          <p className="text-xs text-ink/55">
            Effective 2026-05-13 · subject to RA 10173 (Philippines Data Privacy Act)
          </p>
        </header>

        <Section title="Data Protection Officer">
          <p>
            Setnayan&rsquo;s Data Protection Officer is reachable at{' '}
            <a href="mailto:dpo@setnayan.com" className="text-terracotta hover:underline">
              dpo@setnayan.com
            </a>
            . Reach the DPO for requests under RA 10173 (access, correction,
            blocking, erasure, complaints, NPC inquiries). We respond within 15
            business days.
          </p>
        </Section>

        <Section title="Regulatory posture">
          <p>
            Setnayan is currently operating in a closed pilot phase
            (approximately 5–20 households). During pilot, the Personal
            Information Controller is the platform owner under personal name
            (DTI Business Name and BIR registration pending; targeted before
            public launch on December 1, 2026). NPC registration will be filed
            under the registered business entity at that time. The DPO function
            during pilot is held by the platform owner directly.
          </p>
          <p className="pt-2">
            Cross-border data transfers — Singapore (Supabase), United States
            (Cloudflare R2 PH-region buckets), United States (Anthropic Console
            for Today&rsquo;s Focus AI), and United States (Persona for vendor
            verification) — are subject to RA 10173 § 21 and the cloud
            provider&rsquo;s adequacy commitments.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>Account info — email, password (hashed), display name, optional phone + profile photo URL</li>
            <li>Event data you create — guest lists, vendor records, budget items, schedule, mood-board palettes</li>
            <li>Messages you send via the in-app chat</li>
            <li>Payment metadata — order amounts, reference codes, channel, your screenshot if you upload one</li>
            <li>Anonymized product analytics — page views, button clicks, funnel events (via PostHog · no personal identifiers · opt-out available in your profile)</li>
            <li>Error reports — uncaught exceptions + their stack traces sent to Sentry so we can fix bugs; no message bodies, payment details, or guest data are included</li>
            <li>Automatic — IP address (truncated to first 3 octets for QR scan events), browser user-agent, timestamps</li>
          </ul>
        </Section>

        <Section title="What we do not collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>Face biometrics or any other biometric data</li>
            <li>Location beyond the city-level information vendors choose to share</li>
            <li>Advertising identifiers, third-party cookies, or cross-site tracking signals</li>
          </ul>
        </Section>

        <Section title="Vendor identity masking">
          <p>
            When you chat with a Setnayan vendor, the vendor sees only your event display
            name and date — never your email or personal name unless you choose to share.
            This is a load-bearing product rule.
          </p>
        </Section>

        <Section title="Public Event Summary (post-event editorial)">
          <p>
            If a host opts in, the event&rsquo;s summary page at{' '}
            <code className="font-mono text-[12px]">setnayan.com/{'{event-slug}'}</code>{' '}
            transitions from invitation and day-of mode into a public editorial
            article 30 days after the event date. The page becomes publicly
            indexable on <code className="font-mono text-[12px]">setnayan.com/weddings</code>{' '}
            and discoverable by search engines.
          </p>
          <p className="pt-2">
            <strong>Eight safeguards apply</strong> under RA 10173 § 16(e) right
            to object:
          </p>
          <ol className="ml-5 list-decimal space-y-1 pt-1">
            <li>
              Onboarding-time consent during signup with explicit T+30d
              disclosure.
            </li>
            <li>
              Phase 4 starts at T+1d in archive mode (public via slug only).
            </li>
            <li>
              Index inclusion auto-activates at T+30d unless the host opts out.
            </li>
            <li>
              Reminder email at T+27d (&ldquo;Your wedding goes public in 3
              days — preview and edit, or keep it private&rdquo;).
            </li>
            <li>
              One-click opt-out from{' '}
              <code className="font-mono text-[12px]">/dashboard/{'{eventId}'}/privacy</code>{' '}
              removes the page from the index immediately.
            </li>
            <li>
              Pseudonymization option (full names, initials only, or pseudonym).
            </li>
            <li>
              Private-always field allowlist — guest list, RSVP data, budget
              figures, vendor chat history, day-of broadcast video, and raw
              photo feed never reach the public Summary.
            </li>
            <li>
              Right to redact any field, photo, vendor credit, or whole page at
              any time.
            </li>
          </ol>
          <p className="pt-2 text-xs text-ink/55">
            Per CLAUDE.md decision-log 2026-05-19 row 426.
          </p>
        </Section>

        <Section title="Your rights (RA 10173)">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Right to access:</strong> download a JSON archive of your data anytime
              from <Link href="/dashboard/profile" className="text-terracotta hover:underline">your profile</Link>.
            </li>
            <li>
              <strong>Right to erasure:</strong> the same profile page has a soft-delete
              action (type DELETE to confirm). Soft-deleted accounts are retained for 30
              days for restoration by you, then become irreversibly deleted.
            </li>
            <li>
              <strong>Right to rectification:</strong> edit your personal info on the
              profile page.
            </li>
            <li>
              <strong>Right to object:</strong> reach us at the help center to opt out of
              specific processing.
            </li>
          </ul>
        </Section>

        <Section title="TikTok integration (Patiktok)">
          <p>
            Couples on the Patiktok Personal tier (₱1,999/day) connect their own
            TikTok account to Setnayan so Patiktok booth compilations can
            auto-post to the couple&rsquo;s handle. Setnayan uses TikTok&rsquo;s
            Login Kit and Content Posting API. The Setnayan tier (₱999/day)
            does not require a couple-side TikTok connection — those
            compilations post to <strong>@SetnayanWeddings</strong>, our
            company-owned handle, using credentials Setnayan manages directly.
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-2">
            <li>
              <strong>Scopes requested.</strong> Only <code className="font-mono text-[12px]">user.info.basic</code>,{' '}
              <code className="font-mono text-[12px]">video.upload</code>, and{' '}
              <code className="font-mono text-[12px]">video.publish</code>. We
              do not request access to your TikTok followers, drafts, messages,
              or analytics.
            </li>
            <li>
              <strong>What we receive from TikTok.</strong> Your TikTok open ID
              (a stable per-app identifier), your union ID (if available),
              your display name / handle, an access token (typically valid 24
              hours), and a refresh token. We do not receive your TikTok
              password.
            </li>
            <li>
              <strong>How we use it.</strong> The access token is read only by
              our render worker, only to post one rendered compilation MP4 per
              booth-day on your behalf, with a caption you can configure. We
              do not browse, download, or modify any other content on your
              TikTok account.
            </li>
            <li>
              <strong>Storage + scope.</strong> Tokens and the open ID are
              stored in <code className="font-mono text-[12px]">patiktok_oauth_grants</code> in our
              Supabase database (Singapore region · encrypted at rest), scoped
              to one specific Setnayan event. They are never shared with
              vendors, other couples, or third parties.
            </li>
            <li>
              <strong>Retention.</strong> Grants are kept until the earlier of
              (a) you revoke them from your profile or from TikTok&rsquo;s app
              settings, (b) you delete your Setnayan account, or (c) 30 days
              after the event ends. Refresh tokens past their expiry are
              purged automatically.
            </li>
            <li>
              <strong>Revoking access.</strong> Two paths, either works
              immediately:
              <ul className="ml-5 mt-1 list-disc space-y-1">
                <li>
                  In Setnayan, open the Patiktok page and click{' '}
                  <em>Disconnect TikTok</em>. We soft-revoke the grant locally.
                </li>
                <li>
                  In TikTok, go to <em>Settings → Privacy → Manage apps and
                  websites</em> and remove Setnayan. We honor the revocation on
                  the next render attempt.
                </li>
              </ul>
            </li>
            <li>
              <strong>Posts on your TikTok account.</strong> Once a compilation
              is posted to your account, the video is owned by you. Delete it
              from TikTok like any other video — Setnayan cannot delete posts
              on your behalf after they go live.
            </li>
          </ul>
        </Section>

        <Section title="YouTube integration (Panood)">
          <p>
            Couples who purchase a Panood SKU (live wedding broadcast) connect
            their own YouTube channel to Setnayan so the live ceremony can
            stream to their channel and embed on the event landing page. The
            connection uses Google&rsquo;s standard OAuth sign-in. You can
            revoke it at any time from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-terracotta hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>
            .
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-2">
            <li>
              <strong>Scopes requested.</strong> Only{' '}
              <code className="font-mono text-[12px]">.../auth/youtube</code>{' '}
              (create and manage live broadcasts on your channel),{' '}
              <code className="font-mono text-[12px]">.../auth/youtube.upload</code>{' '}
              (upload videos · used by V1.5+ AI Edited Highlight),{' '}
              <code className="font-mono text-[12px]">.../auth/userinfo.email</code>, and{' '}
              <code className="font-mono text-[12px]">.../auth/userinfo.profile</code>.
              We never request read access to your subscribers, comments, view
              history, watch history, search history, or any YouTube data
              unrelated to the broadcast we created for your event.
            </li>
            <li>
              <strong>What we receive from Google.</strong> A refresh token
              tied to your YouTube channel, your channel name and ID, an
              access token (typically valid 1 hour), and the broadcast IDs we
              create on your behalf. We do not receive your Google password.
            </li>
            <li>
              <strong>How we use it.</strong> The refresh token is read by our
              broadcaster orchestration service only during your event window,
              to (a) create the YouTube live broadcast for your event, (b)
              push the selected camera feed to YouTube&rsquo;s ingest endpoint
              while you are live, and (c) embed the resulting public broadcast
              in your Setnayan event landing page. We do not browse, modify,
              or delete any other content on your YouTube channel.
            </li>
            <li>
              <strong>Storage + scope.</strong> Tokens and the channel ID are
              stored in <code className="font-mono text-[12px]">oauth_grants</code>{' '}
              in our Supabase database (Singapore region · encrypted at rest),
              scoped to one specific Setnayan event. They are never shared
              with vendors, other couples, or third parties.
            </li>
            <li>
              <strong>Limited Use commitment.</strong> Setnayan&rsquo;s use
              and transfer of information received from Google APIs to any
              other app adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We never use your
              YouTube data for advertising, never sell or transfer it, and
              never use it to train AI or ML models.
            </li>
            <li>
              <strong>Retention.</strong> Grants are kept until the earlier of
              (a) you revoke them from your Google account or from your
              Setnayan profile, (b) you delete your Setnayan account, or (c)
              30 days after the event ends. Refresh tokens past their expiry
              are purged automatically.
            </li>
            <li>
              <strong>Revoking access.</strong> Two paths, either works
              immediately:
              <ul className="ml-5 mt-1 list-disc space-y-1">
                <li>
                  In Setnayan, open the Panood page and click{' '}
                  <em>Disconnect YouTube</em>. We soft-revoke the grant
                  locally.
                </li>
                <li>
                  In your Google account, go to{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    className="text-terracotta hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Security → Third-party apps with account access
                  </a>{' '}
                  and remove Setnayan. We honor the revocation on the next
                  broadcast attempt.
                </li>
              </ul>
            </li>
            <li>
              <strong>Broadcasts on your YouTube channel.</strong> Once a
              broadcast is created on your channel, the recording is owned by
              you. Edit or delete it from YouTube Studio like any other video
              — Setnayan cannot delete videos on your behalf after the
              broadcast ends. Your use of YouTube is also governed by{' '}
              <a
                href="https://www.youtube.com/t/terms"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube&rsquo;s Terms of Service
              </a>{' '}
              and the{' '}
              <a
                href="https://policies.google.com/privacy"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="Google Drive integration (Photo Delivery + Papic)">
          <p>
            Couples who use Photo Delivery (vendor-released final wedding
            photos) or Papic (the V1.5+ camera mesh) connect a Google Drive
            account so Setnayan can write photos and videos into that Drive
            on the couple&rsquo;s behalf. The connection uses Google&rsquo;s
            standard OAuth sign-in. You can revoke it at any time from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-terracotta hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>
            .
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-2">
            <li>
              <strong>Scope requested.</strong> Only{' '}
              <code className="font-mono text-[12px]">.../auth/drive.file</code>{' '}
              — a narrow scope that restricts Setnayan to ONLY files and
              folders the Setnayan app itself creates in the Drive. We
              cannot see, read, edit, or delete any other files, folders,
              photos, or documents you already have in the Drive. We also
              never request{' '}
              <code className="font-mono text-[12px]">.../auth/drive</code>{' '}
              (full Drive access),{' '}
              <code className="font-mono text-[12px]">.../auth/drive.readonly</code>,
              or any other Drive scope.
            </li>
            <li>
              <strong>What we receive from Google.</strong> A refresh token
              tied to the connected Drive account, the email address used to
              sign in, an access token (typically valid 1 hour), and the
              file/folder IDs of the items Setnayan creates. We do not
              receive your Google password and do not enumerate or index
              your existing Drive contents.
            </li>
            <li>
              <strong>How we use it.</strong> For Photo Delivery (0009), we
              create one folder per event named after the wedding (for
              example, <em>&ldquo;Setnayan · Maria &amp; Juan Wedding ·
              2026-10-24&rdquo;</em>) and the vendor&rsquo;s release action
              writes the finalized photo set into that folder. For Papic
              (V1.5+), the camera-mesh capture pipeline writes event-day
              photos into a bootstrapped folder structure inside the same
              Drive. We never browse, modify, or delete any file we did not
              create.
            </li>
            <li>
              <strong>Storage + scope.</strong> Tokens and the connected
              email + folder IDs are stored in{' '}
              <code className="font-mono text-[12px]">oauth_grants</code>{' '}
              in our Supabase database (Singapore region · encrypted at
              rest), scoped to one specific Setnayan event. They are never
              shared with vendors, other couples, or third parties.
            </li>
            <li>
              <strong>Limited Use commitment.</strong> Setnayan&rsquo;s use
              and transfer of information received from Google APIs to any
              other app adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We never use your
              Drive data for advertising, never sell or transfer it, and
              never use it to train AI or ML models.
            </li>
            <li>
              <strong>Retention.</strong> Grants are kept until the earlier
              of (a) you revoke them from your Google account or from your
              Setnayan profile, (b) you delete your Setnayan account, or
              (c) 30 days after the event ends. Refresh tokens past their
              expiry are purged automatically. The files Setnayan wrote to
              your Drive are not deleted by Setnayan when the grant ends —
              they remain in your Drive under your sole control.
            </li>
            <li>
              <strong>Revoking access.</strong> Two paths, either works
              immediately:
              <ul className="ml-5 mt-1 list-disc space-y-1">
                <li>
                  In Setnayan, open the Photo Delivery or Papic page for
                  your event and click <em>Disconnect Google Drive</em>. We
                  soft-revoke the grant locally.
                </li>
                <li>
                  In your Google account, go to{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    className="text-terracotta hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Security → Third-party apps with account access
                  </a>{' '}
                  and remove Setnayan. We honor the revocation on the next
                  write attempt.
                </li>
              </ul>
            </li>
            <li>
              <strong>Files in your Drive.</strong> Once a file is written
              to your Drive, it is owned by the Drive account that
              authorized the grant. Move, share, or delete it from
              drive.google.com like any other file — Setnayan cannot delete
              files on your behalf after the grant is revoked. Your use of
              Google Drive is also governed by the{' '}
              <a
                href="https://policies.google.com/privacy"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="AI-assisted Today's Focus">
          <p>
            Today&rsquo;s Focus uses curated Filipino-wedding knowledge plus AI
            synthesis to surface the next planning step for your event. The
            baseline question budget routes through Cloudflare Workers AI
            (model: Llama 3.1 8B), hosted in Cloudflare&rsquo;s regional
            infrastructure. Paid Today&rsquo;s Focus access (per the price on
            /pricing) routes through Anthropic Console (model: Claude Haiku
            4.5; data processing terms per Anthropic&rsquo;s commercial
            agreement).
          </p>
          <p className="pt-2">
            Wedding data submitted to either model is processed solely to
            answer your question and populate your event plan — not used for
            model training, not shared with third parties, not retained beyond
            the conversation thread. Paid access persists the thread for your
            event window; you can delete it at any time. Conversation logs
            are stored encrypted at rest in Supabase (Singapore region).
          </p>
        </Section>

        <Section title="Subprocessors">
          <ul className="ml-5 list-disc space-y-1">
            <li>Supabase (database + auth · Singapore region)</li>
            <li>Vercel (web hosting)</li>
            <li>Cloudflare (CDN + R2 object storage · APAC region)</li>
            <li>Resend (transactional email)</li>
            <li>Sentry (server-side error monitoring · stack traces only)</li>
            <li>PostHog Cloud (product analytics — opt-out available in your profile)</li>
            <li>
              Google (YouTube Data API — only for couples who purchase Panood
              and explicitly connect their YouTube channel via OAuth; Google
              Drive API — only for couples who use Photo Delivery or Papic
              and explicitly connect a Drive account via OAuth)
            </li>
            <li>
              TikTok (Personal-tier Patiktok only · for couples who explicitly
              connect their TikTok account via OAuth)
            </li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions or RA 10173 requests, message us via the{' '}
            <Link href="/help" className="text-terracotta hover:underline">help center</Link>{' '}
            with subject &ldquo;Privacy&rdquo;. We&rsquo;ll respond within one business day.
          </p>
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="border-b border-ink/5">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center text-ink">
          <Logo height={32} withWordmark />
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/5">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-8 text-xs text-ink/55 sm:px-6 lg:px-8">
        <Link href="/" className="hover:text-ink">Home</Link>
        <Link href="/help" className="hover:text-ink">Help</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      </div>
    </footer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-sm text-ink/75">{children}</div>
    </section>
  );
}
