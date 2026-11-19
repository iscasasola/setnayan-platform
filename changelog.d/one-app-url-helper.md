## 2026-11-18 · fix(urls): one app-URL helper — production never falls back to the local dev address

Seven shipped files built an absolute app URL as `NEXT_PUBLIC_APP_URL ?? <local dev address>` — the Google sign-in return (`app/auth/oauth-actions.ts`), the signup confirm link (`app/signup/actions.ts`), the checkout order link (`app/dashboard/[eventId]/checkout/actions.ts`), the open-shop confirm link (`lib/open-shop-account.server.ts`), the password-recovery and event-account links (`lib/password-recovery-link.ts`, `lib/event-account-link.ts`) and the root layout's `metadataBase` (`app/layout.tsx`). Two dev labs (`app/dev/supplier-lab/library-lab-server.ts`, `app/dev/open-shop-lab/page.lab.tsx`) fell back to the local host without a Host header. All now read the existing `siteOrigin()` in `lib/site-origin.ts` — no new helper.

`siteOrigin()` keeps its order (`NEXT_PUBLIC_APP_URL` → legacy names → fallback). The final fallback is the local dev address ONLY under `next dev` (`NODE_ENV=development`); production, preview builds and tests fall back to `https://www.setnayan.com`, as before. A set variable always wins, so nothing changes on any deploy that sets it. No screen changes.

New guard `apps/web/lib/one-app-url-helper.test.ts`: runs `siteOrigin()` in each mode, and fails if any shipped source file under `app/ lib/ components/ types/ models/` or the root runtime files — other than `lib/site-origin.ts` — spells the local dev address (comments stripped with `lib/strip-comments.ts`; test/spec files exempt). Mutation-checked: putting the old literal back in `app/signup/actions.ts` turns it red (3 pass · 1 fail).

SPEC IMPACT: None
