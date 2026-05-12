import { NextResponse } from 'next/server';

// Liveness probe per Sprint 0 acceptance criteria. /api/health/deep is queued
// for iteration 0035 (Observability).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() }, { status: 200 });
}
