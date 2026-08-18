import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/app/_components/legal/legal-chrome';


/**
 * `/privacy/google-access` — the ONE short page a Google reviewer (or a couple)
 * can be handed that answers "what does connecting Google actually do?".
 *
 * WHY IT EXISTS. Both grants were already disclosed in full on `/privacy` — the
 * YouTube block at §"When you connect your own YouTube channel" and the Drive
 * block at §"Google Drive integration". But that page is ~1,900 lines of policy
 * and neither grant has its own URL, so there was nothing to put in an OAuth
 * verification submission except "read our privacy policy and scroll". Each
 * Google resubmission costs days, so the summary is a deliverable in itself.
 *
 * 🔒 RULES FOR EDITING THIS PAGE — every factual claim below is checked against
 * code, not against a document. Keep it that way:
 *   • The two scope strings must stay byte-identical to YOUTUBE_OAUTH_SCOPES
 *     (lib/panood-youtube.ts) and DRIVE_OAUTH_SCOPES (lib/papic-drive.ts).
 *     Guarded by app/privacy/google-access/google-access.test.ts.
 *   • Never claim Setnayan uploads or sends video. It does not send a single
 *     video byte — the couple's own encoder pushes to the stream key
 *     (panood-youtube.ts). `auth/youtube.upload` was dropped 2026-07-25.
 *   • Never assert WHOSE YouTube channel is used. Two arrangements ship on main
 *     (a Setnayan-owned pool channel when NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED
 *     is on, otherwise the couple's own grant), so describe it as a function of
 *     how the event is set up — the same rule the homepage block carries.
 *   • Do not narrow the YouTube description below what `auth/youtube` actually
 *     permits. Google reviews the scope, and a promise narrower than the scope
 *     supports reads as untrue.
 *
 * This is a SUMMARY, not a second policy. It links into /privacy rather than
 * restating it, so the two can never drift into contradicting each other.
 */


import { GOOGLE_ACCESS_METADATA } from './metadata';

/*
  🔑 The object lives in `./metadata.ts` so `google-access.test.ts` can import
  the REAL values without pulling this page's shared shell — and with it
  `server-only`, which the Next bundler aliases and node cannot resolve — into a
  plain node test. See that file's header for the two alternatives rejected.
  This stays a literal `export const metadata`, not a re-export, so Next's
  static analysis sees exactly the export shape it looks for.
*/
/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

export const metadata = GOOGLE_ACCESS_METADATA;

export default function GoogleAccessPage() {
  return (
    <LegalLayout
      title="What connecting Google does"
      meta="Setnayan · last reviewed 2026-08-09 · a plain summary of the two optional Google connections"
    >
      <LegalSection title="The short version">
        <p>
          Setnayan offers two optional connections to a Google account. Both are{' '}
          <strong>off by default</strong>, both are asked for only at the moment
          you use the feature that needs them, and either can be disconnected at
          any time. Nothing on Setnayan requires you to connect Google — a couple
          who never connects anything still plans their whole wedding, keeps
          their gallery, and runs their event page.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>YouTube</strong> — so Live Studio can set up the live
            broadcast of a ceremony and put the player on the event page.
          </li>
          <li>
            <strong>Google Drive</strong> — so photos are copied into a folder
            inside a Drive the couple owns, and stay there whatever happens to
            us.
          </li>
        </ul>
        <p>
          Setnayan never touches a file it did not create, never uses anything it
          receives from Google for advertising, never sells or transfers it, and
          never uses it to train AI models.
        </p>
      </LegalSection>

      <LegalSection title="YouTube — broadcasting the ceremony">
        <p>
          Live Studio is an optional paid feature that streams a ceremony live so
          family working abroad can watch it happen. Setnayan asks for exactly
          one Google permission:
        </p>
        <p>
          <code className="font-mono text-[12px]">
            https://www.googleapis.com/auth/youtube
          </code>
        </p>
        <p>
          This is the narrowest permission Google offers that can create and run
          a live broadcast — the read-only one cannot start a broadcast, and the
          alternatives are wider, not narrower. Google describes it broadly on
          the consent screen, as managing your YouTube account, so the screen
          will tell you it covers more than we use. Here is everything we
          actually do with it:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Read which channel is connected, so we can show you it is linked.</li>
          <li>Create the live broadcast for the event, and the streaming slot it receives video on.</li>
          <li>Start it, check that video is arriving, and end it.</li>
          <li>
            Afterwards, look up the replay of the broadcast{' '}
            <em>we</em> created, by its ID, so the event page can link to it.
          </li>
        </ul>
        <p>
          Broadcasts are always created <strong>unlisted</strong>.{' '}
          <strong>Setnayan does not send the video itself</strong> — the
          couple&rsquo;s own streaming software pushes it to the stream key. We
          do not upload videos to anyone&rsquo;s channel, and we do not read
          anything else on a connected channel.
        </p>
        <p>
          Whose channel is used depends on how the event is set up: the broadcast
          runs on the couple&rsquo;s own channel when they connect one, and where
          Setnayan supplies the channel for an event the couple connects nothing
          and grants Setnayan no access to their Google account at all.
        </p>
      </LegalSection>

      <LegalSection title="Google Drive — photos in a folder you own">
        <p>
          A couple can connect Google Drive so their photos are copied into their
          own Drive, in folders Setnayan creates for the event. It is how a
          couple keeps full-resolution originals, and it means the photos survive
          independently of us. Setnayan asks for exactly one permission:
        </p>
        <p>
          <code className="font-mono text-[12px]">
            https://www.googleapis.com/auth/drive.file
          </code>
        </p>
        <p>
          This is the narrowest Drive permission Google offers.{' '}
          <strong>
            It restricts Setnayan to files and folders the Setnayan app itself
            created.
          </strong>{' '}
          We cannot see, read, edit or delete anything else in the Drive — not
          your documents, not your existing photos, not your other folders. We do
          not ask for full Drive access, and we do not ask for read-only Drive
          access either.
        </p>
        <p>
          What we do with it: create a folder for the event, create the
          sub-folders inside it, and write the couple&rsquo;s own photos and
          videos into them. Nothing else. If you disconnect, the files we already
          wrote stay in your Drive under your sole control — we do not take them
          back.
        </p>
      </LegalSection>

      <LegalSection title="Disconnecting">
        <p>
          Either route works, and either is immediate. In Setnayan, open the page
          for the feature — Live Studio, or the photo page for your event — and
          use its Disconnect button. Or revoke Setnayan from your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            className="text-terracotta hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Account permissions
          </a>{' '}
          page. When a connection ends, we erase the stored keys rather than
          merely marking the connection closed.
        </p>
      </LegalSection>

      <LegalSection title="Limited Use">
        <p>
          Setnayan&rsquo;s use and transfer of information received from Google
          APIs to any other app adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-terracotta hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="The full detail">
        <p>
          This page is a summary. The complete disclosure — what each connection
          stores, where it is stored, how long it is kept, and your rights under
          the Philippine Data Privacy Act (RA 10173) — is in our{' '}
          <Link href="/privacy" className="text-terracotta hover:underline">
            privacy policy
          </Link>
          . Questions go to our Data Protection Officer at{' '}
          <a
            href="mailto:iscasasolaii@gmail.com"
            className="text-terracotta hover:underline"
          >
            iscasasolaii@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
