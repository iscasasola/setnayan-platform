## 2026-06-26 · feat(papic): guest event-page hub bar

When a guest scans their personal QR and lands on their own event page (`app/[slug]/page.tsx` — the signed-in `InvitationSite` view), that page is now a single-screen hub with a fixed bottom **control bar** + a top-right account affordance. Replaces the two lone floating Papic CTAs ("Your Papic camera" / "Be a candid camera") that used to sit on this page.

- **New client component `app/[slug]/_components/guest-hub-bar.tsx`** — three bottom controls + a top-right control. Everything it needs is already computed in `page.tsx` (no new DB reads):
  - **bottom-left** = QR icon → an accessible modal (`useModalA11y`: focus-trap + Esc + scroll-lock) showing the guest's OWN personal QR (reuses the pre-rendered, monogrammed `qrSvg` string + `invitationUrl`).
  - **bottom-center** = Camera (the prominent, raised action) → `Link` to `/papic/me/{qrToken}` when the guest's paid roll camera is live (`guestRollCameraReady`), else `/papic/guest` when the candid camera is open (`papicGuestActive`), else a disabled placeholder.
  - **bottom-right** = Gallery → `Link` to `/papic/me/{qrToken}` ("Photos of you"), with a tagged-photo count badge (`guestLiveGallery.total`).
  - **top-right** = signed-in viewer (`viewerAccount`) → `/dashboard/profile`; otherwise a "Link to account" button that scroll-anchors to the existing claim-account section (`#claim-account`).
- **`app/[slug]/page.tsx`** — minimal edit: mount `<GuestHubBar … />` with the already-computed props, delete the two floating-CTA blocks, and add `id="claim-account"` + `scroll-mt-24` to the existing claim section so the top-right anchor lands cleanly. No change to the public/private landing branches — only the signed-in guest (`InvitationSite`) view.
- Mobile-first; safe-area insets top + bottom. Brand palette (`mulberry`/`cream`/`ink`/`terracotta`) + `lucide-react` icons (`QrCode`/`Camera`/`Images`/`User`/`UserPlus`); all radii via the named `rounded-*` → `--m-r-*` token scale (no forbidden arbitrary radii). No new DB reads, no migration, no SKU/price change.

Verified: `pnpm typecheck` clean · `pnpm lint` (no new warnings) · `pnpm build` (production build succeeds — RSC/client-boundary correctness).

SPEC IMPACT: None (UI composition over existing entitlement data; DECISION_LOG row already recorded per the task brief). No schema, no SKU/price change.
