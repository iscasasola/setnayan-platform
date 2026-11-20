'use client';

/**
 * 📦 HANDOVER, THEN THE REVIEW — the two cards that close a deal (Unichat part H2, 20 Nov 2026; drawing
 * `UNICHAT-LIVE-2026-11-19.html` `c.type==='handover'` · `'review'`).
 *
 * RULE 0: both are the chat face of records that ship.
 *   · `HandoverCard` — a `booking_handovers` row (Album link · Sample / proof · Note · All delivered), posted by the
 *     supplier through the shipped `vendorPostHandover`. The hosts confirm with the shipped single-winner
 *     `acknowledge_handover` — the same press as the workspace's Handover inbox, never a second way to confirm.
 *   · `ReviewAskCard` — the hosts' `vendor_reviews` row. "Write review" opens the shipped review page, which holds
 *     every rule about who may review; once posted, both sides see the stars and the line.
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, PenLine } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { HANDOVER_KIND_WORD, type HandoverKind } from '@/lib/chat-card-lines';
import { handoverLink, reviewInfoLine, starWords, type HandoverRow } from '@/lib/deal-end';
import { markDay } from '@/lib/supplier-schedule-marks';
import { Sheet } from '@/app/_components/sheet';
import { confirmHandoverFromChat, loadHandover, loadReview } from './deal-end-calls';
import { CouldNotLoad, EqualRow, KindCard, Loading, Problem, type Read } from './card-bits';

type GotHandover = { handover: HandoverRow | null; eventId: string };

export function HandoverCard({
  threadId,
  createdAt,
  kind,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  createdAt: string;
  kind: HandoverKind;
  viewer: 'vendor' | 'couple';
  /** The shop's name on the hosts' copy ("you" on the supplier's own). */
  supplierName: string;
  /** Labs only: the handover as read, so no request is made. */
  seed?: GotHandover;
}) {
  const [read, setRead] = useState<Read<GotHandover>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadHandover({ threadId, kind, lineAt: createdAt }).then((r) => setRead(r.ok ? { at: 'ok', data: { handover: r.handover, eventId: r.eventId } } : { at: 'failed' }));
  }, [threadId, kind, createdAt]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const mine = viewer === 'vendor';
  const h = read.at === 'ok' ? read.data.handover : null;
  const word = HANDOVER_KIND_WORD[kind];
  const received = h?.status === 'acknowledged';
  const link = h ? handoverLink(h) : null;
  const confirm = async () => {
    if (read.at !== 'ok' || !h) return;
    setBusy(true);
    setProblem(null);
    const r = await confirmHandoverFromChat({ handoverId: h.handover_id, eventId: read.data.eventId, eventVendorId: h.event_vendor_id });
    setBusy(false);
    if (r.ok) setRead({ at: 'ok', data: { ...read.data, handover: { ...h, status: 'acknowledged', couple_acknowledged_at: new Date().toISOString() } } });
    else setProblem(r.message);
  };

  return (
    <KindCard
      kind="file"
      topic="files"
      // The drawing's handover: "Handover" as the title, what was delivered as the one line under it.
      kicker={h?.label?.trim() || word}
      title="Handover"
      // The drawing's "Open" sits beside the title — only when there is a real link to open (http/https).
      action={link ? { label: 'Open', href: link, icon: ExternalLink, external: true } : undefined}
      turn={received ? 'done' : !mine && h?.status === 'delivered' ? 'me' : 'wait'}
      settled={received ? `Handover · ${h?.label?.trim() || word} · received${h?.couple_acknowledged_at ? ` ${markDay(h.couple_acknowledged_at)}` : ''}` : undefined}
    >
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="this handover" onRetry={load} />
      ) : !h ? (
        <p className="text-[14px] text-ink/70" data-handover-card="not-found">
          Couldn&rsquo;t find this handover. Open Files to see everything delivered.
        </p>
      ) : (
        <div className="grid gap-2" data-handover-card={h.status}>
          {/* A note's own words; a link is opened by the button, never printed as a second, raw door. */}
          {h.payload && !link ? <p className="whitespace-pre-wrap break-words text-[14px] text-ink/80">{h.payload}</p> : null}
          {h.status === 'disputed' ? <p className="text-[14px] font-medium text-warn-800">Reported as a problem · Setnayan is looking at it</p> : null}
          {!mine && h.status === 'delivered' ? (
            <EqualRow>
              <ActionButton tone="ok" main icon={Check} label="I received it" onClick={confirm} disabled={busy} data-testid="handover-confirm" />
            </EqualRow>
          ) : null}
          {mine && h.status === 'delivered' ? <p className="text-[13px] text-ink/60">Waiting for the hosts to confirm they received it</p> : null}
          <Problem text={problem} />
        </div>
      )}
    </KindCard>
  );
}

type GotReview = { review: { rating: number; body: string | null } | null; writeHref: string | null };

export function ReviewAskCard({
  threadId,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  /** Labs only. */
  seed?: GotReview;
}) {
  const [read, setRead] = useState<Read<GotReview>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadReview(threadId, viewer).then((r) => setRead(r.ok ? { at: 'ok', data: { review: r.review, writeHref: r.writeHref } } : { at: 'failed' }));
  }, [threadId, viewer]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const mine = viewer === 'couple';
  const got = read.at === 'ok' ? read.data : null;
  const stars = got?.review ? starWords(got.review.rating) : null;
  const [info, setInfo] = useState(false);
  const sheetTitle = `review-sheet-${threadId}`;
  return (
    <>
    {/* The drawing's review card wears the quote kind's colour (`KCLS.review = 'k-quote'`); the icon stays the topic's own. */}
    <KindCard
      kind="quote"
      topic="decision"
      // The drawing's ⓘ: how reviews work, one line — the review page's own rule (public, the supplier replies once).
      info={{ onOpen: () => setInfo(true), data: { 'data-review-info': '' } }}
      kicker={stars ? (got!.review!.body ? `“${got!.review!.body}”` : 'Review posted') : mine ? 'Stars and one line' : 'The hosts review'}
      title={
        stars ? (
          <span role="img" aria-label={stars.label} data-review-stars="">
            <span className="text-kind-quote">{stars.on}</span>
            <span className="text-ink/20">{stars.off}</span>
          </span>
        ) : mine ? (
          `How was ${supplierName}?`
        ) : (
          'How did it go?'
        )
      }
      turn={stars ? 'wait' : mine && got?.writeHref ? 'me' : 'wait'}
    >
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="the review" onRetry={load} />
      ) : !stars && mine && got!.writeHref ? (
        <EqualRow data="review-ask">
          <ActionButton tone="brand" main icon={PenLine} label="Write review" href={got!.writeHref} />
        </EqualRow>
      ) : null}
    </KindCard>
    <Sheet open={info} onClose={() => setInfo(false)} labelledById={sheetTitle} rise>
      <div className="grid gap-1 px-4 pb-5 pt-1" data-review-sheet="">
        <p id={sheetTitle} className="text-base font-semibold text-ink">
          Reviews
        </p>
        <p className="text-[15px] text-ink/80">{reviewInfoLine(viewer)}</p>
      </div>
    </Sheet>
    </>
  );
}
