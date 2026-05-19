# Portrait placeholder slot

Six AI-generated cinematic portrait images for use as placeholders on
vendor profile cards, testimonial avatars, and other "person card"
surfaces while the real vendor cohort onboards (Dec 2026 launch).

Generated via Higgsfield `soul_cast` on 2026-05-19. Each is a cinematic
editorial portrait with auto-generated character backstory — see the
filenames for character cues. All AVIF q=65, ~70-200 KB each.

## Files

| File | Aesthetic |
|---|---|
| `andres-delgado.avif` | Groom in cream barong, formal editorial |
| `isabel-mendoza.avif` | Bride portrait, soft natural light |
| `isabel-santos.avif` | Bride portrait, chapel context |
| `isabella-reyes.avif` | Bride portrait with capiz-window light |
| `miguel-santos-barong.avif` | Groom in barong tagalog, three-quarter |
| `miguel-santos-garden.avif` | Groom outdoor, garden context |

## Usage patterns

These are **placeholders**. Replace with real vendor photos as the
verified vendor cohort onboards (verification flow lives in iteration
0006 + 0023 — see `App_Build_Status.md`).

**Vendor profile fallback** — when a vendor profile has no `logo_url`
or `cover_photo_url` set, pick a portrait by hashing the vendor's
`public_id` so the assignment is stable across renders:

```ts
const PORTRAITS = [
  '/portraits/andres-delgado.avif',
  '/portraits/isabel-mendoza.avif',
  '/portraits/isabel-santos.avif',
  '/portraits/isabella-reyes.avif',
  '/portraits/miguel-santos-barong.avif',
  '/portraits/miguel-santos-garden.avif',
] as const;

function fallbackPortrait(vendorPublicId: string): string {
  const idx = [...vendorPublicId].reduce(
    (acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0,
    0,
  ) % PORTRAITS.length;
  return PORTRAITS[idx];
}
```

**Testimonial avatar fallback** — same pattern, but on a `testimonial_id`
or the testimonial author's user_id.

## Important note

These are AI-generated fictional people. Do **NOT** caption them with
real names, real businesses, or real testimonials. Use only as visual
placeholder until real vendor photos exist. Labelling fake people as
real is a brand-trust risk far worse than a placeholder gradient.

The wiring rule of thumb: if a real vendor exists, render their photo.
If not, render one of these AVIFs with a "placeholder" badge OR with no
caption at all — never with fabricated identity copy.
