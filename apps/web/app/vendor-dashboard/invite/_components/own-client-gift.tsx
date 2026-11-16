'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronRight, Gift, Plus, Send, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ChosenRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { useToast } from '@/app/_components/toast/toast-provider';
import { ActionButton } from '@/components/action-button';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { BuyGiftsSheet } from '@/app/vendor-dashboard/shop/promote/_components/shop-gifts-section';
import { formatPhp } from '@/lib/php';
import type { OpenRail } from '@/lib/payment-channels';
import { giftPackLine, giftUnitPrice, type ShopGiftPack } from '@/lib/shop-gifts';
import {
  ADD_ANOTHER_GIFT,
  ADD_CLIENT_LEAD,
  ADD_CLIENT_ROW_LINE,
  ADD_CLIENT_TITLE,
  AT_LEAST_ONE,
  GIFT_FROM_YOU,
  GIFT_STEP_TIP,
  GIFT_WITH_YOUR_LINK,
  NO_STOCK_LINE,
  OWN_CLIENT_PROMISE,
  OWN_CLIENT_PROMISE_LINE,
  OWN_CLIENT_PROMISE_TIP,
  OWN_GIFT_BUY_KEY,
  OWN_GIFT_MAX_LINES,
  OWN_LINK_COVERS,
  OWN_LINK_EACH_LINE,
  OWN_LINK_EMPTY,
  OWN_LINK_NOT_SET,
  TOO_LITTLE_STOCK_LINE,
  anyPackPickable,
  defaultOwnGift,
  fromStockLine,
  isEmailOrPhone,
  ownGiftMenu,
  ownGiftPacks,
  packsLeft,
  usedWhenJoinsLine,
} from '@/lib/own-clients';
import { saveOwnClient, type OwnClientActionState } from '../own-client-actions';

/**
 * 🎁 OWN CLIENTS v3 + v4 — the drawing `supplier_own_clients_v4_2026-11-16_fable.html` (specs 5af4037b, approved
 * 16 Nov), parts 1 · 2 · 3. Only what the drawing marks New:
 *
 *   QR codes   "Add a client" row + the promise line, above Booked and Crew
 *   the sheet  Name · Email or phone · Agreed a date? · Note — then "Gift from you · At least one": one ▾ per gift
 *              listing YOUR STOCK ONLY ("x left"; a badge reward greyed, "Doesn't count here"; "＋ Buy more"),
 *              "＋ Add another gift", "1 from your stock is used when the couple joins". No stock → everything you can
 *              buy, paid with the SHIPPED Buy gifts sheet.
 *   confirm    "Send <name> your invite?" To · Invite · Gift · From your stock · Booking fee — Cancel · Send (the phone's
 *              own share sheet: no Setnayan email, no SMS)
 *   My page    "Gift with your link" — set once on the code.
 *
 * Every title and count arrives read (catalogue + stock). The browser sends pack CODES only.
 */
export type OwnGiftData = {
  /** null ⇒ the catalogue could not be read. */
  packs: ShopGiftPack[] | null;
  /** Papic credits free to give as an own-client gift (bought, not badge reward). null ⇒ unread. */
  credits: number | null;
  /** Badge-reward Papic credits still held — listed greyed, never pickable. */
  rewardLeft: number;
  canBuy: boolean;
  paysGiftPrice: boolean;
  openRails: OpenRail[];
};

const IDLE: OwnClientActionState = { status: 'idle' };
const giftIc = <Gift aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={1.75} />;

/* ── the gift step (one ▾ per gift) ─────────────────────────────────────────────────────────────────────────────── */

function GiftHead({ title }: { title: string }) {
  return (
    <div className="mt-4 flex items-center gap-1.5" data-own-gift-head="">
      {giftIc}
      <InfoTip label={title} labelClassName="text-[15px] font-semibold text-ink" align="start">
        {GIFT_STEP_TIP}
      </InfoTip>
      <span className="ml-auto rounded-full bg-[var(--sn-gold-100)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--sn-gold-800)]">{AT_LEAST_ONE}</span>
    </div>
  );
}

