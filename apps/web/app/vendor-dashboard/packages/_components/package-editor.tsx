'use client';

/**
 * PACKAGE EDITOR — the form a vendor fills to build a package (PR-3), now THE BUNDLE MAKER.
 *
 * ── 7 NOV 2026 — FIXED, NOT RE-DRAWN (owner: "all changes as this designs are to be fixed on the current design. we
 * do not invent or create a new one, we just fix the old one."; DECISION_LOG "THE FOUR MAKERS ARE APPROVED"). Kept from
 * that fix: SERVICE CARDS FIRST as locked lines ("Add a card" — one dropdown of the shop's cards) · extra inclusions
 * after, as lines · lines REMOVE BY THEIR SWIPE with Undo (THE ONE SWIPE + the shipped Undo toast) · the spendable
 * budget under MORE SETTINGS.
 *
 * ── 10 NOV 2026 — BUILD 6 · LANE D, THE BUNDLE MAKER'S SUMS (owner 9 Nov; prototype specs
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/bundle-maker.html` v3 — the contract; DECISION_LOG 2026-11-09
 * "A BUNDLE = 2+ SERVICE CARDS + ITS OWN PINNED PRICE + OFFER SWITCHES; GIFTS LIVE ONLY IN OFFERS…"):
 *   1. THE NEW TOTAL IS PINNED at the top of the scroll ("New total · ₱130,000", one small line under it: "2 cards ·
 *      ₱139,000 − ₱9,000" · "Pick cards to see it"). It follows every change at once; while a field has the keyboard up
 *      it slims to its one 44 px line (owner: "when keyboard pops up, it uses almost 50% of the screen").
 *   2. Each card line shows the card AT ITS LOWEST ("₱110,000 → ₱99,000 · 10% off · limited-time") — `lib/bundle-sums.ts`.
 *   3. WHAT THE COUPLE GETS gathers every inclusion of the picked cards, merged, each labelled with its card; the extra
 *      inclusions follow as "beyond the cards".
 *   4. TOTAL per card, then Cards at their lowest · the EXTRA BUNDLE DISCOUNT in pesos only (above ₱0, below the total)
 *      · the NEW TOTAL. The typed "Package price" box is gone — the price is computed (the server re-computes it).
 *   5. PAYMENT PLAN FOR THE BUNDLE — a copy of the default plan, adjustable, adding up to exactly the new total; the last
 *      payment is the automatic balance (the shipped `resolveSchedule`).
 *   6. NO GIFT FIELD — gifts live only in offers. ⏭ "Offers on this bundle" (the card maker's switches) arrives with the
 *      Offer Maker (Build 6 Lane D, another session) — not drawn here until that link exists.
 *   7. FULL SCREEN (`RiseScreen`, the bars step away); ✕ is Cancel. The thumb row is Save to my shop | Send to this
 *      couple at equal widths (7 Nov: the bundle maker and the quote maker are one maker).
 * 🔒 Held by `the-bundle-maker-is-the-prototype.test.ts` and `lib/bundle-sums.test.ts`.
 *
 * The form runs `validatePackageDraft` + `bundleProblems` on every keystroke and shows problems inline; the server
 * action re-runs both on the prices IT read before writing — the client copy is for feedback only.
 *
 * Money is edited in PESOS and stored in CENTAVOS; the conversion happens once, at the input boundary.
 */

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Lock, ChevronDown, Check, Send, Settings, AlertCircle, Info } from 'lucide-react';

import {
  validatePackageDraft,
  type DraftPackage,
  type DraftItem,
  type DraftOption,
  type DraftProblem,
} from '@/lib/package-authoring';
import {
  bundleProblems,
  bundleSums,
  gatherInclusions,
  pinnedTotalLine,
  planDraftsOrDefault,
  resolveBundlePlan,
  type BundleCardFacts,
  type BundlePlanDrafts,
  type BundleProblem,
} from '@/lib/bundle-sums';
import { dueLabel, MAX_INSTALLMENTS } from '@/lib/proposal-payment-schedule';
import { formatPhpRounded } from '@/lib/php';
import type { VendorPackageWithItems } from '@/lib/vendor-packages';
import { ActionButton, EqualRow } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { PackageCard } from '@/app/_components/vendor-packages/package-card';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { displayServiceLabel } from '@/lib/vendors';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { savePackage } from '../actions';
import { findFairHits } from '@/lib/fair-presentation';
import type { ClaimWord } from '@/lib/service-card-checks';
import { FairNote } from '@/app/_components/fair-note';

/** One of the shop's service cards, as "Add a card" lists it — its price, discounts and inclusions are the card's own. */
export type BundleCard = BundleCardFacts & { category: string };

/** Client-side ref for a row that has no database id yet. */
let seq = 0;
const newRef = () => `new-${++seq}`;

