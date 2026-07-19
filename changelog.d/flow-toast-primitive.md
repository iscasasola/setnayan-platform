## 2026-06-20 · feat(ui): app-wide toast primitive — foundation for the feedback lever (flow wave D)

The product-wide user-flow audit (2026-06-20) found **feedback is the dominant defect class — 79 of 250 findings (32%)**: actions across the app silently succeed or fail with no confirmation. `SubmitButton` already covers the *pending* state; this adds the missing *success/error* state as one shared, accessible, zero-dependency primitive (no sonner — extracts the ad-hoc `role="status"` pattern copy-pasted across ~15 components).

- **`apps/web/app/_components/toast/toast-provider.tsx`** (new) — `ToastProvider` + `useToast()` (`.success/.error/.info/.dismiss`). Container is `role="status"` `aria-live="polite"`, bottom-center, each toast dismissible, auto-clears after 5s. Brand-styled (`bg-paper`, `shadow-md`, `rounded-lg`, champagne/mulberry/slate variant tints). Named radius classes only — passes `lint:radius`.
- **`apps/web/app/_components/toast/toast-from-params.tsx`** (new) — the bridge for server-action `<form action={…}>` flows that can't call a hook: the action redirects with `?saved=1` / `?error=1&msg=…`, this fires the toast once and strips the flag (mounted in `<Suspense>` — `useSearchParams` opts the subtree into client rendering).
- **`apps/web/app/providers.tsx`** — mounts `<ToastProvider>` around the app + `<ToastFromParams>`. Mounted in **providers.tsx, not the contended root `layout.tsx`** (#1472 touches layout) — wraps every surface either way.

This is the FOUNDATION only. The 79-finding feedback **sweep** (wiring call-sites + converting throwing actions to `?error=` redirects) is gated on the stale #1733 button-sweep (same files — see `User_Flow_Audit_Backlog_2026-06-20.md` + `feedback_setnayan_watch_parallel_sessions`). The URL bridge is already live app-wide, so any `?saved=1` redirect fires a toast today.

Verified: color classes exist (`bg-paper` ×50 elsewhere, `success`/`danger` defined); wiring present in providers.tsx; lucide icons valid; no ad-hoc radii. tsc/lint/build via CI. Pre-flighted: providers.tsx + the new files are uncontended.

SPEC IMPACT: design-system/UX only (new shared primitive). Flow wave D foundation. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.
