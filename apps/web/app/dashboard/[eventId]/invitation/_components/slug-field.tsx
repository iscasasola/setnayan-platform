'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { slugForwardingLabel } from '@/lib/slug-forwarding-window';
import { formatPhp } from '@/lib/php';
import { PaidMark } from '@/app/_components/paid-mark';

type CheckResult =
  | { status: 'current' }
  | { status: 'available'; slug: string }
  | { status: 'taken'; suggestions: string[] }
  | { status: 'invalid_format'; reason: string }
  | { status: 'reserved'; reason: string }
  /* 🔴 THE ANSWER NEVER CAME. Not a verdict about the word — a verdict about
     the LOOKUP. It used to be nothing at all: a non-ok response or a dropped
     connection left the previous state standing, the spinner stopped, and Save
     simply never lit. A couple typing a perfectly free address saw a grey
     button and no reason on earth for it. Refusing is right; refusing in
     silence is the bug. */
  | { status: 'unverified' };

/**
 * The address's shape, as the field checks it while typing — the same 3–32 small letters, digits and hyphens the
 * server enforces (`/^[a-z0-9-]{3,32}$/`, `invitation/actions.ts`). Written for the `v` flag (see the input).
 */
export const SLUG_INPUT_PATTERN = '[a-z0-9\\-]{3,32}';

type Props = {
  eventId: string;
  initialSlug: string;
  saveAction: (formData: FormData) => Promise<void>;
  /**
   * 💎 TRY FREE, PAY AT APPLY (owner 2026-10-22): instead of saving, an available address is put in the DRAFT — the
   * Custom address part is asked for at ✓ Apply. Absent: the shipped Save button.
   */
  onDraft?: (address: string) => Promise<boolean>;
  /** The address drafted already — the box opens on it. */
  drafted?: string | null;
  /** Drawn inside `AddressField`, which names the address itself — no second "Address" label. */
  bare?: boolean;
};

export function SlugField({ eventId, initialSlug, saveAction, onDraft, drafted = null, bare = false }: Props) {
  const [value, setValue] = useState(drafted ?? initialSlug);
  const [draftedNow, setDraftedNow] = useState<string | null>(drafted);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  /* 📵 The save never answered (no signal, a 5xx). Said under the box; the address stays typed and Save stays lit. */
  const [notSaved, setNotSaved] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setCheck(null);
      return;
    }
    if (value === initialSlug) {
      setCheck({ status: 'current' });
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setBusy(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slugs/check?slug=${encodeURIComponent(value)}&entity_type=event&entity_id=${eventId}`,
          { method: 'GET' },
        );
        if (res.ok) {
          const json = (await res.json()) as CheckResult;
          setCheck(json);
        } else {
          setCheck({ status: 'unverified' });
        }
      } catch {
        setCheck({ status: 'unverified' });
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, eventId, initialSlug]);

  const canSave = check?.status === 'available' && value !== initialSlug;

  /* 💎 In the draft: an address that is free goes into the draft by itself (a pick, like every Maker control) — and
     one put back to the address in use takes the drafted one off. Nothing is saved on the page. */
  useEffect(() => {
    if (!onDraft) return;
    const want = value === initialSlug ? null : canSave ? value : undefined;
    if (want === undefined || want === draftedNow) return;
    let gone = false;
    void onDraft(want ?? '').then((ok) => {
      if (!gone && ok) setDraftedNow(want);
      if (!gone && !ok) setNotSaved(true);
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a pick is drafted once per settled answer
  }, [canSave, value]);

  return (
    <form
      action={(formData) => {
        setNotSaved(false);
        startTransition(async () => {
          try {
            await saveAction(formData);
          } catch (e) {
            /* A redirect is how this action ANSWERS — saved or refused, it lands back here with the reason. Only a
               request that never answered is caught: thrown into this transition it replaced the whole page (in the
               Maker, the whole Maker) with the app's error screen. */
            if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
            setNotSaved(true);
          }
        });
      }}
      className="space-y-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          htmlFor="slug"
          className={bare ? 'sr-only' : 'font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 sm:mr-2'}
        >
          Address
        </label>
        <div className="flex-1">
          <div className="relative">
            <input
              id="slug"
              name="slug"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder="maria-and-juan"
              /* The hyphen is ESCAPED: browsers compile `pattern` with the `v` flag, where a bare `-` in a class is a
                 syntax error — the check was dropped and the console said so (the walk of 2026-10-11, P08). */
              pattern={SLUG_INPUT_PATTERN}
              className="input-field w-full pr-8 font-mono text-sm"
            />
            <StatusBadge busy={busy} check={check} />
          </div>
          <SuggestionsRow
            check={check}
            onPick={(s) => {
              setValue(s);
              setCheck(null);
            }}
          />
          <StatusLine check={check} drafting={Boolean(onDraft)} />
          {notSaved ? (
            <p role="alert" className="mt-1 text-xs text-warn-700">
              That did not save. Please try again.
            </p>
          ) : null}
        </div>
        {onDraft ? null : (
        <button
          type="submit"
          disabled={!canSave || pending}
          className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save address'}
        </button>
        )}
      </div>
      {onDraft ? null : (
      <p className="text-xs text-ink/50">
        3 to 32 characters: small letters, numbers and hyphens. Old links keep working for{' '}
        {slugForwardingLabel()}.
      </p>
      )}
    </form>
  );
}

function StatusBadge({
  busy,
  check,
}: {
  busy: boolean;
  check: CheckResult | null;
}) {
  let tone = '';
  let Icon: typeof Check | null = null;
  let spin = false;
  if (busy) {
    tone = 'text-ink/45';
    Icon = Loader2;
    spin = true;
  } else if (!check) {
    Icon = null;
  } else if (check.status === 'available' || check.status === 'current') {
    tone = 'text-success-700';
    Icon = Check;
  } else if (check.status === 'taken' || check.status === 'reserved') {
    tone = 'text-danger-700';
    Icon = X;
  } else if (check.status === 'invalid_format' || check.status === 'unverified') {
    tone = 'text-warn-700';
    Icon = AlertTriangle;
  }

  if (!Icon) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tone}`}
    >
      <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} strokeWidth={2} />
    </span>
  );
}

