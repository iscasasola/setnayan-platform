/**
 * VendorNav · sticky nav unique to /for-vendors.
 *
 * WHY: ports the inline `VendorNav` from /tmp/setnayan-keynote-template/
 * "Setnayan For Vendors.html". Different from the homepage Nav — links
 * order swapped to lead with "For couples" (the cross-link back) + the
 * sign-in CTA is "Vendor sign in" instead of "Sign in".
 *
 * Per CLAUDE.md 2026-05-28 11th row v2.1 template adoption +
 * [[feedback_setnayan_button_preservation]] preserve placement + concept verbatim.
 */
import Link from 'next/link';
import { Wordmark } from '@/app/_components/brand-marks';

export function VendorNav() {
  return (
    <nav
      className="m-surface"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 56px',
        borderBottom: '1px solid var(--m-line-soft)',
        background: 'var(--m-paper)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Wordmark size={22} />
      </Link>
      <div
        style={{
          display: 'flex',
          gap: 28,
          fontSize: 14,
          color: 'var(--m-slate)',
        }}
      >
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          For couples
        </Link>
        <span
          style={{
            color: 'var(--m-ink)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          For vendors
        </span>
        <Link href="/pricing" style={{ color: 'inherit', textDecoration: 'none' }}>
          Pricing
        </Link>
        <Link href="/help" style={{ color: 'inherit', textDecoration: 'none' }}>
          Help
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Link
          href="/login"
          style={{ fontSize: 14, color: 'var(--m-slate)', textDecoration: 'none' }}
        >
          Vendor sign in
        </Link>
        <Link
          href="/signup?as=vendor"
          className="m-btn m-btn-primary"
          style={{ padding: '10px 18px', fontSize: 13 }}
        >
          Register · free
        </Link>
      </div>
    </nav>
  );
}
