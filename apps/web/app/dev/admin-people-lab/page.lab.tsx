/**
 * /dev/admin-people-lab — the four People records (Person · Shop · Event · Venue) drawn with the REAL record kit
 * (`app/admin/_components/record-kit.tsx`) inside the REAL admin shell, on fixture data, with no sign-in and no
 * database. DEV-ONLY: production 404s it. Every form submit is caught by `LabSubmitCatcher`.
 *
 *   ?view=person|shop|event|venue   which record (default person)
 *   &fail=1                         the record's lists say "Couldn't read" (never "none")
 *
 * It mirrors the record pages' layout for a look at 390 and 1280 against the approved drawing
 * (`Setnayan-specs/prototypes/admin_pub/people.html`); the pages themselves read the database.
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { Ban, Download, Gift, KeyRound, Layers, LogOut, MailCheck, ScanFace, ShieldCheck, Trash2, Undo2, UserPlus, Users, XCircle } from 'lucide-react';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AdminRailContext } from '@/app/admin/_components/admin-rail-context';
import { AdminBottomNav } from '@/app/admin/_components/admin-bottom-nav';
import { AdminPinnedRow } from '@/app/admin/_components/admin-tab-rows';
import { Badge } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { ReadFailed } from '@/app/admin/_components/read-failed';
import {
  RecordBack,
  RecordEmpty,
  RecordFacts,
  RecordFold,
  RecordFolds,
  RecordHead,
  RecordInitials,
  RecordNote,
  RecordRow,
  RecordRows,
  RecordSection,
} from '@/app/admin/_components/record-kit';
import { LabSubmitCatcher } from '../admin-supplier-lab/lab-submit-catcher';

const ACCOUNT = { signedIn: true, initials: 'SA', shopName: null, isAdmin: true } as const;
const AT: Record<string, string> = {
  person: '/admin/users/lab',
  shop: '/admin/vendors/lab',
  event: '/admin/events/lab',
  venue: '/admin/venues/lab',
};

export default async function AdminPeopleLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const view = sp.view && sp.view in AT ? sp.view : 'person';
  const fail = sp.fail === '1';
  const at = AT[view]!;
  return (
    <div className="app-surface sn-ambient min-h-dvh">
      <FrontDoorShell variant="app" account={ACCOUNT} navLabels={{}} railContext={<AdminRailContext at={at} />} createSlot={null}>
        <div className="sn-vt-page pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">
          <AdminPinnedRow at={at} />
          {view === 'person' ? <Person fail={fail} /> : view === 'shop' ? <Shop fail={fail} /> : view === 'event' ? <Event fail={fail} /> : <Venue />}
        </div>
      </FrontDoorShell>
      <AdminBottomNav at={at} />
      <LabSubmitCatcher />
    </div>
  );
}

function Person({ fail }: { fail: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="#" label="All users" />
      <RecordHead
        small="Person · S89U-7K2M9Q1T4B"
        name="Maria & Jose"
        lead={<RecordInitials text="MJ" />}
        line="maria@example.ph · Joined Oct 2, 2026"
        badges={
          <>
            <Badge tone="ok">Host</Badge>
            <Badge tone="ok">Active</Badge>
          </>
        }
      />
      <div className="mt-3">
        <RecordFacts items={[['Account lifecycle', <span key="l">Signed up → Onboarded → First event → <b>First purchase</b> → <span className="text-ink/45">Active</span></span>]]} />
      </div>
      <RecordFolds>
        <RecordFold title="Profile" summary="customer · onboarding completed" defaultOpen>
          <RecordFacts items={[['Account type', 'customer'], ['Onboarding', 'Completed'], ['Last login', 'Nov 14, 2026'], ['Marketing consent', 'Opted in'], ['Internal', 'No'], ['Team member', 'No'], ['Public ID', 'S89U-7K2M9Q1T4B']]} />
          <RecordNote>Internal and Team member are changed under Flags below.</RecordNote>
        </RecordFold>
        <RecordFold title="Events" summary={fail ? 'Couldn’t read' : '2'}>
          {fail ? <ReadFailed what="this account’s events" /> : (
            <RecordRows>
              <RecordRow href="#" title="Maria & Jose wedding" line="Host · Wedding · Jan 18, 2027" />
              <RecordRow href="#" title="Ice’s 30th" line="Host · Birthday · Mar 2, 2026 · (archived)" />
            </RecordRows>
          )}
        </RecordFold>
        <RecordFold title="Orders & payments" summary="3 orders · 1 awaiting payment" defaultOpen>
          <RecordSection label="Orders (3)" right={<a href="#" className="font-semibold text-mulberry">Reconcile in Payments ›</a>}>
            <RecordRows>
              <RecordRow title="Thank-you film" line="SNEY7K2M9Q · Nov 14, 2026" right={<><b className="tabular-nums">₱ sample</b><Badge tone="wait">Awaiting payment</Badge></>} />
              <RecordRow title="Papic Pass" line="SNEY4B8X2K · Oct 30, 2026" right={<><b className="tabular-nums">₱ sample</b><Badge tone="ok">Paid</Badge></>} />
            </RecordRows>
          </RecordSection>
          <RecordSection label="Logged payments (1)">
            <RecordRows><RecordRow title="₱ sample · GCash" line="Nov 14, 2026" right={<Badge tone="wait">Pending review</Badge>} /></RecordRows>
          </RecordSection>
          <RecordSection label="Refunds (0)"><RecordEmpty>No refunds issued.</RecordEmpty></RecordSection>
        </RecordFold>
        <RecordFold title="Comps" summary={fail ? 'Couldn’t read' : '1 active'}>
          {fail ? <ReadFailed what="this account’s comp grants — it may already hold the very thing you are about to gift" /> : (
            <RecordRows>
              <RecordRow title="Animated Monogram · every event" line="admin · pilot remediation · Oct 30, 2026" right={<ActionButton tone="danger" icon={<XCircle aria-hidden strokeWidth={1.9} />} label="Revoke" type="button" />} />
            </RecordRows>
          )}
          <div className="mt-3"><ActionButton tone="brand" icon={<Gift aria-hidden strokeWidth={1.9} />} label="Give a comp" href="#" /></div>
        </RecordFold>
        <RecordFold title="Problems" summary="1 · support history"><RecordEmpty>No help tickets.</RecordEmpty></RecordFold>
        <RecordFold title="Activity" summary="newest first"><RecordRows><RecordRow title="Payment logged" line="Pending review · Nov 14, 2026" /></RecordRows></RecordFold>
        <RecordFold title="Access" summary="confirm email · temporary password · sign out · their data" defaultOpen>
          <RecordRows>
            <RecordRow title="Confirm email" line="Force-confirm (idempotent — useful when the email doesn’t arrive)" right={<form><ActionButton tone="neutral" icon={<MailCheck aria-hidden strokeWidth={1.9} />} label="Confirm email" type="submit" /></form>} />
            <RecordRow title="Temporary password" line="Shown once, at the top of People › Accounts · copy it then" right={<ActionButton tone="warn" icon={<KeyRound aria-hidden strokeWidth={1.9} />} label="Generate" type="button" />} />
            <RecordRow title="Sign out everywhere" line="Every device · data untouched · for compromised accounts" right={<ActionButton tone="danger" icon={<LogOut aria-hidden strokeWidth={1.9} />} label="Sign out" type="button" />} />
            <RecordRow title="Their data" line="The same file they get from Profile, without the text of their messages." right={<ActionButton tone="neutral" icon={<Download aria-hidden strokeWidth={1.9} />} label="Download their data" href="#" />} />
          </RecordRows>
        </RecordFold>
        <RecordFold title="Flags" summary="internal · team member · blacklist · delete" defaultOpen>
          <RecordRows>
            <RecordRow title="Internal (§ 10a)" line="Owner/spouse tier — a permanent unlimited-use grant that bypasses billing." right={<Badge tone="quiet">Not internal</Badge>} />
            <RecordRow title="Team member" line="Adding opens a two-admin approval." right={<ActionButton tone="neutral" icon={<UserPlus aria-hidden strokeWidth={1.9} />} label="Add to team" type="button" />} />
            <RecordRow title="Blacklist" line="Hard-delete AND block the email from signing up again." right={<ActionButton tone="danger" icon={<Ban aria-hidden strokeWidth={1.9} />} label="Blacklist" type="button" />} />
            <RecordRow title="Delete account" line="The email is freed for re-signup · not reversible from here" right={<ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Delete" type="button" />} />
          </RecordRows>
        </RecordFold>
        <RecordFold title="Admin log" summary="2 actions on this account"><RecordRows><RecordRow title="comp grant issued" line="Oct 30, 2026" /></RecordRows></RecordFold>
      </RecordFolds>
    </div>
  );
}

function Shop({ fail }: { fail: boolean }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="#" label="All suppliers" />
      <RecordHead small="Shop · S89V-7K2M9Q1T4B · /v/lumina-studio" name="Lumina Studio" badges={<><Badge tone="quiet">In review</Badge><Badge tone="ok">Shows in search</Badge></>} />
      <RecordFacts items={[['Run by', <a key="r" href="#" className="font-semibold text-mulberry">Ana Lim ›</a>], ['City', 'Makati'], ['Shows in search', 'Yes'], ['Joined', 'Sep 2, 2026']]} />
      <RecordFolds>
        <RecordFold title="Verification" summary="In review · pending · sent Nov 11, 2026">
          <RecordFacts items={[['State', 'In review'], ['Latest application', 'pending · sent Nov 11, 2026']]} />
          <div className="mt-3"><ActionButton tone="brand" icon={<ShieldCheck aria-hidden strokeWidth={1.9} />} label="Verification queue" href="#" /></div>
        </RecordFold>
        <RecordFold title="Plan" summary="Free · Verified · no end date">
          <RecordFacts items={[['Tier', 'Free · Verified'], ['Subscription ends', 'No end date']]} />
          <div className="mt-3"><ActionButton tone="brand" icon={<Layers aria-hidden strokeWidth={1.9} />} label="Change plan" href="#" /></div>
        </RecordFold>
        <RecordFold title="Services" summary={fail ? 'Couldn’t load' : '4 cards · 3 live · 1 taken down'} defaultOpen>
          {fail ? <ReadFailed what="this supplier’s service cards" /> : (
            <RecordRows>
              <RecordRow title="Wedding coverage · full day" line="Photo & video · From ₱ sample" right={<Badge tone="ok">Live</Badge>} />
              <RecordRow title="Same-day edit" line="Why: “photo is another studio’s”" right={<ActionButton tone="ok" icon={<Undo2 aria-hidden strokeWidth={1.9} />} label="Put back" type="button" />} />
            </RecordRows>
          )}
        </RecordFold>
        <RecordFold title="Money" summary="no payouts"><RecordEmpty>Couples pay suppliers directly, so nothing is paid out here.</RecordEmpty></RecordFold>
        <RecordFold title="Team" summary="2 people">
          <RecordFacts items={[['People on the team', '2 people']]} />
          <div className="mt-3"><ActionButton tone="neutral" icon={<Users aria-hidden strokeWidth={1.9} />} label="See team" href="#" /></div>
        </RecordFold>
      </RecordFolds>
    </main>
  );
}

function Event({ fail }: { fail: boolean }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="#" label="Events" />
      <RecordHead small="Event · S89E-4B8X2K7Q1M · Wedding" name="Mendoza wedding" badges={<Badge tone="ok">Active</Badge>} />
      <RecordFacts items={[['Type', 'Wedding'], ['Date', 'Nov 22, 2026'], ['ID', 'S89E-4B8X2K7Q1M'], ['Status', 'Active']]} />
      <RecordSection label="Hosts (2)">
        {fail ? <ReadFailed what="the hosts" /> : (
          <RecordRows>
            <RecordRow href="#" title="Rolando Mendoza" line="rolando@mendoza.ph" />
            <RecordRow href="#" title="Rosa Mendoza" line="rosa@mendoza.ph" />
          </RecordRows>
        )}
      </RecordSection>
      <RecordFolds>
        <RecordFold title="Guest list" summary="Finalized · 168 guests" defaultOpen>
          <RecordFacts items={[['Guests', '168'], ['Replied yes', '150'], ['Declined', '12'], ['State', 'Finalized'], ['Finalized on', 'Nov 10, 2026'], ['Final count', '150'], ['Reply-by date', 'Nov 8, 2026']]} />
          <div className="mt-3"><ActionButton tone="warn" icon={<Undo2 aria-hidden strokeWidth={1.9} />} label="Reopen guest list" type="button" /></div>
        </RecordFold>
        <RecordFold title="Face tagging" summary="Off · running: no">
          <ActionButton tone="neutral" icon={<ScanFace aria-hidden strokeWidth={1.9} />} label="Turn on" type="button" />
        </RecordFold>
        <RecordFold title="Suppliers" summary="4 booked"><RecordRows><RecordRow title="Lumina Studio" line="Not taking changes since Nov 10 · Where: Preparation" /></RecordRows></RecordFold>
      </RecordFolds>
    </main>
  );
}

function Venue() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="#" label="Venues" />
      <RecordHead small="Venue · Catholic Church" name="Manila Cathedral" />
      <RecordNote>The shared venue form draws here (slug · type · name · city · address · latitude · longitude · ceremony types · source note).</RecordNote>
      <div className="mt-8 border-t border-[color:var(--m-line,#E2DED4)] pt-2">
        <RecordSection label="Remove">
          <RecordNote>Deleting a venue removes it from the marketplace Paired-Venue panel immediately. Not reversible.</RecordNote>
          <div className="mt-3"><ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Remove the venue" type="button" /></div>
        </RecordSection>
      </div>
    </div>
  );
}
