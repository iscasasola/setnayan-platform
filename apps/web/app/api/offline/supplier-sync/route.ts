import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, rateLimited429 } from '@/lib/with-rate-limit';
import { supplierOffline } from '@/lib/supplier-offline/engine.server';
import { SUPPLIER_OFFLINE_WIRE, isSupplierOfflineOp } from '@/lib/supplier-offline/replies';

/**
 * 📶 THE SUPPLIER OFFLINE ROUTE (owner 24 Nov 2026, DECISION_LOG "The supplier dashboard works offline…"; controller
 * review #2 item 4). The phone's queue is sent HERE — a stable address with a versioned JSON payload — never through a
 * server action: an action's id changes with every deploy, and a phone that kept its work through a deploy would then
 * read "action not found" as "no signal" forever. The door (`lib/supplier-offline/engine.server.ts`) does every check;
 * this route only speaks the wire and limits the rate. Signed-in session only (the door reads it).
 *
 *   POST { v: 1, op, fields }  →  200 { v: 1, reply }     the door's typed answer
 *                              →  409 { v: 1, update }    another payload version: the phone must update, never guessed
 *                              →  429                     too many: the phone keeps the item and tries later
 */
export const dynamic = 'force-dynamic';

const LIMITS = { sync: { limit: 240, windowSecs: 60 }, register: { limit: 10, windowSecs: 600 } } as const;

export async function POST(req: NextRequest) {
  let body: { v?: unknown; op?: unknown; fields?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ v: SUPPLIER_OFFLINE_WIRE, error: 'shape' }, { status: 422 });
  }
  if (body.v !== SUPPLIER_OFFLINE_WIRE) return NextResponse.json({ v: SUPPLIER_OFFLINE_WIRE, update: true }, { status: 409 });
  if (!isSupplierOfflineOp(body.op) || !body.fields || typeof body.fields !== 'object') {
    return NextResponse.json({ v: SUPPLIER_OFFLINE_WIRE, error: 'shape' }, { status: 422 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limit = body.op === 'device.register' ? LIMITS.register : LIMITS.sync;
  const rl = await enforceRateLimit(body.op === 'device.register' ? 'offline-device-register' : 'offline-supplier-sync', user?.id ?? null, limit);
  if (!rl.ok) return rateLimited429(rl.retryAfterSecs);

  const fd = new FormData();
  fd.set('op', body.op);
  for (const [k, v] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length <= 20000) fd.set(k, v);
  }
  const reply = await supplierOffline(fd);
  return NextResponse.json({ v: SUPPLIER_OFFLINE_WIRE, reply }, { headers: { 'cache-control': 'no-store' } });
}
