## 2026-09-18 · chore(web): four unmounted components deleted — nothing imported them (S39)

From S26's orphan sweep (`component-no-mount`). Each re-measured on `origin/main` with
`git grep -n <basename>` — no runtime importer — then the reason it stopped being mounted
was traced. Choice for every one: **(b) delete the end nobody needs.**

| File | Why nobody needs it |
|---|---|
| `app/_components/profile-menu.tsx` | Superseded by the account switcher; its two unique rows (Personalization, Hosts) were already given a real door in the event nav on 2026-08-18. |
| `app/onboarding/wedding/_components/welcome-parallax.tsx` (+ `public/onboarding/welcome-depth.png`, 2 CSS rules) | Owner removed the depth parallax ("2 angles") in `e6714e3f4`; the welcome hero is a single photo. The depth map had zero references. |
| `app/vendor-dashboard/_components/eager-disclosure.tsx` | Its one consumer was removed by the 21-surface dedupe (`028c0b68e`). |
| `app/vendor-dashboard/performance/_components/scope-note.tsx` | The shop-level cards moved ABOVE the service selector (`16414e7db`), so they no longer need an "across all services" badge; the funnel carries the caveat in words. |

Guard changes (both tighten, neither loosens):
- `seam-invariants.test.ts` — `ACCOUNT_MENUS` drops `profile-menu.tsx`. It was counting a Sign-out
  control in a file nobody mounts as one of the ways out; the list is now the two live menus.
- `port-control-baseline.json` — the three deleted files leave their routes' `files`, and the
  `/onboarding/wedding` route loses the `<canvas>`/`<img>` blocks that only the parallax drew.
  Patched in place (not regenerated) so the diff shows exactly those lines.

Not touched: `app/_components/OfflineSyncProvider.tsx` (DAY-11 offline sync — reported, not deleted).

SPEC IMPACT: None.
