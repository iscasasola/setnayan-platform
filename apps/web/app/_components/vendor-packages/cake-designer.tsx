'use client';

/**
 * 🎂 "DESIGN YOUR CAKE" — the couple's side of the Cake Maker (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO
 * BUILD"; drawing prototypes/cake_maker_2026-11-21/cake_maker_fable.html §02).
 *
 * For a cake card's own package this REPLACES the plain list of choice lines in the shipped Book sheet
 * (`lock-modal.tsx`): the same lines, grouped, under a live picture of the cake. Loaded only when opened.
 *
 *   · The total is the SHIPPED `choiceTotals` — the one price plus the extras picked (ruling 1, 3). Same function, same
 *     flag, same inputs as `lockPackage`'s own commit, so the number shown is the number Book charges.
 *   · Colours start from the couple's own Mood Board (ruling 6); a 4th tick is refused with the drawn line.
 *   · "Send to [shop]" is the main button (ruling 7): `startServiceInquiry` with the design as ids — the server re-reads
 *     every label and price. "or Book at this total · your supplier confirms" is the line under it.
 *   · A design that did not go across says so, and never "sent".
 */
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ChevronDown, Clock, MessageCircle, X } from 'lucide-react';
import {
  CAKE_COLOURS_MAX,
  cakeSelection,
  colourCapOf,
  flavourLabelsByIndex,
  flavoursFor,
  sizeOf,
  startingCakeDesign,
  type CakeCard,
  type CakeColourPick,
  type CakeDesignState,
  type CakeExtras,
} from '@/lib/cake-maker';
import { choiceTotals } from '@/lib/package-choice-tree';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import { formatCentavosPhp, type VendorPackageItemOptionRow, type VendorPackageItemRow, type VendorPackageWithItems } from '@/lib/vendor-packages';
import { hexForColorName } from '@/lib/color-names';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { startServiceInquiry, type StartServiceInquiryResult } from '@/app/v/[slug]/inquiry-actions';
import { lockPackage, type LockPackageResult } from '../../dashboard/[eventId]/vendors/packages/actions';
import { BOOKINGS_CLOSED_COUPLE_MESSAGE } from '@/lib/bookings-open';
import type { PackageAskTarget } from './lock-modal';
import { CakePicture, finishOf, lookOf, spongeOf, topperOf } from './cake-picture';
import css from './cake-designer.module.css';

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; threadHref: string }
  | { kind: 'not_sent'; threadHref: string; message: string }
  | { kind: 'error'; message: string };

const available = (item: VendorPackageItemRow | null | undefined) => (item?.options ?? []).filter((o) => o.is_available);
const extraWords = (o: VendorPackageItemOptionRow) => (o.price_delta_centavos > 0 ? `+${formatCentavosPhp(o.price_delta_centavos)}` : 'in the price');
const SHOP_COLOUR_FALLBACK = '#D9D2CA';

