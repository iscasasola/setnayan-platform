import type { AppleWalletLink } from '@/lib/wallet-pass';
import { AppleWalletSheetLink } from './apple-wallet-sheet-link';

/**
 * 🍎 APPLE'S BADGE ARTWORK, when it is in the repo. Apple's rules require the
 * official "Add to Apple Wallet" badge, unmodified — downloaded from
 * developer.apple.com/wallet/add-to-apple-wallet-guidelines. Until somebody
 * places that file (e.g. `public/brand/wallet/add-to-apple-wallet.svg`) and
 * sets this to its path, the link is a plain button with Apple's own words.
 */
export const APPLE_WALLET_BADGE_SRC: string | null = null;

/**
 * "Add to Apple Wallet" beside "Save my ticket" — drawn only when the page was handed a link (`appleWalletLink`: an
 * iPhone, and a pass the server can sign right now). `download` is a plain link, no script: the route answers with
 * the `.pkpass` and Safari opens Wallet's Add sheet (and if signing fails after all, the route's own page says so —
 * "Save my ticket instead" — never a broken file). `safari` is the Messenger hand-off; `sheet` is the Setnayan app's
 * in-app browser (`AppleWalletSheetLink`).
 */
export function AppleWalletButton({ link, className }: { link: AppleWalletLink | null; className?: string }) {
  if (!link) return null;
  const plain = 'button-secondary inline-flex w-full justify-center';
  return (
    <div data-wallet="apple" className={className}>
      {link.kind === 'sheet' ? (
        <AppleWalletSheetLink href={link.href} label={link.label} className={plain} />
      ) : (
        <a
          href={link.href}
          data-wallet-link={link.kind}
          aria-label={link.label}
          className={APPLE_WALLET_BADGE_SRC && link.kind === 'download' ? 'inline-flex' : plain}
        >
          {APPLE_WALLET_BADGE_SRC && link.kind === 'download' ? (
            // eslint-disable-next-line @next/next/no-img-element -- Apple's badge, unmodified
            <img src={APPLE_WALLET_BADGE_SRC} alt={link.label} height={48} className="h-12 w-auto" />
          ) : (
            link.label
          )}
        </a>
      )}
    </div>
  );
}
