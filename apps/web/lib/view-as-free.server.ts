import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  VIEW_AS_FREE_COOKIE,
  proAsViewed,
  viewAsFreeCookieOn,
  viewAsFreeHonoured,
} from '@/lib/view-as-free';

/**
 * apps/web/lib/view-as-free.server.ts
 *
 * 👁 VIEW AS A FREE COUPLE — the request half. The rule itself is pure and lives
 * in `lib/view-as-free.ts`; this file only reads the two facts it needs (the
 * cookie, and whether the viewer is internal) once per request.
 *
 * ── 🔑 THE ONE PLACE A RENDER'S PRO READ PASSES THROUGH ───────────────────
 * `asViewed(real)` is how every surface the owner looks at from the Maker asks
 * "is this Pro?": the Maker's work area (`website/editor/page.tsx`), its Love
 * Story (`our-story/page.tsx`), the Maker page itself (`launch/page.tsx`), the
 * Apply bar (`loadHubDraftBarData`), Prints & Tickets and `/api/hub-print`
 * (`printOwnsPro`), every QR (`resolveEventQrLook`), and the canvas — the
 * public page — through its per-request `websiteProActiveFor`.
 *
 * ⛔ AND NOTHING THAT WRITES. `eventCoupleWebsiteProActive` is NOT wrapped: it
 * is the gate every server action and Apply (`lookProAllows`) calls, and a view
 * switch that reached those would refuse or hold the owner's real Pro edits.
 * A surface that forgets to wrap its read shows Pro — visible, and harmless; a
 * write that learned the switch would be neither. So the switch is opted INTO
 * by renders, never opted out of by writes.
 *
 * 💸 Zero cost for everyone else: no cookie → `false` before any auth read, so
 * a guest opening the public page pays one cookie lookup and nothing more.
 *
 * ⚠ NO `import 'server-only'` HERE, ON PURPOSE — and the auth + Supabase
 * modules are imported LAZILY, only once a cookie says "on". Three shared
 * readers import this file (`qr-look.server.ts`, `print-set.server.ts`,
 * `hub-look.ts`), and unit tests load the QR one in plain node, where
 * `server-only` cannot be resolved (it broke two suites the first time). The
 * same shape `lib/demo-mode.ts` uses for its admin-only cookie. Outside a
 * request `cookies()` throws, which reads as OFF.
 */

/**
 * The read behind `viewerIsInternal`, with a FAILED read kept apart from "no".
 *
 * 🧯 2026-10-08 (production incident): while PostgREST was refusing
 * connections this read timed out, "not internal" came back, and the Maker's
 * gate — which is on for an internal viewer — drew the OLD Maker for the
 * owner. A read that did not answer picked a different product. The view
 * switch may still treat a failure as "off" (it then shows the real page);
 * the Maker's gate may not, so it asks `read` (`viewAsFreeSwitch().measured`,
 * `lib/maker-stages-studio-flag.ts` `makerChoiceIsUnread`).
 */
const viewerInternalRead = cache(async (): Promise<{ read: boolean; internal: boolean }> => {
  const [{ getCurrentUser }, { createClient }, { logQueryError }] = await Promise.all([
    import('@/lib/auth'),
    import('@/lib/supabase/server'),
    import('@/lib/supabase/error-detect'),
  ]);
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { read: true, internal: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('is_internal')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    // Not internal on a failed read: the switch then does nothing, which shows
    // the real (Pro) page — never the other way round.
    logQueryError('viewAsFree.viewerIsInternal', error, { user_id: user.id }, 'graceful_degrade');
    return { read: false, internal: false };
  }
  return { read: true, internal: (data as { is_internal?: boolean | null } | null)?.is_internal === true };
});

/** Is the viewer an internal (§10a) account? Cached per request. */
export const viewerIsInternal = cache(async (): Promise<boolean> => (await viewerInternalRead()).internal);

async function readCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(VIEW_AS_FREE_COOKIE)?.value ?? null;
  } catch {
    // Outside a request (a build, a script): the switch cannot be on.
    return null;
  }
}

/** Is THIS request viewing as a free couple? Cached per request. */
export const viewingAsFreeCouple = cache(async (): Promise<boolean> => {
  const cookie = await readCookie();
  // The cheap check first — a guest never costs an auth read.
  if (!viewAsFreeCookieOn(cookie)) return false;
  // Never throws: a switch that cannot be read is OFF (the real page shows).
  const isInternal = await viewerIsInternal().catch(() => false);
  return viewAsFreeHonoured({ cookie, isInternal });
});

/**
 * What the Maker needs to draw the switch: whether to offer it at all, and its
 * state — and `measured`: did the read behind `offered` ANSWER? `offered` is
 * false both for "not internal" and for "the read failed"; only `measured`
 * tells them apart, and the Maker's gate must (see `viewerInternalRead`).
 */
export async function viewAsFreeSwitch(): Promise<{ offered: boolean; on: boolean; measured: boolean }> {
  const [offered, on] = await Promise.all([viewerIsInternal().catch(() => false), viewingAsFreeCouple()]);
  const measured = await viewerInternalRead().then(
    (r) => r.read,
    () => false,
  );
  return { offered, on: offered && on, measured };
}

/**
 * A RENDER's Pro read, as this viewer is shown it. Hand it the real read
 * (a promise or a boolean); it resolves to `false` while an internal viewer is
 * viewing as a free couple, and to the real value otherwise. A rejected real
 * read rejects here too, so each caller keeps its own `.catch` default.
 */
export async function asViewed(real: boolean | Promise<boolean>): Promise<boolean> {
  const [pro, free] = await Promise.all([real, viewingAsFreeCouple()]);
  return proAsViewed(pro, free);
}
