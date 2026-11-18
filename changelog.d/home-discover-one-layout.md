## 2026-11-18 · fix(shell): Home and Discover share one layout — the bars stop remounting between them

Owner, 18 Nov ("yes, unify home and discover on fable"), against the 17 Nov "bars never reload" ruling. Signed in, Home (`/dashboard`) and Discover (`/`) sat under no shared layout below the root, so the tap between them mounted a new top bar, Menu button and rail (measured on live f8f278f at 390 px), and the two bars looked different (gold mark + plain avatar on Home, text-only SETNAYAN on Discover).

- New route group `app/(hub)/` holds both pages: `app/page.tsx` → `app/(hub)/page.tsx`, `app/dashboard/(launcher)/page.tsx` → `app/(hub)/dashboard/page.tsx` (with its `loading`, `default` and `@modal` create-event slot). No URL changes and no redirects. A route group adds no segment.
- `app/(hub)/layout.tsx` is the launcher layout, moved. It draws the app-variant shell (the drawing's one bar), the bell, the switcher, the account bar and the one `<main class="sn-vt-page">`, signed in only. Signed out it draws nothing, so `/` is still the public front door drawn by `FrontDoor`.
- `app/(hub)/dashboard/layout.tsx` re-uses `app/dashboard/layout.tsx` (sign-in gate, deleted account, Terms, tours) by importing it, not copying it, and renders the `@modal` slot.
- `FrontDoor`: signed in, it now draws only Discover's content and its `<h1>`. Its own shell, `SignedInCluster` and `FrontDoorAccountBar` (deleted) left the signed-in path, so the bell, switcher and account-bar reads run once in the layout instead of twice.
- `lib/hub-shell.ts`: one question (`hubDrawsTheShell`, the cached `getCurrentUser`) decides for both the layout and the page who draws the shell, so neither both nor none draw it.
- Guard `app/(hub)/home-and-discover-share-one-layout.test.ts` is red on main. About 90 guard tests and baselines that cited the old file paths now point at the new ones.

SPEC IMPACT: None. This builds the 2026-11-17 DECISION_LOG rows "USER DASHBOARD (Home + Discover)" and "navigation bars should not load with the screen" as ruled. The bar look is the approved drawing `prototypes/user_dashboard_clean_2026-11-17/user_dashboard_clean_2026-11-17_fable.html`.
