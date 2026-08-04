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
            Effective 2026-05-13 · last updated 2026-07-31 · subject to RA 10173 (Philippines Data Privacy Act)
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
            Cross-border data transfers — Singapore (Supabase, our database,
            which is also where any biometric face vector is stored), the APAC
            region (Cloudflare R2, our media storage, which holds photos,
            videos, and the selfie image you upload if you enrol a face),
            United States (Anthropic Console for Setnayan AI), and United States
            (Google LLC, when you connect the optional Google Drive or YouTube
            integrations) — are subject to RA 10173 § 21 and the
            provider&rsquo;s adequacy commitments. We do not run servers of our
            own; every location above is a third-party provider, and wherever
            you are, your data is held outside your own country.
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

        <Section title="Your connection tree (limited pilot)">
          <p>
            Setnayan is piloting a <strong>connection tree</strong> — a record of
            how the people around an event are related. It has three layers:{' '}
            <strong>family</strong>, <strong>ritual</strong> (ninong and ninang),
            and <strong>friends</strong>. It is entirely optional, and you never
            have to add anyone to use Setnayan.
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Nothing is recorded about someone without an account.</strong>{' '}
              During the pilot a connection can only be stored when{' '}
              <em>both</em> people have a Setnayan account. That way both of you
              can see it, answer it, and delete it. You cannot add someone who
              has not signed up.
            </li>
            <li>
              <strong>The other person has to agree.</strong> When you say how
              you are related to someone, that stays a request until they
              confirm it. Until then it counts as nothing, and it is not shown
              as a relationship anywhere.
            </li>
            <li>
              <strong>Only the person a claim is about can answer it.</strong>{' '}
              You cannot confirm a connection you proposed yourself — that is
              enforced by the database, not just by the interface.
            </li>
            <li>
              <strong>Drafts are private to you.</strong> If you are still
              working out your tree, a draft is visible only to you. The other
              person is never shown a claim you have not sent.
            </li>
            <li>
              <strong>Requests do not linger.</strong> A request nobody answers,
              and a connection that is declined, are both deleted after{' '}
              <strong>30 days</strong>.
            </li>
            <li>
              <strong>Wider family words are worked out, not stored.</strong>{' '}
              Terms like lolo, lola, tito, tita, pinsan and pamangkin are
              calculated from the connections you and others have confirmed. We
              do not keep a separate record of them.
            </li>
          </ul>
          <p className="pt-2">
            You can remove any connection you created at any time, and either
            person can decline one. Deleting your account removes your side of
            every connection.
          </p>
          <p className="pt-2">
            This feature is a <strong>limited pilot</strong> while our filing
            with the National Privacy Commission is being completed. We have kept
            it deliberately narrow for that reason — both-parties-only, consent
            before anything counts, and short retention.
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
            <strong>
              The shared pool: other guests at the same event can see your shots.
            </strong>{' '}
            When the host turns on the shared pool for their event, the photos and
            clips guests capture there become visible to the{' '}
            <em>other signed-in guests of that same event</em> — not only to the
            couple, and not to the public or to anyone outside the event. Only the
            compressed web copies are shared, only after they pass the automatic
            screening that runs on every capture, and the sharing never crosses
            events: a pool is scoped to the one celebration. Guests can also link
            themselves to a photo they appear in. If you would rather your shots
            went only to the couple, ask the host to leave the shared pool off for
            their event, or capture without it.
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

        <Section title="Live video connections (calls and event cameras)">
          <p>
            A few Setnayan features connect two devices{' '}
            <strong>directly to each other</strong>, so that live audio and video
            travel between them rather than through us. That is how a voice or
            video <strong>call</strong> inside a vendor conversation works; how a
            camera operator&rsquo;s phone sends its feed to the couple&rsquo;s Live
            Studio control room; how a guest who taps a side camera on an event
            page receives that angle (the operator&rsquo;s phone sends it straight
            to them); and how the live demo on our homepage works.
          </p>
          <p className="pt-2">
            <strong>
              A direct connection means each device learns the other&rsquo;s IP
              address.
            </strong>{' '}
            An IP address is the number your internet provider gives your
            connection so that other computers know where to send data — it
            broadly indicates your provider and general area, not your street
            address. Two devices cannot send video straight to each other without
            each knowing where to send it, so on a direct connection the other
            person&rsquo;s device receives your IP address and yours receives
            theirs. This is inherent to how direct video connections work
            everywhere on the internet; it is not something we add, and not
            something we can switch off while still offering the feature. Your
            device also briefly contacts a public address-discovery (STUN) server
            run by Google or Cloudflare to learn which address to advertise.
          </p>
          <p className="pt-2">
            <strong>We do not store these addresses.</strong> To introduce the two
            devices to each other, Setnayan carries the setup messages between
            them, and those messages contain the candidate addresses — so the
            addresses do pass through our infrastructure in transit. We do not
            write them to our database, keep them in a log, or use them for
            anything else. What we do keep for each connection is whether it ended
            up direct or relayed and the general type of network path it used, so
            that we can size the relay costs described below; that record contains
            no IP address and none of the audio or video.
          </p>
          <p className="pt-2">
            <strong>When a direct connection is not possible, media is relayed.</strong>{' '}
            Some networks — Philippine mobile data and shared venue or guest Wi-Fi
            especially — will not let two devices reach each other directly. Those
            connections instead route the audio and video through a relay server
            operated by <strong>Cloudflare</strong>, using short-lived credentials
            we issue for that one connection. The relay is transit, not storage:
            it forwards the stream, and Setnayan keeps none of it. On a relayed
            connection the two devices see the relay instead of each other.
          </p>
          <p className="pt-2">
            <strong>Tapping a side camera creates a session for you.</strong> If
            you choose a side camera on an event page while signed out, we create
            an anonymous sign-in for your browser at that moment — a session
            identifier with no name, email, or password attached — because the
            connection can only be set up under a signed-in session. We create it
            only when you actually tap a camera, never merely for visiting the
            page.
          </p>
          <p className="pt-2">
            <strong>Calls are never recorded.</strong> Setnayan does not record,
            store, or listen to the audio or video of a call. On a direct
            connection the media never touches our infrastructure at all; on a
            relayed connection it passes through the Cloudflare relay described
            above in transit only, and is not retained there or by us. We keep
            only the fact that a call took place on a conversation: who started
            it, whether it was voice or video, when it began, and when it ended.
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
            <li>Stored IP addresses from live calls and camera feeds — the two devices exchange these to connect, and they pass through our signaling in transit, but we never log or keep them (explained under &ldquo;Live video connections&rdquo; above)</li>
          </ul>
        </Section>

        <Section title="Vendor identity masking">
          <p>
            When you chat with a Setnayan vendor, the vendor sees only your event display
            name and date — never your email or personal name unless you choose to share.
            This is a load-bearing product rule.
          </p>
        </Section>

        <Section title="Vendor interest counts (what other couples can see)">
          <p>
            When you save a vendor to your plan, or send that vendor an inquiry, for an
            event on a specific date, that action is counted toward an{' '}
            <strong>aggregate, de-identified</strong> number — how many other couples are
            interested in that vendor on that same date. Other couples planning that date
            can see that number next to the vendor.
          </p>
          <p className="pt-2">
            <strong>What is shared is the count, and only the count.</strong> Never your
            name, your account, your email, your event, your budget, your guest list, or
            any contact detail; never <em>which</em> couples they are; and never anything
            that would let another couple work out who you are. The count is computed on
            our servers from data no couple can read directly, and only the final number
            reaches the page. Vendors are not shown this count either.
          </p>
          <p className="pt-2">
            <strong>Small numbers are suppressed.</strong> In the Marketplace&rsquo;s
            &ldquo;In demand right now&rdquo; ranking, the number is only sourced from
            couples who actually <em>inquired</em> with the vendor (not from couples who
            merely saved them), and it is not shown at all unless at least{' '}
            <strong>three</strong> other couples have inquired for your date — so one
            couple&rsquo;s planning is never exposed on its own. The count is also
            exact-date only: if your date is still a month or a year rather than a day, no
            count is computed and none is shown.
          </p>
          <p className="pt-2">
            We never present this number as scarcity. Setnayan does not tell you a vendor
            is &ldquo;almost gone&rdquo; or that there are &ldquo;only N slots left&rdquo;
            — we do not hold a live capacity count, so any such claim would be invented.
          </p>
          {/* Added 2026-08-02 by the per-clause honesty audit. Every other
              disclosure on this page states whether you can switch the thing
              off; this one could not, because the answer is no — and a notice
              that is silent exactly where the answer is unflattering is not an
              honest notice. RoPA DPS-17 records the same point as the open
              question for the DPO. */}
          <p className="pt-2">
            <strong>You cannot switch this one off.</strong> There is no setting
            that removes your own inquiry from the counts other couples see. We
            are telling you plainly rather than leaving it unsaid: what leaves our
            servers is a number, at three or above, with nothing attached to it
            that points back to you — that is the protection, and it is the
            reason we consider the trade a fair one. If you would rather not be
            counted at all, not sending the inquiry is the only way.
          </p>
        </Section>

        <Section title="Coordinators you invite (delegated access)">
          <p>
            You can invite a <strong>coordinator</strong> to help plan your event. A
            coordinator is someone on your side — a planner, a family member, a friend —
            not a Setnayan employee. Before they get any access, they accept a consent
            screen that names exactly what they will be able to see and do: your{' '}
            <strong>guest list, seating, schedule, and your chats with vendors</strong>.
          </p>
          <p className="pt-2">
            Two abilities are <strong>off by default</strong> and only turn on if you
            explicitly grant them: <strong>&ldquo;Can finalize vendors&rdquo;</strong>{' '}
            (lock in a vendor choice for you) and{' '}
            <strong>&ldquo;Can handle payments&rdquo;</strong> (complete an apply-then-pay
            checkout on your behalf). Even with the payments scope,{' '}
            <strong>Setnayan never holds, moves, or records the transfer of any money</strong>
            {' '}— the coordinator only prepares the same off-platform payment you would,
            and settlement happens directly between you and the vendor.
          </p>
          <p className="pt-2">
            A coordinator can also <strong>draft schedule items privately and release them
            to you</strong> when ready; drafts stay hidden from you, your guests, and your
            vendors until the coordinator releases them.
          </p>
          {/* Added 2026-08-02 by the per-clause audit follow-up. The section
              described a coordinator's READ access thoroughly but not the two
              day-of surfaces where they ACT outward — and one of them reaches
              the couple's guests directly. RoPA DPS-19 declares both. */}
          <p className="pt-2">
            <strong>On the day, a coordinator can post announcements your guests
            see.</strong>{' '}
            A day-of announcement (&ldquo;dinner is moving up fifteen minutes&rdquo;)
            is a short message, capped at 500 characters, that goes to{' '}
            <em>everyone on that event</em> — you, your guests, and your vendors —
            and it cannot be edited or unsent once posted. Only you and a
            coordinator you invited can write one, and every message records who
            sent it. Announcements never leave the event they belong to.
          </p>
          <p className="pt-2">
            <strong>They also run a day-of requests desk.</strong> Requests raised
            during the event — a vendor asking for something, a change of plan on
            the floor — collect in one list the coordinator works through. It holds
            what a person wrote into the request and who raised it, stays scoped to
            that one event, and is deleted with it.
          </p>
          <p className="pt-2">
            <strong>Lawful basis &amp; your control.</strong> We process this on your consent
            (captured on that invite screen) and the planning contract (RA 10173 &sect;&nbsp;12(a)
            and &sect;&nbsp;12(b)). You can <strong>narrow or revoke</strong> a
            coordinator&rsquo;s access at any time, and revoking it takes effect going
            forward. Objections go to our{' '}
            <Link href="/help" className="text-terracotta hover:underline">
              Help Center
            </Link>{' '}
            or our Data Protection Officer (above).
          </p>
          <p className="pt-2">
            <strong>What we do not do here:</strong> a coordinator never receives your face
            or biometric data, and their access is scoped to the one event you invited them
            to — never across your other events.
          </p>
        </Section>

        <Section title="Vendor AI assistant (automated replies)">
          <p>
            A vendor may turn on a paid <strong>Vendor AI assistant</strong> for
            their own shop. When they do, it can read the messages in
            <em> your chat with that vendor</em> and your event brief (event
            date, guest count, budget per head, and venue) to answer common
            questions — and, if the vendor allows it, accept a booking request —
            automatically, on that vendor&rsquo;s behalf.
          </p>
          <p className="pt-2">
            You always see an automated message labelled{' '}
            <strong>&ldquo;&#9889; AI auto-reply&rdquo;</strong>, so you know a
            person didn&rsquo;t type it. The assistant is{' '}
            <strong>deterministic</strong> — it follows fixed rules and never
            invents answers or commitments — and it is <strong>single-tenant</strong>:
            it only ever acts for the one vendor whose chat it is in, and never
            reads across vendors or across your events.
          </p>
          <p className="pt-2">
            <strong>Lawful basis &amp; your rights.</strong> We process these
            messages on the basis of your own act of messaging that vendor
            (consent) and the couple&ndash;vendor relationship (contract). Because
            a machine, not a person, is replying, RA 10173 &sect; 34 (automated
            processing) and &sect; 16(c) (right to object) apply: you can always
            reach a human — every message you send still goes to the vendor, and
            nothing is hidden from them — and you may object through our{' '}
            <Link href="/help" className="text-terracotta hover:underline">
              Help Center
            </Link>{' '}
            or our Data Protection Officer (above).
          </p>
          <p className="pt-2">
            <strong>What we do not do here:</strong> we never feed sensitive
            personal information — religion, civil status, family or dependent
            details, or biometric/face data — into the assistant, and it never
            has access to your guest list.
          </p>
        </Section>

        <Section title="Vendor Deep Search (vendor business research)">
          <p>
            Vendors can run <strong>Deep Search</strong>, a paid tool that uses AI
            to research <em>their own business</em> across public web sources —
            their own website, directory listings, and review sites — and builds a
            short summary the vendor reviews to fill in their Setnayan profile.
          </p>
          <p className="pt-2">
            This is about the vendor&rsquo;s business information. The research
            runs through <strong>Anthropic&rsquo;s AI web search</strong> (United
            States; see Subprocessors below). We <strong>never</strong> send your
            guest list, your messages, or your personal data into it. Public pages
            the tool reads may incidentally mention other people (for example, the
            name on a public review); we keep only a structured business summary,
            not the raw pages, and delete it on a rolling <strong>180-day</strong>
            {' '}basis.
          </p>
          <p className="pt-2">
            <strong>Lawful basis.</strong> The vendor initiates it about their own
            business (consent + contract); for any incidental, already-public
            third-party content we rely on legitimate interest (RA 10173 &sect;
            12(f)), minimised to a business summary and short retention.
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

        <Section title="Guest-written columns on an event page">
          <p>
            If a host turns this on, guests can write a short message — a title
            and a few sentences — for the event&rsquo;s page. A column you submit
            is <strong>published on the open web</strong> once the couple approves
            it, alongside a byline drawn from the name on the event&rsquo;s guest
            list, and can be read by anyone who opens the page.
          </p>
          <p className="pt-2">
            <strong>Nothing is published automatically.</strong> A column starts as
            a submission only. It reaches the page when two things happen: it
            passes the automatic screening applied to guest-written content, and
            the couple approves it. The couple can decline it, with a note back to
            you, and you can edit and resubmit.
          </p>
          <p className="pt-2">
            <strong>You can take it down.</strong> Withdraw your own column at any
            time and it comes off the page. If your guest record is deleted, or the
            event is, your column goes with it. We record the moment you agreed to
            publication when you submit, so consent is never assumed.
          </p>
        </Section>

        {/* ── HOW LONG WE KEEP THINGS ────────────────────────────────────────
            Added 2026-08-02 by the per-clause honesty audit (Interim Payments &
            Privacy Deferral Policy §5). The notice stated retention for three
            narrow things — a TikTok grant, a Drive connection, BIR records —
            and NOWHERE for the largest and most sensitive category we hold:
            guests' photos and video. RA 10173 requires the retention period to
            be disclosed, and we had already DECIDED every number below in
            `Data_Retention_Schedule_2026-07-11.md`; the notice simply never
            carried them. Every figure here is that schedule, verbatim — do not
            edit one without editing the other. */}
        <Section title="How long we keep things">
          <p>
            Different kinds of data have different lifespans, and two of them are
            set by law rather than by us. This is the whole schedule.
          </p>
          <ul className="list-disc space-y-1.5 pt-2 pl-5">
            <li>
              <strong>Photos and video</strong> — kept for{' '}
              <strong>5 years</strong> after the event date, then purged. (They
              stay instantly available for the first 90 days and move to cheaper
              cold storage after that; the 5-year total is the same either way.)
              Philippine wedding photographers keep originals for about that
              long, and couples come back for them.
            </li>
            <li>
              <strong>Face-recognition data</strong> — for the one event only.
              Deleted the moment you withdraw, and in any case purged together
              with that event&rsquo;s photos.
            </li>
            <li>
              <strong>Messages between a couple and a vendor</strong> —{' '}
              <strong>5 years</strong> after the event date.
            </li>
            <li>
              <strong>Payments, receipts and official receipts</strong> —{' '}
              <strong>10 years</strong>. This one is a legal floor under BIR
              rules: we <em>cannot</em> delete these earlier, even if you ask.
            </li>
            <li>
              <strong>Contracts and e-signatures</strong> —{' '}
              <strong>10 years</strong>, the prescription period under the Civil
              Code.
            </li>
            <li>
              <strong>Your account and profile</strong> — for as long as the
              account is open. When you close it, a short 30–90 day tail, then
              permanent deletion.
            </li>
            <li>
              <strong>Support tickets</strong> — <strong>2 years</strong> after
              the ticket closes.
            </li>
            <li>
              <strong>Error and usage logs</strong> — <strong>90 days</strong> or
              less, and they carry no personal data by design.
            </li>
            <li>
              <strong>The fraud-prevention device identifier</strong> — for the
              life of the account, and device records unused for more than 24
              months are pruned.
            </li>
          </ul>
          <p className="pt-2">
            Where you can end something sooner, you can: withdrawing face
            recognition deletes that data immediately, withdrawing a column takes
            it off the page, and closing your account starts the tail above. The
            two 10-year items are the exception — those we are required to keep.
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
              personal data within one business day of the request — except
              records we are legally required to keep, such as tax and receipt
              records under BIR rules, which we retain for the required period
              and then delete. Because
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
              to one specific Setnayan event. These credentials are never
              shared with vendors, other couples, or third parties. (That
              statement is about your TikTok credentials specifically — it is
              not a blanket claim that nothing you do on Setnayan is ever
              visible to another couple. For the one place where your planning
              activity feeds an anonymous count that other couples can see, see{' '}
              <em>Vendor interest counts</em> above.)
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

        {/* ── Google / YouTube data (Live Studio) ───────────────────────────
            Rewritten 2026-07-27. Five rules produced every sentence below.
            Re-read them before editing:
              1. TRUE IN BOTH ARRANGEMENTS, AND TRUE TODAY. goLivePanood
                 prefers a Setnayan-owned pool channel when
                 NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is on
                 (lib/live-studio-channel-grants.ts) and otherwise uses the
                 couple's own grant (lib/panood-broadcast.ts). In production
                 the pool is EMPTY, so the couple-connects path is the only one
                 that has ever run. Describe whose channel is used as a
                 FUNCTION OF HOW THE EVENT IS SET UP; never assert which
                 arrangement is in force, in either direction.
              2. NEVER CLAIM AN INCAPACITY THE SCOPE CONTRADICTS. auth/youtube
                 is Google's broad "manage your YouTube account" scope. State
                 restraint ("we do not"), never inability ("we cannot").
              3. NEVER PROMISE AN AUTOMATION THAT DOES NOT EXIST. The old "30
                 days after the event ends / refresh tokens purged
                 automatically" line was implemented nowhere — retention-sweep
                 is chat-only and api/cron/oauth-refresh only refreshes.
              4. STATE WHAT IS GUARANTEED, NOT WHAT IS ATTEMPTED. The
                 disconnect route calls Google's revoke endpoint only when
                 getYoutubeOAuthConfig() resolves ready
                 (api/oauth/youtube/disconnect/route.ts:88-92), and
                 revokeYoutubeToken swallows every network error
                 (panood-youtube.ts:550-563). So the Google-side revoke is
                 best-effort and this copy says so.
              5. THE SCOPE LIST MUST BYTE-MATCH YOUTUBE_OAUTH_SCOPES *AND* THE
                 OAUTH CONSENT SCREEN. A policy that discloses a scope we do
                 not request is as wrong as one that hides a scope we do. */}
        <Section title="Google / YouTube data (Live Studio)">
          <p>
            Live Studio is Setnayan&rsquo;s live-broadcast feature. It is
            optional and off by default. When a host turns it on for an event,{' '}
            <strong>Live Studio uses YouTube API Services</strong> to set up and
            run that event&rsquo;s live broadcast, and embeds the player on the
            event page. Single-camera streaming is free for any host; the
            multi-camera control room is a paid upgrade. Your use of YouTube is
            also governed by{' '}
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
          </p>

          <p className="pt-2">
            <strong>
              Whose YouTube channel the broadcast runs on depends on how your
              event is set up.
            </strong>
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-1">
            <li>
              <strong>You connect your own channel.</strong> You link your
              YouTube channel to Setnayan using Google&rsquo;s standard
              sign-in, and the broadcast is created on your channel. This is
              the arrangement everything below describes — and the one you are
              in if Setnayan ever asked you to sign in to Google.
            </li>
            <li>
              <strong>Setnayan supplies the channel.</strong> For events where
              Setnayan provides the channel, the broadcast is created on a
              YouTube channel Setnayan owns and operates, using a Google
              connection that belongs to Setnayan. You connect nothing, you are
              never asked to sign in to Google, and no Google data of yours
              reaches us at all. What this means for the recording is under
              &ldquo;Recordings&rdquo; below.
            </li>
          </ul>

          <p className="pt-3">
            <strong>When you connect your own YouTube channel</strong>
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-1">
            <li>
              {/* .../auth/youtube.upload was dropped 2026-07-25 — requested for
                  the same-day-edit feature the owner retired 2026-06-28, and no
                  code ever called an upload endpoint. userinfo.email and
                  userinfo.profile were removed from this list 2026-07-27: they
                  were disclosed here but never requested. Keep this matching
                  YOUTUBE_OAUTH_SCOPES in lib/panood-youtube.ts AND the OAuth
                  consent screen. */}
              <strong>The permission we ask for.</strong> Exactly one:{' '}
              <code className="font-mono text-[12px]">
                https://www.googleapis.com/auth/youtube
              </code>
              . This is the narrowest permission Google offers that can create
              and run a live broadcast &mdash; the read-only YouTube permission
              cannot start one, and the two other permissions that could
              (&ldquo;force-ssl&rdquo; and &ldquo;youtubepartner&rdquo;) are
              wider, not narrower. Google describes it broadly, as managing
              your YouTube account &mdash; so the consent screen will tell you
              it covers more than we use. We ask for nothing else: no permission
              to upload videos, and no permission to read your Google email
              address or profile. Connecting YouTube tells us your
              channel&rsquo;s ID, name, and picture. It does not tell us your
              Gmail address.
            </li>
            <li>
              <strong>What we actually do with it.</strong> Six things, and
              nothing else: (a) read which channel you connected, so we can show
              you it is linked; (b) create the live broadcast for your event;
              (c) create the streaming slot it receives video on; (d) link those
              two together; (e) start the broadcast, check that video is
              arriving, and end it; and (f) afterwards, look up the replay of
              the broadcast <em>we</em> created, by its ID, so your event page
              can link to it.
            </li>
            <li>
              <strong>What we do not do.</strong> We do not read, edit, or
              delete any other video on your channel. We do not read your
              subscribers, comments, playlists, watch history, or search
              history. We do not upload anything to your channel. We do not
              delete anything from your channel &mdash; including the broadcast
              we created.
            </li>
            <li>
              <strong>Setnayan does not send your video to YouTube.</strong>{' '}
              Setnayan creates the broadcast and gives you a streaming address
              and key; your own streaming software sends the video to YouTube.
              No ceremony video passes through Setnayan on its way to your
              channel.
            </li>
            <li>
              <strong>The broadcast is unlisted.</strong> Every broadcast we
              create is set to unlisted &mdash; it does not appear in YouTube
              search or on a channel&rsquo;s public video list. Anyone who has
              the link, or your event page, can watch it. It is embedded on your
              event page using YouTube&rsquo;s privacy-enhanced player, which
              sets no tracking cookies until someone presses play.
            </li>
            <li>
              <strong>What we receive and store.</strong> A refresh token and a
              short-lived access token for the connection, the permission Google
              granted, your channel&rsquo;s ID, name and picture, which Setnayan
              account completed the connection, and the IDs of the broadcasts we
              created. We never receive your Google password.
            </li>
            <li>
              <strong>Where it is stored, and who can read it.</strong> In our
              Supabase database in Singapore, encrypted at rest by our hosting
              provider. The credential is readable only by our servers &mdash;
              it is never sent to any browser, including yours, and the database
              blocks browser-level accounts from reading it at all. No Setnayan
              screen displays it to our staff. Access to the underlying database
              is limited to the small team that operates Setnayan. A person only
              ever looks at your Google connection data where it is necessary
              for security purposes, to comply with applicable law, or where you
              have asked us to investigate a specific problem with your
              broadcast. Your streaming key is shown to you only when you ask to
              see it, and is never published on your event page.
            </li>
            <li>
              <strong>How long we keep it.</strong> Until you disconnect it,
              until you delete your Setnayan account, or until you ask us to
              remove it. We keep the connection alive in the background &mdash;
              refreshing the access token automatically, including outside your
              event window &mdash; so it still works on the day and so we can
              resolve your replay afterwards. We do not currently delete the
              connection on an automatic timer after the event. If you ask us to
              delete the Google data we hold about you, we will do so within 30
              days.
            </li>
            <li>
              <strong>If you revoke access at Google.</strong> Our side notices
              on the next attempt and stops using the connection. Setnayan will
              show you that the connection needs reconnecting rather than
              behaving as though it still works.
            </li>
            <li>
              <strong>How to disconnect.</strong> Two ways, either works:
              <ul className="ml-5 mt-1 list-disc space-y-1">
                <li>
                  In Setnayan, open the Live Studio page and click{' '}
                  <em>Disconnect YouTube</em>. We mark the connection revoked so
                  Setnayan stops using it, and we ask Google to cancel our
                  access. That second step is best-effort &mdash; if the call to
                  Google does not go through, we still stop using the connection
                  on our side. If you want to be certain the access is gone at
                  Google as well, remove Setnayan from your Google account
                  permissions too.
                </li>
                <li>
                  In your Google account, go to{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    className="text-terracotta hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Security &rarr; Third-party apps with account access
                  </a>{' '}
                  and remove Setnayan.
                </li>
              </ul>
            </li>
            <li>
              <strong>If you delete your Setnayan account.</strong> We delete
              the Google connections our records attribute to your account.
              Where a connection was recorded before we started capturing which
              partner completed it, we leave it in place rather than risk
              deleting your partner&rsquo;s credential &mdash; ask us and we
              will remove it. Deleting your account does not, by itself, call
              Google&rsquo;s revoke endpoint, so if you want the access
              cancelled at Google too, remove Setnayan from your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-terracotta hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google account permissions
              </a>
              . Records of the broadcasts we created (their YouTube video IDs,
              timings, and streaming keys) are not removed by account deletion
              today; ask us and we will delete them.
            </li>
          </ul>

          <p className="pt-3">
            <strong>Recordings</strong>
          </p>
          <ul className="ml-5 list-disc space-y-1 pt-1">
            <li>
              Setnayan does not keep its own copy of your broadcast. YouTube
              archives it, and Setnayan links to it.
            </li>
            <li>
              <strong>If the broadcast ran on your own channel</strong>, the
              recording is yours. Edit or delete it in YouTube Studio like any
              other video. Setnayan does not delete or edit videos on your
              channel.
            </li>
            <li>
              <strong>If the broadcast ran on a Setnayan channel</strong>, the
              recording is an unlisted video on a YouTube channel Setnayan owns.
              Setnayan keeps it and can remove it; you will not have YouTube
              Studio access to it. Setnayan gives you the watch link from your
              dashboard. Ask us and we will delete it.
            </li>
            <li>
              Setnayan never deletes anything on YouTube automatically. Nothing
              disappears because an event ended.
            </li>
          </ul>

          <p className="pt-3">
            <strong>Sharing, advertising, and AI.</strong> Setnayan&rsquo;s use
            and transfer of information received from Google APIs to any other
            app adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-terracotta hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We do not sell YouTube
            data, do not transfer it to anyone other than Google, do not send it
            to advertising networks or data brokers, do not use it for
            advertising or personalisation, and do not use it to train AI or
            machine-learning models. Your connection credential and your channel
            details are not shared with vendors, other couples, or any other
            Setnayan user. The one thing that is published is the broadcast
            itself &mdash; its link is embedded on your event page, which is
            public, so anyone with that page or the link can watch. That is what
            the feature is for, and you control it by choosing whether to go
            live. (This paragraph is about your YouTube connection, not about
            everything you do on Setnayan &mdash; your vendor shortlisting also
            feeds an anonymous count other couples can see, described under{' '}
            <em>Vendor interest counts</em> above.)
          </p>

          <p className="pt-3">
            Setnayan&rsquo;s Google Drive integration (Photo Delivery and Papic)
            is a separate connection, with a separate permission and separate
            credentials that never mix with this one. See the Google Drive
            section below.
          </p>

          <p className="pt-3">
            <strong>Facebook Live.</strong> A host may also publish a Facebook
            Live link alongside the YouTube player on their event page. For this,
            Setnayan uses no Meta credentials of yours or of ours: the host
            pastes in a link they created themselves on their own Facebook
            account. Setnayan sends no video to Meta and receives no data back
            from Meta for your broadcast. Meta, not Setnayan, controls how long
            that replay lasts. (Separately, Setnayan does hold a credential for
            its own Facebook and Instagram pages &mdash; that is only for
            posting Setnayan&rsquo;s own marketing, and is covered under
            &ldquo;Featuring your event on Setnayan&rsquo;s own social
            channels&rdquo; above.)
          </p>
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
              rest), scoped to one specific Setnayan event. These credentials
              are never shared with vendors, other couples, or third parties.
              (That statement is about your Google Drive credentials
              specifically — it is not a blanket claim that nothing you do on
              Setnayan is ever visible to another couple. See{' '}
              <em>Vendor interest counts</em> above for the one place where your
              planning activity feeds an anonymous count.)
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
            <li>
              Cloudflare (CDN + R2 object storage · APAC region; also the relay
              server that carries live call and camera video when a direct
              connection is not possible — transit only, nothing stored)
            </li>
            <li>Resend (transactional email)</li>
            <li>Sentry (server-side error monitoring · stack traces only)</li>
            <li>PostHog Cloud (product analytics — opt-out available in your profile)</li>
            <li>Anthropic (AI features, including AI web research for the vendor Deep Search tool · United States · never trained on your data)</li>
            <li>Suno (AI music generation for Pakanta and rendered videos · United States · no guest or personal data is sent)</li>
            <li>
              Google (YouTube Data API — used for any event broadcast through
              Live Studio, under either the couple&rsquo;s own connected channel
              or a Setnayan-held connection where Setnayan supplies the channel; Google
              Drive API — only for couples who use Photo Delivery or Papic
              and explicitly connect a Drive account via OAuth; Google&rsquo;s
              public STUN server — contacted briefly by your device when starting
              a live call or camera connection, to discover its own network
              address)
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
            with subject &ldquo;Privacy&rdquo;. We&rsquo;ll respond within 15 business days (usually much sooner).
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
