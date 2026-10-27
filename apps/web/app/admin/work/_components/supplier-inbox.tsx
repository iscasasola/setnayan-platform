/**
 * SupplierInbox — what suppliers sent, at the top of Admin › Work, each one DONE IN ITS ROW (admin supplier slice,
 * owner 2026-10-28: "A"; prototype `prototypes/admin_supplier_slice_2026-10-28/` work.png).
 *
 * Server Component, URL-driven like the queue rows under it: the chips are `?kind=`, an open row is `?item=` — plain
 * links, JS off still works, an open row is bookmarkable. Every decision is a plain `<form>` posting a SHIPPED action
 * (verify · corrections · repost watch · event types · help) with `back` / `return_to` = this very address, so the
 * admin never leaves Work: the row disappears and the outcome line says what happened (or why nothing did).
 *
 * 🔑 Every reason is a dropdown of the list's own words (lib/admin/supplier-work.ts) — the shop reads it, and the
 * actions refuse anything that is not one of them.
 * 🔑 A kind whose read failed is SAID ("couldn't read"), never drawn as nothing waiting.
 */
import Link from 'next/link';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Flag,
  Link2,
  MessageSquare,
  PartyPopper,
  PenLine,
  Send,
  Undo2,
  X,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { ageShort } from '@/lib/admin/queue-counts';
import { formatCount } from '@/lib/format-number';
import {
  SUPPLIER_WORK_CHIP,
  SUPPLIER_WORK_KINDS,
  SUPPLIER_WORK_REASONS,
  countByKind,
  shopAddress,
  type ReasonList,
  type SupplierWorkItem,
  type SupplierWorkKind,
  type SupplierWorkRead,
} from '@/lib/admin/supplier-work';
import { settleVerificationFromWorkList, openApplicationDocument } from '@/app/admin/verify/actions';
import { settleCorrectionFromWorkList, settleHelpFromWorkList } from '@/app/admin/work/actions';
import { resolveRepostFlag } from '@/app/admin/repost-watch/actions';
import { createEventTypeRoster, setEventTypeStatus } from '@/app/admin/categories/actions';
import { setFolderEventTypeOffered } from '@/app/admin/categories/event-type-actions';

export type SupplierInboxProps = {
  read: SupplierWorkRead;
  kind?: SupplierWorkKind;
  /** The open row (`?item=`). */
  itemKey?: string;
  /** This page's address WITHOUT `item`/`settle` — where every form comes back to. */
  basePath: string;
  /** The event types an ask can be pointed to. */
  eventTypes: ReadonlyArray<{ key: string; label: string }>;
  nowMs: number;
};

const ICON: Record<SupplierWorkKind, typeof FileText> = {
  docs: FileText,
  names: PenLine,
  cards: Flag,
  types: PartyPopper,
  msgs: MessageSquare,
};

const PILL =
  'sn-press-ring h-10 min-h-10 w-full max-w-[320px] rounded-full border border-ink/15 bg-white px-3.5 text-[14px] font-medium text-ink dark:bg-raised';

function href(basePath: string, params: Record<string, string | undefined>): string {
  const [path, query = ''] = basePath.split('?');
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') p.delete(k);
    else p.set(k, v);
  }
  const q = p.toString();
  return q ? `${path}?${q}` : path!;
}

