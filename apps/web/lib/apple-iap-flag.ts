import { envFlagEnabled } from '@/lib/env-flag';

/**
 * 🍎 Apple In-App Purchase — the owner's switch (DECISION_LOG 2026-10-18 "IN-APP
 * PURCHASE — THE FIVE DECISIONS").
 *
 * OFF by default, and it must stay off until the owner has, in App Store
 * Connect: created the seven products named in `lib/iap/products.ts`, set their
 * prices, pointed App Store Server Notifications v2 at
 * `/api/iap/app-store-notifications`, and bought each one once in the sandbox.
 * Switching it on before then puts a buy button in the app whose product Apple
 * does not know — StoreKit answers with nothing, and the app says so.
 *
 * OFF means the app renders exactly what it rendered before this build: the
 * store shell keeps hiding every paid item (`lib/store-shell.ts`).
 *
 * It is ONE of three conditions (`lib/iap/iap-gate.ts`): this switch, the
 * store shell, and a phone build that carries the StoreKit plugin
 * (`SetnayanIAP/1` in its user-agent). An app already in people's hands has no
 * plugin and never sees a buy button, whatever this says.
 *
 * NEXT_PUBLIC_ so the server (what to render) and the client (whether to ask
 * StoreKit) read the same value. Never flipped in code.
 */
export function isAppleIapEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_APPLE_IAP_ENABLED);
}
