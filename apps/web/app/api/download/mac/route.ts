import { NextResponse } from 'next/server';
import { DESKTOP_RELEASE } from '@/lib/desktop-release';

export const dynamic = 'force-static';

// /api/download/mac → 302 to the current macOS .dmg on GitHub Releases.
// Apple Silicon only for now (M1/M2/M3/M4). Intel-Mac users fall back to web.
export function GET() {
  return NextResponse.redirect(DESKTOP_RELEASE.mac.aarch64.url, 302);
}
