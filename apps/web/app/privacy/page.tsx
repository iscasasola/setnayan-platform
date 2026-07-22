import Link from 'next/link';

// GEO Phase G5 (2026-05-28) — canonical URL + enriched description. AI
// engines extract privacy-policy content for "is X RA 10173 compliant"
// queries — the description now names the compliance standard explicitly.
// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

export const metadata = {
  title: 'Privacy policy · Setnayan',
  description:
    'How Setnayan handles personal data under the Philippine Data Privacy Act (RA 10173). Guest data, couple consent, vendor data, receipts, and DPO contact.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy policy · Setnayan',
    description:
      'How Setnayan handles personal data under the Philippine Data Privacy Act (RA 10173).',
    url: '/privacy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy policy · Setnayan',
    description:
      'How Setnayan handles personal data under the Philippine Data Privacy Act (RA 10173).',
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-cream">
      <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How we handle your data
          </h1>
          <p className="text-xs text-ink/55">
            Effective 2026-05-13 · last updated 2026-07-17 · subject to RA 10173 (Philippines Data Privacy Act)
          </p>
        </header>

        <Section title="Data Protection Officer">
          <p>
            Setnayan&rsquo;s Data Protection Officer is reachable at{' '}
            <a href="mailto:iscasasolaii@gmail.com" className="text-terracotta hover:underline">
              iscasasolaii@gmail.com
            </a>
            . Reach the DPO for requests under RA 10173 (access, correction,
            blocking, erasure, complaints, NPC inquiries). We respond within 15
            business days.
          </p>
        </Section>

        <Section title="Regulatory posture">
          <p>
            Setnayan is operated by{' '}
            <strong>SETNAYAN SOFTWARE DEVELOPMENT SERVICE</strong>, a sole
            proprietorship registered with the Department of Trade and Industry
            under that business name (registered 2026-06-25, national scope).
            Because a sole
            proprietorship has no legal personality separate from its
            proprietor, the Personal Information Controller under RA 10173 is the
            proprietor, who also holds the Data Protection Officer function
            directly and is reachable at{' '}
            <a href="mailto:iscasasolaii@gmail.com" className="text-terracotta hover:underline">
              iscasasolaii@gmail.com
            </a>
            . BIR registration is under the proprietor&rsquo;s existing TIN.
            NPC registration will be filed under this business name.
          </p>
          <p className="pt-2">
            Cross-border data transfers — Singapore (Supabase), United States
            (Cloudflare R2 PH-region buckets), United States (Anthropic Console
            for Setnayan AI), and United States (Google LLC, when you connect
            the optional Google Drive or YouTube integrations) — are subject to
            RA 10173 § 21 and the provider&rsquo;s adequacy commitments.
            Third-party identity-verification providers (such as Persona,
            Veriff, or Onfido) are <strong>not currently active</strong> — the
            integration is a stub with no personal data flowing to them; we will
            update this policy before any such provider begins processing your
            data.
          </p>
        </Section>

        <Section title="Self-declared information (and what we verify)">
          <p>
            Setnayan is a self-service platform, and most of what we hold about
            an account is <strong>self-declared</strong> — you provide your
            profile, your event details, the vendors you name, and your story
            yourself. We do <strong>not</strong> require a government ID and do
            not independently verify that this information is accurate; you
            control it and are responsible for keeping it correct. You can view,
            correct, or delete it at any time from your profile or the relevant
            event page.
          </p>
          <p className="pt-2">
            We verify identity <strong>only where this notice says so</strong>.
            The main case is <strong>vendor identity verification</strong>: a
            vendor shown as verified has had that credential checked separately.
            (Third-party identity-verification providers are not yet active — see
            &ldquo;Regulatory posture&rdquo; above.)
          </p>
          <p className="pt-2">
            Where content involves <strong>other people</strong> — for example a
            photo, likeness, or detail you upload about a guest or a third party —
            we rely on the uploader&rsquo;s confirmation that they have the right
            to share it, together with the event&rsquo;s own consent controls
            (such as guest photo consent and couple approval for any public
            showcase, described below). This does not change the separate,
            explicit consent we require before processing biometric face data or
            other sensitive personal information covered in their own sections.
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

        <Section title="Device identifier (fraud prevention)">
          <p>
            To keep our marketplace safe from fake accounts and coordinated
            abuse, we may record a{' '}
            <strong>hashed identifier for the device you sign in from</strong> —
            a random value stored in your browser, one-way hashed on our servers
            (we never store the raw value). Where active, we use it{' '}
            <strong>only</strong> to detect fraud and duplicate/sock-puppet
            accounts.
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              It is <strong>not</strong> a behavioral or biometric fingerprint
              and uses no third-party tracking service — it identifies a
              browser, not your activity.
            </li>
            <li>
              We never use it for advertising, personalization, or tracking you
              across other websites, and we never sell or share it.
            </li>
            <li>
              Legal basis: our legitimate interest in preventing fraud and
              protecting our vendors (RA 10173 &sect; 12). The hash is
              pseudonymous, included in your data export, and deleted when you
              delete your account.
            </li>
          </ul>
        </Section>

        <Section title="Biometric data (facial recognition)">
          <p>
            Certain optional features — such as automatically matching you to
            event photos so your tagged pictures reach you — can process
            facial-geometry data derived from a selfie you choose to provide (a
            &ldquo;face vector&rdquo;, a mathematical representation of facial
            features). You might be offered enrollment when you RSVP, from a
            guest photo page during the event, or at an on-site check-in — and it
            is always your choice. We process this sensitive personal information
            only:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              with your explicit, opt-in consent, recorded with a timestamp when
              you enroll;
            </li>
            <li>
              for adults 18 and older only (enrollment is not offered to
              minors); and
            </li>
            <li>
              scoped to a single event — your face vector is never reused across
              events and never sold or shared for advertising.
            </li>
          </ul>
          <p className="pt-2">
            You may withdraw consent at any time, which permanently deletes your
            face vector and enrolled selfie. If you never enroll a selfie, we
            collect no biometric data about you.
          </p>
          <p className="pt-2">
            A single, account-wide face profile that would carry across your
            events is <strong>not active</strong> — it is turned off pending our
            Data Protection Officer&rsquo;s review. Until it is enabled and
            separately disclosed here, all face matching stays scoped to the one
            event you consented to.
          </p>
        </Section>

        <Section title="Optional personalization &amp; family details">
          <p>
            Some Setnayan features let you add details that are optional and that
            you choose to provide. Several of these are{' '}
            <strong>sensitive personal information</strong> under RA 10173, so we
            process them only with your consent, record a timestamp when you
            provide them, and let you remove them at any time. You never have to
            provide any of these to use Setnayan.
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Profile personalization</strong> — your religion, civil
              status, and gender, if you add them, so we can tailor suggestions
              and salutations. Reference-only and always optional.
            </li>
            <li>
              <strong>Family details</strong> — dependents (which may include a
              child&rsquo;s name, birth date, sex, and religion) and godparents
              (name and email), if you choose to track family milestones such as
              upcoming christenings or godchild reminders. Data about a minor is
              provided by you as the responsible adult, on that basis.
            </li>
            <li>
              <strong>Event honoree details</strong> — for some event types (for
              example a christening or a gender reveal) the person the event is
              for is not the account holder; the details you enter about them —
              which may include the celebrant&rsquo;s first name
              (&ldquo;Para kanino?&rdquo;), a child&rsquo;s birth date and
              gender, or an expected due date — are stored as part of your
              event. The celebrant&rsquo;s first name is used only to keep
              their celebrations organized; it is never shown on public pages
              or to vendors.
            </li>
            <li>
              <strong>Guest RSVP details</strong> — when your guests reply we
              store what the event needs, which may include meal or dietary
              preferences. Because dietary information can imply health or
              religious observance, we treat it as sensitive and use it only to
              run your event.
            </li>
          </ul>
          <p className="pt-2">
            You can view, correct, or delete any of these from your profile or
            the relevant event page; removing them deletes the underlying data.
          </p>
        </Section>

        <Section title="Gift-receiving details (Pabuya)">
          <p>
            If you set up Pabuya (digital gift-giving), you can display your own
            gift-receiving details to your guests — for example a GCash, Maya,
            bank, or PayPal handle and a receiving QR image. This is your own
            information, shown to your guests at your choice.
          </p>
          <p className="pt-2">
            <strong>
              Setnayan never holds, moves, or records the transfer of any money.
            </strong>{' '}
            We store only the receiving details you enter so we can display them
            — there is no wallet, balance, or transaction ledger. You can edit or
            remove these details at any time, and they are deleted with your
            event.
          </p>
        </Section>

        <Section title="Photos and videos — location data and guest capture">
          <p>
            When photos and short clips are captured at an event (for example
            through Papic, our in-app camera feature), the original file can
            carry the device metadata a camera normally records, which{' '}
            <strong>may include the GPS coordinates</strong> of where the shot
            was taken. Originals are stored privately in our object storage for
            the couple.
          </p>
          <p className="pt-2">
            <strong>We strip location from what leaves the app.</strong> When a
            photo is downloaded or shared out, we remove its EXIF/GPS metadata
            first so the copy you send does not reveal where it was taken; if
            that strip cannot complete for a given file, we drop the file rather
            than release a location-bearing original. (Short video clips are shown
            and shared as a re-encoded web copy that is produced without the
            capture device&rsquo;s location or other embedded metadata; the
            couple&rsquo;s own full-resolution clip originals stay private in our
            storage and keep whatever the camera recorded.)
          </p>
          <p className="pt-2">
            <strong>Guest capture is consent-gated.</strong> If you take photos
            as a guest, a photo only becomes eligible for the couple&rsquo;s
            public showcase when <em>two</em> gates are met: you opt in at
            capture time (off by default, never pre-checked) <em>and</em> the
            couple approves it. You can leave the opt-in off and still have your
            photos delivered privately to the couple.
          </p>
          <p className="pt-2">
            <strong>FaceBlock.</strong> A guest who does not want to appear on an
            event&rsquo;s live photo wall can turn on FaceBlock. We then generate
            a server-side copy with detected faces blurred into the pixels and
            only that blurred copy may be projected — the wall fails closed, so
            if the safe copy is not ready the photo is withheld. You can opt out
            of the live wall this way at any time.
          </p>
        </Section>

        <Section title="Featuring your event on Setnayan&rsquo;s own social channels">
          <p>
            Setnayan may feature finished work from real events — such as a
            published event recap, or a consented artifact like an animated
            monogram, save-the-date, event website, personal reel, or LED
            design — on Setnayan&rsquo;s own social channels (for example our
            Facebook, Instagram, or TikTok) to showcase what the platform makes.
            This is optional and governed by consent:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Per-artifact consent.</strong> A specific artifact is only
              eligible after you grant consent for that item, and you choose how
              you are credited — by first names only, or fully anonymously. You
              can revoke a consent at any time.
            </li>
            <li>
              <strong>Recap re-posts are opt-out.</strong> For the automatic
              re-post of a published recap, we honor a one-tap opt-out on your
              recap manager; a recap is never composed for our social queue when
              you have opted out, and it is never posted at all if your event
              page is private.
            </li>
            <li>
              <strong>After the event only.</strong> Featuring happens only after
              your event has taken place — never before or during it.
            </li>
            <li>
              We never post your guest list, RSVP data, budget, chat history, or
              raw photo feed, and we never sell these artifacts.
            </li>
          </ul>
        </Section>

        <Section title="Minors, dependents, and religious information">
          <p>
            Where you optionally provide family details (see &ldquo;Optional
            personalization &amp; family details&rdquo; above) — including a
            dependent&rsquo;s information or a religion — we collect it only with
            your consent, as the responsible adult, and use it solely to run your
            events and reminders. Some of these features are still gated and not
            enabled by default. <strong>We never surface a minor&rsquo;s details
            or anyone&rsquo;s religion on a public page, in search, or in any
            social feature.</strong>
          </p>
        </Section>

        <Section title="Samahan (groups)">
          <p>
            You can create or join a <em>samahan</em> — a group you and your people name
            yourselves (a barkada, a clan, an org, anything). For each samahan we store
            only the group&rsquo;s chosen name, an optional description, your role
            (organizer or member), and when you joined. <strong>We do not classify or
            categorize groups</strong> — the name is yours, and we attach no type,
            affiliation, or category to it. Your display name is visible to fellow
            members of the same samahan (that&rsquo;s what a group is), and never to
            anyone outside it. Your memberships are included in your data export and are
            removed when you leave a group or delete your account.
          </p>
        </Section>

        <Section title="What we do not collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>Precise location for advertising, profiling, or cross-site tracking (photo/clip GPS is described above and stripped from outbound shares)</li>
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

        <Section title="Anti-fraud &amp; trust integrity">
          <p>
            To keep our marketplace signals honest — reviews, ratings, badges,
            and &ldquo;most-booked&rdquo; counts — we run automated checks that
            detect and prevent manipulation, such as fake or duplicate accounts
            created to inflate a vendor&rsquo;s reputation. To spot rings of
            accounts controlled by one person or household, we analyze signals we
            already hold (device and browser signals, the address on your
            account, and the payment-sender identity on your transactions) so
            duplicate reviews and bookings are counted once, not many times.
          </p>
          <p className="pt-2">
            <strong>Lawful basis.</strong> We rely on legitimate interest (RA
            10173 § 12(f)) — preventing fraud and protecting the integrity of the
            marketplace for couples and honest vendors. We use only data we have
            already collected for other purposes; there is no new collection for
            this.
          </p>
          <p className="pt-2">
            <strong>Automated decisions &amp; your right to object.</strong> At a
            high fraud-risk score a vendor&rsquo;s listing may be automatically
            and <em>reversibly</em> hidden while we review — no data is deleted,
            and one review by our team reverses it. Permanent action (removing a
            vendor&rsquo;s reviews or banning an account) is never automatic; it
            requires two separate team members to confirm. If you are a vendor
            affected by an automated suspension or enforcement action, you may
            object and request a review through our{' '}
            <Link href="/help" className="text-terracotta hover:underline">
              Help Center
            </Link>{' '}
            or by contacting our Data Protection Officer (above). These rights
            are under RA 10173 § 16(c) (right to object) and § 34 (automated
            processing).
          </p>
          <p className="pt-2">
            <strong>What we do not do here:</strong>
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-1">
            <li>We do not capture or use your IP address for this.</li>
            <li>
              These groupings, signals, and scores are strictly internal — no
              couple or vendor can view them, and they are never sold, shared,
              used for advertising, or used to rank or promote vendors.
            </li>
            <li>
              The evidence we store is non-identifying — counts and ratios, not
              your name, address, or raw identifiers.
            </li>
          </ul>
        </Section>

        <Section title="Storyteller chapters — inquiry referrals and source labels">
          <p>
            When you contact a vendor after tapping &ldquo;Book through this
            chapter&rdquo; on a storyteller&rsquo;s public chapter, we record
            which chapter referred your inquiry so the vendor can honor the promo
            that chapter advertised and the storyteller&rsquo;s public profile
            can show an aggregate count of inquiries their chapters have driven.
            We also label each inquiry with how it reached the vendor (for
            example: their website, a Setnayan recommendation, a storyteller
            chapter, an editorial feature, or a returning customer). These labels
            and the referral are visible only to you and the vendor on your
            conversation — they are never public. The only public figure derived
            from them is the storyteller&rsquo;s aggregate
            &ldquo;inquiries driven&rdquo; number, which never identifies you,
            your event, or your conversation. Any discount is offered and settled
            by the vendor directly; Setnayan never handles the money.
          </p>
        </Section>

        <Section title="Public Event Summary (post-event editorial)">
          <p>
            If a host opts in, the event&rsquo;s summary page at{' '}
            <code className="font-mono text-[12px]">setnayan.com/{'{event-slug}'}</code>{' '}
            transitions from invitation and day-of mode into a public editorial
            article 30 days after the event date. The page becomes publicly
            indexable on <code className="font-mono text-[12px]">setnayan.com/realstories</code>{' '}
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
              from <Link href="/dashboard/profile" className="text-terracotta hover:underline">your profile</Link>{' '}
              (served by our <code className="font-mono text-[12px]">/api/profile/export</code> endpoint).
              The export includes your face-enrollment consent records but not
              the raw face-vector embeddings themselves.
            </li>
            <li>
              <strong>Right to withdraw biometric consent (face-forget):</strong>{' '}
              if you enrolled a selfie for photo matching, you can withdraw at any
              time; we permanently delete your face vector and enrolled selfie.
            </li>
            <li>
              <strong>Right to erasure:</strong> the same profile page has an
              account-deletion action (type DELETE to confirm). When you request
              account deletion, our team reviews and permanently erases your
              personal data within one business day of the request. Because
              deletion is permanent and immediate upon processing, it cannot be
              undone once completed — please contact{' '}
              <a
                href="mailto:iscasasolaii@gmail.com"
                className="text-terracotta hover:underline"
              >
                iscasasolaii@gmail.com
              </a>{' '}
              before requesting if you are unsure.
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
            {/* 2026-06-13 reprice scrub: per-day tier prices removed — the
                figures predated the locked catalog (Patiktok is a flat-price
                SKU; current price on /pricing). Privacy copy describes data
                flows, not prices. */}
            Couples on the Patiktok Personal tier connect their own
            TikTok account to Setnayan so Patiktok booth compilations can
            auto-post to the couple&rsquo;s handle. Setnayan uses TikTok&rsquo;s
            Login Kit and Content Posting API. The Setnayan tier
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

        <Section title="Subprocessors">
          <ul className="ml-5 list-disc space-y-1">
            <li>Supabase (database + auth · Singapore region)</li>
            <li>Vercel (web hosting)</li>
            <li>Cloudflare (CDN + R2 object storage · APAC region)</li>
            <li>Resend (transactional email)</li>
            <li>Sentry (server-side error monitoring · stack traces only)</li>
            <li>PostHog Cloud (product analytics — opt-out available in your profile)</li>
            <li>Anthropic (AI features · United States · never trained on your data)</li>
            <li>Suno (AI music generation for Pakanta and rendered videos · United States · no guest or personal data is sent)</li>
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
    </main>
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
