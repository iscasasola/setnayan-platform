import type { ReactNode } from 'react';

/**
 * ONE CLOSED TOOL. Zero height until revealed; one open at a time.
 *
 * This is the disclosure the supplier's thread has rendered since 2026-09-08
 * (`[&:not([open])]:hidden` — "closed means invisible, not a row you can
 * open"), lifted into one component so the couple's page draws the identical
 * thing for its two tools. Both pages still `.map` their own panel list over
 * it: `lib/the-thread-tools-open-what-they-name.test.ts` requires the
 * supplier's page to render from `VENDOR_THREAD_PANELS` itself.
 *
 * `id` + `data-thread-tool` are the contract with `revealThreadTool`: it opens
 * the target by id, closes every other `[data-thread-tool]`, and scrolls the
 * panel into view. The body is capped and scrolls INSIDE the panel, so a tool
 * taller than the screen ("Build a quote") pushes the conversation down to its
 * floor and no further.
 *
 * `open` is set by the server for `?compose=deal` — the Counter-offer link on a
 * quote card — so the amendment builder is on screen when the page paints.
 * Without it the builder rendered inside a closed, hidden panel and the link
 * looked like it did nothing.
 */
export function ThreadToolPanel({
  id,
  label,
  hint,
  open = false,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      data-thread-tool
      open={open || undefined}
      className="group scroll-mt-24 border-t border-ink/10 bg-cream [&:not([open])]:hidden"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden sm:px-4">
        <span>{label}</span>
        <span className="truncate font-normal text-ink/45">{hint}</span>
        {/* The way OUT. A panel that can only be opened never goes away. */}
        <span className="ml-auto shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs font-medium text-ink/55 group-hover:border-ink/30">
          Close
        </span>
      </summary>
      <div className="max-h-[55dvh] overflow-y-auto border-t border-ink/10 p-3 sm:px-4">
        {children}
      </div>
    </details>
  );
}