function StatusLine({ check, drafting }: { check: CheckResult | null; drafting: boolean }) {
  if (!check) return null;
  if (check.status === 'available') {
    /* Drafted (the Maker, without the Custom address part): no Save button here — ✓ Apply keeps it. */
    return drafting ? (
      <p className="mt-1 text-xs text-success-700">Available — ✓ Apply keeps it.</p>
    ) : (
      <p className="mt-1 text-xs text-success-700">Available — tap Save address to keep it.</p>
    );
  }
  if (check.status === 'current') {
    return <p className="mt-1 text-xs text-ink/55">This is your address now.</p>;
  }
  if (check.status === 'taken') {
    return <p className="mt-1 text-xs text-danger-700">Taken — try one of these:</p>;
  }
  if (check.status === 'invalid_format') {
    return <p className="mt-1 text-xs text-warn-700">{check.reason}</p>;
  }
  if (check.status === 'reserved') {
    return <p className="mt-1 text-xs text-danger-700">{check.reason}</p>;
  }
  if (check.status === 'unverified') {
    return (
      <p className="mt-1 text-xs text-warn-700">
        We couldn&rsquo;t check that address just now — Save stays off until we can. Try again in a
        moment.
      </p>
    );
  }
  return null;
}

function SuggestionsRow({
  check,
  onPick,
}: {
  check: CheckResult | null;
  onPick: (slug: string) => void;
}) {
  if (!check || check.status !== 'taken' || check.suggestions.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {check.suggestions.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono text-xs hover:border-terracotta"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * 💎 THE ADDRESS, PART BY PART (owner 2026-10-22; prototype `pro_part_by_part_2026-10-22.html` frame 5). The free
 * address is SHOWN, not typed — with Copy and Share, the presses a free couple needs. "Pick your own · ◆ ₱500" is one
 * row; it opens in place (no "edit elsewhere" link) and the pick lives in the draft: ✓ Apply asks for the Custom
 * address part (or everything), and the old link keeps forwarding. An event that renamed before keeps its address
 * free ("chosen before, kept free"); a further change asks for the part. An event that holds the part (or
 * everything) sees "Change it" with no price, and saves as before.
 *
 * Every figure is a catalogue read handed in; in the app-store shell a couple without the part sees no paid row.
 * ⛔ Since 2026-10-26 the part is off sale (owner: "just have the upgrade event hub pro") — no price is handed in, and
 * the row says Event Hub Pro instead of the part.
 */
export function AddressField({
  eventId,
  slug,
  saveAction,
  owns,
  renamed,
  pricePhp,
  storeShell,
  drafted,
}: {
  eventId: string;
  slug: string;
  saveAction: (formData: FormData) => Promise<void>;
  /** The Custom address part (or everything) is held. */
  owns: boolean;
  /** The event renamed its address before — its row in `slug_change_log`. */
  renamed: boolean;
  /** The part's catalogue price, or null (unread, the shell). */
  pricePhp: number | null;
  storeShell: boolean;
  drafted: string | null;
}) {
  const [open, setOpen] = useState(Boolean(drafted));
  const [copied, setCopied] = useState(false);
  const url = `https://setnayan.com/${slug}`;
  const draftAddress = async (next: string): Promise<boolean> => {
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ address: next || null }));
    const { hubDraftAction } = await import('../../website/hub-draft-actions');
    const { makerSave } = await import('@/lib/maker-refresh');
    const r = await makerSave(() => hubDraftAction(eventId, fd), () => undefined).catch(() => null);
    return Boolean(r && (r as { ok?: boolean }).ok);
  };
  const price = pricePhp !== null ? formatPhp(pricePhp) : null;
  const offered = owns || !storeShell;
  return (
    <div data-address-field={owns ? 'owned' : renamed ? 'kept' : 'free'} className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Address</p>
      <p className="break-all font-mono text-[15px] text-ink">
        <span className="text-ink/55">setnayan.com/</span>
        {slug}
      </p>
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-[12.5px] font-semibold text-success-700">
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
        {owns ? 'Yours' : renamed ? 'Yours · chosen before, kept free' : 'Free · made from your names and date'}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
          className="sn-press inline-flex min-h-11 items-center rounded-full border border-ink/25 px-4 text-sm font-semibold text-ink"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (navigator.share) void navigator.share({ url }).catch(() => undefined);
            else void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
          className="sn-press inline-flex min-h-11 items-center rounded-full border border-ink/25 px-4 text-sm font-semibold text-ink"
        >
          Share
        </button>
      </div>
      {offered ? (
        <div className="border-t border-ink/10 pt-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            data-address-pick=""
            className="flex min-h-11 w-full items-center gap-2 text-left"
          >
            <span className="flex-1 text-[15px] font-semibold text-ink">{renamed || owns ? 'Change it' : 'Pick your own'}</span>
            {owns ? null : price ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink/70">
                <PaidMark state="try" bare label="Custom address" size="xs" /> {price}
              </span>
            ) : null}
            <span aria-hidden className={`text-ink/45 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
          </button>
          {open ? (
            <div className="space-y-2 pb-2">
              <SlugField eventId={eventId} initialSlug={slug} saveAction={saveAction} bare {...(owns ? {} : { onDraft: draftAddress, drafted })} />
              <p className="text-xs leading-snug text-ink/55">
                3 to 32 characters: small letters, numbers and hyphens.{' '}
                {owns ? (
                  <>Old links keep working for {slugForwardingLabel()}.</>
                ) : (
                  <>
                    <b className="font-semibold text-ink">◆ Goes live when you Apply</b> — {price ? `Custom address ${price}, or everything.` : 'with Event Hub Pro.'}
                    Until then guests use the link above, and it keeps forwarding for {slugForwardingLabel()} after.
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="pb-1 text-xs text-ink/55">
              {owns
                ? `Your old link keeps forwarding for ${slugForwardingLabel()}.`
                : renamed
                  ? `Your current address stays yours for free. Choosing a new one is ${price ? 'the Custom address part, or everything' : 'part of Event Hub Pro'}. The old one keeps forwarding for ${slugForwardingLabel()}.`
                  : `${price ? 'Part of everything, too.' : 'Part of Event Hub Pro.'} Your old link keeps forwarding for ${slugForwardingLabel()}.`}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
