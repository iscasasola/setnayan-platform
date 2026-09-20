## 2026-09-20 · feat(invitation): save the wedding to your home screen, with the couple's own icon

Owner 2026-09-20: teach a guest on a phone to keep the invitation as an icon, "so they can access
it anytime". An installed tile now shows the COUPLE'S monogram and opens THEIR invitation — not our
app with our logo.

- **`/<slug>/manifest.webmanifest`** — a per-event manifest whose `start_url` and `scope` are the
  couple's own address, named `Cale & Ice`, with a `short_name` clipped to 12 characters because
  that is what a home screen shows.
- **`/<slug>/icon/<size>.<svg|png>`** — the mark on a ground taken from their mood board, drawn
  once. Android reads the SVG from the manifest; **iOS ignores manifest icons entirely** and takes
  the PNG through `apple-touch-icon`, rasterised with sharp from the same string so the two
  platforms cannot drift. `appleWebApp.title` is the couple's name — without it iOS writes
  "Setnayan" under their monogram.
- **The teaching card** (`keep-on-home-screen.tsx`) renders nothing until it knows what it is
  looking at, and nothing at all for a guest already inside the installed app. Android gets the
  real `beforeinstallprompt` button; iOS Safari gets the Share → Add to Home Screen steps; Chrome
  on iOS is told to open the page in Safari, because it cannot install at all.

🔒 Both routes read with the admin client, so **both ask `canViewSlugEvent` themselves** and 404
for a private wedding — otherwise the icon route would confirm a couple's existence, their names
and their mark to anyone who guessed the address. The icon route parses `<size>.<ext>` against a
fixed size list, so it is not an open image resizer.

A couple with no mark gets their initials in the same serif on the same ground — an icon is the one
asset that cannot be absent. `iconInitials` keeps LETTERS only: the first version let the joiner
through and "C&I" rendered as "C&".

⚠ **Deliberately NOT using the protected 0.66rem gild eyebrow** in the new card. That treatment
marks a chapter and its count is pinned; PR #5749 legitimately moves it 19 → 20, and a second
branch adding one would take main red at 21.

Guarded by `apps/web/lib/their-wedding-on-your-home-screen.test.ts` (12 tests). Verified by
rasterising the real Cale & Ice mark at 180 and 512: valid PNGs with non-uniform channel statistics,
i.e. a mark actually drawn, not a blank tile.

Not verified on a real phone: installing from an iPhone and an Android handset is the remaining check.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row — per-event manifest and icon.