function GiftPicks({
  data,
  picks,
  setPicks,
  onBuy,
  many,
}: {
  data: OwnGiftData;
  picks: string[];
  setPicks: (next: string[]) => void;
  onBuy: (code: string | null) => void;
  many: boolean;
}) {
  const packs = ownGiftPacks(data.packs);
  const creditsOf = (code: string) => packs.find((p) => p.code === code)?.credits ?? 0;
  return (
    <FormRows width="wide" data="own-gift-picks">
      {picks.map((code, i) => {
        const others = picks.reduce((s, c, j) => (j === i ? s : s + creditsOf(c)), 0);
        const room = data.credits === null ? null : Math.max(0, data.credits - others);
        const pack = packs.find((p) => p.code === code) ?? null;
        const left = pack ? packsLeft(room, pack) : null;
        return (
          <ChosenRow
            key={`${i}-${code}`}
            name={many && picks.length > 1 ? `Gift ${i + 1}` : 'Gift'}
            line={fromStockLine(left)}
            label="Gift from your stock"
            value={code}
            buttonText={pack?.title ?? 'Pick a gift'}
            options={ownGiftMenu(data.packs, room, data.rewardLeft, data.canBuy)}
            onPick={(k) => {
              if (k === OWN_GIFT_BUY_KEY) return onBuy(null);
              setPicks(picks.map((c, j) => (j === i ? k : c)));
            }}
            dataAttr="data-own-gift-pick"
          />
        );
      })}
    </FormRows>
  );
}

