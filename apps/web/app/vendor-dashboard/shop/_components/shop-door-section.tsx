/**
 * shop-door-section.tsx — one room on My Shop (door 1, "Your shop").
 *
 * ✂ THE "ON THIS PAGE" RAIL THAT LIVED IN THIS FILE IS RETIRED (owner "Yes to
 * all", 2026-10-21, item 4 of `shots-2026-10-21/supplier-dash-audit/AUDIT.md`;
 * the approved S-PR6 shape, "ShopRail/ManageTiles removed"). Since step 5
 * (2026-10-14) its six doors had become rows on this one room, each one tap
 * away, so the map repeated the page it sat on. The file was `shop-rail.tsx`;
 * only the door shell is left, so it carries its own name now.
 */

/**
 * The door shell — one room on the page.
 *
 * `scroll-mt-24` is what makes the fragment link land with the heading visible
 * instead of tucked under the sticky header; it is the CSS half of "pressing a
 * door scrolls to it".
 */
export function ShopDoorSection({
  id,
  title,
  question,
  children,
}: {
  id: string;
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24 space-y-4">
      <header className="space-y-1 border-b border-ink/10 pb-3">
        <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink/60">{question}</p>
      </header>
      {children}
    </section>
  );
}
