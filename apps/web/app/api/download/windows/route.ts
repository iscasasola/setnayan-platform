import { NextResponse } from 'next/server';
import { resolveDesktopRelease } from '@/lib/desktop-release-server';

// /api/download/windows -> 302 to the current Windows .msi on R2. New in S10 —
// there was no Windows download route at all before this (the whole desktop
// release was macOS-only). Unsigned until S11 lands a code-signing cert;
// SmartScreen will warn on first run (see /download's readiness copy).
export async function GET(request: Request) {
  const release = await resolveDesktopRelease();
  if (!release?.windows) {
    return NextResponse.json(
      { error: 'No Windows build is published right now. Try again shortly, or see /download.' },
      { status: 503 },
    );
  }
  const target = new URL(release.windows.url, request.url);
  return NextResponse.redirect(target, 302);
}
