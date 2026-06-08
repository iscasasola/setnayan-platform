/**
 * POST /api/v1/billing/initialize-maya
 *
 * Dual-branch billing initialization for the V2 catalog (per owner directive
 * 2026-05-28 fifth message · "non-destructive append" strategy).
 *
 * BRANCH A · MANUAL_QR_OVERLAY (default · while NEXT_PUBLIC_MAYA_STATUS ≠ 'APPROVED'):
 *   1. Compute the 100% retail total from `platform_retail_catalog_v2` +
 *      `platform_package_catalog` (or the hardcoded PRICING_BOOK fallback if
 *      DB is unavailable · matches the owner-supplied spec verbatim).
 *   2. INSERT a tracking row into `manual_payment_logs` with a unique
 *      reference_number for admin reconciliation.
 *   3. Return the manual-QR overlay payload (gcashQrUrl + mayaQrUrl + ref).
 *      The client's MayaQrOverlayModal component intercepts this shape.
 *
 * BRANCH B · AUTOMATED_MAYA_API (when NEXT_PUBLIC_MAYA_STATUS === 'APPROVED'):
 *   Forward the line items to the Maya checkout API + return the redirect URL.
 *
 * Auth: cookie session (event member of `event_id`). DEMO_MODE bypasses
 * the membership check so the walkthrough video can record without a
 * signed-in browser. The PRICING_BOOK fallback also lets the route render
 * a complete response even when the DB read errors.
 *
 * Pricing posture: hard-locked 100% retail · `discount_applied: false`
 * always emitted in the response · per blueprint Part 1 § 1 "all cash
 * discounts are completely deprecated."
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase B. CLAUDE.md
 * 2026-05-28 fifth row (non-destructive pivot).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const DEMO_MODE = process.env.SETNAYAN_DEMO_MODE === '1';
const MAYA_APPROVED = process.env.NEXT_PUBLIC_MAYA_STATUS === 'APPROVED';

// Hardcoded fallback used when the DB read fails OR when running purely in
// demo mode. Mirrors the platform_retail_catalog_v2 + platform_package_catalog
// seed values from migration 20260628000000_v2_additive_phase_a.sql.
const PRICING_BOOK: Record<string, number> = {
  ANIMATED_MONOGRAM:   2499.0,
  PRO_WEBSITE:         2999.0,
  CUSTOM_QR_GUEST:     1499.0,
  TODAYS_FOCUS:        1499.0,
  PINOY_MAP_ROUTE:     1499.0,
  INDOOR_BLUEPRINT:    1499.0,
  CALL_TIME_ESCALATOR: 1999.0,
  PATIKTOK_COMPILER:   2499.0,
  PABATI:              999.0,
  HIGH_RES_ARCHIVE:    2999.0,
  PAPIC_GUEST:         2999.0,
  PAPIC_GUEST_STORIES: 3499.0,
  PAPIC_MEDIA_PACK:    9999.0,
  PAPIC_SEATS:         2999.0,
  PANOOD_SYSTEM:       3499.0,
  SDE:                 5499.0,
  CAMERA_BRIDGE:       1999.0,
  LIVE_WALL:           3499.0,
  PAKANTA:             3499.0,
};
const BUNDLE_BOOK: Record<string, number> = {
  GUIDED_PACK: 11999.0,
  MEDIA_PACK:  16999.0,
};

const TITLE_BOOK: Record<string, string> = {
  ANIMATED_MONOGRAM:   'Animated Monogram Maker',
  PRO_WEBSITE:         'Pro Wedding Website Subdomain',
  CUSTOM_QR_GUEST:     'Custom QR per Guest Token',
  TODAYS_FOCUS:        'Setnayan AI Dashboard Engine',
  PINOY_MAP_ROUTE:     'Traditional Pinoy Map Route Engine',
  INDOOR_BLUEPRINT:    'Indoor Blueprint Venue Layout Engine',
  CALL_TIME_ESCALATOR: 'Call-Time Escalator Coordinator Assistant',
  PATIKTOK_COMPILER:   'Patiktok WebAssembly Highlight Compiler',
  PABATI:              'Pabati 5-Second Video Guestbook Pass',
  HIGH_RES_ARCHIVE:    'High Res Archive Yearly Subscription',
  PAPIC_GUEST:         'Papic Guest AI Gallery',
  PAPIC_GUEST_STORIES: 'Papic Guest AI Gallery with Stories',
  PAPIC_MEDIA_PACK:    'Papic Guest with Stories + Thank You Video',
  PAPIC_SEATS:         'Papic Professional 5 Seats Pass',
  PANOOD_SYSTEM:       'Panood Multi-Cam Live Broadcast Engine',
  SDE:                 'Same Day Edit Video Processing Pass',
  CAMERA_BRIDGE:       'DSLR Mirrorless Camera Bridge Sync',
  LIVE_WALL:           'Live Venue Photo Wall Projection Socket',
  PAKANTA:             'Pakanta Custom Wedding Song Service',
  GUIDED_PACK:         'Setnayan Guided Planner Suite',
  MEDIA_PACK:          'Setnayan Comprehensive Media Pack Bundle',
};

type CheckoutLineItem = {
  name: string;
  amount: { value: string };
  totalAmount: { value: string };
  quantity: string;
};

type InitializeBody = {
  eventId?: string;
  event_id?: string; // accept both casings
  selectedServices?: string[];
  includeMediaPack?: boolean;
  includeGuidedPack?: boolean;
};

export async function POST(request: Request) {
  try {
    const body: InitializeBody = await request.json().catch(() => ({}));
    const eventId = (body.eventId ?? body.event_id ?? '').trim();
    const selectedServices = Array.isArray(body.selectedServices) ? body.selectedServices : [];
    const includeMediaPack = Boolean(body.includeMediaPack);
    const includeGuidedPack = Boolean(body.includeGuidedPack);

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'eventId is required.' },
        { status: 400 },
      );
    }

    // Cookie-session auth + event membership. Skipped in DEMO_MODE so the
    // walkthrough video can record without a real session.
    if (!DEMO_MODE) {
      const supabase = await createClient();
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id;
      if (!userId) {
        return NextResponse.json(
          { success: false, message: 'Sign in required.' },
          { status: 401 },
        );
      }
      const adminCheck = createAdminClient();
      const { data: membership } = await adminCheck
        .from('event_members')
        .select('event_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json(
          { success: false, message: 'You are not a member of this event.' },
          { status: 403 },
        );
      }
    }

    // ------------------------------------------------------------------------
    // 1 · COMPUTE 100% RETAIL TOTAL (no discounts · blueprint Part 1 § 1)
    // ------------------------------------------------------------------------
    let finalCalculatedTotal = 0;
    const checkoutLineItems: CheckoutLineItem[] = [];
    let primaryItemDescriptor: string;

    if (includeMediaPack) {
      finalCalculatedTotal = await readBundlePrice('MEDIA_PACK');
      primaryItemDescriptor = 'MEDIA_PACK';
      checkoutLineItems.push({
        name: TITLE_BOOK.MEDIA_PACK ?? 'Media Pack Bundle',
        amount:      { value: finalCalculatedTotal.toFixed(2) },
        totalAmount: { value: finalCalculatedTotal.toFixed(2) },
        quantity: '1',
      });
    } else if (includeGuidedPack) {
      finalCalculatedTotal = await readBundlePrice('GUIDED_PACK');
      primaryItemDescriptor = 'GUIDED_PACK';
      checkoutLineItems.push({
        name: TITLE_BOOK.GUIDED_PACK ?? 'Guided Pack Bundle',
        amount:      { value: finalCalculatedTotal.toFixed(2) },
        totalAmount: { value: finalCalculatedTotal.toFixed(2) },
        quantity: '1',
      });
    } else {
      for (const code of selectedServices) {
        const price = await readSkuPrice(code);
        if (price === null) {
          return NextResponse.json(
            { success: false, message: `Unknown service code: ${code}` },
            { status: 400 },
          );
        }
        const title = TITLE_BOOK[code] ?? code.replace(/_/g, ' ');
        finalCalculatedTotal += price;
        checkoutLineItems.push({
          name: title,
          amount:      { value: price.toFixed(2) },
          totalAmount: { value: price.toFixed(2) },
          quantity: '1',
        });
      }
      primaryItemDescriptor = selectedServices.length > 1
        ? `${selectedServices.length}-item-order`
        : (selectedServices[0] ?? '');
    }

    if (finalCalculatedTotal <= 0) {
      return NextResponse.json(
        { success: false, message: 'Checkout order matrix cannot be empty.' },
        { status: 400 },
      );
    }

    const referenceNumber = makeReferenceNumber(eventId, MAYA_APPROVED ? 'MAYA' : 'QR');

    // ------------------------------------------------------------------------
    // BRANCH A · MANUAL_QR_OVERLAY (default · while Maya API is unapproved)
    // ------------------------------------------------------------------------
    if (!MAYA_APPROVED) {
      const itemsOrdered = includeMediaPack
        ? ['MEDIA_PACK']
        : includeGuidedPack
          ? ['GUIDED_PACK']
          : selectedServices;

      // Log the pending manual transaction. In DEMO_MODE we skip the DB write
      // so the walkthrough video can run without env credentials.
      let dbInsertOk = true;
      let dbInsertError: string | null = null;
      if (!DEMO_MODE) {
        try {
          const admin = createAdminClient();
          const { error: insertErr } = await admin
            .from('manual_payment_logs')
            .insert({
              event_id: eventId,
              reference_number: referenceNumber,
              amount_php: finalCalculatedTotal,
              payment_status: 'PENDING_MANUAL_VERIFICATION',
              items_ordered: itemsOrdered,
            });
          if (insertErr) {
            dbInsertOk = false;
            dbInsertError = insertErr.message;
            // Non-fatal · the customer still gets the QR + reference to pay
            // manually. Admin reconciles via the screenshot upload flow.
            console.error('[initialize-maya] manual_payment_logs insert failed', {
              eventId, referenceNumber, error: insertErr.message,
            });
          }
        } catch (e) {
          dbInsertOk = false;
          dbInsertError = e instanceof Error ? e.message : 'unknown_db_error';
        }
      }

      // Read the live admin-uploaded QR codes + account names from
      // platform_settings (set via the admin dashboard's merchant-QR
      // uploader). The env-var pattern from the prior turn is retired —
      // admins control these values directly without a redeploy. Falls
      // through to safe defaults if the platform_settings row is empty.
      const instructions = await readQrInstructions();

      return NextResponse.json({
        success: true,
        gatewayMode: 'MANUAL_QR_OVERLAY',
        calculatedTotal: finalCalculatedTotal,
        currency: 'PHP',
        discount_applied: false,
        referenceNumber,
        primaryItemDescriptor,
        lineItems: checkoutLineItems,
        instructions,
        audit: {
          log_persisted: dbInsertOk,
          log_error: dbInsertError,
          mode: DEMO_MODE ? 'demo' : 'live',
        },
      });
    }

    // ------------------------------------------------------------------------
    // BRANCH B · AUTOMATED_MAYA_API (pre-wired · live when approval lands)
    // ------------------------------------------------------------------------
    const mayaPublicKey = process.env.MAYA_PUBLIC_API_KEY;
    const mayaSecretKey = process.env.MAYA_SECRET_API_KEY;
    if (!mayaPublicKey || !mayaSecretKey) {
      return NextResponse.json(
        { success: false, message: 'Maya API credentials missing despite NEXT_PUBLIC_MAYA_STATUS=APPROVED. Configure MAYA_PUBLIC_API_KEY + MAYA_SECRET_API_KEY.' },
        { status: 503 },
      );
    }

    const returnBase = process.env.NEXT_PUBLIC_SETNAYAN_BASE_URL ?? 'https://www.setnayan.com';
    const mayaCheckoutEndpoint = process.env.MAYA_CHECKOUT_ENDPOINT
      ?? 'https://pg-sandbox.paymaya.com/checkout/v1/checkouts';

    const mayaPayload = {
      totalAmount: { value: finalCalculatedTotal.toFixed(2), currency: 'PHP' },
      requestReferenceNumber: referenceNumber,
      items: checkoutLineItems,
      redirectUrl: {
        success: `${returnBase}/checkout/return/${encodeURIComponent(eventId)}?ref=${encodeURIComponent(referenceNumber)}`,
        failure: `${returnBase}/checkout/failure?ref=${encodeURIComponent(referenceNumber)}`,
        cancel:  `${returnBase}/checkout/cancel?ref=${encodeURIComponent(referenceNumber)}`,
      },
    };

    const mayaResponse = await fetch(mayaCheckoutEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${mayaPublicKey}:${mayaSecretKey}`).toString('base64')}`,
      },
      body: JSON.stringify(mayaPayload),
    });

    if (!mayaResponse.ok) {
      const errBody = await mayaResponse.text();
      return NextResponse.json(
        { success: false, message: `Maya API error: ${mayaResponse.status} ${errBody.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const mayaData = (await mayaResponse.json()) as { redirectUrl?: string; checkoutId?: string };
    if (!mayaData.redirectUrl) {
      return NextResponse.json(
        { success: false, message: 'Maya API response missing redirectUrl.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      gatewayMode: 'AUTOMATED_MAYA_API',
      checkoutUrl: mayaData.redirectUrl,
      checkoutId: mayaData.checkoutId ?? null,
      calculatedTotal: finalCalculatedTotal,
      currency: 'PHP',
      discount_applied: false,
      referenceNumber,
      mode: DEMO_MODE ? 'demo' : 'live',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gateway initialization timeout.';
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}

// ---------- helpers ----------

async function readSkuPrice(serviceCode: string): Promise<number | null> {
  // Try DB first · fall back to PRICING_BOOK on read failure or missing row.
  // DEMO_MODE skips the DB entirely.
  if (!DEMO_MODE) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from('platform_retail_catalog_v2')
        .select('retail_price_php')
        .eq('service_code', serviceCode)
        .maybeSingle();
      if (data?.retail_price_php) {
        return Number(data.retail_price_php);
      }
    } catch {
      // Swallow · fall through to PRICING_BOOK.
    }
  }
  return PRICING_BOOK[serviceCode] ?? null;
}

async function readBundlePrice(bundleCode: string): Promise<number> {
  if (!DEMO_MODE) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from('platform_package_catalog')
        .select('retail_price_php')
        .eq('package_code', bundleCode)
        .maybeSingle();
      if (data?.retail_price_php) {
        return Number(data.retail_price_php);
      }
    } catch {
      // Swallow · fall through to BUNDLE_BOOK.
    }
  }
  return BUNDLE_BOOK[bundleCode] ?? 0;
}

function makeReferenceNumber(eventId: string, channel: 'QR' | 'MAYA'): string {
  const evtShort = eventId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `SETNAYAN-${channel}-${evtShort}-${ts}`;
}

/**
 * Read live admin-uploaded QR URLs + account-name copy from
 * `public.platform_settings`. Admins update these values via the admin
 * dashboard's merchant-QR uploader — no redeploy required when QR
 * assets change. Falls through to placeholder strings if the row is
 * empty (only happens in fresh staging environments).
 */
