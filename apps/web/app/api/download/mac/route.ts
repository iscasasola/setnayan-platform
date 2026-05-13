import { NextResponse } from 'next/server';
import { DESKTOP_RELEASE } from '@/lib/desktop-release';

// /api/download/mac → 302 to the current macOS .dmg under /downloads.
// Apple Silicon only for now (M1/M2/M3/M4). Intel-Mac users fall back to web.
// Built as a runtime route (not prerendered) because NextResponse.redirect
// rejects relative URLs at static-export time; we need request.url to build
// the absolute origin.
export function GET(request: Request) {
  const target = new URL(DESKTOP_RELEASE.mac.aarch64.url, request.url);
  return NextResponse.redirect(target, 302);
}
