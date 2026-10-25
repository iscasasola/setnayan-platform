import type { AppleWalletLink } from '@/lib/wallet-pass';
import { AppleWalletSheetLink } from './apple-wallet-sheet-link';

/**
 * 🍎 APPLE'S BADGE ARTWORK — the owner approved using it (2026-10-25). Apple's rules require the official "Add to
 * Apple Wallet" badge, unmodified, downloaded from Apple (developer.apple.com → Wallet → Add to Apple Wallet
 * guidelines). It is committed under `public/brand/apple-wallet/` with a SOURCE note. Apple ships ONE English badge
 * (black, with its own border), so both keys point at it. Set this to null and the link is a plain button again.
 */
export const APPLE_WALLET_BADGE: { onLight: string; onDark: string } | null = {
  // Apple's own badge, unmodified (public/brand/apple-wallet/SOURCE.md). It carries its own border, so one file serves both.
  onLight: '/brand/apple-wallet/add-to-apple-wallet-en.svg',
  onDark: '/brand/apple-wallet/add-to-apple-wallet-en.svg',
};

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
          className={APPLE_WALLET_BADGE && link.kind === 'download' ? 'inline-flex' : plain}
        >
          {APPLE_WALLET_BADGE && link.kind === 'download' ? (
            <picture>
              <source srcSet={APPLE_WALLET_BADGE.onDark} media="(prefers-color-scheme: dark)" />
              {/* eslint-disable-next-line @next/next/no-img-element -- Apple's badge, unmodified */}
              <img src={APPLE_WALLET_BADGE.onLight} alt={link.label} height={48} className="h-12 w-auto" />
            </picture>
          ) : (
            link.label
          )}
        </a>
      )}
    </div>
  );
}
