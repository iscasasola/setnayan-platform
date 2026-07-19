# Changelog fragment — claude/plaque-shows-real-mark

## 2026-07-17 · fix(nav): the sidebar plaque shows the couple's REAL mark, not text initials

Owner report: "i set it as monogram, but it did not update the sidebar."

Root cause — not a caching bug: the sidebar plaque chip was **hardcoded to text initials** and never read the mark at all:

```tsx
chip={eventInitials(plaqueName, event.monogram_text)}   // → "C&I", always
```

The layout's query already selects `monogram_custom_svg` + `monogram_uploaded_svg` (they're right there on line ~172) — only the chip ignored them. So no amount of revalidation would ever have updated it.

This regressed an explicit **owner lock (2026-06-15)**, documented in `EventMonogram` itself: *"show the custom SVG everywhere … the chrome icon matches the website hero (one mark everywhere, no letters-in-chrome / SVG-on-hero split)."* The Plaque-as-Menu redesign (#3282) locked the plaque's **interaction** grammar (plaque = menu, wordmark = home) — not its chip content; the vendor doorway already passes a `<VendorAvatar>` component into the same `chip: ReactNode` prop, so a component chip is the established pattern.

Fix: the plaque chip renders `<EventMonogram size="md" shape="square">` when the couple has a mark, falling back to initials otherwise (unchanged for events without one). Precedence mirrors every other surface — `uploaded ?? custom`. `EventMonogram` brings its own cream tile + `object-contain`, so the mark reads at 36px instead of going dark-on-bronze, and `size="md"` (36px) + `shape="square"` (rounded-xl) match the plaque frame exactly.

Not covered here (separate data source, `switcherData`): the mobile AccountSwitcher and the collapsed-rail icon trigger may still show initials — flagged for a follow-up if the owner wants the mark there too.

SPEC IMPACT: restores the 2026-06-15 "one mark everywhere" lock in the sidebar chrome.
