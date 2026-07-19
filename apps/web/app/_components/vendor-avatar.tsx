/**
 * The shop avatar — ONE shared rule for every surface that shows a vendor's
 * identity tile (owner 2026-07-02: "the logo will also replace the logo on the
 * upper left once there is an uploaded photo"): render the uploaded LOGO when
 * present, else the dark 2-letter-initials tile.
 *
 * Server-component-safe (no client hooks). Callers own size/shape via
 * `className` (e.g. `h-16 w-16 rounded-2xl` on the My Shop hero, `h-10 w-10
 * rounded-lg` on the sidebar identity card); this component owns only the
 * logo-vs-initials decision and the tile colors. `logoUrl` is a presigned
 * display URL (resolve `vendor_profiles.logo_url` via `displayUrlForStoredAsset`
 * server-side) — a raw `r2://` ref will not render, so pass the resolved URL or
 * null. Decorative (`aria-hidden`): the business name is always adjacent text.
 */
export function VendorAvatar({
  logoUrl,
  initials,
  className,
}: {
  /** Presigned/display URL of the uploaded logo, or null to fall back. */
  logoUrl: string | null;
  /** 2-letter fallback initials (deriveVendorInitials). */
  initials: string;
  /** Size/shape/typography classes from the call site. */
  className?: string;
}) {
  if (logoUrl) {
    return (
      <span
        aria-hidden
        className={`${className ?? ''} overflow-hidden`}
        style={{ background: 'var(--m-paper)' }}
      >
        {/* Presigned R2 URL — next/image can't optimize short-lived signed
            URLs, so this follows the FileUpload thumbnail pattern. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={className}
      style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
    >
      {initials}
    </span>
  );
}

/**
 * Up to two uppercase initials from a business/display name. Canonical copy —
 * consolidates the byte-identical `deriveInitials` helpers that lived in
 * vendor-dashboard/layout.tsx and shop/page.tsx.
 */
export function deriveVendorInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
