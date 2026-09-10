#!/usr/bin/env -S npx tsx
/**
 * scripts/prove-the-flow-watch.ts
 *
 * THE T1 WATCHER — read-only production SELECTs, reported in plain words,
 * for `Test_Script_Live_Two_Sided_2026-09-10.md` (spec corpus) and
 * `build-sessions/PROVE-THE-FLOW.md` (this repo).
 *
 * WHAT IT DOES: after each tap of the owner's live two-sided test, this
 * prints what production's own rows say — the inquiry, the quote, the Deal,
 * the lock, the price change — next to what the screen just told the owner.
 * It never writes anything. It exists because this codebase's repeat failure
 * is not a crash, it is a SCREEN telling a true-sounding lie while the
 * database disagrees (see PROVE-THE-FLOW.md §6: "a rejected query is not a
 * thrown error").
 *
 * ⚠ THIS SCRIPT IS WRITTEN, NOT RUN, BY THE SESSION THAT AUTHORED IT — per
 * that session's own instruction ("write the script only. Do NOT start
 * watching production — the watcher runs when the owner begins the test").
 * Nothing here executes on its own; it is invoked by hand when the owner sits
 * down to tap through the walk.
 *
 * USAGE
 *   cd apps/web
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/prove-the-flow-watch.ts \
 *     --vendor-slug=<shop's slug, from its /v/<slug> address> \
 *     --event-id=<the couple's event UUID>
 *
 *   Add --json for machine output. Add --save=<file> to snapshot the read so
 *   a LATER run can diff against it (nothing here polls or loops by itself —
 *   run it again by hand after the next tap).
 *
 * ENV: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Read-only by construction: every call below is `.select(...)`, never
 * `.insert`/`.update`/`.delete`/`.rpc`. If that ever stops being true, this
 * script has stopped being safe to hand the owner.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  describeCard,
  describeThread,
  describeAmendment,
  describeProposal,
  describeLock,
  describeChangeTrail,
  type CardRow,
  type ThreadRow,
  type ProposalRow,
  type AmendmentRow,
  type EventVendorRow,
  type ChangeOrderRow,
} from '../lib/prove-the-flow-watch-format';

type Args = {
  vendorSlug: string | null;
  eventId: string | null;
  json: boolean;
  save: string | null;
  diffAgainst: string | null;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { vendorSlug: null, eventId: null, json: false, save: null, diffAgainst: null };
  for (const t of argv) {
    if (t.startsWith('--vendor-slug=')) a.vendorSlug = t.slice('--vendor-slug='.length);
    else if (t.startsWith('--event-id=')) a.eventId = t.slice('--event-id='.length);
    else if (t === '--json') a.json = true;
    else if (t.startsWith('--save=')) a.save = t.slice('--save='.length);
    else if (t.startsWith('--diff-against=')) a.diffAgainst = t.slice('--diff-against='.length);
  }
  return a;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    fail(
      'Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY — ' +
        'this reads production, read-only, with the service role (RLS does not scope a ' +
        "single couple/vendor pair the way the app's own session client would).",
    );
  }
  if (!args.vendorSlug) fail('--vendor-slug=<shop slug> is required (from its /v/<slug> address).');
  if (!args.eventId) fail('--event-id=<uuid> is required (the couple\'s event, from the dashboard URL).');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // ── Resolve the vendor profile from its public slug ──────────────────────
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug')
    .eq('business_slug', args.vendorSlug)
    .maybeSingle();
  if (vendorErr) fail(`Could not read vendor_profiles: ${vendorErr.message}`);
  if (!vendor) fail(`No shop found at slug "${args.vendorSlug}".`);
  const vendorProfileId = (vendor as { vendor_profile_id: string }).vendor_profile_id;

  // ── The shop's cards (step 1: A1 gift optional, B1 named) ────────────────
  const { data: cards } = await supabase
    .from('vendor_services')
    .select('service_id, title, category, price_php, is_active, includes_setnayan_gift')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });

  // ── The one inquiry thread between this couple and this shop ─────────────
  const { data: thread } = await supabase
    .from('chat_threads')
    .select(
      'thread_id, inquiry_status, accepted_at, agreed_price_centavos, locked_at, locked_by_user_id',
    )
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const threadRow = (thread ?? null) as ThreadRow;

  let messages = { total: 0, fromVendor: 0 };
  if (threadRow) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('sender_role')
      .eq('thread_id', threadRow.thread_id);
    const rows = (msgs ?? []) as { sender_role: string | null }[];
    messages = { total: rows.length, fromVendor: rows.filter((m) => m.sender_role === 'vendor').length };
  }

  // ── The latest formal quote ───────────────────────────────────────────────
  const { data: proposals } = await supabase
    .from('vendor_proposals')
    .select('proposal_id, status, total_centavos, sent_at')
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(1);
  const proposal = ((proposals ?? [])[0] ?? null) as ProposalRow;

  // ── The latest in-chat Deal (amendment) ───────────────────────────────────
  const { data: amendments } = threadRow
    ? await supabase
        .from('proposal_amendments')
        .select('amendment_id, status, base_proposal_id, locked_at')
        .eq('thread_id', threadRow.thread_id)
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: [] as unknown[] };
  const amendment = ((amendments ?? [])[0] ?? null) as AmendmentRow;

  // ── The booking row + lock state ──────────────────────────────────────────
  const { data: eventVendors } = await supabase
    .from('event_vendors')
    .select('vendor_id, status, total_cost_php, linked_vendor_profile_id, selection_match_rank, lock_request_state')
    .eq('event_id', args.eventId)
    .eq('linked_vendor_profile_id', vendorProfileId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const eventVendor = ((eventVendors ?? [])[0] ?? null) as EventVendorRow;

  // ── The change-order trail since the lock (B2) ────────────────────────────
  let changeOrders: ChangeOrderRow[] = [];
  if (eventVendor) {
    const { data: cos, error: coErr } = await supabase
      .from('vendor_change_orders')
      .select('change_order_id, raised_by, delta_amount_php, status')
      .eq('event_vendor_id', eventVendor.vendor_id)
      .order('created_at', { ascending: true });
    if (!coErr) changeOrders = (cos ?? []) as ChangeOrderRow[];
    // A missing table/column here (B2 not yet merged) is reported, not thrown —
    // the watcher must survive being run before every session it checks lands.
  }

  const snapshot = {
    at: new Date().toISOString(),
    vendorSlug: args.vendorSlug,
    eventId: args.eventId,
    card: (cards ?? [])[0] ?? null,
    thread: threadRow,
    messages,
    proposal,
    amendment,
    eventVendor,
    changeOrders,
  };

  let originalTotalPhp: number | null = null;
  if (args.diffAgainst && existsSync(args.diffAgainst)) {
    try {
      const prior = JSON.parse(readFileSync(args.diffAgainst, 'utf8'));
      if (prior?.eventVendor?.total_cost_php != null) {
        originalTotalPhp = Number(prior.eventVendor.total_cost_php);
      }
    } catch {
      // A malformed snapshot file is not a reason to refuse the current read.
    }
  }

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    const lines = [
      `Shop: ${(vendor as { business_name: string }).business_name} (${args.vendorSlug})`,
      `1 · Card — ${describeCard(((cards ?? [])[0] ?? null) as CardRow | null)}`,
      `2 · Inquiry — ${describeThread(threadRow, messages)}`,
      `3 · Deal in chat — ${describeAmendment(amendment, threadRow)}`,
      `4 · Formal quote — ${describeProposal(proposal)}`,
      `5 · Lock — ${describeLock(eventVendor)}`,
      `6 · Price change since lock — ${describeChangeTrail(eventVendor, changeOrders, originalTotalPhp)}`,
    ];
    console.log(lines.join('\n'));
  }

  if (args.save) {
    writeFileSync(args.save, JSON.stringify(snapshot, null, 2));
    console.error(`\n(saved to ${args.save} — pass --diff-against=${args.save} next run to catch a silent replace)`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e?.message ?? e}`);
  process.exit(1);
});
