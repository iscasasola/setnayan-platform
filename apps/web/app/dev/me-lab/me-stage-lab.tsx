import { setGuestScanTracking, withdrawFaceConsent } from '@/app/[slug]/actions';
import { GuestMe } from '@/app/[slug]/_components/guest-me';
import { GuestMeSection } from '@/app/[slug]/_components/guest-hub-bar';
import { ScanTrailForm } from '@/app/[slug]/_components/scan-trail-notice';
import { PLATE } from '@/app/[slug]/_lib/measures';

/**
 * 👤 ME, AS A STAGE — Invitation › Me drawn the way the guest page draws it (`data-me-stage` → `GuestMeSection` →
 * `GuestMe`, then the record note), over a photo, for the guest_page_fixes_2_4 walk (owner 2026-10-21): the Hub's
 * scene cards (fix 2), names shown cased (fix 3), a plus-one as their ticket with one Send (fix 4). No database: the
 * tickets are `../ticket` drawings, the actions are the page's own, and refuse here (no guest session holds `g-pam`) — no new
 * server action for a lab (`lint-server-action-budget`). `?stage=1&dark=1` = the couple's Candlelight look with Shade ▾
 * Darker; `&guests=2` adds a second plus-one ("jose de los santos").
 */
export function MeStageLab({ dark, two }: { dark: boolean; two: boolean }) {
  const typed = two ? ['pamela labriaga', 'jose de los santos'] : ['pamela labriaga'];
  const guests = typed.map((name, i) => ({ guestId: `p${i + 1}`, name, inviteUrl: `https://setnayan.com/me-lab?invite=lab-${i + 1}` }));
  const ticket = (name: string) => `/dev/me-lab/ticket?name=${encodeURIComponent(name)}`;
  return (
    <main data-art={dark ? 'candlelight' : undefined} className="sn-editorial relative min-h-dvh overflow-hidden text-ink" style={{ background: 'rgb(var(--color-paper))' }}>
      {/* The main background (`MainGround`): the couple's photo under the veil — paper at As is, the page's ink at Darker.
          `sn-editorial`: the guest tree's faces, as `GuestLookScope` wears them for a Classic look. */}
      <div aria-hidden className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: 'url(/realstories/jack-jill-g1.jpg)' }} />
      <div aria-hidden className="absolute inset-0" style={{ background: dark ? 'rgb(24 22 20 / 0.62)' : 'rgb(var(--color-paper) / 0.5)' }} />
      <div className="relative pb-10 pt-16">
        {/* Pam's own ticket is on her page (`#site-pass`), so Me offers no second "My QR" — as on her page and the prototype. */}
        <span id="site-pass" hidden />
        <div data-me-stage="" className={`mx-auto w-full ${PLATE} space-y-12 px-4`}>
          <GuestMeSection
            asTab
            galleryCount={0}
            meSlot={
              <GuestMe
                name="Pam"
                slug="me-lab"
                eventId="e-lab"
                guestId="g-pam"
                askMeal={false}
                askDietary={false}
                askPlusOnes
                eventName="Indalecio & Claire"
                guests={guests}
                passCards={{ own: ticket('Pam'), plusOnes: Object.fromEntries(typed.map((n, i) => [`p${i + 1}`, ticket(n)])) }}
                account={{ kind: 'link_this_seat', seatName: 'Pam', accountEmail: 'pam@example.com', coupleSeat: false }}
                personalLink="https://setnayan.com/me-lab?invite=lab-0"
                userAgent={null}
                termsCarried
                faceTagging={{ on: false, open: false, faceMode: 'mode_a', wish: true, turnOff: withdrawFaceConsent.bind(null, 'e-lab', 'g-pam') }}
              />
            }
          />
          <ScanTrailForm
            card
            optedOut={false}
            toggle={setGuestScanTracking.bind(null, 'e-lab', 'g-pam', true)}
            sentence="We keep a record of when you open your invitation or scan your code at this wedding — it is how this page knows to welcome you when you first arrive."
          />
        </div>
      </div>
    </main>
  );
}
