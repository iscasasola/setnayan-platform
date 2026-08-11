import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile, type VendorProfileRow } from '@/lib/vendor-profile';
import { fetchThreadById, type ChatThreadRow } from '@/lib/chat';
import { notifyOtherParty } from '@/lib/chat-actions';
import { resolveTokens, formatCentavos, type ProposalLineItem } from '@/lib/vendor-proposals';
import {
  resolveProposalValues,
  resolvePackageLineItems,
  minimalBrief,
  type ProposalBrief,
} from '@/lib/proposal-merge';
import {
  sanitizeAndResolveSchedule,
  type ResolvedSchedule,
} from '@/lib/proposal-payment-schedule';
import { applyFreeTransportToQuote } from '@/lib/vendor-free-transport';
import { resolveThreadFreeTransport } from '@/lib/vendor-free-transport.server';

/**
 * Shared CORE for the in-chat vendor proposal (a "quote" is simply a proposal
 * with a total). Split out of the collocated server action so the SAME
 * ownership + accepted-thread gating + draft→sent freeze runs under both the
 * web action (sendProposalFromChat) and the native endpoint
 * (api/vendor/chat/[threadId]/proposal). The caller passes its OWN RLS-scoped
 * client; we never write a price the couple didn't accept — acceptance still
 * goes through the DB-guarded respond_vendor_proposal RPC.
 *
 * Two entry points share the gating + card-post below:
 *   • sendProposalCore       — template + package-resolved line items (the
 *                              original data-link path). UNCHANGED behavior.
 *   • sendCustomProposalCore — Vendor Proposal Maker (PR 3): the vendor AUTHORS
 *                              the line items in the in-thread editor and passes
 *                              them in explicitly (pricing bases + freebies +
 *                              crew/transport already resolved to centavos via
 *                              lib/package-line-pricing.ts). Same gate, same
 *                              draft→sent freeze, same in-thread card.
 */

export type SendProposalError =
  | 'unauthenticated'
  | 'not_owner'
  | 'thread_closed'
  | 'tier_free'
  | 'needs_template'
  // Booking-fee prepaid gate: a fee is owed on this send and hasn't been paid.
  // Only reachable when the fee is ENFORCED (flag on + live Maya rail); until then
  // the gate always clears. The draft is left in place to be completed at checkout.
  | 'fee_unpaid'
  | 'failed';

export type SendProposalResult =
  | { ok: true; proposalId: string; publicId: string; cardPosted: boolean; priceLabel: string }
  | { ok: false; code: SendProposalError; message: string };

export interface SendProposalInput {
  threadId: string;
  templateId: string;
  /** Optional — falls back to the template's default package. */
  packageId?: string | null;
  /** Optional manual total (PHP) used only when no package priced it. */
  totalPhp?: number | null;
  /** Optional YYYY-MM-DD quote expiry. */
  validUntil?: string | null;
  /** Optional custom title. */
  title?: string | null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Shared gating + card-post (identical under both send paths)              */
/* ──────────────────────────────────────────────────────────────────────── */

type ThreadGate =
  | { ok: true; user: { id: string }; profile: VendorProfileRow; thread: ChatThreadRow }
  | { ok: false; code: SendProposalError; message: string };

/**
 * The ownership + accepted-thread + FREE-tier gate every proposal send must
 * clear before it may INSERT a vendor_proposals row and post a chat card.
 * Extracted verbatim from the original sendProposalCore body so the custom
 * (vendor-authored) send path enforces the EXACT same guarantees — a FREE
 * vendor, a foreign thread, or a not-yet-accepted inquiry can never post a
 * proposal card here.
 */
async function gateVendorProposalThread(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ThreadGate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthenticated', message: 'Sign in again to send a proposal.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, code: 'not_owner', message: 'No vendor profile for this account.' };

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return { ok: false, code: 'not_owner', message: 'This conversation isn’t yours.' };
  }
  // A proposal is a real reply — only on an open (accepted) conversation.
  if (thread.inquiry_status !== 'accepted') {
    return {
      ok: false,
      code: 'thread_closed',
      message: 'You can only send a proposal on an open conversation.',
    };
  }

  // Inbox ungated (owner 2026-07-24) — the mirrored FREE-tier block that used to
  // sit here (matching sendChatMessageCore's tier gate) has been REMOVED. A
  // proposal is an answer, and the inbox is never locked by tier: a vendor on any
  // tier who has an accepted thread can post a proposal. The gate this mirrored
  // is gone in lib/chat-send.ts, so keeping it here would re-introduce the wall
  // we just removed. Couple-side spam protection is unaffected (it lives on the
  // inquiry-open path in lib/inquiry-gate.ts, not here).

  return { ok: true, user, profile, thread };
}

