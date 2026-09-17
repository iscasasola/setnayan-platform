import 'server-only';
import { parseStoredAsset } from '@/lib/uploads';
import { r2GetBytes } from '@/lib/r2';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import {
  pabuyaQrVerdict,
  railExpectsQrPh,
  type PabuyaQrVerdict,
} from '@/lib/pabuya-qr-verdict';
import type { EgiftMethodKind } from '@/lib/egift-kinds';

/**
 * lib/pabuya-qr-check.server.ts — the I/O half of the gift-QR check.
 *
 * Fetches the uploaded image's authoritative bytes from R2, runs the SHARED
 * two-scale decoder (`lib/qr-decode.ts` — not a third copy), and hands the
 * result to the PURE verdict in `lib/pabuya-qr-verdict.ts`, which owns every
 * decision this file must not make.
 *
 * 🔑 NOTHING IS DECIDED HERE. This module can only answer "what did the
 * decoder read", never "is that acceptable" — so a change of policy is a
 * change to a pure, executable module rather than to a `server-only` one a
 * test can only grep.
 */
export async function checkPabuyaQrImage(args: {
  kind: EgiftMethodKind;
  r2Ref: string;
}): Promise<PabuyaQrVerdict> {
  // Skip the network entirely on a rail we do not hold to QR Ph. The verdict
  // would return ok for these anyway; not fetching is the same answer, faster.
  if (!railExpectsQrPh(args.kind)) return { ok: true };

  const ref = parseStoredAsset(args.r2Ref);
  // A legacy external URL is not ours to fetch (SSRF surface, and it predates
  // uploads entirely). `decoderRan: false` is the honest input: we did not look.
  if (!ref || ref.kind !== 'r2') {
    return pabuyaQrVerdict({ kind: args.kind, decoded: null, decoderRan: false });
  }

  let decoded: string | null = null;
  let decoderRan = false;
  try {
    const { bytes } = await r2GetBytes({ bucket: ref.bucket, key: ref.key });
    decoded = await decodeQrPayloadFromImage(bytes);
    // Set only AFTER both steps return. A throw anywhere above means we never
    // completed a look, and `decoded` is still null for the WRONG reason —
    // reporting that as "no QR found" would blame the couple for our outage.
    decoderRan = true;
  } catch {
    decoderRan = false;
  }

  return pabuyaQrVerdict({ kind: args.kind, decoded, decoderRan });
}