function ReasonPick({ list, form, id }: { list: ReasonList; form: string; id: string }) {
  return (
    <label className="flex min-h-[52px] flex-wrap items-center gap-2.5 border-t border-ink/10 py-1.5" htmlFor={id}>
      <span className="min-w-[10rem] flex-1 text-[14px] text-ink">
        If it needs a fix — <span className="text-ink/70">the reason they’ll see</span>
      </span>
      <select id={id} name="reason" form={form} defaultValue="" className={PILL} data-reason-pick={list}>
        <option value="" disabled>
          Pick the reason…
        </option>
        {SUPPLIER_WORK_REASONS[list].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}

function Fact({ name, sub, badge, tone = 'ok' }: { name: string; sub?: string | null; badge?: string; tone?: 'ok' | 'no' | 'wait' }) {
  const toneClass =
    tone === 'ok'
      ? 'bg-[var(--sn-success-soft,#e4f1e8)] text-success-800'
      : tone === 'no'
        ? 'bg-[var(--sn-danger-soft,#fbe9e2)] text-danger-800'
        : 'bg-[var(--sn-warning-soft)] text-ink';
  return (
    <div className="flex min-h-[52px] items-center gap-2.5 border-t border-ink/10 py-1.5 first:border-t-0">
      <span className="min-w-0 flex-1 text-[14px] text-ink">
        {name}
        {sub ? <span className="block truncate text-xs text-ink/70">{sub}</span> : null}
      </span>
      {badge ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>{badge}</span> : null}
    </div>
  );
}

function Preview({ url, alt, empty }: { url: string | null; alt: string; empty: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link; next/image cannot cache it
    <img src={url} alt={alt} className="h-40 w-full rounded-xl bg-ink/[0.04] object-contain" />
  ) : (
    <div className="grid h-40 w-full place-items-center rounded-xl bg-ink/[0.04] px-3 text-center text-xs text-ink/70">
      {empty}
    </div>
  );
}

function DocsBody({ item, back }: { item: Extract<SupplierWorkItem, { kind: 'docs' }>; back: string }) {
  const first = item.papers.find((p) => p.previewUrl) ?? null;
  const a = `ok-${item.applicationId}`;
  const b = `fix-${item.applicationId}`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Preview url={first?.previewUrl ?? null} alt={first ? `${first.label} — ${item.shopName}` : ''} empty="No photo to preview — a PDF opens with Open below." />
        <ul className="mt-2 flex flex-wrap gap-2">
          {item.papers
            .filter((p) => p.present && p.r2Key)
            .map((p) => (
              <li key={p.slot}>
                <form action={openApplicationDocument}>
                  <input type="hidden" name="application_id" value={item.applicationId} />
                  <input type="hidden" name="slot_key" value={p.slot} />
                  <input type="hidden" name="r2_key" value={p.r2Key ?? ''} />
                  <ActionButton type="submit" tone="neutral" quiet icon={<FileText />} label={`Open ${p.label}`} />
                </form>
              </li>
            ))}
        </ul>
      </div>
      <div>
        {item.papers.map((p) => (
          <Fact key={p.slot} name={p.label} badge={p.present ? '✓ in' : 'Not in'} tone={p.present ? 'ok' : 'wait'} />
        ))}
        {item.checks.map((c) => (
          <Fact
            key={c.label}
            name={c.label}
            sub={c.detail}
            badge={c.outcome === 'pass' ? '✓ matches' : c.outcome === 'mismatch' ? 'Does not match' : 'Look'}
            tone={c.outcome === 'pass' ? 'ok' : c.outcome === 'mismatch' ? 'no' : 'wait'}
          />
        ))}
        <ReasonPick list="docs" form={b} id={`reason-${b}`} />
        <form id={a} action={settleVerificationFromWorkList} data-work-form="docs-approve">
          <input type="hidden" name="application_id" value={item.applicationId} />
          <input type="hidden" name="decision" value="approve" />
          <input type="hidden" name="back" value={back} />
        </form>
        <form id={b} action={settleVerificationFromWorkList} data-work-form="docs-fix">
          <input type="hidden" name="application_id" value={item.applicationId} />
          <input type="hidden" name="decision" value="needs_fix" />
          <input type="hidden" name="back" value={back} />
        </form>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <ActionButton type="submit" form={a} tone="ok" main icon={<Check />} label="Approve" />
          <ActionButton type="submit" form={b} tone="warn" icon={<Undo2 />} label="Needs a fix" />
        </div>
      </div>
    </div>
  );
}

function NamesBody({ item, back }: { item: Extract<SupplierWorkItem, { kind: 'names' }>; back: string }) {
  const a = `ok-n${item.requestId}`;
  const b = `no-n${item.requestId}`;
  const slug = item.field === 'business_slug';
  return (
    <div className="max-w-2xl">
      <Fact name="Now" sub={slug ? shopAddress(item.current) : `${item.current ?? '—'}`} />
      <Fact name="Asked" sub={slug ? shopAddress(item.requested) : (item.requested ?? '—')} />
      {item.note ? <Fact name="Why" sub={`“${item.note}”`} /> : null}
      {slug ? (
        <Fact name="Old address forwards to the new one" sub="Printed cards and tarps keep working." badge="✓ forwards" />
      ) : null}
      <ReasonPick list="names" form={b} id={`reason-${b}`} />
      <form id={a} action={settleCorrectionFromWorkList} data-work-form="names-approve">
        <input type="hidden" name="request_id" value={item.requestId} />
        <input type="hidden" name="decision" value="apply" />
        <input type="hidden" name="back" value={back} />
      </form>
      <form id={b} action={settleCorrectionFromWorkList} data-work-form="names-decline">
        <input type="hidden" name="request_id" value={item.requestId} />
        <input type="hidden" name="decision" value="decline" />
        <input type="hidden" name="back" value={back} />
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ActionButton type="submit" form={a} tone="ok" main icon={<Check />} label="Approve" />
        <ActionButton type="submit" form={b} tone="danger" icon={<X />} label="Decline" />
      </div>
    </div>
  );
}

function CardsBody({ item, back }: { item: Extract<SupplierWorkItem, { kind: 'cards' }>; back: string }) {
  const a = `pub-${item.flagId}`;
  const b = `fix-c${item.flagId}`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-2">
        <Preview url={item.flaggedUrl} alt={`Their photo — ${item.shopName}`} empty="Their photo" />
        <Preview url={item.sourceUrl} alt={`Matched photo — ${item.matchShopName}`} empty={`Matched photo (${item.matchShopName})`} />
      </div>
      <div>
        <Fact name="Why it waits" sub={`Repost watch: ${item.matchPct}% match with ${item.matchShopName}`} badge="Held" tone="no" />
        {item.unverifiedShop ? <Fact name="The shop is not verified yet" badge="Unverified" tone="wait" /> : null}
        <ReasonPick list="cards" form={b} id={`reason-${b}`} />
        <form id={a} action={resolveRepostFlag} data-work-form="cards-publish">
          <input type="hidden" name="flag_id" value={item.flagId} />
          <input type="hidden" name="action" value="dismiss" />
          <input type="hidden" name="back" value={back} />
        </form>
        <form id={b} action={resolveRepostFlag} data-work-form="cards-fix">
          <input type="hidden" name="flag_id" value={item.flagId} />
          <input type="hidden" name="action" value="confirm_theft" />
          <input type="hidden" name="back" value={back} />
        </form>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <ActionButton type="submit" form={a} tone="ok" main icon={<Check />} label="Publish" />
          <ActionButton type="submit" form={b} tone="warn" icon={<Undo2 />} label="Needs a fix" />
        </div>
      </div>
    </div>
  );
}

