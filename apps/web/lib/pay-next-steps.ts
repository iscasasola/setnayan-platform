/**
 * 💳 STEP 1's "What happens next" FOLLOWS THE ROUTE THE PAYER WILL ACTUALLY TAKE (controller 22 Nov, seen live on
 * /pay/SN1E342727). With Maya on, stage 2 is Maya's secure page — no QR to scan, no receipt to upload, no transfer
 * note — so step 1 must not promise the BDO route. With Maya closed (off, no keys, busy, above the ceiling) the shipped
 * BDO words stand, untouched.
 *
 * The page decides `maya` with the SAME `mayaOpen` it uses to hand the pay panel its Maya stage — one decision, two
 * readers — so step 1 and step 2 can never describe different routes.
 */
export const MAYA_NEXT_STEPS = {
  pay: 'Pay on Maya’s secure page.',
  back: 'Come straight back for your receipt — nothing to upload.',
  activatesPlan: 'Your plan switches on the moment it’s paid.',
  activates: 'It switches on the moment it’s paid.',
} as const;

export const BDO_UPLOAD_STEP = 'Upload the screenshot of your payment receipt — nothing to type.';

export type PayNextSteps = {
  /** The three numbered lines under "What happens next". */
  steps: readonly [string, string, string];
  /** The transfer-note line under the reference — null on the Maya route, where there is no transfer to note. */
  note: string | null;
};

export function payNextSteps(input: {
  maya: boolean;
  isVendorPlan: boolean;
  /** The BDO route's own words (lib/qr-amount-truth.ts `qrWords`), used only when Maya is closed. */
  bdo: { scanStep: string; note: string; activates: string };
}): PayNextSteps {
  if (input.maya) {
    return {
      steps: [
        MAYA_NEXT_STEPS.pay,
        MAYA_NEXT_STEPS.back,
        input.isVendorPlan ? MAYA_NEXT_STEPS.activatesPlan : MAYA_NEXT_STEPS.activates,
      ],
      note: null,
    };
  }
  return { steps: [input.bdo.scanStep, BDO_UPLOAD_STEP, input.bdo.activates], note: input.bdo.note };
}
