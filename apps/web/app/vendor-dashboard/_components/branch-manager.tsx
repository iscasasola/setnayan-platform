'use client';

/**
 * BranchManager — the ONE shared branch add + manage surface, rendered both
 * inline in My Shop (owner 2026-07-02 "no more jumping to a new page, just
 * expand it there") and on the /vendor-dashboard/branches page.
 *
 * Add flow: name → drop a pin (BranchPinMap) → city auto-detected via reverse
 * geocode → range is automatic (Enterprise tier reach) → pick BDO/GCash →
 * Purchase ₱999/28 days (apply-then-pay; a Setnayan admin confirms the payment
 * and the branch activates). Manage: pay reference, renew (when expired),
 * cancel — all in place via useActionState, no page jump.
 */

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import { Collapsible } from './collapsible';
import { BranchPinMap, type LatLng } from './branch-pin-map';
import {
  createBranch,
  renewBranch,
  cancelBranch,
  detectBranchLocation,
} from '../branches/actions';
import { BRANCH_IDLE, type BranchActionState } from '../branches/branch-types';
import {
  BRANCH_LABEL_MAX,
  BRANCH_CITY_MAX,
  type BranchStatus,
  type VendorBranchView,
} from '@/lib/vendor-branches';

const STATUS_TONE: Record<BranchStatus, string> = {
  active: 'bg-success-100 text-success-800',
  pending_payment: 'bg-warn-100 text-warn-800',
  expired: 'bg-danger-100 text-danger-800',
  cancelled: 'bg-ink/10 text-ink/55',
};
const STATUS_LABEL: Record<BranchStatus, string> = {
  active: 'Active',
  pending_payment: 'Pending payment',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export type PayInfo = {
  bdoName: string | null;
  bdoNumber: string | null;
  gcashName: string | null;
  gcashNumber: string | null;
};

type Props = {
  branches: VendorBranchView[];
  feePhp: number;
  autoRadiusKm: number;
  /** Where the pin map opens before the vendor pans (HQ, or a PH fallback). */
  initialCenter: LatLng;
  pay: PayInfo;
};

export function BranchManager({ branches, feePhp, autoRadiusKm, initialCenter, pay }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const live = branches.filter((b) => b.status !== 'cancelled');
  const hasPending = branches.some((b) => b.status === 'pending_payment');

  return (
    <div className="space-y-4">
      {/* Add-branch trigger + inline expander */}
      <div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-3.5 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add a branch
        </button>
        <Collapsible open={adding} className="mt-3">
          <AddBranchForm
            feePhp={feePhp}
            autoRadiusKm={autoRadiusKm}
            initialCenter={initialCenter}
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
            toastSuccess={(m) => toast.success(m)}
            toastError={(m) => toast.error(m)}
          />
        </Collapsible>
      </div>

      {/* How to pay — shown whenever a branch is awaiting payment */}
      {hasPending ? (
        <section
          className="space-y-2 rounded-xl border p-4"
          style={{ borderColor: 'var(--m-warn-line, rgba(180,120,0,0.35))', background: 'var(--m-orange-4)' }}
        >
          <h3 className="text-xs font-semibold text-ink">How to pay</h3>
          <p className="text-xs text-ink/70">
            Send {peso(feePhp)} per pending branch and put its{' '}
            <span className="font-medium">reference code</span> in the transfer note so
            our team can match it (confirmed within 24 hours).
          </p>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {pay.bdoNumber ? (
              <div className="rounded-lg border bg-white p-2.5" style={{ borderColor: 'var(--m-line)' }}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">BDO</dt>
                <dd className="mt-0.5 text-ink">
                  {pay.bdoName ?? 'Setnayan'}
                  <br />
                  <span className="font-mono">{pay.bdoNumber}</span>
                </dd>
              </div>
            ) : null}
            {pay.gcashNumber ? (
              <div className="rounded-lg border bg-white p-2.5" style={{ borderColor: 'var(--m-line)' }}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">GCash</dt>
                <dd className="mt-0.5 text-ink">
                  {pay.gcashName ?? 'Setnayan'}
                  <br />
                  <span className="font-mono">{pay.gcashNumber}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Branch list */}
      {live.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-6 text-center"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <Building2 aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No extra branches yet.</p>
          <p className="mt-1 text-xs text-ink/55">Your headquarters is always your first location.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {live.map((b) => (
            <BranchRow
              key={b.branch_id}
              branch={b}
              feePhp={feePhp}
              onDone={() => router.refresh()}
              toastSuccess={(m) => toast.success(m)}
              toastError={(m) => toast.error(m)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddBranchForm({
  feePhp,
  autoRadiusKm,
  initialCenter,
  onDone,
  toastSuccess,
  toastError,
}: {
  feePhp: number;
  autoRadiusKm: number;
  initialCenter: LatLng;
  onDone: () => void;
  toastSuccess: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const [state, formAction] = useActionState<BranchActionState, FormData>(
    createBranch,
    BRANCH_IDLE,
  );
  const [pin, setPin] = useState<LatLng>(initialCenter);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [detecting, setDetecting] = useState(false);
  const detectSeq = useRef(0);
  const handled = useRef<BranchActionState | null>(null);

  const detect = useCallback((v: LatLng) => {
    const seq = ++detectSeq.current;
    setDetecting(true);
    detectBranchLocation(v.lat, v.lng)
      .then((res) => {
        if (seq !== detectSeq.current) return; // ignore stale pan responses
        setCity(res.city);
        setAddress(res.address);
      })
      .catch(() => {
        if (seq !== detectSeq.current) return;
      })
      .finally(() => {
        if (seq === detectSeq.current) setDetecting(false);
      });
  }, []);

  // Detect the opening centre once so the city is pre-filled.
  useEffect(() => {
    detect(initialCenter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settle each submission once.
  useEffect(() => {
    if (state === BRANCH_IDLE || state === handled.current) return;
    handled.current = state;
    if (state.status === 'success') {
      toastSuccess(state.message);
      onDone();
    } else if (state.status === 'error') {
      toastError(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onPinChange = (v: LatLng) => {
    setPin(v);
    detect(v);
  };

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-cream, #faf7f2)' }}
    >
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink/70">Branch name</span>
        <input
          name="branch_label"
          required
          maxLength={BRANCH_LABEL_MAX}
          placeholder="e.g. Cebu studio"
          className="input-field"
        />
      </label>

      <div className="space-y-1">
        <span className="block text-xs font-medium text-ink/70">
          Location <span className="font-normal text-ink/45">— drag the map to drop your pin</span>
        </span>
        <BranchPinMap value={pin} onChange={onPinChange} initialCenter={initialCenter} />
      </div>

      <label className="block space-y-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink/70">
          <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          City {detecting ? <span className="font-normal text-ink/45">· detecting…</span> : <span className="font-normal text-ink/45">· auto-detected, edit if needed</span>}
        </span>
        <input
          name="branch_city"
          required
          maxLength={BRANCH_CITY_MAX}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Drop a pin to detect the city"
          className="input-field"
        />
      </label>

      {/* Coords + resolved address ride along as hidden fields. */}
      <input type="hidden" name="branch_latitude" value={pin.lat} />
      <input type="hidden" name="branch_longitude" value={pin.lng} />
      <input type="hidden" name="branch_address" value={address} />

      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-ink/70"
        style={{ borderColor: 'var(--m-line)', background: 'white' }}
      >
        <MapPin className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} aria-hidden />
        Coverage area <span className="font-medium text-ink">~{autoRadiusKm} km</span> around this pin — set automatically for your plan.
      </div>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink/70">Pay with</span>
        <select name="channel" defaultValue="bdo" className="input-field cursor-pointer">
          <option value="bdo">BDO bank transfer</option>
          <option value="gcash">GCash</option>
        </select>
      </label>

      <SubmitButton className="button-primary w-full" pendingLabel="Starting…">
        Purchase · {peso(feePhp)} / 28 days
      </SubmitButton>
      <p className="text-center text-[11px] text-ink/45">
        Apply-then-pay — the branch activates once our team confirms your payment.
      </p>
    </form>
  );
}

function BranchRow({
  branch,
  feePhp,
  onDone,
  toastSuccess,
  toastError,
}: {
  branch: VendorBranchView;
  feePhp: number;
  onDone: () => void;
  toastSuccess: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const [renewState, renewAction] = useActionState<BranchActionState, FormData>(
    renewBranch,
    BRANCH_IDLE,
  );
  const [cancelState, cancelAction] = useActionState<BranchActionState, FormData>(
    cancelBranch,
    BRANCH_IDLE,
  );
  const handledRenew = useRef<BranchActionState | null>(null);
  const handledCancel = useRef<BranchActionState | null>(null);

  useEffect(() => {
    if (renewState === BRANCH_IDLE || renewState === handledRenew.current) return;
    handledRenew.current = renewState;
    if (renewState.status === 'success') {
      toastSuccess(renewState.message);
      onDone();
    } else if (renewState.status === 'error') {
      toastError(renewState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewState]);

  useEffect(() => {
    if (cancelState === BRANCH_IDLE || cancelState === handledCancel.current) return;
    handledCancel.current = cancelState;
    if (cancelState.status === 'success') {
      toastSuccess(cancelState.message);
      onDone();
    } else if (cancelState.status === 'error') {
      toastError(cancelState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelState]);

  return (
    <li
      className="flex items-start justify-between gap-3 rounded-xl border bg-white p-3"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold text-ink">{branch.branch_label}</p>
        <p className="text-xs text-ink/65">
          {branch.branch_city} · {branch.branch_radius_km} km radius
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[branch.status]}`}
          >
            {STATUS_LABEL[branch.status]}
          </span>
          {branch.status === 'pending_payment' && branch.reference_code ? (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70">
              Ref <span className="font-mono font-semibold">{branch.reference_code}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {branch.status === 'expired' ? (
          <form action={renewAction}>
            <input type="hidden" name="branch_id" value={branch.branch_id} />
            <input type="hidden" name="channel" value="bdo" />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-warn-300 bg-warn-50 px-3 text-xs font-medium text-warn-900 hover:border-warn-500"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Renew · {peso(feePhp)}
            </button>
          </form>
        ) : null}
        <form action={cancelAction}>
          <input type="hidden" name="branch_id" value={branch.branch_id} />
          <button
            type="submit"
            aria-label={`Cancel ${branch.branch_label}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </li>
  );
}
