'use client';

/**
 * AddYourOwnWalk — the FIRST add of a couple's own supplier, as four steps on a
 * phone: Name · What they do · Contact · Their link.
 *
 * Owner-approved 2026-10-10 (approval 10 — "yes"); the contract for every
 * screen is `prototypes/suppliers_add_your_own_2026-10-10.html`, cases A1–A5.
 * Price and "already booked?" are NOT steps here (owner, same day: "out") — the
 * record sheet that opens from the card afterwards carries them.
 *
 * ── NOTHING HERE IS A NEW MECHANISM ───────────────────────────────────────
 * Each step calls what already ships:
 *   1 · Name          `searchMarketplaceVendorsByName` — the same search the
 *                     one-screen sheet runs under its name field.
 *       Yes — Inquire `attachMarketplaceVendorToCategory`, then
 *                     `contactShortlistVendor` — the shipped "Ask for a quote",
 *                     so the real shop lands under the category waiting for its
 *                     quote and NO hand-made twin is created. (Those two presses
 *                     already existed as "pick the match" then "Ask for a
 *                     quote"; this is the same pair behind one button, and it
 *                     stamps the thread exactly as that pair does today.)
 *       Not them?     carries on by hand.
 *   2 · What they do  ONE dropdown (`PickMenu`) of only the categories on the
 *                     event; opened from a category, it is already answered.
 *   3 · Contact       who they talk to, or their mobile — then **Add** makes the
 *                     record: `addManualSupplier` (the one save the eight-field
 *                     sheet uses), followed by `createManualVendorInvite`.
 *   4 · Their link    `SupplierConnectPanel` — the QR, the link, Download · Copy
 *                     link — and the note that this is the couple's record, not
 *                     a booking.
 *
 * ── WHAT THE OWNER RULED SINCE (2026-10-12), AND WHERE IT LIVES ──────────
 *   · a name match dismissed with "Not them?" does NOT count — the press sends
 *     `name_dismissed=1`, and `addManualSupplier` leaves the record unstamped
 *     (`lib/manual-add-leak.ts`);
 *   · couples are NOT told about the booking fee — no screen here says "fee",
 *     "credit" or "sourced" (`a-brought-supplier-hears-no-fee.test.ts`);
 *   · the fee-leak line ("This looks like … who already sent you a quote") is
 *     the prototype's guard WITHOUT its fee sentence, for the same reason.
 *
 * ── ONE WRITE PER PRESS, AND THE PAGE CATCHES UP BEHIND THE LINK ─────────
 * "Add" is ONE call: `addManualSupplier` makes the record, runs the leak check
 * and returns their link (`with_link=1`), and draws no page back
 * (`answer_in_place=1`). The page is refreshed ONCE, the moment the record
 * exists (`onRecorded`), while the couple is looking at step 4 — so the card is
 * already under its category when they press Done.
 *
 * ── THE CONTROLS (INTERACTION_RULES § 9) ─────────────────────────────────
 * Sheet (darkens + blurs) · Form rows for every typed answer (`TypedRow`, the
 * first one already open) · PickMenu for "What they do" · ActionButton for every
 * press · the step line in the accent token. No bordered box: the matches and
 * the leak line are divider rows.
 *
 * The lab (`/dev/suppliers-lab`) has no session, so the four calls can be
 * answered from fixtures through `AddOwnStandInCtx`. Production never provides
 * it and always takes the real actions.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageCircle, MessagesSquare, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { ANSWER_IN_PLACE_FIELD } from '@/lib/answer-in-place';
import { nameMatchesShop } from '@/lib/manual-add-leak';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { manualVendorNeedsAddress } from '@/lib/manual-venue-address';
import {
  ADD_OWN_MATCH_HEAD,
  ADD_OWN_MATCH_TAIL,
  ADD_OWN_NAME_ERROR,
  ADD_OWN_SEARCH_MIN,
  ADD_OWN_STEPS,
  ADD_OWN_SUB,
  ADD_OWN_TITLE,
  addOwnAskedLine,
  addOwnContactError,
  addOwnDoneLine,
  addOwnNobodyLine,
  addOwnRecordNote,
  addOwnStepLine,
  type AddOwnStep,
} from '@/lib/add-your-own';
import {
  addManualSupplier,
  attachMarketplaceVendorToCategory,
  searchMarketplaceVendorsByName,
  type MarketplaceVendorSuggestion,
  type SupplierInviteView,
} from '../vendors/actions';
import { contactShortlistVendor } from '../vendors/_actions/contact-shortlist-vendor';
import { AddressPinField } from './address-pin-field';
import { SupplierConnectPanel } from './supplier-connect-panel';

/** One category on the event — what step 2's dropdown lists. */
export type AddOwnCategory = { category: string; label: string; group?: string };

