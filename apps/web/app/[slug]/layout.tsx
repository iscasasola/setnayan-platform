/**
 * /[slug] guest-tree layout — the editorial-typography scope.
 *
 * The 2026-07-12 Atelier finalization flipped the root font variables to the
 * chrome faces (Hanken Grotesk + Space Mono) so every marketing/dashboard
 * page reads one type system. The guest-facing invitation/event tree is the
 * owner-EXCLUDED surface family: couples' pages keep the wedding-editorial
 * register (Cormorant Garamond display · Manrope body · DM Mono labels).
 *
 * `.sn-editorial` (globals.css) remaps --font-display/--font-sans/--font-mono
 * back to the editorial faces (loaded as --font-editorial-* in the root
 * layout); `display: contents` keeps this wrapper out of the box model so no
 * guest page's layout shifts. Purely a CSS-variable scope — zero behavior.
 */
export default function GuestTreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="sn-editorial contents">{children}</div>;
}
