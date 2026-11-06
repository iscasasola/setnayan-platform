import { APPLE_WALLET_ROUTE, PASS_CARD_WORDS } from '@/lib/pass-card';
import { appleWalletDevice, type AppleWalletLink } from '@/lib/wallet-pass';
import { mightBeIpadSafari } from '@/lib/apple-device';
import type { GuestAccountState } from '@/lib/guest-one-path';
import { MeKeepInvitation } from '@/app/[slug]/_components/me-keep-invitation';
import { SaveToAccount } from '@/app/[slug]/_components/save-to-account';
import { GuestTicket } from '@/app/[slug]/_components/guest-ticket';
import { TicketPicture } from '@/app/[slug]/_components/ticket-picture';
import { AppleWalletButton } from '@/app/[slug]/_components/apple-wallet-button';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { LANDING_WORDS } from '@/lib/guest-landing';

/**
 * 🎟 THE SAVE OFFER LAB (`/dev/me-lab?save=1`) — option A of prototypes/save_to_account_2026-10-25, drawn through the
 * shipped components for the side-by-side. No database, no session:
 *   `&page=me`      Me's ticket (`GuestTicket`) with the ONE offer under its Save · Wallet (`MeKeepInvitation` as `keep`)
 *   `&page=thanks`  the thank-you's ticket group in the page's order — ticket · Save my ticket · Add to Apple Wallet ·
 *                   the ONE offer (`SaveToAccount`) — a lab composition of the same pieces (the real page needs a guest)
 *   `&ua=iphone|android|messenger` the device · `&state=offer|linked|host` · `&terms=0` the Terms not carried ·
 *   `&dark=1` under Candlelight.
 */
const UAS: Record<string, string> = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
  messenger:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
};

export function SaveOfferLab({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const userAgent = UAS[one('ua') ?? 'iphone'] ?? UAS.iphone!;
  const dark = one('dark') === '1';
  const termsCarried = one('terms') !== '0';
  const state: GuestAccountState =
    one('state') === 'linked'
      ? { kind: 'linked', accountEmail: null }
      : one('state') === 'host'
        ? { kind: 'host_viewing', seatName: 'Ana Reyes' }
        : { kind: 'offer' };
  const wallet: AppleWalletLink | null = appleWalletDevice(userAgent)
    ? { kind: 'download', href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet }
    : mightBeIpadSafari(userAgent)
      ? { kind: 'download', href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet, touchOnly: true }
      : null;
  const names = 'Maria & Jose';
  const base = { eventId: 'lab-event', slug: 'lab', personalLink: 'https://www.setnayan.com/lab?invite=0123456789abcdef', userAgent, termsCarried };
  const page = one('page') === 'thanks' ? 'thanks' : 'me';
  return (
    <div data-art={dark ? 'candlelight' : undefined} data-guest-look={dark ? '' : undefined} className="contents">
      <main className="min-h-dvh bg-cream px-5 py-8 text-ink">
        <div className="mx-auto max-w-[430px]">
          <p className="mb-4 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">
            Lab · {page === 'me' ? 'Me' : 'Thank-you'} · {one('ua') ?? 'iphone'} · {state.kind}
            {termsCarried ? '' : ' · terms not carried'}
          </p>
          {page === 'me' ? (
            <GuestTicket
              state="pass"
              name="Ana Reyes"
              invitationUrl="/dev/me-lab"
              src="/dev/me-lab/ticket?who=woman"
              appleWallet={wallet}
              keep={<MeKeepInvitation {...base} state={state} ticketNames={names} />}
            />
          ) : (
            <section className="space-y-4 text-center">
              <div className="mx-auto w-[min(260px,100%)] overflow-hidden rounded-2xl shadow-[0_24px_48px_-26px_rgba(30,34,41,0.45)]">
                <TicketPicture src="/dev/me-lab/ticket?who=woman" alt="The lab ticket" fallback={null} />
              </div>
              <div>
                <SavePassCardButton hrefs={['/dev/me-lab/ticket?who=woman']} label={LANDING_WORDS.saveTicket} variant="primary" />
              </div>
              {wallet ? (
                <div className="!mt-2 empty:hidden">
                  <AppleWalletButton link={wallet} />
                </div>
              ) : null}
              {state.kind === 'host_viewing' ? null : (
                <div className="!mt-7 text-left">
                  <SaveToAccount {...base} state={state} ticketNames={names} />
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