export default function CakeDesigner({
  eventId,
  pkg,
  card,
  cake,
  ask,
  paxCount,
  onClose,
}: {
  eventId: string;
  pkg: VendorPackageWithItems;
  card: CakeCard;
  cake: CakeExtras;
  ask: PackageAskTarget;
  paxCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CakeDesignState>(() => startingCakeDesign(card));
  const [openTier, setOpenTier] = useState<string | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [send, setSend] = useState<SendState>({ kind: 'idle' });
  const [bookError, setBookError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useModalA11y({ open: true, onClose, containerRef: dialogRef });

  const shop = ask.vendorLabel;
  const cap = colourCapOf(card);
  const size = sizeOf(card, state);
  const creditEnabled = packageCreditEnabled();

  /** 💰 THE ONLY NUMBER — the shipped pricer, with the flag and the pax Book commits with. null = refused. */
  const totals = useMemo(() => {
    const { selection, removedItemIds } = cakeSelection(card, state);
    return choiceTotals({ pkg, removedItemIds, selection, creditEnabled, paxCount });
  }, [pkg, card, state, creditEnabled, paxCount]);

  const shopColours = useMemo(
    () => available(card.colours).map((o) => ({ option: o, hex: hexForColorName(o.option_label) ?? SHOP_COLOUR_FALLBACK })),
    [card.colours],
  );

  const flavourOf = (line: VendorPackageItemRow) => available(line).find((o) => o.option_id === state.flavours[line.item_id]) ?? null;
  const optionOf = (item: VendorPackageItemRow | null, id: string | null) => available(item).find((o) => o.option_id === id) ?? null;

  const pickedHexes = state.colours.map((c) =>
    c.kind === 'mood' ? c.hex : (shopColours.find((x) => x.option.option_id === c.optionId)?.hex ?? SHOP_COLOUR_FALLBACK),
  );
  const flavourLines = size?.flavourLines ?? [];
  const picture = {
    sponges: flavourLines.length > 0 ? flavourLines.map((l) => spongeOf(flavourOf(l)?.option_label)) : Array.from({ length: size?.tiers ?? 1 }, () => spongeOf(null)),
    finish: finishOf(optionOf(card.finish, state.finishOptionId)?.option_label),
    look: lookOf(optionOf(card.design, state.designOptionId)?.option_label),
    topper: topperOf(optionOf(card.topper, state.topperOptionId)?.option_label),
    colours: pickedHexes,
    message: state.message,
  };

  const overCap = state.colours.length > cap;
  const busy = isPending || send.kind === 'sending';
  const canSend = !busy && !overCap && totals !== null;

  function pickSize(optionId: string) {
    const next = card.sizes.find((x) => x.option.option_id === optionId);
    if (!next) return;
    setState((st) => ({ ...st, sizeOptionId: optionId, flavours: flavoursFor(next, flavourLabelsByIndex(card, st)) }));
    setOpenTier(null);
  }

  function toggleColour(pick: CakeColourPick) {
    const same = (c: CakeColourPick) =>
      c.kind === pick.kind && (c.kind === 'shop' ? c.optionId === (pick as { optionId: string }).optionId : c.hex.toLowerCase() === (pick as { hex: string }).hex.toLowerCase());
    const on = state.colours.some(same);
    if (on) {
      setState((st) => ({ ...st, colours: st.colours.filter((c) => !same(c)) }));
      setCapHit(false);
      return;
    }
    // The build stops the 4th tick (drawing): refuse it, and say what to do.
    if (state.colours.length >= cap) {
      setCapHit(true);
      return;
    }
    setState((st) => ({ ...st, colours: [...st.colours, pick] }));
  }

  function onSend() {
    if (!canSend) return;
    setSend({ kind: 'sending' });
    startTransition(async () => {
      const result: StartServiceInquiryResult = await startServiceInquiry({
        vendorProfileId: ask.vendorProfileId,
        eventId,
        initialServiceId: ask.vendorServiceId,
        initialCategoryKey: ask.categoryKey,
        alsoServiceIds: [],
        // Ids and the couple's own words only — the server re-reads every label and price.
        requirements: { cakeDesign: state },
      });
      if (result.status === 'ok') {
        setSend({ kind: 'sent', threadHref: `/dashboard/${result.eventId}/messages/${result.threadId}` });
        return;
      }
      if (result.status === 'ok_build_not_sent') {
        setSend({
          kind: 'not_sent',
          threadHref: `/dashboard/${result.eventId}/messages/${result.threadId}`,
          // The drawn line, word for word (the reason is the server's to log; the couple's next step is the same).
          message: `Your conversation with ${shop} is open, but the design didn’t go across. Open it and send it again.`,
        });
        return;
      }
      if (result.status === 'not_signed_in' || result.status === 'not_secured') {
        router.push(result.status === 'not_secured' ? '/signup' : '/login');
        return;
      }
      if (result.status === 'no_event') {
        setSend({ kind: 'error', message: 'Create your event first, then you can message this supplier.' });
        return;
      }
      setSend({ kind: 'error', message: result.message ?? 'Could not send that to the supplier.' });
    });
  }

  function onBook() {
    setBookError(null);
    if (!totals) {
      setBookError('We could not price this cake. Please reload and try again.');
      return;
    }
    const { removedItemIds } = cakeSelection(card, state);
    startTransition(async () => {
      const result: LockPackageResult = await lockPackage(eventId, pkg.package_id, {
        removed_item_ids: removedItemIds,
        ...(creditEnabled && totals.chargeableOptionIds.length > 0 ? { chosen_option_ids: [...totals.chargeableOptionIds] } : {}),
      });
      if (result.status === 'ok' || result.status === 'already_locked' || result.status === 'lock_requested') {
        onClose();
        router.push(`/dashboard/${eventId}/vendors/packages/${result.bookingId}`);
        return;
      }
      if (result.status === 'not_signed_in') {
        router.push('/login');
        return;
      }
      if (result.status === 'bookings_closed') return setBookError(BOOKINGS_CLOSED_COUPLE_MESSAGE);
      if (result.status === 'vendor_not_verified')
        return setBookError(`${result.vendorName} is completing verification and can't be booked just yet.`);
      if (result.status === 'package_inactive') return setBookError('This cake is paused by the supplier.');
      if (result.status === 'package_not_found') return setBookError('This cake is no longer available.');
      if (result.status === 'forbidden') return setBookError("You can't book on this event.");
      if (result.status === 'choice_required') return setBookError('The shop changed this cake. Reload the page to see it.');
      setBookError(result.message || 'Something went wrong.');
    });
  }

  const tierName = (i: number, n: number) => `${i === 0 ? 'Bottom tier' : `Tier ${i + 1}`}${n > 1 && i === n - 1 ? ' · top' : ''}`;
  const sentDone = send.kind === 'sent' || send.kind === 'not_sent';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <OverlayBackdrop onClose={onClose} />
      <div
        ref={dialogRef}
        className={css.root}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cake-designer-title"
        aria-modal="true"
      >
        <header className={css.head}>
          <h2 id="cake-designer-title">Design your cake</h2>
          <span className={css.headShop}>{shop}</span>
          <button type="button" onClick={onClose} className={css.close} aria-label="Close">
            <X aria-hidden width={20} height={20} strokeWidth={1.75} />
          </button>
        </header>

        <div className={css.d}>
          <div className={css.dl}>
            <div className={css.stage}>
              <CakePicture {...picture} tags={flavourLines.map((l) => flavourOf(l)?.option_label ?? '')} className={css.live} />
              <p className={css.cap}>
                {[size?.option.option_label, optionOf(card.finish, state.finishOptionId)?.option_label, optionOf(card.design, state.designOptionId)?.option_label]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className={css.dr}>
            <section className={css.dsec}>
              <h3 className={css.lab}>
                Tiers <span className={css.hint}>Pick one</span>
              </h3>
              <div className={css.tps} role="radiogroup" aria-label="Tiers">
                {card.sizes.map((sz) => (
                  <button
                    key={sz.option.option_id}
                    type="button"
                    role="radio"
                    aria-checked={sz.option.option_id === state.sizeOptionId}
                    className={css.tp}
                    onClick={() => pickSize(sz.option.option_id)}
                  >
                    <b>{sz.tiers}</b>
                    <small>{extraWords(sz.option)}</small>
                  </button>
                ))}
              </div>
            </section>

            {flavourLines.length > 0 ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Flavour, for each tier <span className={css.hint}>Pick one each</span>
                </h3>
                <div className={css.frame}>
                  {flavourLines.map((line, i) => {
                    const cur = flavourOf(line);
                    const open = openTier === line.item_id;
                    return (
                      <div key={line.item_id} className={css.pick}>
                        <button type="button" className={css.pickHead} aria-expanded={open} onClick={() => setOpenTier(open ? null : line.item_id)}>
                          <span className={css.tn}>{tierName(i, flavourLines.length)}</span>
                          <span className={css.cur}>
                            {cur?.option_label ?? 'Pick one'}
                            {cur && cur.price_delta_centavos > 0 ? <em> +{formatCentavosPhp(cur.price_delta_centavos)}</em> : null}
                          </span>
                          <ChevronDown aria-hidden width={16} height={16} className={open ? css.chevOpen : css.chev} />
                        </button>
                        {open ? (
                          <div className={css.pm} role="radiogroup" aria-label={tierName(i, flavourLines.length)}>
                            {available(line).map((o) => (
                              <button
                                key={o.option_id}
                                type="button"
                                role="radio"
                                aria-checked={o.option_id === cur?.option_id}
                                className={css.po}
                                onClick={() => {
                                  setState((st) => ({ ...st, flavours: { ...st.flavours, [line.item_id]: o.option_id } }));
                                  setOpenTier(null);
                                }}
                              >
                                <i className={css.fd} style={{ background: spongeOf(o.option_label) }} />
                                <span>{o.option_label}</span>
                                <em>{o.is_default ? 'Standard' : o.price_delta_centavos > 0 ? `+${formatCentavosPhp(o.price_delta_centavos)} for this tier` : ''}</em>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {card.finish && available(card.finish).length > 0 ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Finish <span className={css.hint}>Pick one</span>
                </h3>
                <div className={css.fos} role="radiogroup" aria-label="Finish">
                  {available(card.finish).map((o) => {
                    const f = finishOf(o.option_label);
                    return (
                      <button
                        key={o.option_id}
                        type="button"
                        role="radio"
                        aria-checked={o.option_id === state.finishOptionId}
                        className={css.fo}
                        onClick={() => setState((st) => ({ ...st, finishOptionId: o.option_id }))}
                      >
                        <i className={`${css.tex} ${f === 'fd' ? css.texFd : f === 'sn' ? css.texSn : ''}`} />
                        <b>{o.option_label}</b>
                        <small>{extraWords(o)}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {card.colours ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Colours <span className={css.hint}>Choose up to {cap}</span>
                </h3>
                <div className={`${css.frame} ${css.swl}`}>
                  {cake.mood === null ? (
                    <p className={css.swNote}>
                      <AlertCircle aria-hidden width={14} height={14} /> Couldn’t load your Mood Board colours just now. The shop’s colours are below.
                    </p>
                  ) : cake.mood.length > 0 ? (
                    <>
                      <p className={css.swh}>From your Mood Board</p>
                      {cake.mood.map((m) => {
                        const on = state.colours.some((c) => c.kind === 'mood' && c.hex.toLowerCase() === m.hex.toLowerCase());
                        return (
                          <button
                            key={`${m.slot}-${m.hex}`}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            className={css.sw}
                            onClick={() => toggleColour({ kind: 'mood', name: m.name, hex: m.hex })}
                          >
                            <i style={{ background: m.hex }} />
                            <b>{m.name}</b>
                            <small>{m.setByYou ? `${m.slot} · set by you` : m.slot}</small>
                          </button>
                        );
                      })}
                    </>
                  ) : null}
                  {shopColours.length > 0 ? (
                    <>
                      <p className={css.swh}>More colours from {shop}</p>
                      {shopColours.map(({ option, hex }) => {
                        const on = state.colours.some((c) => c.kind === 'shop' && c.optionId === option.option_id);
                        return (
                          <button
                            key={option.option_id}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            className={css.sw}
                            onClick={() => toggleColour({ kind: 'shop', optionId: option.option_id })}
                          >
                            <i style={{ background: hex }} />
                            <b>{option.option_label}</b>
                            {option.price_delta_centavos > 0 ? <small>+{formatCentavosPhp(option.price_delta_centavos)}</small> : null}
                          </button>
                        );
                      })}
                    </>
                  ) : null}
                </div>
                <p className={css.cnt}>
                  {state.colours.length} of {Math.min(cap, CAKE_COLOURS_MAX)} picked · they show on the ribbons and flowers
                </p>
                {capHit || overCap ? (
                  <p className={css.capwarn} role="status">
                    <AlertCircle aria-hidden width={14} height={14} /> Pick up to {cap} — untick one to send your design.
                  </p>
                ) : null}
              </section>
            ) : null}

            {card.design && available(card.design).length > 0 ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Design <span className={css.hint}>Photos of {shop}’s work</span>
                </h3>
                <div className={css.dos} role="radiogroup" aria-label="Design">
                  {available(card.design).map((o) => {
                    const photo = cake.photoUrls[o.option_id];
                    return (
                      <button
                        key={o.option_id}
                        type="button"
                        role="radio"
                        aria-checked={o.option_id === state.designOptionId}
                        className={css.do}
                        onClick={() => setState((st) => ({ ...st, designOptionId: o.option_id }))}
                      >
                        <span className={css.dph}>
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL of the shop's own photo
                            <img src={photo} alt="" loading="lazy" />
                          ) : (
                            <CakePicture
                              sponges={picture.sponges.slice(0, 3)}
                              finish={picture.finish}
                              look={lookOf(o.option_label)}
                              topper="no"
                              colours={pickedHexes}
                              message=""
                              className={css.mini}
                            />
                          )}
                        </span>
                        <b>{o.option_label}</b>
                        <em>{extraWords(o)}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {card.topper && available(card.topper).length > 0 ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Topper <span className={css.hint}>Optional</span>
                </h3>
                <div className={`${css.tps} ${css.two}`} role="radiogroup" aria-label="Topper">
                  {available(card.topper).map((o) => (
                    <button
                      key={o.option_id}
                      type="button"
                      role="radio"
                      aria-checked={o.option_id === state.topperOptionId}
                      className={`${css.tp} ${css.wide}`}
                      onClick={() => setState((st) => ({ ...st, topperOptionId: o.option_id }))}
                    >
                      <b>{o.option_label}</b>
                      <small>{extraWords(o)}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {cake.messageMax > 0 ? (
              <section className={css.dsec}>
                <h3 className={css.lab}>
                  Message on the cake <span className={css.hint}>Optional</span>
                </h3>
                <label className={css.pillbox}>
                  <input
                    type="text"
                    maxLength={cake.messageMax}
                    placeholder="e.g. Ana & Migs · 12.19"
                    value={state.message}
                    onChange={(e) => setState((st) => ({ ...st, message: e.target.value.slice(0, cake.messageMax) }))}
                    aria-label="Message on the cake"
                  />
                  <small>{cake.messageMax - state.message.length} letters</small>
                </label>
              </section>
            ) : null}

            {cake.prepDays ? (
              <p className={css.prep}>
                <Clock aria-hidden width={16} height={16} />
                <span>
                  {shop} usually needs {cake.prepDays} {cake.prepDays === 1 ? 'day' : 'days'}. They confirm the time for your design when they quote.
                </span>
              </p>
            ) : null}
          </div>

          <footer className={css.totbar}>
            <div className={css.tot}>
              <small>Total</small>
              <b className={css.totn}>{totals ? formatCentavosPhp(totals.bookingTotalCentavos) : '—'}</b>
              <small>An estimate until {shop} quotes</small>
            </div>
            {!sentDone ? (
              <button type="button" className={`${css.btn} ${css.main}`} onClick={onSend} disabled={!canSend}>
                {send.kind === 'sending' ? 'Sending…' : `Send to ${shop}`}
              </button>
            ) : null}
            {sentDone ? (
              <div className={send.kind === 'sent' ? css.sentbox : css.notSent} role="status">
                {send.kind === 'sent' ? <Check aria-hidden width={16} height={16} /> : <AlertCircle aria-hidden width={16} height={16} />}
                <span>{send.kind === 'sent' ? `Sent to ${shop} — your design is in the message.` : send.message}</span>
                <button
                  type="button"
                  className={`${css.btn} ${css.ghost} ${css.sm}`}
                  onClick={() => {
                    onClose();
                    router.push(send.threadHref);
                  }}
                >
                  <MessageCircle aria-hidden width={16} height={16} />
                  {send.kind === 'sent' ? 'View the conversation' : 'Open the conversation'}
                </button>
              </div>
            ) : (
              <p className={css.bookalt}>
                or{' '}
                <button type="button" className={css.bookLink} onClick={onBook} disabled={busy || overCap || totals === null}>
                  {isPending && send.kind !== 'sending' ? 'Booking…' : 'Book at this total'}
                </button>{' '}
                · your supplier confirms
              </p>
            )}
            {send.kind === 'error' ? <p className={css.err}>{send.message}</p> : null}
            {bookError ? <p className={css.err}>{bookError}</p> : null}
          </footer>
        </div>
      </div>
    </div>
  );
}