function TypesBody({
  item,
  back,
  eventTypes,
}: {
  item: Extract<SupplierWorkItem, { kind: 'types' }>;
  back: string;
  eventTypes: SupplierInboxProps['eventTypes'];
}) {
  if (item.status === 'linked') {
    const linked = eventTypes.find((t) => t.key === item.eventType)?.label ?? item.eventType ?? 'the new type';
    return (
      <div className="max-w-2xl">
        <Fact name={`Added as ${linked}`} sub="Couples cannot pick it yet. Putting it in the picker tells everyone who asked, in the app." badge="Hidden" tone="wait" />
        {/* SUPPLIER COVERAGE, RIGHT HERE — the shipped Scope categories switch, one group at a time. */}
        <p className="border-t border-ink/10 py-2 text-[14px] text-ink" data-type-coverage="">
          <InfoTip label="Suppliers it covers" align="start">
            The same switch as Event types › Scope categories: a covered group offers this type on every one of its
            categories. Hide a group that has nothing to do with it.
          </InfoTip>
        </p>
        {item.coverage === null ? (
          <p role="alert" className="mb-2 rounded-card bg-[var(--sn-warning-soft)] p-3 text-sm text-ink">
            Couldn’t read which suppliers cover it — refresh to try again.
          </p>
        ) : (
          <ul className="mb-1">
            {item.coverage.map((g) => (
              <li key={g.groupId} className="flex min-h-[52px] items-center gap-2.5 border-t border-ink/10 py-1.5 first:border-t-0">
                <span className="min-w-0 flex-1 text-[14px] text-ink">{g.label}</span>
                <form action={setFolderEventTypeOffered} data-work-form="types-cover">
                  <input type="hidden" name="event_type" value={item.eventType ?? ''} />
                  <input type="hidden" name="folder_id" value={g.groupId} />
                  <input type="hidden" name="offered" value={g.covered ? '0' : '1'} />
                  <input type="hidden" name="return_to" value={back} />
                  {g.covered ? (
                    <ActionButton type="submit" tone="neutral" icon={<X />} label="Hide" name={`Hide ${linked} from ${g.label}`} />
                  ) : (
                    <ActionButton type="submit" tone="ok" icon={<Check />} label="Cover" name={`Cover ${linked} by ${g.label}`} />
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={setEventTypeStatus} className="mt-2.5" data-work-form="types-picker">
          <input type="hidden" name="event_type" value={item.eventType ?? ''} />
          <input type="hidden" name="status" value="picker" />
          <input type="hidden" name="return_to" value={back} />
          <ActionButton type="submit" tone="brand" main icon={<BadgeCheck />} label="Put it in the picker" />
        </form>
      </div>
    );
  }
  const add = `add-${item.requestId}`;
  const link = `link-${item.requestId}`;
  return (
    <div className="max-w-2xl">
      <form id={add} action={createEventTypeRoster} data-work-form="types-add">
        <input type="hidden" name="request_id" value={item.requestId} />
        <input type="hidden" name="event_type" value="" />
        <input type="hidden" name="return_to" value={back} />
        <label className="flex min-h-[52px] flex-wrap items-center gap-2.5 py-1.5" htmlFor={`name-${add}`}>
          <span className="min-w-[10rem] flex-1 text-[14px] text-ink">
            Name <span className="block text-xs text-ink/70">as people will see it · its supplier coverage opens here next</span>
          </span>
          <input id={`name-${add}`} name="label_en" defaultValue={item.label} minLength={2} maxLength={80} required className={PILL} />
        </label>
      </form>
      <form id={link} action={setEventTypeStatus} data-work-form="types-link">
        <input type="hidden" name="request_id" value={item.requestId} />
        <input type="hidden" name="request_answer" value="link" />
        <input type="hidden" name="return_to" value={back} />
        <label className="flex min-h-[52px] flex-wrap items-center gap-2.5 border-t border-ink/10 py-1.5" htmlFor={`type-${link}`}>
          <span className="min-w-[10rem] flex-1 text-[14px] text-ink">Or it is an existing type</span>
          <select id={`type-${link}`} name="event_type" defaultValue="" className={PILL} required>
            <option value="" disabled>
              Pick the type…
            </option>
            {eventTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ActionButton type="submit" form={add} tone="brand" main icon={<PartyPopper />} label="Add the type" />
        <ActionButton type="submit" form={link} tone="neutral" icon={<Link2 />} label="Point them to it" />
      </div>
    </div>
  );
}

function MsgsBody({ item, back }: { item: Extract<SupplierWorkItem, { kind: 'msgs' }>; back: string }) {
  const f = `reply-${item.messageId}`;
  return (
    <div className="max-w-2xl">
      <div className="flex flex-col gap-1.5 rounded-2xl bg-ink/[0.03] p-3" data-chat-flow="">
        <p className="max-w-[80%] self-start rounded-2xl bg-[var(--sn-paper,#efe9df)] px-3 py-2 text-[14px] text-ink">{item.body || item.subject}</p>
        {item.reply ? (
          <p className="max-w-[80%] self-end rounded-2xl bg-[var(--sn-accent,#C24E25)] px-3 py-2 text-[14px] text-white">{item.reply}</p>
        ) : null}
      </div>
      <form id={f} action={settleHelpFromWorkList} className="mt-2.5 flex flex-wrap items-center gap-2" data-work-form="msgs-reply">
        <input type="hidden" name="message_id" value={item.messageId} />
        <input type="hidden" name="status" value="in_progress" />
        <input type="hidden" name="back" value={back} />
        <label className="sr-only" htmlFor={`body-${f}`}>
          Reply to {item.shopName}
        </label>
        <input
          id={`body-${f}`}
          name="admin_notes"
          required
          placeholder="Reply…"
          maxLength={2000}
          className="h-10 min-w-0 flex-1 rounded-full bg-ink/[0.05] px-4 text-[14px] text-ink placeholder:text-ink/60"
        />
        <ActionButton type="submit" tone="info" main icon={<Send />} label="Send" />
        <ActionButton href={`/admin/help?m=${encodeURIComponent(item.messageId)}`} tone="neutral" quiet icon={<MessageSquare />} label="Open the chat" />
      </form>
    </div>
  );
}

export function SupplierInbox({ read, kind, itemKey, basePath, eventTypes, nowMs }: SupplierInboxProps) {
  const counts = countByKind(read.items);
  const shown = kind ? read.items.filter((i) => i.kind === kind) : read.items;
  const back = href(basePath, { item: undefined, settle: undefined, why: undefined });
  const chip = (k: SupplierWorkKind | undefined, label: string, n: number) => {
    const on = kind === k;
    return (
      <Link
        key={k ?? 'all'}
        href={href(back, { kind: k })}
        aria-current={on ? 'page' : undefined}
        className={`sn-press inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-semibold ${
          on ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-white text-ink dark:bg-raised'
        }`}
        data-work-chip={k ?? 'all'}
      >
        {label} {formatCount(n)}
      </Link>
    );
  };
  const unread = read.failed.map((k) => SUPPLIER_WORK_CHIP[k]);
  return (
    <section aria-labelledby="supplier-inbox-h" className="mb-6" data-supplier-inbox="">
      <h2 id="supplier-inbox-h" className="text-lg font-semibold text-ink">
        From suppliers
      </h2>
      <p className="mb-3 text-sm text-ink/70">Everything a supplier sent, oldest first. Each one is done right here.</p>
      <nav aria-label="Filter what suppliers sent" className="mb-3 flex flex-wrap gap-2">
        {chip(undefined, 'All', read.items.length)}
        {SUPPLIER_WORK_KINDS.map((k) => chip(k, SUPPLIER_WORK_CHIP[k], counts[k]))}
      </nav>
      {unread.length > 0 ? (
        <p role="alert" className="mb-3 rounded-card bg-[var(--sn-warning-soft)] p-3 text-sm text-ink" data-work-unread="">
          Couldn’t read {unread.join(' · ')} — refresh to try again. This is not an all-clear.
        </p>
      ) : null}
      {read.absent.includes('types') && (!kind || kind === 'types') ? (
        <p className="mb-3 text-xs text-ink/70" data-work-absent="types">
          <InfoTip label="Event-type asks arrive with the Create Event update." align="start">
            “Can’t find yours? Ask us to add it” stores its asks in a table that ships with that update (PR #7001). Until
            then nobody can ask, so there is nothing to show — this is not a failed read.
          </InfoTip>
        </p>
      ) : null}
      {shown.length === 0 && unread.length === 0 ? (
        <p className="sn-tile p-5 text-center text-sm text-ink/70" data-work-clear="">
          All clear ✓ — nothing from suppliers{kind ? ` under ${SUPPLIER_WORK_CHIP[kind]}` : ''}.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => {
            const open = item.key === itemKey;
            const Icon = ICON[item.kind];
            const rowBack = href(back, { kind });
            return (
              <li key={item.key} className="sn-tile overflow-hidden" data-work-item={item.key}>
                <Link
                  href={href(back, { kind, item: open ? undefined : item.key })}
                  aria-expanded={open}
                  className="sn-row flex min-h-16 items-center gap-3 p-3.5"
                  scroll={false}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/5">
                    <Icon aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{item.title}</span>
                    <span className="block truncate text-[13px] text-ink/70">{item.line}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink/70">{ageShort(item.at, nowMs) ?? ''}</span>
                  {open ? (
                    <ChevronUp aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" />
                  ) : (
                    <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" />
                  )}
                </Link>
                {open ? (
                  <div className="border-t border-ink/10 px-3.5 pb-4 pt-3 sm:pl-[3.75rem]" data-work-body={item.kind}>
                    {item.kind === 'docs' ? <DocsBody item={item} back={rowBack} /> : null}
                    {item.kind === 'names' ? <NamesBody item={item} back={rowBack} /> : null}
                    {item.kind === 'cards' ? <CardsBody item={item} back={rowBack} /> : null}
                    {item.kind === 'types' ? <TypesBody item={item} back={rowBack} eventTypes={eventTypes} /> : null}
                    {item.kind === 'msgs' ? <MsgsBody item={item} back={rowBack} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