type ManualQrInstructions = {
  gcashQrUrl: string;
  bdoQrUrl: string;
  gcashAccountName: string;
  bdoAccountName: string;
  message: string;
  slaMinutes: number;
};

async function readQrInstructions(): Promise<ManualQrInstructions> {
  const fallback: ManualQrInstructions = {
    gcashQrUrl: '',
    bdoQrUrl: '',
    gcashAccountName: 'Setnayan Wedding Platform',
    bdoAccountName:   'Setnayan Corporation',
    message: 'Please scan either QR code using GCash or your BDO mobile app to settle full retail payment. Enter your Reference Number in the transaction notes. Your platform benefits will be activated manually by administration within 10-15 minutes of payment receipt confirmation.',
    slaMinutes: 15,
  };

  if (DEMO_MODE) {
    // Demo mode skips DB hit — emit placeholders so the modal renders
    // with broken-but-non-blocking QR src attributes.
    return { ...fallback, gcashQrUrl: 'https://setnayan.com/demo-gcash.png', bdoQrUrl: 'https://setnayan.com/demo-bdo.png' };
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_settings')
      .select('gcash_qr_url, bdo_qr_url, gcash_account_name, bdo_account_name')
      .maybeSingle();
    if (!data) return fallback;
    return {
      gcashQrUrl: (data.gcash_qr_url as string | null) ?? fallback.gcashQrUrl,
      bdoQrUrl:   (data.bdo_qr_url as string | null)   ?? fallback.bdoQrUrl,
      gcashAccountName: (data.gcash_account_name as string | null) ?? fallback.gcashAccountName,
      bdoAccountName:   (data.bdo_account_name as string | null)   ?? fallback.bdoAccountName,
      message:    fallback.message,
      slaMinutes: fallback.slaMinutes,
    };
  } catch {
    return fallback;
  }
}
