import type { AppleWalletLink } from '@/lib/wallet-pass';

/**
 * 🍎 APPLE'S BADGE ARTWORK, when it is in the repo. Apple's rules require the
 * official "Add to Apple Wallet" badge, unmodified — downloaded from
 * developer.apple.com/wallet/add-to-apple-wallet-guidelines. Until somebody
 * places that file (e.g. `public/brand/wallet/add-to-apple-wallet.svg`) and
 * sets this to its path, the link is a plain button with Apple's own words.
 */
export const APPLE_WALLET_BADGE_SRC: string | null = null;

/**
 * "Add to Apple Wallet" beside "Save my ticket" — a plain link, no script: the
 * route answers with the `.pkpass` and Safari opens Wallet's Add sheet. Shown
 * only when the page was handed a link (`appleWalletLink`: the switch on, every
 * Apple value present, an Apple device or the iPhone in-app hand-off).
 */
export function AppleWalletButton({ link, className }: { link: AppleWalletLink | null; className?: string }) {
  if (!link) return null;
  return (
    <div data-wallet="apple" className={className}>
      <a
        href={link.href}
        data-wallet-handoff={link.handoff ? '' : undefined}
        aria-label={link.label}
        className={APPLE_WALLET_BADGE_SRC && !link.handoff ? 'inline-flex' : 'button-secondary inline-flex w-full justify-center'}
      >
        {APPLE_WALLET_BADGE_SRC && !link.handoff ? (
          // eslint-disable-next-line @next/next/no-img-element -- Apple's badge, unmodified
          <img src={APPLE_WALLET_BADGE_SRC} alt={link.label} height={48} className="h-12 w-auto" />
        ) : (
          link.label
        )}
      </a>
    </div>
  );
}