/** With no stock (or too little): everything the shop can buy, right here — the catalogue's own words and prices. */
function BuyList({ data, chosen, setChosen, empty }: { data: OwnGiftData; chosen: string | null; setChosen: (c: string) => void; empty: boolean }) {
  const packs = ownGiftPacks(data.packs);
  return (
    <div data-own-gift-buy-list="">
      <p className="mt-2 text-[13.5px] text-ink/70">{empty ? NO_STOCK_LINE : TOO_LITTLE_STOCK_LINE}</p>
      <div className="mt-2" role="radiogroup" aria-label="Gifts you can buy">
        {packs.map((p) => (
          <button
            key={p.code}
            type="button"
            role="radio"
            aria-checked={chosen === p.code}
            onClick={() => setChosen(p.code)}
            className={`sn-press flex min-h-14 w-full items-center gap-3 border-b border-[var(--sn-hairline)] py-2.5 text-left last:border-b-0 ${chosen === p.code ? 'text-ink' : ''}`}
            data-own-gift-buy={p.code}
          >
            <span aria-hidden className={`h-4 w-4 flex-none rounded-full border ${chosen === p.code ? 'border-[5px] border-sn-accent' : 'border-ink/30'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-tight text-ink">{p.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink/60">{giftPackLine(p)}</span>
            </span>
            <span className="tabular-nums text-[14px] text-ink">{formatPhp(giftUnitPrice(p, data.paysGiftPrice).centavos / 100)}</span>
          </button>
        ))}
        <Link href="/vendor-dashboard/subscription" className="sn-press flex min-h-14 w-full items-center gap-3 py-2.5 text-left" data-own-gift-plans="">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium leading-tight text-ink">Plans</span>
            <span className="mt-0.5 block text-[13px] text-ink/60">Some plans come with gifts</span>
          </span>
          <ChevronRight aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

/* ── Customers › QR codes · Add a client ───────────────────────────────────────────────────────────────────────── */

export function AddClientBlock({ data, bookedHref }: { data: OwnGiftData; bookedHref: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  const confirmId = useId();
  const form = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const [state, formAction] = useActionState(saveOwnClient, IDLE);
  const handled = useRef<OwnClientActionState | null>(null);
  const [confirm, setConfirm] = useState<Extract<OwnClientActionState, { status: 'added' }> | null>(null);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [dated, setDated] = useState<'no' | 'yes'>('no');
  const first = defaultOwnGift(data.packs, data.credits);
  const [picks, setPicks] = useState<string[]>(first ? [first] : []);
  const [buying, setBuying] = useState<{ code: string | null } | null>(null);
  const [buyPick, setBuyPick] = useState<string | null>(ownGiftPacks(data.packs)[0]?.code ?? null);
  const pickable = anyPackPickable(data.packs, data.credits);
  const packs = ownGiftPacks(data.packs);
  const need = picks.reduce((s, c) => s + (packs.find((p) => p.code === c)?.credits ?? 0), 0);
  const fits = data.credits !== null && picks.length > 0 && need <= data.credits;
  const nextPack = defaultOwnGift(data.packs, data.credits === null ? null : data.credits - need);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'added') {
      setOpen(false);
      setConfirm(state);
    }
  }, [state, toast]);

  const send = async (c: NonNullable<typeof confirm>) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: `An invite for ${c.name}`, text: c.shareText, url: c.url });
      } else {
        await navigator.clipboard.writeText(`${c.shareText} ${c.url}`);
        toast.success('Invite link copied — paste it to them');
      }
      setConfirm(null);
      setName('');
      setContact('');
      setNote('');
    } catch (e) {
      // A closed share sheet is not a failure: the invite is saved and stays usable.
      if ((e as { name?: string })?.name !== 'AbortError') toast.error('Couldn’t open sharing — copy the link instead.');
    }
  };

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-5" data-own-client-add="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          {ADD_CLIENT_TITLE}
        </h2>
        <p className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">{ADD_CLIENT_LEAD}</p>
        <form
          ref={form}
          action={formAction}
          className="mt-3"
          onSubmit={(e) => {
            if (dated === 'yes') return e.preventDefault();
            if (!name.trim() || !isEmailOrPhone(contact) || !fits) {
              e.preventDefault();
              nudgeFormRows(form.current ?? undefined);
            }
          }}
        >
          <input type="hidden" name="mode" value="add" />
          {picks.map((c, i) => (
            <input key={`${i}-${c}`} type="hidden" name="gift" value={c} />
          ))}
          <FormRows width="wide">
            <TypedRow name="Name" value={name} required maxLength={120} fieldName="client_name" autoCapitalize="words" empty="Their name" onKeep={(t) => setName(t)} />
            <TypedRow
              name="Email or phone"
              value={contact}
              required
              maxLength={160}
              fieldName="client_contact"
              empty="How to reach them"
              check={(t: string) => (t.trim() && !isEmailOrPhone(t) ? 'An email, or a phone number' : null)}
              onKeep={(t) => setContact(t)}
            />
            <ChosenRow
              name="Agreed a date?"
              label="Agreed a date?"
              value={dated}
              options={[
                { key: 'no', label: 'Not yet', hint: 'Send your invite — they plan with you on Setnayan' },
                { key: 'yes', label: 'Yes, booked', hint: 'Make their one-use Booked code — date, payments and chat come with it' },
              ]}
              onPick={(k) => setDated(k === 'yes' ? 'yes' : 'no')}
              dataAttr="data-own-client-dated"
            />
            <TypedRow name="Note" value={note} empty="Optional" long maxLength={500} fieldName="client_note" onKeep={(t) => setNote(t)} />
          </FormRows>

          {dated === 'yes' ? (
            <p className="mt-3 text-[13.5px] text-ink/70" data-own-client-booked="">
              Next: your one-use Booked code — total, first payment and proof, as it is today.
            </p>
          ) : (
            <div data-own-gift-step="">
              <GiftHead title={GIFT_FROM_YOU} />
              {data.credits === null || data.packs === null ? (
                <p role="alert" className="mt-2 text-[13.5px] text-ink/70">
                  Your gift stock couldn’t be read just now — reload to try again. Nothing is lost.
                </p>
              ) : pickable && picks.length > 0 ? (
                <>
                  <GiftPicks data={data} picks={picks} setPicks={setPicks} onBuy={(c) => setBuying({ code: c })} many />
                  {nextPack && picks.length < OWN_GIFT_MAX_LINES ? (
                    <button type="button" onClick={() => setPicks([...picks, nextPack])} className="sn-press mt-1 min-h-11 text-[14px] font-semibold text-sn-accent" data-own-gift-add="">
                      {ADD_ANOTHER_GIFT}
                    </button>
                  ) : null}
                  <p className="mt-1 text-[13px] text-ink/60" data-own-gift-used="">
                    ✓ {usedWhenJoinsLine(picks.length)}
                  </p>
                </>
              ) : (
                <BuyList data={data} chosen={buyPick} setChosen={setBuyPick} empty={(data.credits ?? 0) === 0} />
              )}
            </div>
          )}

          <div className="mt-4">
            {dated === 'yes' ? (
              <ActionButton tone="brand" main icon={ChevronRight} label="Next" href={bookedHref} data-testid="own-client-next" />
            ) : pickable && picks.length > 0 ? (
              <SupplierSubmit tone="brand" main icon={<Plus aria-hidden className="h-5 w-5" strokeWidth={1.9} />} label="Add" pendingLabel="Adding…" className="w-full" />
            ) : data.canBuy && buyPick ? (
              // 🍎 Selling is web-only (store shell: `canBuy` is false there too, `shop-gifts-data.ts`).
              <div data-web-only="">
                <ActionButton tone="brand" main icon={Gift} label="Buy gifts" onClick={() => setBuying({ code: buyPick })} aria-haspopup="dialog" data-testid="own-gift-buy" />
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </Sheet>
  );

  const confirmSheet = (
    <Sheet open={confirm !== null} onClose={() => setConfirm(null)} labelledById={confirmId}>
      {confirm ? (
        <div className="px-5 pb-5 pt-5" data-own-client-confirm="">
          <h2 id={confirmId} className="pr-12 text-[17px] font-semibold text-ink">
            Send {confirm.name} your invite?
          </h2>
          <dl className="mt-3 space-y-2 text-[14px]">
            <Row k="To" v={confirm.to} />
            <Row k="Invite" v="Your Shortlist link" />
            <Row k="Gift" v={`${confirm.gift} · your stock`} />
            <Row k="From your stock" v={`${confirm.lines} used when they join`} />
            <Row k="Booking fee" v="None — your client" ok />
          </dl>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="sn-press min-h-12 flex-1 rounded-full border border-ink/15 text-[15px] font-semibold text-ink" data-own-client-cancel="">
              Cancel
            </button>
            <ActionButton tone="brand" main icon={Send} label="Send" onClick={() => void send(confirm)} data-testid="own-client-send" />
          </div>
          <p className="mt-2 text-[12.5px] text-ink/55">It opens on your phone, so it comes from you.</p>
        </div>
      ) : null}
    </Sheet>
  );

  return (
    <div data-own-clients="">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="sn-press flex min-h-14 w-full items-center gap-3 border-b border-[var(--sn-hairline)] py-2.5 text-left"
        data-qr-row="add-client"
      >
        <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[var(--sn-gold-100)]">
          <Plus className="h-5 w-5 text-sn-accent" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-tight text-ink">{ADD_CLIENT_TITLE}</span>
          <span className="mt-0.5 block text-[13px] text-ink/60">{ADD_CLIENT_ROW_LINE}</span>
        </span>
        <ChevronRight aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2} />
      </button>
      <div className="my-2 flex gap-2.5 rounded-xl bg-[var(--sn-gold-100)] px-3 py-2.5" data-own-client-promise="">
        <ShieldCheck aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none text-[var(--sn-gold-800)]" strokeWidth={1.75} />
        <div className="text-[13.5px] leading-snug text-ink">
          <b className="block">{OWN_CLIENT_PROMISE}</b>
          <InfoTip label={OWN_CLIENT_PROMISE_LINE} labelClassName="text-[13px] text-ink/70" align="start">
            {OWN_CLIENT_PROMISE_TIP}
          </InfoTip>
        </div>
      </div>
      {mounted ? createPortal(sheet, document.body) : null}
      {mounted ? createPortal(confirmSheet, document.body) : null}
      {buying && data.canBuy && data.packs ? (
        <BuyGiftsSheet
          open
          onClose={() => setBuying(null)}
          packs={ownGiftPacks(data.packs)}
          paysGiftPrice={data.paysGiftPrice}
          openRails={data.openRails}
          initialCode={buying.code}
        />
      ) : null}
    </div>
  );
}

function Row({ k, v, ok = false }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--sn-hairline)] pb-2 last:border-b-0">
      <dt className="text-ink/60">{k}</dt>
      <dd className={`text-right font-semibold ${ok ? 'text-[rgb(var(--color-ok))]' : 'text-ink'}`}>{v}</dd>
    </div>
  );
}

/* ── Shop › Promote › My page · Gift with your link ────────────────────────────────────────────────────────────── */

export function OwnLinkGift({ data, current }: { data: OwnGiftData; current: { code: string; title: string } | null | 'unread' }) {
  const toast = useToast();
  const [state, formAction] = useActionState(saveOwnClient, IDLE);
  const handled = useRef<OwnClientActionState | null>(null);
  const saved = current && current !== 'unread' ? current.code : null;
  const [pick, setPick] = useState<string | null>(saved ?? defaultOwnGift(data.packs, data.credits));
  const [buying, setBuying] = useState(false);
  const pickable = anyPackPickable(data.packs, data.credits);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'set') toast.success(`${state.gift} goes with your link`);
  }, [state, toast]);

  const empty = data.credits !== null && !pickable;
  return (
    <div className="mt-3.5 border-t border-ink/10 pt-1" data-own-link-gift={saved ? 'set' : 'unset'}>
      <GiftHead title={GIFT_WITH_YOUR_LINK} />
      {current === 'unread' || data.credits === null || data.packs === null ? (
        <p role="alert" className="mt-2 text-[13.5px] text-ink/70">
          Your link’s gift couldn’t be read just now — reload to try again. Nothing is lost.
        </p>
      ) : (
        <>
          {!saved ? <p className="mt-1 text-[13px] text-[rgb(var(--color-danger))]">{OWN_LINK_NOT_SET}</p> : null}
          {empty ? <p className="mt-1 text-[13px] text-[rgb(var(--color-danger))]" data-own-link-empty="">{OWN_LINK_EMPTY}</p> : null}
          {pickable && pick ? (
            <form action={formAction}>
              <input type="hidden" name="mode" value="own_link" />
              <input type="hidden" name="gift" value={pick} />
              <GiftPicks data={data} picks={[pick]} setPicks={(n) => setPick(n[0] ?? pick)} onBuy={() => setBuying(true)} many={false} />
              <p className="mt-1 text-[13px] text-ink/60">✓ {OWN_LINK_EACH_LINE}</p>
              {pick !== saved ? (
                <div className="mt-2">
                  <SupplierSubmit tone="brand" main icon={<Gift aria-hidden className="h-4 w-4" strokeWidth={1.9} />} label="Save this gift" pendingLabel="Saving…" className="w-full" />
                </div>
              ) : null}
            </form>
          ) : data.canBuy ? (
            <div className="mt-2" data-web-only="">
              <ActionButton tone="brand" icon={Gift} label="Buy gifts" onClick={() => setBuying(true)} aria-haspopup="dialog" data-testid="own-link-buy" />
            </div>
          ) : null}
          <p className="mt-1 text-[12.5px] text-ink/55">{OWN_LINK_COVERS}</p>
        </>
      )}
      {buying && data.canBuy && data.packs ? (
        <BuyGiftsSheet open onClose={() => setBuying(false)} packs={ownGiftPacks(data.packs)} paysGiftPrice={data.paysGiftPrice} openRails={data.openRails} initialCode={pick} />
      ) : null}
    </div>
  );
}
