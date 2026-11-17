import { NextResponse, after, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { grantOwedBadgeRewards, readBadgeRewardFacts } from '@/lib/badge-rewards.server';
import { badgesForPrint } from '@/lib/shop-badges';
import { tellBadgesJustEarned } from '@/lib/badge-earned.server';
import { badgePrintSvg, type PrintGround } from '@/lib/shop-badge-print';
import { orderAwardQueue, todayAwardLine, validFlowStep } from '@/lib/award-queue';
import { readAwardFlowProgress, readAwardQueue, saveAwardFlowProgress } from '@/lib/award-queue.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/badges?badge=<key|all>&ground=light|white|dark|colour&colour=#RRGGBB
 *
 * 🖨 A supplier's badges as a print-ready vector (the pill, type outlined — `lib/shop-badge-print.ts`), for their
 * calling card and tarps (owner 2026-10-28). The facts are READ NOW (`readShopBadgeFacts`) and passed through
 * `badgesForPrint` — never a value saved when a design was made — so a file carries the badges the shop wears on the
 * day it is saved. Saved through the shipped `SaveFileLink` (`usePrintSave`): share sheet on a phone, a download on a
 * computer.
 *
 * `?view=facts` answers the badges' facts as JSON instead — what the Today line (`badge-earned-line.tsx`) compares
 * with the badges the supplier last dismissed, after the page has drawn (Today's own reads never grow for it). It is
 * also THE door that pays newly earned badge rewards (`grantOwedBadgeRewards`) — the one place a supplier's visit
 * writes them; no page render does.
 *
 * `?view=awards` answers the award queue (No. 1 → seals → badges as earned) and its ONE Today line (News until opened,
 * To do when left mid-flow, button "See it") — `lib/award-queue.ts`. A refused read answers null, never an empty queue.
 *
 * POST { flow, step, total?, done? } saves where the shop is in one award flow, so Later resumes at the exact step
 * (`shop_award_flow_progress`). The ONE write the award flow makes — no server action (the budget is full).
 *
 * Own shop only: the signed-in user's shop (`fetchOwnVendorProfile`). A badge the shop does not wear today is refused
 * in words (404), never drawn.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save your badges.' }, { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const want = sp.get('badge') ?? 'all';
  const g = sp.get('ground');
  const ground: PrintGround = g === 'white' || g === 'dark' || g === 'colour' ? g : 'light';

  const admin = createAdminClient();
  if (sp.get('view') === 'awards') {
    const [queue, progress] = await Promise.all([
      readAwardQueue(admin, profile.vendor_profile_id),
      readAwardFlowProgress(supabase, profile.vendor_profile_id),
    ]);
    return NextResponse.json(
      {
        queue: queue === null ? null : orderAwardQueue(queue),
        progress,
        line: queue === null ? null : todayAwardLine(queue, progress),
      },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  }
  const facts = await readShopBadgeFacts(admin, profile.vendor_profile_id);
  if (sp.get('view') === 'facts') {
    // 🎁 Today asks this after it has drawn, so it is where a newly earned badge pays its reward (owner 2026-11-05)
    // without slowing Today — and so do the badge pages, Shop and Performance (`badge-reward-sweep.tsx`), since a
    // page render never writes (8 Nov). Exactly once (the database's key); a failure only means the next read pays it.
    // `granted` = how many rewards/upgrades THIS call paid, so a badge page can redraw once to show them.
    const granted = await readBadgeRewardFacts(admin, profile.vendor_profile_id, facts)
      .then((rewardFacts) => grantOwedBadgeRewards(admin, profile.vendor_profile_id, rewardFacts))
      .then((sweep) => {
        // 📣 Lane S (2026-11-10): a badge just earned composes ONE post for Setnayan's own Page — and (owner
        // 2026-11-15) the shop is told: one `badge_earned` notice + email. After the response, never on the
        // supplier's path; only keys THIS sweep paid, so an existing grant is never told twice.
        if ((sweep.grantedKeys ?? []).length > 0) after(() => tellBadgesJustEarned(admin, profile.vendor_profile_id, sweep));
        return sweep.granted + (sweep.upgrades?.granted ?? 0);
      })
      .catch((err) => {
        console.error('[badge-rewards] sweep failed', err);
        return 0;
      });
    return NextResponse.json({ vendorId: profile.vendor_profile_id, facts, granted }, { headers: { 'cache-control': 'private, no-store' } });
  }
  const all = badgesForPrint(facts);
  const picked = want === 'all' ? all : all.filter((b) => b.key === want);
  if (picked.length === 0) {
    return NextResponse.json(
      { error: want === 'all' ? 'Your shop has no badges to print yet.' : 'That badge isn’t on your shop today.' },
      { status: 404 },
    );
  }
  const svg = badgePrintSvg(picked, { ground, colour: sp.get('colour') ?? undefined });
  const name = want === 'all' ? 'setnayan-badges' : `setnayan-${want.replace(/[^a-z0-9]+/gi, '-')}`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.svg"`,
      'cache-control': 'private, no-store',
    },
  });
}

/**
 * POST /api/vendor/badges — `{ flow, step, total?, done? }`: the shop's place in one award flow. Own shop only, and only
 * a flow the shop actually has (its own award queue). 400 for a bad step, 404 for a flow that is not theirs, 503 when
 * the save was refused (said, never pretended).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { flow?: unknown; step?: unknown; total?: unknown; done?: unknown } | null;
  const flow = typeof body?.flow === 'string' ? body.flow.trim() : '';
  const checked = validFlowStep(body?.step, body?.total);
  if (!flow || flow.length > 120 || !checked) return NextResponse.json({ error: 'That step could not be saved.' }, { status: 400 });

  const admin = createAdminClient();
  const queue = await readAwardQueue(admin, profile.vendor_profile_id);
  if (queue === null) return NextResponse.json({ error: 'Your awards could not be read. Try again.' }, { status: 503 });
  if (!queue.some((a) => a.key === flow)) return NextResponse.json({ error: 'That award is not yours.' }, { status: 404 });

  const saved = await saveAwardFlowProgress(admin, {
    vendorProfileId: profile.vendor_profile_id,
    flowKey: flow,
    step: checked.step,
    totalSteps: checked.totalSteps,
    finished: body?.done === true,
  });
  if (!saved) return NextResponse.json({ error: 'Your place could not be saved. Try again.' }, { status: 503 });
  return NextResponse.json({ ok: true, flow, step: checked.step }, { headers: { 'cache-control': 'private, no-store' } });
}