const pesos = (centavos: number) => (centavos === 0 ? '' : String(centavos / 100));
const toCentavos = (v: string) => {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const wholePesos = (v: string) => {
  const n = Number(v.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const php = formatPhpRounded;

function emptyItem(): DraftItem {
  return {
    ref: newRef(),
    service_description: '',
    canonical_service: '',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
  };
}

/** A card, as a locked line: in the bundle as the card — required, worth nothing of its own here (the server forces the same). */
function cardItem(card: BundleCard): DraftItem {
  return {
    ref: newRef(),
    service_description: card.name,
    canonical_service: card.category,
    is_default_included: true,
    is_required: true,
    replacement_value_centavos: 0,
    options: [],
    vendorServiceId: card.id,
  };
}

/** The name written for you from the cards — "Catering, Lechon & Cake" (the prototype's `autoName`). */
export function bundleNameFromCards(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

const isCardLine = (i: DraftItem) => Boolean(i.vendorServiceId);

/** Cards first, then the typed lines — the order the maker draws and the order the lines are saved in. */
const cardsFirst = (items: DraftItem[]) => [...items.filter(isCardLine), ...items.filter((i) => !isCardLine(i))];

export function PackageEditor({
  packageId,
  initial,
  frozen,
  canonicalServices,
  cards,
  shopName,
  closeHref,
  now,
  fairWords = null,
}: {
  packageId?: string;
  initial: DraftPackage;
  /** True when a live booking exists — structure is locked, metadata is not. */
  frozen: boolean;
  canonicalServices: { value: string; label: string }[];
  /** The shop's service cards with their prices — `null` = the read was refused (said on the page, never "none"). */
  cards: BundleCard[] | null;
  /** The shop's name, for the couple's card in the preview. */
  shopName: string | null;
  /** Where ✕ goes back to (the Shop's services list). */
  closeHref: string;
  /** The server's clock (ISO), so the first paint's sums equal the server's. */
  now: string;
  /** 🚫 The claim words this shop may not use — the bundle name's live note. Absent/`null` = unread (the save asks). */
  fairWords?: ClaimWord[] | null;
}) {
  const router = useRouter();
  const clock = useMemo(() => new Date(now), [now]);
  const [draft, setDraft] = useState<DraftPackage>(() => ({
    ...initial,
    gift: '',
    items: cardsFirst(initial.items),
  }));
  const [plan, setPlan] = useState<BundlePlanDrafts>(() => planDraftsOrDefault(initial.plan));
  const [planTouched, setPlanTouched] = useState(() => Boolean(initial.plan));
  // A saved name that is still the one written from its cards keeps following the cards; a typed one stays put.
  const [nameTouched, setNameTouched] = useState(() => {
    const own = initial.package_name.trim();
    return own.length > 0 && own !== bundleNameFromCards(initial.items.filter(isCardLine).map((i) => i.service_description));
  });
  /** Save was pressed: the notes show under their fields from now on (never before the first try). */
  const [tried, setTried] = useState(false);
  /** A field has the keyboard: the pinned New total slims to its one line. */
  const [typing, setTyping] = useState(false);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [moreOpen, setMoreOpen] = useState(initial.consumable_budget_centavos > 0 || initial.is_consumable_flexible);

  const cardById = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const cardLines = draft.items.filter(isCardLine);
  const extraLines = draft.items.filter((i) => !isCardLine(i));
  const cardsLeft = (cards ?? []).filter((c) => !cardLines.some((l) => l.vendorServiceId === c.id));
  const picked = cardLines
    .map((i) => (i.vendorServiceId ? cardById.get(i.vendorServiceId) : undefined))
    .filter((c): c is BundleCard => Boolean(c));

  // 🧺 THE SUMS — the same functions the server runs on the prices it reads.
  const extraPhp = Math.round((draft.extra_discount_centavos ?? 0) / 100);
  const sums = bundleSums(picked, extraPhp, clock);
  const resolved = resolveBundlePlan(plan, sums.newTotalPhp);
  const priced: DraftPackage = { ...draft, total_price_centavos: Math.round(sums.newTotalPhp * 100) };
  const problems: Array<DraftProblem | BundleProblem> = [
    ...bundleProblems(sums, resolved, php),
    // The price problems are the bundle's own words; the shipped validator keeps the rest (names, lines, budget).
    ...validatePackageDraft(priced).filter((p) => p.code !== 'package_price_not_positive' || sums.lines.length >= 2),
  ];
  // 🚫 FAIR PRESENTATION ON THE BUNDLE NAME (owner 2026-11-08): the note under the name shows AS YOU TYPE (not only
  // after Save — the ruling's "message under the line"), and Save waits while it is open. `savePackage` asks
  // again. A name written from the cards is checked the same — a card's claim word would ride into it.
  const nameFair = useMemo(() => findFairHits([{ field: 'package_name', value: draft.package_name }], { words: fairWords }), [draft.package_name, fairWords]);
  const shown = tried ? problems : [];
  const problemsFor = (itemRef: string, optionRef?: string) =>
    (shown.filter((p) => 'itemRef' in p && p.itemRef === itemRef && (optionRef ? p.optionRef === optionRef : !p.optionRef)) as DraftProblem[]);
  const extraErr = sums.extraPhp > 0 && sums.extraPhp >= sums.cardsTotalPhp ? 'The extra discount has to be below the total.' : null;
  const planErr = resolved.balances ? null : `The payments add up to more than ${php(sums.newTotalPhp)}.`;
  const gathered = gatherInclusions(picked);

  /** Keep the name written from the cards while the supplier has not typed their own. */
  const named = (d: DraftPackage, touched = nameTouched): DraftPackage =>
    touched ? d : { ...d, package_name: bundleNameFromCards(d.items.filter(isCardLine).map((i) => i.service_description)) };

  const patch = (over: Partial<DraftPackage>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...over }));
  };
  const patchItem = (ref: string, over: Partial<DraftItem>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.ref === ref ? { ...i, ...over } : i)) }));
  };
  const patchOption = (itemRef: string, optRef: string, over: Partial<DraftOption>) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.ref !== itemRef ? i : { ...i, options: i.options.map((o) => (o.ref === optRef ? { ...o, ...over } : o)) })),
    }));
  };
  /** Exactly one standard option — picking one clears the others. */
  const makeStandard = (itemRef: string, optRef: string) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) => ({
                ...o,
                is_default: o.ref === optRef,
                // The standard option IS the baseline, so it costs nothing extra — the database enforces this too.
                price_delta_centavos: o.ref === optRef ? 0 : o.price_delta_centavos,
              })),
            },
      ),
    }));
  };

  const addCard = (id: string) => {
    const card = cardById.get(id);
    if (!card) return;
    setSaved(false);
    setDraft((d) => named({ ...d, items: cardsFirst([...d.items, cardItem(card)]) }));
  };

  /**
   * 👈 THE LINE'S SWIPE (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). The line
   * leaves the DRAFT at once; nothing is written until Save, so Undo is putting it back where it was.
   */
  const removeLine = (item: DraftItem) => {
    const at = draft.items.findIndex((i) => i.ref === item.ref);
    setSaved(false);
    setDraft((d) => named({ ...d, items: d.items.filter((i) => i.ref !== item.ref) }));
    const word = item.service_description.trim();
    pushUndo({
      label: isCardLine(item) ? `${word || 'Card'} taken out` : word ? `“${word}” removed` : 'Line removed',
      undo: async () => {
        setDraft((d) => {
          if (d.items.some((i) => i.ref === item.ref)) return d;
          const items = [...d.items];
          items.splice(at < 0 ? items.length : Math.min(at, items.length), 0, item);
          return named({ ...d, items: cardsFirst(items) });
        });
      },
    });
  };

  // ── The plan: a copy of the default, adjusted here. Typing an amount makes that payment a fixed one. ──
  const editPlan = (fn: (p: BundlePlanDrafts) => BundlePlanDrafts) => {
    setSaved(false);
    setPlanTouched(true);
    setPlan((p) => fn({ manual: p.manual.map((m) => ({ ...m })), autoBalance: { ...p.autoBalance } }));
  };
  const setPayment = (i: number, value: string) =>
    editPlan((p) => {
      p.manual[i] = { ...p.manual[i]!, kind: 'fixed', amountPhp: wholePesos(value), percent: null };
      return p;
    });
  const addPayment = () =>
    editPlan((p) => {
      p.manual.push({ label: `Payment ${p.manual.length + 1}`, kind: 'percent', amountPhp: null, percent: 10, due: 'before_event', offsetDays: 14 });
      return p;
    });
  const removePayment = (i: number) => {
    const gone = plan.manual[i]!;
    editPlan((p) => ({ ...p, manual: p.manual.filter((_, k) => k !== i) }));
    pushUndo({
      label: `${gone.label} removed`,
      undo: async () => editPlan((p) => {
        p.manual.splice(Math.min(i, p.manual.length), 0, gone);
        return p;
      }),
    });
  };

  const save = () => {
    setServerError(null);
    setTried(true);
    // The same rules the server runs: with notes still open, Save shows them where they are and sends nothing.
    if (problems.length > 0 || nameFair.length > 0) return;
    start(async () => {
      const res = await savePackage({
        ...priced,
        items: cardsFirst(draft.items),
        extra_discount_centavos: sums.extraPhp * 100,
        plan: planTouched ? plan : null,
        packageId,
      });
      if (res.status === 'ok') {
        setSaved(true);
        // ⚡ `savePackage` revalidates: its answer redraws this page, and a new bundle's replace reads a fresh one.
        if (!packageId) router.replace(`/vendor-dashboard/packages/${res.packageId}`);
        return;
      }
      if (res.status === 'locked') {
        setServerError('The Bundle Maker opens once your shop is Verified. Tap Get verified on Shop › Bundles.');
        return;
      }
      if (res.status === 'frozen') {
        setServerError(`Someone has already booked this bundle, so its contents are locked. Changed: ${res.changed.join(', ')}. Make a new bundle instead.`);
        return;
      }
      if (res.status === 'invalid') {
        // The server's own words: some of its rules (the card-text gate, today's card prices) have no inline note.
        setServerError(res.problems.length > 0 ? res.problems.map((p) => p.message).join(' ') : 'Some details still need fixing — see the notes below.');
        return;
      }
      setServerError(res.status === 'error' ? res.message : 'That bundle could not be saved.');
    });
  };

  // One rhythm (the prototype's `.fld`): a label · its 48 px box · a quiet hint; each topic after the first opens with
  // a divider, never a box around the group.
  const field =
    'h-12 w-full rounded-xl border border-ink/15 bg-cream px-4 text-[15px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60'; // no-card-ok: the class of an <input>, a thing you press
  const lab = 'mb-1.5 flex items-center gap-2 text-[14px] font-medium text-ink';
  const small = 'text-[12px] font-normal text-ink/50';
  const hint = 'mt-1.5 text-[12px] leading-snug text-ink/55';
  const topic = 'border-t border-ink/10 px-4 pt-5';
  const box =
    'flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-cream px-4 text-left text-[15px] text-ink disabled:opacity-60'; // no-card-ok: a PickMenu trigger, a <button>
  const optionField =
    'h-10 w-full rounded-lg border border-ink/15 bg-cream px-3 text-sm text-ink focus:border-terracotta focus:outline-none'; // no-card-ok: the class of an <input>
  const kv = 'flex min-h-9 items-center justify-between gap-3 text-[14px] text-ink';

  // The couple's card, drawn from the draft by the SHIPPED `PackageCard` — what /v/[slug] will show, not a second
  // drawing of it — beside the form from 701. Each picked card by `ServiceCardFace`, the ONE face Find renders.
  const previewPkg: VendorPackageWithItems = {
    package_id: packageId ?? 'new',
    vendor_profile_id: '',
    package_name: draft.package_name.trim() || 'Bundle name',
    description: null,
    total_price_centavos: priced.total_price_centavos,
    consumable_budget_centavos: draft.consumable_budget_centavos,
    is_consumable_flexible: draft.is_consumable_flexible,
    primary_canonical_service: draft.items[0]?.canonical_service ?? '',
    is_active: false,
    created_at: '',
    updated_at: '',
    items: draft.items
      .filter((i) => i.service_description.trim().length > 0)
      .map((i, n) => ({
        item_id: i.ref,
        package_id: packageId ?? 'new',
        canonical_service: i.canonical_service,
        service_description: i.service_description,
        is_default_included: i.is_default_included,
        replacement_value_centavos: i.replacement_value_centavos,
        display_order: n,
        created_at: '',
        is_required: i.is_required,
      })),
  };
  const preview = (
    <>
      {picked.length > 0 ? (
        <div className="space-y-2" data-bundle-find-cards="">
          {picked.map((c) => {
            const l = sums.lines.find((x) => x.id === c.id);
            return (
              <ServiceCardFace
                key={c.id}
                snap={{ name: c.name, priceText: l?.lowestPhp != null ? `from ${php(l.lowestPhp)}` : '', discountBadge: l?.offer ?? null, includesLine: null, notIncluded: [], hasExclusive: false, givesSetnayanGift: false, hasCover: false }}
                leafPathLabel={[displayServiceLabel(c.category), shopName].filter(Boolean).join(' · ')}
                footer={<span className="inline-flex rounded-full bg-ink/[0.06] px-2.5 py-1 text-[12px] font-medium text-ink/70">in this bundle</span>}
              />
            );
          })}
        </div>
      ) : null}
      <PackageCard pkg={previewPkg} gift={null} />
    </>
  );

  const thumb = (
    // 👍 Save to my shop | Send to this couple — at equal widths (one maker for bundles and quotes, 7 Nov). ✕ is Cancel.
    <EqualRow data="bundle-thumb">
      <ActionButton tone="ok" main icon={Check} label={pending ? 'Saving…' : 'Save to my shop'} onClick={save} waiting={pending || nameFair.length > 0} data-testid="bundle-save" />
      {/* ⏸ NOT WIRED YET, drawn waiting: sending a bundle as a quote must copy each card at its lowest, the extra
          discount and this plan into the quote's own lines (9 Nov freeze ruling) — the quote maker's job, next slice. */}
      <ActionButton tone="brand" main icon={Send} label="Send to this couple" title="Send to this couple — opens from a couple’s chat, coming next" waiting data-bundle-send="" />
    </EqualRow>
  );

  return (
    <RiseScreen
      title={draft.package_name.trim() || 'New bundle'}
      line="Several of your cards as one price"
      info={
        <>
          <b className="block text-ink">A bundle</b>
          Several of your cards as one price. Each card counts at its lowest price — its price minus the best discount that
          is on. Your extra bundle discount comes off that sum, in pesos. The bundle’s payment plan starts from your default
          and has to add up to the new total.
        </>
      }
      thumb={thumb}
      onClose={() => router.push(closeHref)}
      data="bundle-maker"
    >
      <UndoToastHost />
      <div
        className="tab:grid tab:grid-cols-[minmax(0,1fr)_300px] tab:gap-6"
        data-bundle-maker=""
        onFocus={(e) => setTyping(e.target instanceof HTMLInputElement)}
        onBlur={() => setTyping(false)}
      >
        <div className="min-w-0 space-y-5 pb-6">
          {/* 📌 THE PINNED NEW TOTAL (owner 9 Nov: "Bundle maker needs to show the total as pinned also"). It stays put while
              the body scrolls and follows every change; with the keyboard up it is its one 44 px line. */}
          <div
            className="sn-pin-hair sticky top-0 z-[3] flex min-h-11 items-center justify-between gap-3 bg-cream px-4 py-2"
            data-bundle-total-pin={typing ? 'slim' : 'full'}
            aria-live="polite"
          >
            <span className="min-w-0">
              <b className="block text-[15px] font-semibold leading-tight text-ink">New total</b>
              {typing ? null : (
                <small className="block truncate text-[12.5px] text-ink/60" data-bundle-total-line="">
                  {pinnedTotalLine(sums, php)}
                </small>
              )}
            </span>
            <span className="shrink-0 font-mono text-[18px] font-semibold text-ink" data-bundle-total="">
              {php(sums.newTotalPhp)}
            </span>
          </div>

          {frozen ? (
            <p className="mx-4 flex items-start gap-2 text-sm text-ink/70">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>
                Someone has booked this bundle, so what is in it and its price are now fixed — that booking is a promise you
                have already made. You can still rename it or take it offline. To sell something different, make a new bundle.
              </span>
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="flex items-center gap-2 px-4 text-[13px] font-medium text-success-700">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Saved · the bundle shows under Bundles.
            </p>
          ) : null}

          {/* ---- Name ---- */}
          <div className="px-4">
            <label className={lab} htmlFor="pkg-name">Name</label>
            <input
              autoComplete="off"
              id="pkg-name"
              className={field}
              value={draft.package_name}
              placeholder="Named from the cards you pick"
              maxLength={120}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  save();
                }
              }}
              onChange={(e) => {
                setNameTouched(true);
                patch({ package_name: e.target.value });
              }}
            />
            <p className={hint}>{cardLines.length > 0 && !nameTouched ? 'Written for you · change it if you like' : 'Named from the cards you add'}</p>
            <FairNote hits={nameFair} field="package_name" />
          </div>

          {/* ---- Service cards — FIRST, as locked lines, each at its lowest ---- */}
          <div className={topic} data-bundle-cards="">
            <p className={lab}>
              Service cards <span className={small}>{cardLines.length ? `${cardLines.length} ${cardLines.length === 1 ? 'card' : 'cards'}` : 'two or more'}</span>
            </p>
            {cardLines.length > 0 ? (
              <ul className="mb-2 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15">
                {cardLines.map((item) => {
                  const l = sums.lines.find((x) => x.id === item.vendorServiceId);
                  return (
                    <SwipeToDelete key={item.ref} as="li" label={`Take ${item.service_description} out of the bundle`} word="Remove" radiusClass="rounded-none" disabled={frozen} onDelete={() => removeLine(item)}>
                      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5" data-bundle-line="card">
                        <Lock aria-label="Locked — this line is the card" className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-ink">{item.service_description}</span>
                          <span className="block truncate text-[12px] text-ink/55" data-bundle-card-lowest="">
                            {l?.pricePhp == null ? 'No price yet · set it on the card' : l.offer ? `${php(l.pricePhp)} → ${php(l.lowestPhp)} · ${l.offer}` : `${php(l.pricePhp)} · no discount on`}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[14px] text-ink">{l?.lowestPhp != null ? php(l.lowestPhp) : '—'}</span>
                      </div>
                    </SwipeToDelete>
                  );
                })}
              </ul>
            ) : (
              <p className="mb-2 text-[13.5px] text-ink/70" data-bundle-cards-empty="">Pick the cards this bundle sells.</p>
            )}
            {frozen ? null : cards === null ? (
              <p role="alert" className="text-[13px] text-danger-700">Couldn’t read your service cards and their prices right now. Reload to try again.</p>
            ) : cards.length === 0 ? (
              <p className={hint}>No service cards yet. Make one under Services, then add it here.</p>
            ) : cardsLeft.length > 0 ? (
              <PickMenu
                label="Add a card"
                value={null}
                options={cardsLeft.map((c) => {
                  const l = bundleSums([c], 0, clock).lines[0]!;
                  return { key: c.id, label: c.name, hint: l.pricePhp == null ? 'no price yet' : l.offer ? `from ${php(l.pricePhp)} → ${php(l.lowestPhp)}` : `from ${php(l.pricePhp)}` };
                })}
                onPick={addCard}
                dataAttr="data-bundle-add-card"
                className={box}
                trigger={
                  <>
                    <span className="truncate text-ink/55">{cardLines.length ? 'Add another card' : 'Add a card'}</span>
                    <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                  </>
                }
              />
            ) : (
              <p className="flex items-center gap-1.5 text-[13px] text-success-700">
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Every card is in this bundle
              </p>
            )}
            <p className={hint}>
              Each card at its <b className="font-semibold text-ink/75">lowest</b> price: the card price minus its best discount that is on.
              {cardLines.length > 0 && !frozen ? ' Swipe a line left to take it out · Undo in the toast.' : ''}
            </p>
            {tried && sums.lines.length < 2 ? <Note>A bundle is two or more of your service cards — add another card.</Note> : null}
            {tried ? sums.unpriced.map((n) => <Note key={n}>{`${n} has no price yet — set it on the card first.`}</Note>) : null}
          </div>

          {/* ---- What the couple gets — gathered from the cards, then the extra lines ---- */}
          <div className={topic} data-bundle-gets="">
            <div className={lab}>
              <span>What the couple gets</span>
              <InfoTip label="" ariaLabel="About inclusions" align="end">
                <span className="block font-semibold">What’s included</span>
                <span className="mt-1 block">Everything the picked cards include gathers here, merged, each line labelled with its card. Add a line for anything beyond the cards.</span>
                <span className="mt-1 block">Swap options are made on the card, under What’s included · details.</span>
              </InfoTip>
            </div>
            {gathered.length > 0 ? (
              <ul className="divide-y divide-ink/10" data-bundle-gathered="">
                {gathered.map((g) => (
                  <li key={g.label} className="flex min-h-11 items-center justify-between gap-3 text-[14.5px] text-ink">
                    <span className="min-w-0 truncate">{g.label}</span>
                    <span className="shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[11.5px] font-medium text-ink/65">{g.card}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 text-[13.5px] text-ink/65">
                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.9} />
                Everything the picked cards include gathers here, merged, each line labelled with its card.
              </p>
            )}

            <p className="mb-1.5 mt-4 text-[13px] font-medium text-ink/75" data-bundle-extras="">
              Extra inclusions <span className={small}>beyond the cards · optional</span>
            </p>
            {extraLines.length > 0 ? (
              <ul className="mb-3 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15">
                {extraLines.map((item) => (
                  <SwipeToDelete key={item.ref} as="li" label={`Remove ${item.service_description.trim() || 'this line'}`} word="Remove" radiusClass="rounded-none" disabled={frozen} onDelete={() => removeLine(item)}>
                    <div data-bundle-line="extra">
                      <div className="grid grid-cols-[1fr_7rem] lg:grid-cols-[1fr_9rem_6.5rem]">
                        <input
                          aria-label="What this inclusion is"
                          className="col-span-2 h-12 min-w-0 border-b border-ink/10 bg-transparent px-4 text-[15px] text-ink placeholder:text-ink/40 focus:outline-none lg:col-span-1 lg:border-b-0 disabled:opacity-60"
                          disabled={frozen}
                          value={item.service_description}
                          placeholder="Welcome drink on arrival"
                          onChange={(e) => patchItem(item.ref, { service_description: e.target.value })}
                        />
                        <div className="min-w-0 border-ink/10 lg:border-l">
                          <PickMenu
                            label="Category"
                            value={item.canonical_service || null}
                            options={canonicalServices.map((c) => ({ key: c.value, label: c.label }))}
                            onPick={(k) => patchItem(item.ref, { canonical_service: k })}
                            className="flex h-12 w-full items-center justify-between gap-2 px-4 text-left text-[14px] text-ink disabled:opacity-60"
                            trigger={
                              <>
                                <span className={`truncate ${item.canonical_service ? '' : 'text-ink/45'}`}>{canonicalServices.find((c) => c.value === item.canonical_service)?.label ?? 'Category…'}</span>
                                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                              </>
                            }
                          />
                        </div>
                        <input
                          aria-label="What this is worth in pesos"
                          inputMode="decimal"
                          disabled={frozen}
                          className="h-12 min-w-0 border-l border-ink/10 bg-transparent px-4 font-mono text-[14px] text-ink placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
                          value={pesos(item.replacement_value_centavos)}
                          placeholder="worth ₱"
                          onChange={(e) => patchItem(item.ref, { replacement_value_centavos: toCentavos(e.target.value) })}
                        />
                      </div>
                      {/* A line that ALREADY carries choices keeps them editable here — no saved bundle is stranded. */}
                      {item.options.length > 0 ? (
                        <div className="px-4 pb-3">
                          <OptionList
                            item={item}
                            frozen={frozen}
                            field={optionField}
                            problemsFor={problemsFor}
                            onPatch={patchOption}
                            onStandard={makeStandard}
                            onAdd={() => patchItem(item.ref, { options: [...item.options, { ref: newRef(), label: '', price_delta_centavos: 0, is_default: false, is_available: true }] })}
                            onRemove={(optRef) => patchItem(item.ref, { options: item.options.filter((o) => o.ref !== optRef) })}
                          />
                        </div>
                      ) : null}
                      {problemsFor(item.ref).length > 0 ? (
                        <ul className="space-y-1 px-4 pb-3">
                          {problemsFor(item.ref).map((p) => (
                            <ProblemLine key={p.code} problem={p} />
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </SwipeToDelete>
                ))}
              </ul>
            ) : null}
            {!frozen ? <ActionButton tone="neutral" icon={Plus} label="Add a line" onClick={() => patch({ items: [...draft.items, emptyItem()] })} /> : null}
          </div>

          {/* ---- Total — each card at its lowest, then their sum ---- */}
          <div className={topic} data-bundle-sum="">
            <p className={lab}>Total</p>
            {sums.lines.length > 0 ? (
              sums.lines.map((l) => (
                <div key={l.id} className={kv}>
                  <span className="min-w-0">
                    <span className="block truncate">{l.name}</span>
                    <small className="block text-[12px] text-ink/55">{l.offer ?? 'no discount on'}</small>
                  </span>
                  <span className="shrink-0 font-mono">
                    {l.offer && l.pricePhp != null ? <s className="mr-1.5 text-ink/45">{php(l.pricePhp)}</s> : null}
                    {l.lowestPhp != null ? php(l.lowestPhp) : '—'}
                  </span>
                </div>
              ))
            ) : (
              <div className={kv}>
                <span>No cards yet</span>
                <span className="font-mono">{php(0)}</span>
              </div>
            )}
            <div className={`${kv} border-t border-ink/10 pt-1 font-semibold`}>
              <span>Cards at their lowest</span>
              <span className="font-mono" data-bundle-cards-total="">{php(sums.cardsTotalPhp)}</span>
            </div>
          </div>

          {/* ---- The extra bundle discount — pesos only ---- */}
          <div className={topic}>
            <div className={lab}>
              <label htmlFor="pkg-extra">Extra bundle discount</label>
              <InfoTip label="" ariaLabel="About the extra discount" align="start">
                <span className="block font-semibold">Extra bundle discount</span>
                <span className="mt-1 block">On top of each card’s own best discount, a peso amount off the bundle. It has to be more than ₱0 and less than the cards’ total.</span>
              </InfoTip>
            </div>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-ink/70">₱</span>
              <input
                id="pkg-extra"
                inputMode="numeric"
                disabled={frozen}
                className={`${field} pl-9 font-mono`}
                value={sums.extraPhp > 0 ? sums.extraPhp.toLocaleString('en-PH') : ''}
                placeholder="0"
                enterKeyHint="done"
                data-bundle-extra=""
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    save();
                  }
                }}
                onChange={(e) => patch({ extra_discount_centavos: wholePesos(e.target.value) * 100 })}
              />
            </div>
            {extraErr ? <Note>{extraErr}</Note> : <p className={hint}>Pesos only, never a percent · above ₱0 and below {php(sums.cardsTotalPhp)}.</p>}
          </div>

          {/* ---- The new total — the bundle's one price ---- */}
          <div className={topic}>
            <div className="flex items-center justify-between gap-3 text-[17px] font-semibold text-ink">
              <span>New total</span>
              <span className="font-mono">{php(sums.newTotalPhp)}</span>
            </div>
            <p className={hint}>{php(sums.cardsTotalPhp)} − {php(sums.extraPhp)} · the bundle’s one price.</p>
          </div>

          {/* ---- The bundle's own payment plan — a copy of the default, adjusted here ---- */}
          <div className={topic} data-bundle-plan="">
            <p className={lab}>Payment plan for the bundle</p>
            <p className="mb-1.5 text-[12.5px] leading-snug text-ink/60">
              A copy of your default plan · adjust it here · adds up to {php(sums.newTotalPhp)} · the last payment is the balance.
            </p>
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15">
              {plan.manual.map((m, i) => {
                const row = resolved.installments[i];
                const amount = Math.round((row?.amount_centavos ?? 0) / 100);
                const line = (
                  <div className="flex min-h-14 items-center gap-3 px-4 py-2" data-bundle-payment={i}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ink">{m.label}</span>
                      <span className="block truncate text-[12px] text-ink/55">
                        {dueLabel(m.due, m.offsetDays)} · {m.kind === 'percent' ? `${m.percent ?? 0}% of the total` : 'adjusted'}
                      </span>
                    </span>
                    <input // field-ok: an amount cell inside one payment row of the plan list — it re-balances the plan on every key, as the quote maker's installment cells do
                      aria-label={`${m.label} amount in pesos`}
                      inputMode="numeric"
                      disabled={frozen}
                      className="h-10 w-28 shrink-0 rounded-lg border border-ink/15 bg-cream px-3 text-right font-mono text-[14px] text-ink focus:border-terracotta focus:outline-none"
                      value={amount > 0 ? amount.toLocaleString('en-PH') : ''}
                      placeholder="0"
                      enterKeyHint="done"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          save();
                        }
                      }}
                      onChange={(e) => setPayment(i, e.target.value)}
                    />
                  </div>
                );
                // The first payment is the booking's own; the later ones swipe out, with Undo.
                return i === 0 ? (
                  <li key={`p${i}`}>{line}</li>
                ) : (
                  <SwipeToDelete key={`p${i}`} as="li" label={`Remove ${m.label}`} word="Remove" radiusClass="rounded-none" disabled={frozen} onDelete={() => removePayment(i)}>
                    {line}
                  </SwipeToDelete>
                );
              })}
              {resolved.installments
                .filter((r) => r.is_auto_balance)
                .map((r) => (
                  <li key="auto" className="flex min-h-14 items-center gap-3 px-4 py-2" data-bundle-payment="auto">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ink">{r.label}</span>
                      <span className="block truncate text-[12px] text-ink/55">{dueLabel(r.due, r.offset_days)} · the rest</span>
                    </span>
                    <span className="shrink-0 font-mono text-[14px] text-ink/70">{php(Math.round(r.amount_centavos / 100))}</span>
                  </li>
                ))}
            </ul>
            {planErr ? (
              <Note>{planErr}</Note>
            ) : (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-success-700" data-bundle-plan-ok="">
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                {resolved.installments.length} {resolved.installments.length === 1 ? 'payment' : 'payments'} · adds up to {php(sums.newTotalPhp)}
              </p>
            )}
            {!frozen && plan.manual.length < MAX_INSTALLMENTS ? (
              <div className="mt-2">
                <ActionButton tone="neutral" icon={Plus} label="Add a payment" onClick={addPayment} />
              </div>
            ) : null}
          </div>

          {/* ⏭ OFFERS ON THIS BUNDLE — the card maker's switches, one per shop offer (9 Nov ruling). It waits for the Offer
              Maker (Build 6 Lane D, another session), which owns the offer → bundle link; nothing is drawn until it exists. */}

          {/* ---- More settings — the spendable budget ---- */}
          <div className={topic}>
            <Fold
              data="bundle-more"
              open={moreOpen}
              onOpenChange={setMoreOpen}
              popovers
              title="More settings"
              line="Spendable budget · money freed"
              lead={<Settings aria-hidden className="h-5 w-5 text-ink/60" strokeWidth={1.75} />}
            >
              <div className="space-y-4 pb-2 pt-3">
                <div>
                  <label className={lab} htmlFor="pkg-budget">
                    Spendable budget <span className={small}>optional</span>
                  </label>
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-ink/70">₱</span>
                    <input id="pkg-budget" inputMode="decimal" disabled={frozen} className={`${field} pl-9 font-mono`} value={pesos(draft.consumable_budget_centavos)} placeholder="—" onChange={(e) => patch({ consumable_budget_centavos: toCentavos(e.target.value) })} />
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <label className="flex min-h-11 flex-1 items-start gap-3 text-[14px] text-ink/80">
                    <input type="checkbox" disabled={frozen} checked={draft.is_consumable_flexible} onChange={(e) => patch({ is_consumable_flexible: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/25 text-terracotta" />
                    <span>Money freed by dropping an inclusion stays in the bundle</span>
                  </label>
                  <InfoTip label="" ariaLabel="About money freed" align="end">
                    <span className="block font-semibold">Money freed</span>
                    <span className="mt-1 block">Off: the couple simply pays less. On: they spend it on something else of yours — so you keep the full price.</span>
                  </InfoTip>
                </div>
              </div>
            </Fold>
          </div>

          {shown.length > 0 ? (
            <p className="px-4 text-xs text-ink/55">
              {shown.length} thing{shown.length === 1 ? '' : 's'} to fix first
            </p>
          ) : null}
          {serverError ? (
            <p role="alert" className="px-4 text-sm text-danger-700">
              {serverError}
            </p>
          ) : null}
        </div>

        {/* ---- What the couple gets, as they will see it — beside the form from 701 ---- */}
        <aside className="hidden pt-4 tab:block" aria-label="As couples see it">
          <div className="sticky top-4 space-y-3 pr-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">As couples see it · live</p>
            {preview}
          </div>
        </aside>
      </div>
    </RiseScreen>
  );
}

/** One problem note under its field — the house error line. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-danger-700" data-bundle-note="">
      <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}

function ProblemLine({ problem }: { problem: DraftProblem }) {
  return <li className="list-none text-xs text-danger-700">{problem.message}</li>;
}

function OptionList({
  item,
  frozen,
  field,
  problemsFor,
  onPatch,
  onStandard,
  onAdd,
  onRemove,
}: {
  item: DraftItem;
  frozen: boolean;
  field: string;
  problemsFor: (itemRef: string, optionRef?: string) => DraftProblem[];
  onPatch: (itemRef: string, optRef: string, over: Partial<DraftOption>) => void;
  onStandard: (itemRef: string, optRef: string) => void;
  onAdd: () => void;
  onRemove: (optRef: string) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/50 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">They pick one — the standard one is in the price, the rest add to it</p>
      <ul className="space-y-2">
        {item.options.map((o) => (
          <li key={o.ref} className="flex items-center gap-2">
            <input type="radio" name={`std-${item.ref}`} aria-label="Make this the standard option" disabled={frozen} checked={o.is_default} onChange={() => onStandard(item.ref, o.ref)} className="h-4 w-4 shrink-0 border-ink/20 text-terracotta" />
            <input aria-label="Option name" className={`${field} flex-1`} disabled={frozen} value={o.label} placeholder="Chicken teriyaki" onChange={(e) => onPatch(item.ref, o.ref, { label: e.target.value })} />
            <input
              aria-label="Extra cost in pesos"
              inputMode="decimal"
              disabled={frozen || o.is_default}
              className={`${field} w-28 font-mono disabled:opacity-50`}
              value={o.is_default ? '' : pesos(o.price_delta_centavos)}
              // The default pick shows a BLANK, not "included" (owner 2026-07-28).
              placeholder={o.is_default ? '' : '+₱'}
              onChange={(e) => onPatch(item.ref, o.ref, { price_delta_centavos: toCentavos(e.target.value) })}
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink/55">
              <input type="checkbox" disabled={frozen || o.is_default} checked={o.is_available} onChange={(e) => onPatch(item.ref, o.ref, { is_available: e.target.checked })} className="h-3.5 w-3.5 rounded border-ink/20 text-terracotta" />
              On
            </label>
            {/* A field INSIDE an editor keeps its small ✕ (owner 2026-11-03); an option is a field of its line, not a list row. */}
            {!frozen && item.options.length > 2 ? (
              <button type="button" aria-label="Remove this option" onClick={() => onRemove(o.ref)} className="rounded p-1 text-ink/30 hover:text-ink/60">
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {item.options.some((o) => problemsFor(item.ref, o.ref).length > 0) ? (
        <ul className="mt-2 space-y-1">{item.options.flatMap((o) => problemsFor(item.ref, o.ref).map((p) => <ProblemLine key={`${o.ref}-${p.code}`} problem={p} />))}</ul>
      ) : null}
      {!frozen ? (
        <button type="button" onClick={onAdd} className="mt-2 text-xs text-mulberry underline underline-offset-2">
          Add another option
        </button>
      ) : null}
    </div>
  );
}
