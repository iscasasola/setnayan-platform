import 'server-only';

/**
 * PayMongo REST client — booking-fee Checkout Sessions (owner-chosen rail
 * 2026-07-23). DORMANT until PAYMONGO_SECRET_KEY is set: isPaymongoConfigured()
 * gates every call, so nothing hits the network until the owner provisions keys.
 *
 * Auth is HTTP Basic with the secret key as username + EMPTY password
 * (`base64("sk_...:")`). Amounts are integer CENTAVOS.
 */

const PAYMONGO_API = 'https://api.paymongo.com';

export function isPaymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY ?? '';
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

export type CheckoutMethod = 'gcash' | 'card' | 'paymaya' | 'grab_pay' | 'qrph';

export type CreateCheckoutResult = {
  checkoutUrl: string;
  checkoutSessionId: string;
} | null;

/**
 * Create a hosted Checkout Session for one booking-fee charge and return the URL
 * to redirect the vendor to. `amountCentavos` is the INCLUSIVE total the vendor
 * pays — the caller applies the gateway-cost split (absorb %, pass the fixed card
 * fee) by picking `methods` + amount before calling: e.g. card → fee + ₱15 with
 * methods:['card']; GCash → fee with methods:['gcash']. `metadata.charge_id` is
 * our reconciliation key echoed back verbatim in the webhook.
 *
 * Returns null on any error or when unconfigured (caller treats null as "couldn't
 * start checkout" and shows a retry — never as paid).
 */
export async function createBookingFeeCheckout(args: {
  /** booking_fee_charges.charge_id (UUID) — the webhook settles by this. */
  chargeId: string;
  vendorProfileId: string;
  amountCentavos: number;
  /** Human-readable receipt ref (the charge public_id, S89F-…). */
  referenceNumber: string;
  methods: CheckoutMethod[];
  successUrl: string;
  cancelUrl: string;
  /** Stable per-charge key so a retry doesn't mint a second session. */
  idempotencyKey: string;
}): Promise<CreateCheckoutResult> {
  if (!isPaymongoConfigured()) return null;
  if (!Number.isInteger(args.amountCentavos) || args.amountCentavos <= 0) return null;
  try {
    const res = await fetch(`${PAYMONGO_API}/v2/checkout_sessions`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: 'Setnayan booking fee',
                amount: args.amountCentavos,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: args.methods,
            success_url: args.successUrl,
            cancel_url: args.cancelUrl,
            reference_number: args.referenceNumber,
            description: 'Setnayan booking fee',
            metadata: { charge_id: args.chargeId, vendor_id: args.vendorProfileId },
            send_email_receipt: true,
          },
        },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { id?: string; attributes?: { checkout_url?: string } };
    };
    const url = json?.data?.attributes?.checkout_url;
    const id = json?.data?.id;
    if (typeof url !== 'string' || typeof id !== 'string') return null;
    return { checkoutUrl: url, checkoutSessionId: id };
  } catch {
    return null;
  }
}