/**
 * Retire any earlier still-live proposal for this (event, vendor) so the couple
 * can't accept a stale quote, then post the proposal AS a message into the
 * thread (the in-thread card) and notify the couple. Shared tail for both send
 * paths — behavior identical to the original sendProposalCore steps 6+7.
 */
async function supersedeAndPostCard(
  supabase: SupabaseClient,
  args: {
    thread: ChatThreadRow;
    userId: string;
    eventId: string;
    proposalId: string;
    title: string;
    totalCentavos: number;
  },
): Promise<{ cardPosted: boolean; priceLabel: string }> {
  const { thread, userId, eventId, proposalId, title, totalCentavos } = args;

  // Retire any earlier still-live proposal for this (event, vendor) so the
  // couple can't accept a stale quote. DEFINER RPC — RLS blocks the vendor from
  // updating non-draft rows directly. Best-effort.
  await supabase.rpc('supersede_prior_vendor_proposals', {
    p_event_id: eventId,
    p_vendor_profile_id: thread.vendor_profile_id,
    p_keep_proposal_id: proposalId,
  });

  // Post the proposal AS a message into the thread (the in-thread card).
  // sender_role='vendor' also stamps vendor_first_reply_at via the DB trigger.
  const priceLabel = totalCentavos > 0 ? formatCentavos(totalCentavos) : 'Price on request';
  const body = `📄 Proposal — “${title}” · ${priceLabel}. Tap to review and accept.`;
  // sender_user_id / sender_role omitted — `authenticated` cannot write either
  // (migration 20271132839561); the DB derives them from auth.uid(). The row
  // still lands as 'vendor' because gateVendorProposalThread has already
  // established that the caller OWNS this vendor profile and that the thread
  // belongs to it, which is exactly what the derivation resolves.
  const { error: msgErr } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: eventId,
    vendor_profile_id: thread.vendor_profile_id,
    body,
    proposal_id: proposalId,
  });

  // Notify the couple, same path as a normal vendor message — fire even if the
  // in-thread card failed to post (msgErr), so they still learn a proposal
  // arrived (it's live at /proposals/{public_id} regardless of the card).
  await notifyOtherParty({
    threadId: thread.thread_id,
    eventId,
    vendorProfileId: thread.vendor_profile_id,
    senderRole: 'vendor',
    senderUserId: userId,
    body,
    isFirstMessage: false,
  });

  return { cardPosted: !msgErr, priceLabel };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Path 1 — template + package-resolved proposal (UNCHANGED behavior)       */
/* ──────────────────────────────────────────────────────────────────────── */

