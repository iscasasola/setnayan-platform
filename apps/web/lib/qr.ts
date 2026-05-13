import QRCode from 'qrcode';
import { compositeMonogram, type MonogramConfig } from './monogram';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // ~30% redundancy per spec § Locked structural rules
  margin: 4, // ≥4 modules of quiet zone
  color: {
    dark: '#1A1A1A',  // ink — Sprint 0 default, replaces with role-palette color in 0010
    light: '#FAF7F2', // cream — same as our app background
  },
};

/**
 * Render a guest's invitation QR as an inline SVG string. Encodes the HTTPS
 * fallback URL per spec § Token format and URI scheme — `setnayan://` is the
 * parsing convenience inside native apps, never embedded in printed QRs.
 *
 * When a monogram is supplied, the renderer composites a circular cream-on-
 * accent badge into the center of the QR pattern (level H error correction
 * keeps the code scannable through the clearance).
 */
export async function renderInvitationQrSvg(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  monogram?: MonogramConfig;
}): Promise<string> {
  const url = `${params.appUrl}/${params.slug}?invite=${params.qrToken}`;
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width: 256 });
  if (params.monogram) {
    return compositeMonogram(svg, params.monogram);
  }
  return svg;
}

export function buildInvitationUrl(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
}): string {
  return `${params.appUrl}/${params.slug}?invite=${params.qrToken}`;
}
