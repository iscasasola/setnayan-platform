# Dashboard cover-photo placeholders

Two AI-generated 16:9 placeholders intended as fallbacks for couple
dashboard event-cover photos when a couple hasn't uploaded their own yet.
**Not yet wired** — these are committed as-ready inventory for the
moment the couple-dashboard event header gets a cover slot.

## Files

| File | Composition |
|---|---|
| `cover-couple-venue.avif` | Couple sitting close together at a Filipino wedding venue, golden hour. Wide cinematic feel; top has negative space for UI overlay. |
| `cover-reception-table.avif` | Long banquet table beautifully decorated at twilight, sampaguita garlands, capiz lanterns. Wide negative space throughout. |

## When to wire

Once iteration 0021 (couple dashboard) adds a cover-photo slot to the
event-header surface, wire these as the deterministic fallback:

```ts
// Pick one of two based on event_id parity / hash so the same event
// always renders the same fallback (stable, not flickering on refetch).
function fallbackCover(eventId: string): string {
  const hash = [...eventId].reduce(
    (acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0,
    0,
  );
  return hash % 2 === 0
    ? '/dashboard/cover-couple-venue.avif'
    : '/dashboard/cover-reception-table.avif';
}
```

Then render via `next/image` with `priority` (it's above the fold on the
event dashboard) and a soft overlay so any UI elements on top stay
readable.

## Source

AI-generated via Higgsfield `z_image` on 2026-05-19. Same conversion
pipeline as `public/hero/` and `public/add-ons/` — AVIF q=65 effort=6
via `sharp@0.34.4`.
