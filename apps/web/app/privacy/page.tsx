import Link from 'next/link';
import { Logo } from '@/app/_components/logo';

export const metadata = {
  title: 'Privacy policy · Setnayan',
  description: 'How Setnayan handles personal data under RA 10173.',
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

        <Section title="Starter draft">
          <p>
            This is a starter draft pending legal review. The product behavior described
            below is accurate as of this version; the legal language will be refined by
            counsel before any public launch. If you have questions in the meantime, reach
            us at the <Link href="/help" className="text-terracotta hover:underline">help center</Link>.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>Account info — email, password (hashed), display name, optional phone + profile photo URL</li>
            <li>Event data you create — guest lists, vendor records, budget items, schedule, mood-board palettes</li>
            <li>Messages you send via the in-app chat</li>
            <li>Payment metadata — order amounts, reference codes, channel, your screenshot if you upload one</li>
            <li>Automatic — IP address (truncated to first 3 octets for QR scan events), browser user-agent, timestamps</li>
          </ul>
        </Section>

        <Section title="What we do not collect (yet)">
          <ul className="ml-5 list-disc space-y-1">
            <li>Face biometrics — Papic iteration (0012) hasn&rsquo;t shipped face data in V1</li>
            <li>Location beyond city-level vendor info you choose to share</li>
            <li>Third-party analytics — Sentry/PostHog are wired but not active until owner provisions accounts</li>
          </ul>
        </Section>

        <Section title="Vendor identity masking">
          <p>
            When you chat with a Setnayan vendor, the vendor sees only your event display
            name and date — never your email or personal name unless you choose to share.
            This is a load-bearing product rule.
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

        <Section title="TikTok integration (Patiktok · iteration 0017)">
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

        <Section title="YouTube integration (Panood · iteration 0011)">
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

        <Section title="Subprocessors">
          <ul className="ml-5 list-disc space-y-1">
            <li>Supabase (database + auth, Singapore region)</li>
            <li>Vercel (web hosting)</li>
            <li>Cloudflare (CDN + planned R2 object storage, APAC region)</li>
            <li>Resend (transactional email — pending activation)</li>
            <li>
              Google (YouTube Data API — only for couples who purchase Panood
              and explicitly connect their YouTube channel via OAuth)
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