export async function sendProposalCore(
  supabase: SupabaseClient,
  input: SendProposalInput,
): Promise<SendProposalResult> {
  const gate = await gateVendorProposalThread(supabase, input.threadId);
  if (!gate.ok) return gate;
  const { user, profile, thread } = gate;

  const templateId = input.templateId?.trim() ?? '';
  if (!templateId) return { ok: false, code: 'needs_template', message: 'Pick a template to send a proposal.' };

  const eventId = thread.event_id;

  // 1 · Template (RLS: own org only).
  const { data: template } = await supabase
    .from('vendor_proposal_templates')
    .select('template_id, body, terms, default_package_id')
    .eq('template_id', templateId)
    .maybeSingle();
  if (!template) return { ok: false, code: 'needs_template', message: 'Pick a template to send a proposal.' };

  // 2 · Brief — booked threads resolve the rich auto-fill; inquiry threads fall
  // back to a minimal brief (event identity only, no shared planning data).
  let brief: ProposalBrief;
  const { data: briefData } = await supabase.rpc('get_vendor_event_brief', { p_event_id: eventId });
  if (briefData) {
    brief = briefData as ProposalBrief;
  } else {
    const { data: ev } = await supabase
      .from('events')
      .select('display_name, event_date, venue_name, venue_address')
      .eq('event_id', eventId)
      .maybeSingle();
    brief = minimalBrief({
      display_name: ev?.display_name ?? null,
      event_date: ev?.event_date ?? null,
      venue_name: ev?.venue_name ?? null,
      venue_address: ev?.venue_address ?? null,
    });
  }

  // 3 · Package line items + manual-total fallback (mirrors createProposal).
  const packageId = (input.packageId ?? '').trim() || template.default_package_id || null;
  const {
    packageName,
    totalCentavos: pkgTotal,
    lineItems,
  } = await resolvePackageLineItems(supabase, profile.vendor_profile_id, packageId);
  let totalCentavos = pkgTotal;
  const totalPhpRaw = Number(input.totalPhp);
  if (totalCentavos === 0 && Number.isFinite(totalPhpRaw) && totalPhpRaw > 0) {
    totalCentavos = Math.round(totalPhpRaw * 100);
  }

  // 4 · Resolve merge tokens (shared resolver) + title.
  const values = resolveProposalValues(brief, {
    businessName: profile.business_name ?? null,
    packageName,
    totalCentavos,
  });
  const titleRaw = (input.title ?? '').trim().slice(0, 160);
  const title =
    titleRaw ||
    `${profile.business_name ?? 'Proposal'} — ${brief.event.display_name ?? 'your event'}`.slice(0, 160);

  const validUntil = (input.validUntil ?? '').trim();

  // 5 · Insert as draft, then flip to sent (the draft→sent freeze is what the
  // UPDATE-draft RLS allows; inserting 'sent' directly would fail the policy).
  const { data: inserted, error: insErr } = await supabase
    .from('vendor_proposals')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      event_id: eventId,
      template_id: template.template_id,
      title,
      merge_snapshot: {
        values,
        confirmed_guests: brief.pax.attending,
        resolved_at: new Date().toISOString(),
      },
      rendered_body: resolveTokens(template.body, values),
      rendered_terms: resolveTokens(template.terms, values),
      line_items: lineItems,
      total_centavos: totalCentavos,
      valid_until: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
      status: 'draft',
    })
    .select('proposal_id, public_id')
    .single();
  if (insErr || !inserted) return { ok: false, code: 'failed', message: 'Couldn’t send that proposal. Please try again.' };

  // 5b · Booking-fee prepaid SEND-gate RETIRED 2026-07-24 — the fee TRIGGER moved
  // to the LOCK (finalizeVendor → collectBookingFeeAtLock; base = the couple-
  // confirmed agreed total). Retired to guarantee a SINGLE trigger; leaving it
  // would double-charge once the rail flag flips. Byte-identical today (inert).

  const { error: sendErr } = await supabase
    .from('vendor_proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('proposal_id', inserted.proposal_id)
    .eq('status', 'draft');
  if (sendErr) {
    // Don't strand the just-created draft — couples can't see drafts, but a
    // retry would otherwise pile up orphans. Best-effort cleanup (RLS scopes
    // the delete to the vendor's own draft).
    await supabase
      .from('vendor_proposals')
      .delete()
      .eq('proposal_id', inserted.proposal_id)
      .eq('status', 'draft');
    return { ok: false, code: 'failed', message: 'Couldn’t send that proposal. Please try again.' };
  }

  const { cardPosted, priceLabel } = await supersedeAndPostCard(supabase, {
    thread,
    userId: user.id,
    eventId,
    proposalId: inserted.proposal_id,
    title,
    totalCentavos,
  });

  return {
    ok: true,
    proposalId: inserted.proposal_id,
    publicId: inserted.public_id,
    cardPosted,
    priceLabel,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Path 2 — vendor-authored custom proposal (Vendor Proposal Maker · PR 3)  */
/* ──────────────────────────────────────────────────────────────────────── */

export interface SendCustomProposalInput {
  threadId: string;
  /**
   * Vendor-authored, already-resolved line items (centavos). Freebies carry a
   * null amount (render "Complimentary"); discount + crew-meal-offset credit
   * ride as NEGATIVE lines so the itemization reconciles to total_centavos.
   */
  lineItems: ProposalLineItem[];
  /** Optional YYYY-MM-DD quote expiry. */
  validUntil?: string | null;
  /** Optional custom title (auto-titled from business + event if blank). */
  title?: string | null;
  /** Optional free-text note shown to the couple as the proposal body. */
  note?: string | null;
  /**
   * Optional self-balancing payment schedule draft (Vendor Proposal Maker § 8).
   * Raw wire shape — { manual, autoBalance, baseCentavos, creditCentavos } — that
   * the server RE-RESOLVES through the pure resolver so the persisted numbers are
   * authoritative, never the client's arithmetic. Null / no installments → no
   * schedule stored ({}), the proposal renders line items only.
   */
  schedule?: unknown;
  /**
   * Optional array of the vendor's own vendor_payment_methods.payment_method_id
   * to show the couple with this quote (§ 9). Validated server-side against the
   * vendor's OWN methods; unknown ids are dropped. [] = show all approved.
   */
  paymentMethodIds?: string[] | null;
}

const MAX_CUSTOM_LINE_ITEMS = 60;
const MAX_PAYMENT_METHODS = 12;

/** Coerce anything to a finite integer (0 fallback). */
function intOrZero(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sanitize the vendor-authored line items server-side and RECOMPUTE the total
 * from them, so the persisted total_centavos always equals the itemization the
 * couple sees (the client can't drift the headline off its own lines). Null
 * amounts (freebies / distance-transport) stay null and contribute nothing.
 * Returns the clamped line items + the derived non-negative total.
 */
function sanitizeCustomLineItems(
  raw: ProposalLineItem[],
): { lineItems: ProposalLineItem[]; totalCentavos: number } {
  const lineItems: ProposalLineItem[] = (Array.isArray(raw) ? raw : [])
    .slice(0, MAX_CUSTOM_LINE_ITEMS)
    .map((li) => {
      const label = String(li?.label ?? '').trim().slice(0, 200) || 'Line item';
      const detailRaw = li?.detail == null ? null : String(li.detail).trim().slice(0, 200);
      const amount =
        li?.amount_centavos == null || !Number.isFinite(Number(li.amount_centavos))
          ? null
          : intOrZero(li.amount_centavos);
      return { label, detail: detailRaw && detailRaw.length > 0 ? detailRaw : null, amount_centavos: amount };
    })
    .filter((li) => li.label.length > 0);

  const sum = lineItems.reduce((s, li) => s + (li.amount_centavos ?? 0), 0);
  return { lineItems, totalCentavos: Math.max(0, sum) };
}

/**
 * Send a VENDOR-AUTHORED proposal (the in-thread Proposal Maker). Shares the
 * exact same gating + draft→sent freeze + supersede + in-thread card as
 * sendProposalCore, but takes explicit line items instead of resolving a
 * template + package. The vendor is quoting their OWN price on their OWN booked
 * event (RLS INSERT policy still enforces booked-event scope), so we trust the
 * composed line amounts and only clamp them; the total is recomputed from the
 * lines. No template_id (custom quote).
 */
export async function sendCustomProposalCore(
  supabase: SupabaseClient,
  input: SendCustomProposalInput,
): Promise<SendProposalResult> {
  const gate = await gateVendorProposalThread(supabase, input.threadId);
  if (!gate.ok) return gate;
  const { user, profile, thread } = gate;
  const eventId = thread.event_id;

  const sanitized = sanitizeCustomLineItems(input.lineItems);
  if (sanitized.lineItems.length === 0) {
    return { ok: false, code: 'failed', message: 'Add at least one line item before sending a quote.' };
  }

  // ── Inner-ring free travel · THE ENFORCEMENT BOUNDARY (spec §17 · PR #3816) ──
  // The Proposal Maker composes its line items in the BROWSER and POSTs them as
  // JSON, so anything the client does about the transportation field is a
  // suggestion. Without this, a crafted request hangs a ₱15,000 "Transportation"
  // line on a quote for a venue the vendor THEMSELVES declared inside their
  // free-travel ring, and the couple is billed for travel the bench badge
  // promised was free.
  //
  // Flag-dark and fail-soft: `resolveThreadFreeTransport` returns null before
  // issuing a single query while NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED is
  // off, and on any error; `applyFreeTransportToQuote(lines, null)` returns the
  // same lines and the same total, so the flag-off path is behaviourally
  // identical to before this block existed.
  //
  // The total is RECOMPUTED from the enforced lines — rewriting a line without
  // re-summing would persist a headline the itemization contradicts, and the
  // headline is what the booking-fee and payment-schedule maths read.
  const freeTransport = await resolveThreadFreeTransport({
    vendorProfileId: profile.vendor_profile_id,
    eventId,
  });
  const enforced = applyFreeTransportToQuote(sanitized.lineItems, freeTransport);
  const lineItems: ProposalLineItem[] = enforced.lineItems;
  const totalCentavos = enforced.totalCentavos;

  // Payment schedule (§ 8) — RE-RESOLVE server-side from the drafts so the
  // persisted, self-balancing numbers come from the pure resolver, not the
  // client. Null when the vendor built no schedule → store {} (degrades to line
  // items only on the couple view).
  const resolvedSchedule: ResolvedSchedule | null = sanitizeAndResolveSchedule(input.schedule);

  // Accepted payment methods (§ 9) — keep ONLY ids that are this vendor's OWN
  // methods (RLS-scoped read on the vendor's client; owner RLS already blocks
  // reading anyone else's, but we intersect explicitly so a spoofed id is
  // dropped). [] = show all approved by default (couple-side resolver).
  let paymentMethodIds: string[] = [];
  {
    const requested = Array.isArray(input.paymentMethodIds)
      ? input.paymentMethodIds
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .slice(0, MAX_PAYMENT_METHODS)
      : [];
    if (requested.length > 0) {
      const { data: ownMethods } = await supabase
        .from('vendor_payment_methods')
        .select('payment_method_id')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .in('payment_method_id', requested);
      const owned = new Set(
        ((ownMethods ?? []) as { payment_method_id: string }[]).map((m) => m.payment_method_id),
      );
      // Preserve the vendor's chosen order; keep only owned ids.
      paymentMethodIds = requested.filter((id) => owned.has(id));
    }
  }

  // Title — reuse the event display_name for the default (no template here).
  const { data: ev } = await supabase
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const titleRaw = (input.title ?? '').trim().slice(0, 160);
  const title =
    titleRaw ||
    `${profile.business_name ?? 'Quote'} — ${ev?.display_name ?? 'your event'}`.slice(0, 160);

  const note = (input.note ?? '').trim().slice(0, 20000);
  const renderedBody =
    note ||
    `Quote from ${profile.business_name ?? 'your vendor'}. Review the line items below and accept to add it to your plan.`;

  const validUntil = (input.validUntil ?? '').trim();

  // Insert as draft, then flip to sent (mirrors the package path's freeze).
  const { data: inserted, error: insErr } = await supabase
    .from('vendor_proposals')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      event_id: eventId,
      template_id: null,
      title,
      merge_snapshot: {
        source: 'proposal_maker',
        resolved_at: new Date().toISOString(),
      },
      rendered_body: renderedBody,
      rendered_terms: '',
      line_items: lineItems,
      total_centavos: totalCentavos,
      payment_schedule: resolvedSchedule ?? {},
      payment_method_ids: paymentMethodIds,
      valid_until: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
      status: 'draft',
    })
    .select('proposal_id, public_id')
    .single();
  if (insErr || !inserted) return { ok: false, code: 'failed', message: 'Couldn’t send that quote. Please try again.' };

  // Booking-fee prepaid SEND-gate RETIRED 2026-07-24 (see sendProposalCore) — the
  // fee TRIGGER moved to the LOCK. Retired to keep a single trigger; inert today.

  const { error: sendErr } = await supabase
    .from('vendor_proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('proposal_id', inserted.proposal_id)
    .eq('status', 'draft');
  if (sendErr) {
    await supabase
      .from('vendor_proposals')
      .delete()
      .eq('proposal_id', inserted.proposal_id)
      .eq('status', 'draft');
    return { ok: false, code: 'failed', message: 'Couldn’t send that quote. Please try again.' };
  }

  const { cardPosted, priceLabel } = await supersedeAndPostCard(supabase, {
    thread,
    userId: user.id,
    eventId,
    proposalId: inserted.proposal_id,
    title,
    totalCentavos,
  });

  return {
    ok: true,
    proposalId: inserted.proposal_id,
    publicId: inserted.public_id,
    cardPosted,
    priceLabel,
  };
}

/**
 * Settle-on-VIEW's legit half: transition a proposal sent→viewed when a
 * CUSTOMER-side member (couple/coordinator, never the vendor) opens a delivered
 * quote. 'viewed' is a load-bearing proposal status the vendor's clients/funnel
 * surfaces read ("your quote was opened") — independent of any token economy.
 *
 * The RPC re-verifies customer-side membership itself and only transitions
 * sent→viewed (idempotent — a re-open or a vendor's own preview no-ops). Runs on
 * the admin client so it works cleanly from `after()` off the request path.
 * Best-effort — never throws (the couple already saw the quote).
 *
 * (The former token-consume side of this — the vendor's held lead-token settled
 * on view — was retired with the lead-token HOLD path; only the status
 * transition remains.)
 */
export async function markProposalViewed(publicId: string, viewerUserId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('mark_proposal_viewed' as never, {
      p_public_id: publicId,
      p_viewer_user_id: viewerUserId,
    } as never);
  } catch (e) {
    // Best-effort — the couple already saw the quote; a missed transition just
    // means the vendor's "opened" signal lags until the next open.
    console.warn('[proposal-send] mark-viewed failed:', e);
  }
}