/** What the walk tells the page when it closes having changed something. */
export type AddOwnOutcome = {
  kind: 'added' | 'asked';
  name: string;
  category: string;
  /** The sentence the page says after the sheet closes. */
  said: string;
  /** False when only part of it happened (they were added, but the ask did not send). */
  whole: boolean;
};

/** The four calls, replaceable in the lab only. */
export type AddOwnStandIn = {
  search: (query: string, category: string) => Promise<ReadonlyArray<MarketplaceVendorSuggestion>>;
  inquire: (shop: MarketplaceVendorSuggestion, category: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  add: (form: FormData) => Promise<{ ok: true; eventVendorId: string; invite: SupplierInviteView } | { ok: false; error: string }>;
};
export const AddOwnStandInCtx = createContext<AddOwnStandIn | null>(null);

const LABEL = 'block text-[13px] font-medium text-ink';

/**
 * A Setnayan shop already on this event that has QUOTED — what the leak line
 * looks for. The page derives it from the cards it already holds (no read).
 */
export type AddOwnQuotedShop = { category: string; name: string; threadHref: string | null };

export function AddYourOwnWalk({
  eventId,
  category: openedCategory,
  categoryLabel: openedLabel,
  categories,
  initialName = '',
  quotedShops = [],
  onClose,
  onRecorded,
  onDone,
}: {
  eventId: string;
  /** The category the walk was opened from (`event_vendors.category`). */
  category: string;
  categoryLabel: string;
  /** ONLY the categories on the event — the dropdown offers nothing else. */
  categories: ReadonlyArray<AddOwnCategory>;
  /** What the couple had typed in the thumb row's box before pressing ＋. */
  initialName?: string;
  /** Shops on the event that quoted (any category) — the leak line's facts. */
  quotedShops?: ReadonlyArray<AddOwnQuotedShop>;
  onClose: () => void;
  /** The record exists — the page may refresh now, behind the link step. */
  onRecorded?: () => void;
  onDone: (outcome: AddOwnOutcome) => void;
}) {
  const standIn = useContext(AddOwnStandInCtx);
  const [step, setStep] = useState<AddOwnStep>(1);
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(openedCategory);
  const [who, setWho] = useState('');
  const [mobile, setMobile] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // null = not searched (too short) · [] = searched, nobody · rows = matches.
  const [matches, setMatches] = useState<ReadonlyArray<MarketplaceVendorSuggestion> | null>(null);
  const [searching, setSearching] = useState(false);
  const [created, setCreated] = useState<{ eventVendorId: string; invite: SupplierInviteView } | null>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  /** "Not them?" was pressed for the name as typed — the match does not count (owner 2026-10-12). */
  const [dismissed, setDismissed] = useState(false);
  /** Opens the step's first field once the step is drawn (a Form row never opens itself on mount). */
  const [openAsk, setOpenAsk] = useState(0);

  const label =
    categories.find((c) => c.category === category)?.label ??
    (category === openedCategory ? openedLabel : (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category));
  const typed = name.trim();
  const addressRequired = manualVendorNeedsAddress(category);

  // Step 1 — typing searches Setnayan, 250 ms after the last keystroke (the
  // page's one debounce); a slow answer never replaces a newer one.
  useEffect(() => {
    if (step !== 1) return;
    if (typed.length < ADD_OWN_SEARCH_MIN) {
      setMatches(null);
      setSearching(false);
      return;
    }
    const mine = ++generation.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      let rows: ReadonlyArray<MarketplaceVendorSuggestion> = [];
      try {
        if (standIn) rows = await standIn.search(typed, category);
        else {
          const res = await searchMarketplaceVendorsByName(typed, eventId, category);
          rows = res.status === 'ok' ? res.matches : [];
        }
      } catch {
        rows = [];
      }
      if (mine !== generation.current) return;
      setMatches(rows);
      setSearching(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [typed, category, eventId, step, standIn]);

  // A first-time form has its box already open (INTERACTION_RULES § 9, Form row:
  // "filling in something new = the same rows with the boxes already open").
  useEffect(() => {
    if (step === 1 || step === 3) setOpenAsk((n) => n + 1);
  }, [step]);

  /** The leak line: a shop on this event, in this category, that already quoted — and whose name was typed. */
  const leak = useMemo(
    () =>
      typed.length > 0
        ? (quotedShops.find((q) => q.category === category && nameMatchesShop(typed, q.name)) ?? null)
        : null,
    [quotedShops, category, typed],
  );

  // Once the record exists, every way out (✕, the backdrop, Esc) is "Done": the
  // row is real, so the page must refresh and say what was added.
  const finish = () => {
    if (created) onDone({ kind: 'added', name: typed, category, said: addOwnDoneLine(typed), whole: true });
    else onClose();
  };

  function next(notThem = false) {
    if (step === 1 && typed.length === 0) {
      setErr(ADD_OWN_NAME_ERROR);
      if (rowsRef.current) nudgeFormRows(rowsRef.current);
      return;
    }
    if (step === 1) setDismissed(notThem);
    setErr(null);
    setStep((s) => (s < 3 ? ((s + 1) as AddOwnStep) : s));
  }
  function back() {
    setErr(null);
    setStep((s) => (s > 1 ? ((s - 1) as AddOwnStep) : s));
  }

  /** Yes — Inquire: ask the REAL shop for a quote. No hand-made twin. */
  function inquire(shop: MarketplaceVendorSuggestion) {
    if (pending) return;
    setErr(null);
    start(async () => {
      const done = () =>
        onDone({ kind: 'asked', name: shop.business_name, category, said: addOwnAskedLine(shop.business_name), whole: true });
      if (standIn) {
        const res = await standIn.inquire(shop, category);
        if (res.ok) done();
        else setErr(res.error);
        return;
      }
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('marketplace_vendor_id', shop.vendor_profile_id);
      fd.set('category', category);
      const attached = await attachMarketplaceVendorToCategory(fd);
      if (attached.status === 'not_signed_in') {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (attached.status !== 'ok' && attached.status !== 'already_attached') {
        setErr(
          attached.status === 'marketplace_vendor_not_found'
            ? 'This supplier is no longer available. Try the name again.'
            : attached.status === 'error'
              ? (attached.message ?? 'Could not add them. Nothing changed.')
              : 'Could not add them. Nothing changed.',
        );
        return;
      }
      const asked = await contactShortlistVendor({ eventId, vendorId: attached.eventVendorId });
      if (asked.status === 'ok' || asked.status === 'ok_build_not_sent') {
        done();
        return;
      }
      // They ARE under the category now — only the ask did not go. Say exactly
      // that, and leave the way to send it: the card's own "Ask for a quote".
      onDone({
        kind: 'asked',
        name: shop.business_name,
        category,
        said: `${shop.business_name} is under ${label} now, but your ask did not send — press Ask for a quote on their card.`,
        whole: false,
      });
    });
  }

  /** Step 3's Add — ONE call: the record, the leak check and their link. */
  function add() {
    if (pending) return;
    const refusal = addOwnContactError(who, mobile);
    if (refusal) {
      setErr(refusal);
      if (rowsRef.current) nudgeFormRows(rowsRef.current);
      return;
    }
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('category', category);
    fd.set('business_name', typed);
    fd.set('contact_either', '1');
    fd.set('contact_person', who.trim());
    fd.set('contact_number', mobile.trim());
    if (dismissed) fd.set('name_dismissed', '1');
    fd.set('with_link', '1');
    fd.set(ANSWER_IN_PLACE_FIELD, '1');
    // A place owes its address — the pin field posts into its own form.
    const place = rowsRef.current?.querySelector('form[data-add-own-place]') as HTMLFormElement | null;
    if (place) {
      for (const [k, v] of new FormData(place).entries()) fd.set(k, v);
      if (String(fd.get('address') ?? '').trim().length === 0) {
        if (rowsRef.current) nudgeFormRows(rowsRef.current);
        return;
      }
    }
    setErr(null);
    start(async () => {
      if (standIn) {
        const res = await standIn.add(fd);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setCreated({ eventVendorId: res.eventVendorId, invite: res.invite });
        setStep(4);
        onRecorded?.();
        return;
      }
      const res = await addManualSupplier(fd);
      if (res.status === 'not_signed_in') {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (res.status === 'error') {
        setErr(res.message ?? 'Could not add them. Nothing changed.');
        return;
      }
      // The record exists. A link that could not be made is not a failed add:
      // step 4 then offers "Create their link" (the panel's own button).
      setCreated({ eventVendorId: res.eventVendorId, invite: res.invite ?? null });
      setStep(4);
      onRecorded?.();
    });
  }

  const note = addOwnRecordNote(typed);
  const hasMatches = (matches?.length ?? 0) > 0;

  return (
    <Sheet open onClose={finish} labelledById="add-own-walk-title" rise>
      <div ref={rowsRef} className="px-5 pb-2 pt-5" data-add-own-walk="" data-step={step}>
        <h2 id="add-own-walk-title" className="pr-10 text-[20px] font-semibold tracking-[-0.01em] text-ink">
          {ADD_OWN_TITLE}
        </h2>
        <p className="mt-0.5 text-sm text-ink/60">{ADD_OWN_SUB}</p>

        <div className="mt-3 flex items-center gap-1.5" role="img" aria-label={addOwnStepLine(step)}>
          {ADD_OWN_STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-[3px] min-w-0 flex-1 rounded-full ${i < step ? 'bg-sn-accent' : 'bg-ink/15'}`}
            />
          ))}
          <span className="shrink-0 pl-1 text-[11.5px] text-ink/55">{addOwnStepLine(step)}</span>
        </div>

        {step === 1 ? (
          <div className="mt-3">
            <FormRows width="wide" data="add-own-name">
              <TypedRow
                name="Name"
                value={name}
                empty="Their name"
                placeholder="e.g. Tita Baby's Catering"
                required
                maxLength={128}
                autoCapitalize="words"
                openAsk={openAsk}
                attrs={{ 'data-add-own-name': '' }}
                onType={(t) => {
                  setName(t);
                  setDismissed(false);
                  setErr(null);
                }}
                onKeep={(t) => {
                  setName(t);
                }}
              />
            </FormRows>
            {/* THE LEAK LINE (prototype case A, "This looks like X's quote") —
                WITHOUT the fee sentence: couples are not told about the fee
                (owner 2026-10-12). A line on the page, not a box. */}
            {leak ? (
              <div className="mt-2 flex items-start gap-3 border-t border-ink/10 pt-3" data-add-own-leak="">
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink/75">
                  <b className="font-semibold text-ink">This looks like {leak.name}, who already sent you a quote.</b>{' '}
                  Booked here, your chat, payments and their date stay in one place.
                </p>
                {leak.threadHref ? (
                  <ActionButton
                    tone="info"
                    icon={MessagesSquare}
                    label="See their quote"
                    name={`See ${leak.name}'s quote`}
                    href={leak.threadHref}
                  />
                ) : null}
              </div>
            ) : null}
            {hasMatches ? (
              <div className="mt-2 border-t border-ink/10 pt-3" data-add-own-matches="">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">
                  {ADD_OWN_MATCH_HEAD}{' '}
                  <span className="font-sans normal-case tracking-normal">· {ADD_OWN_MATCH_TAIL}</span>
                </p>
                <ul className="mt-1 divide-y divide-ink/10">
                  {(matches ?? []).map((m) => (
                    <li key={m.vendor_profile_id} className="flex items-center gap-3 py-2.5" data-add-own-match="">
                      <MatchLogo name={m.business_name} url={m.logo_display_url} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14.5px] font-semibold text-ink">{m.business_name}</b>
                        <span className="block truncate text-[12.5px] text-ink/60">{matchLine(m)}</span>
                      </span>
                      {/* Every MAIN button is terracotta (owner "APPROVE ALL" look, 2026-10-12 #1). */}
                      <ActionButton
                        tone="brand"
                        main
                        icon={MessageCircle}
                        label="Yes — Inquire"
                        name={`Yes — Inquire ${m.business_name}`}
                        disabled={pending}
                        onClick={() => inquire(m)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : searching ? (
              <p className="mt-2 text-[12.5px] text-ink/55" aria-live="polite">
                Searching Setnayan…
              </p>
            ) : matches && typed.length >= ADD_OWN_SEARCH_MIN && !leak ? (
              <p className="mt-2 text-[12.5px] text-ink/60" data-add-own-nobody="">
                {addOwnNobodyLine(typed, label)}
              </p>
            ) : null}
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-4 space-y-2">
            <p className={LABEL}>What they do</p>
            <PickMenu
              label="What they do"
              value={category}
              buttonText={label}
              dataAttr="data-add-own-what"
              stickyGroups
              options={categories.map((c) => ({ key: c.category, label: c.label, group: c.group }))}
              onPick={(key) => setCategory(key)}
              className="w-full border border-ink/15"
            />
            <p className="text-[12.5px] text-ink/60">Only the categories on your event.</p>
          </div>
        ) : null}

        {/* Step 3 — who they talk to, or their mobile (one is enough). Form
            rows, the first already open; the walk holds the words and the Add
            press sends them in ONE call. */}
        {step === 3 ? (
          <div className="mt-3">
            <FormRows width="wide" data="add-own-contact">
              <TypedRow
                name="Who you talk to"
                value={who}
                empty="Add"
                placeholder="e.g. Maria Santos"
                maxLength={128}
                autoCapitalize="words"
                openAsk={openAsk}
                attrs={{ 'data-add-own-who': '' }}
                onType={(t) => {
                  setWho(t);
                  setErr(null);
                }}
                onKeep={(t) => {
                  setWho(t);
                }}
              />
              <TypedRow
                name="Mobile"
                value={mobile}
                empty="Add"
                placeholder="+63 9XX XXX XXXX"
                maxLength={32}
                inputMode="tel"
                attrs={{ 'data-add-own-mobile': '' }}
                onType={(t) => {
                  setMobile(t);
                  setErr(null);
                }}
                onKeep={(t) => {
                  setMobile(t);
                }}
              />
            </FormRows>
            {/* A place owes its address (the shipped rule, asked again by the
                save): a venue with no address cannot be found by a guest. */}
            {addressRequired ? (
              <form data-add-own-place="" className="mt-2 border-t border-ink/10 pt-3" onSubmit={(e) => e.preventDefault()}>
                <AddressPinField id="add-own-address" required disabled={pending} />
              </form>
            ) : null}
          </div>
        ) : null}

        {step === 4 && created ? (
          <div className="mt-4 space-y-3">
            <SupplierConnectPanel
              eventId={eventId}
              vendorId={created.eventVendorId}
              vendorName={typed}
              initial={created.invite}
            />
            <p className="text-[12.5px] text-ink/60" data-add-own-note="">
              {note.lead}
              <b className="font-semibold text-ink">{note.strong}</b>.
            </p>
          </div>
        ) : null}

        {err ? (
          <p role="alert" className="mt-2 text-[12.5px] text-danger-800" data-add-own-error="">
            {err}
          </p>
        ) : null}
      </div>

      {/* The foot — the one next thing, pinned under the step. */}
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-ink/10 bg-cream px-5 py-3">
        {step === 1 ? (
          hasMatches ? (
            <ActionButton tone="neutral" icon={ArrowRight} label="Not them?" onClick={() => next(true)} disabled={pending} className="flex-1" />
          ) : (
            <ActionButton tone="brand" main icon={ArrowRight} label="Next" onClick={() => next(false)} className="flex-1" />
          )
        ) : null}
        {step === 2 ? (
          <>
            <ActionButton tone="neutral" icon={ArrowLeft} label="Back" onClick={back} />
            <ActionButton tone="brand" main icon={ArrowRight} label="Next" onClick={() => next(false)} className="flex-1" />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <ActionButton tone="neutral" icon={ArrowLeft} label="Back" onClick={back} disabled={pending} />
            <ActionButton
              tone="brand"
              main
              icon={Plus}
              label={pending ? 'Adding…' : 'Add'}
              onClick={add}
              disabled={pending}
              className="flex-1"
            />
          </>
        ) : null}
        {step === 4 ? (
          <ActionButton tone="brand" main icon={Check} label="Done" onClick={finish} className="flex-1" />
        ) : null}
      </div>
    </Sheet>
  );
}

/** "Catering · Makati" — what they do here, and where. */
function matchLine(m: MarketplaceVendorSuggestion): string {
  const what = m.categories
    .map((c) => VENDOR_CATEGORY_LABEL[c])
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  return [what, m.city ?? ''].filter(Boolean).join(' · ') || 'On Setnayan';
}

/** The shop's logo, already resolved by the search (`logo_display_url`), or its initials. */
function MatchLogo({ name, url }: { name: string; url: string | null }) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('') || '?';
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-paper text-[12px] font-semibold text-ink/70">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials
      )}
    </span>
  );
}
