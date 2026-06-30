/**
 * Login hero — the left full-bleed panel of the redesigned /login surface
 * (mockup "1c · Full-bleed · sign-in rail").
 *
 * A photographic panel (the owner-uploaded homepage hero frame, falling back to
 * a gradient) under a dark scrim, carrying a floating pill nav at the top and
 * the brand headline anchored bottom-left. The dark treatment is the OBSIDIAN
 * end of the existing Clean Editorial palette (var(--m-ink)), not a new theme —
 * see globals.css `.sn-login`.
 *
 * Static server component — the entrance choreography (hero settles left, rail
 * slides in from the right; mobile rail rises as a bottom sheet) is driven by
 * the wrapper: CSS classes on the standalone page, the client LoginOverlay for
 * the intercepted modal.
 */
import Link from 'next/link';
import { LogoMark } from '@/app/_components/brand-marks';

// Real marketing routes mirrored into the in-hero pill nav (the mockup shows a
// trimmed Prices / Download / Vendors set distinct from the full site nav).
const HERO_NAV: Array<{ label: string; href: string }> = [
  { label: 'Prices', href: '/pricing' },
  { label: 'Download', href: '/download' },
  { label: 'Vendors', href: '/vendors' },
];

export function LoginHero({ heroImageUrl }: { heroImageUrl: string | null }) {
  return (
    <div
      className="sn-login-hero"
      style={
        heroImageUrl
          ? { backgroundImage: `url("${heroImageUrl}")` }
          : undefined
      }
    >
      {/* Scrim so the nav + headline stay legible over any photo. */}
      <div className="sn-login-hero-scrim" aria-hidden />

      {/* Floating pill nav — logo + trimmed links + Sign in (the active door). */}
      <nav className="sn-login-nav" aria-label="Setnayan">
        <Link href="/" aria-label="Setnayan — home" className="sn-login-nav-logo">
          <LogoMark size={22} />
        </Link>
        <div className="sn-login-nav-links">
          {HERO_NAV.map((l) => (
            <Link key={l.label} href={l.href} className="sn-login-nav-link">
              {l.label}
            </Link>
          ))}
          <span className="sn-login-nav-divider" aria-hidden />
          <span className="sn-login-nav-link sn-login-nav-link--active" aria-current="page">
            Sign in
          </span>
        </div>
      </nav>

      {/* Headline block, anchored bottom-left per the mockup. */}
      <div className="sn-login-hero-copy">
        <span className="sn-login-eyebrow">SET NA &rsquo;YAN</span>
        <h1 className="sn-login-headline">
          Keep your memories.
          <br />
          Plan your moments.
        </h1>
        <p className="sn-login-sub">
          Sign in to pick up exactly where you left off — every event you hold and
          attend, in one place.
        </p>
      </div>
    </div>
  );
}
