## 2026-08-01 · fix(home): two weddings, one photograph — the Events card had no per-event identity

**The owner found this by looking at his own phone.** Two cards on the home
Events row, two different weddings, the identical picture — same couple, same
fence, same sky. It is the first defect this session caught by human eyes rather
than by CI, and no test could have caught it: every part was behaving exactly as
written.

The hero art is per **event TYPE** (`apps/web/public/event-types/<key>.webp`), so
every wedding on the platform drew the same photograph — and prod holds **3
weddings out of 5 events**, with weddings set to be the bulk of them forever. The
card shipped 2026-07-30 to answer *"we want a better card for events… let them
get to imagine what the events are."* Two cards showing one stranger's wedding
does the opposite: they read as duplicates.

## What changed

**① The event's OWN photo now wins.** `events.landing_page_hero_image_url` — the
couple's guest-site hero — is resolved on the server (presigned out of its
`r2://` ref) and rendered instead of the type stock photo. This is the correct
answer and it becomes true for free as couples fill in their sites. It is **NULL
on every event in prod today**, so on its own it fixes nothing yet, which is why
there is a ②.

The read is deliberately **not** folded into `fetchUserEvents()`: that helper is
React `cache()`d and shared by all four dashboard layouts, and its own comment
records that one bad column there empties the event switcher app-wide. The
launcher does its own isolated, failure-tolerant read instead. The value is
host-writable straight through PostgREST and any non-`r2://` string passes
through `displayUrlForStoredAsset()` untouched, so `renderableImageSrc()` narrows
it to an https/root-relative URL before it can reach an `<img src>`.

**② With no own photo, the type photo now carries a per-EVENT treatment.**
`eventCardTreatment(event_id)` (new · `apps/web/lib/event-card-art.ts`) derives a
stable **framing** — crop · mirror · zoom — plus a colour grade, so the stock
photo still says WEDDING while two weddings stop being the same picture.

## Two things the tests caught that eyes would not have

🪤 **A hue is not enough, and the owner's own data proved it.** The first cut
derived a hue and nothing else. Run against the three REAL wedding rows in prod,
the suite failed on the first execution: **two of the owner's weddings both hash
to hue 132.** Not a bad hash — the distribution over 360 buckets is uniform to
±10% — just that a hue is a 1-in-360 signal at best and perceptually more like
1-in-18. Worse, the deeper problem survived the arithmetic: *"same couple, same
fence, same sky"* stays true under any tint. **So the framing carries this now,
not the colour** — mirror (the couple faces the other way), crop, and zoom give
24 distinct framings of the one asset; hue and wash angle sit on top as the grade
that keeps the row reading as one family.

🪤 **"Independent" salted hashes were 4× correlated.** Each axis is re-hashed from
its own salt (`<id>:hue`, `<id>:crop`, …) so a collision on one drags nothing
along. The independence test measured **0.330 where 0.083 was expected**: raw
FNV-1a avalanches *upward only* — the last byte XORs into the low 8 bits and the
multiply carries influence toward the high bits, never back down — so two inputs
sharing a long prefix land on strongly related **low** bits, and `% 6` / `% 2` /
`% 360` read exactly those. A hue collision was dragging the crop and the mirror
with it, i.e. the exact failure the module exists to prevent. Fixed with a
murmur3 `fmix32` finalizer; there is a test pinning the low-bit spread so nobody
removes it as decoration.

## Legibility is the constraint, and it is proved, not assumed

The band carries a white title, a white/gold badge pill and the monogram. The
wash is painted **under** the card's existing scrim, never over it, and every
wash colour is capped at `L = 38%` — strictly darker than the brightest thing the
un-washed card can already show. So compositing it can only pull the band **down**
in luminance. `event-card-art.test.ts` asserts, for all **360 hues** at four
scrim depths against both a pure-white and a pure-black photo: the white title
clears AA (4.5:1); the title never drops below the un-washed card's own floor;
the gold-on-white badge never regresses past the floor it already reaches on main
(it sits at ~3.5:1 over a dark photo today — pre-existing, not introduced here);
and the monogram's white ring keeps ≥4.5:1. The crop stops are all **≤ 50%**, the
shipped default, because the stock photos put their subject at or above centre —
so the treatment can only ever reveal more of the subject than the card shows
today, never less.

Verified visually as well as numerically: a static repro of the exact layer stack
was rendered at every 30° of the hue wheel and screenshotted. Title, badge and
monogram ring are readable on all twelve.

## Not changed, deliberately

- **The mobile composition.** `MobileEventHero` / `MobileEventChip` render **no
  photograph at all** (`bg-ink` and `bg-white/60`), so the duplicate-photo defect
  cannot exist below the `sm` breakpoint — what the owner saw was the desktop
  grid at ≥640px (a phone in landscape, a tablet, or desktop-mode). Giving the
  mobile hero the couple's own photo is a real improvement and a separate change.
- **`date.webp` / `hangout.webp`** stay as shipped — they are DESIGNED gradient
  art, not missing assets. They do receive the treatment (two `date` events would
  otherwise be identical too), which recolours abstract art. Intentional.
- Hrefs, date-descending order, the "Show all" toggle, the progress ring and the
  monogram are all untouched.
- `eventTypePlaceholderGradient()` now calls the shared `hashToHue()` instead of
  carrying its own copy of the fold. The arithmetic is byte-identical and a test
  pins it against the original, so every existing type gradient renders unchanged.

SPEC IMPACT: None — presentation only. No SQL, no migration, no RLS, no pricing
or entitlement change. `events.landing_page_hero_image_url` is read, never
written.
