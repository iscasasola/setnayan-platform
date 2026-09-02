'use client';

import { useState, useTransition } from 'react';
import {
  linkCelebration,
  renameCluster,
  setClusterAnchor,
  unlinkCelebration,
} from '../../actions';

type Member = { event_id: string; display_name: string; is_anchor: boolean };
type Linkable = { event_id: string; display_name: string };
type Result = { ok: true } | { ok: false; error: string };

/**
 * The write side of one group: add a celebration, choose the main one, rename,
 * remove.
 *
 * Kept deliberately plain. This is the first cluster screen that has ever
 * existed, so it ships the five things the 7a primitive can actually do and
 * nothing speculative — no drag-to-reorder (the order is derived from dates,
 * not chosen), no cross-celebration rollups (7d, and the ruling forbids the
 * money one outright).
 */
export function ClusterTools({
  clusterId,
  clusterName,
  members,
  membersMeasured,
  linkable,
  linkableMeasured,
}: {
  clusterId: string;
  clusterName: string;
  members: Member[];
  membersMeasured: boolean;
  linkable: Linkable[];
  linkableMeasured: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<Result>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  };

  const anchored = members.find((m) => m.is_anchor) ?? null;

  return (
    <section className="sn-tile space-y-6">
      <h2 className="sn-sec">Manage this group</h2>

      {error ? (
        <p
          className="rounded-xl border border-ink/10 bg-white/40 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* ── add ──────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-ink">Add a celebration</h3>
        {!linkableMeasured ? (
          <p className="mt-1 text-sm text-ink-soft" role="status">
            We could not load your other celebrations just now. Refresh to try again.
          </p>
        ) : linkable.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            You have no other celebrations to add. A celebration can be in one group at a time.
          </p>
        ) : (
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            action={(formData) => run(() => linkCelebration(formData))}
          >
            <input type="hidden" name="event_cluster_id" value={clusterId} />
            <label className="sr-only" htmlFor="link-event">
              Choose a celebration
            </label>
            <select id="link-event" name="event_id" required className="input-field flex-1">
              <option value="">Choose a celebration…</option>
              {linkable.map((e) => (
                <option key={e.event_id} value={e.event_id}>
                  {e.display_name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={pending} className="button-primary disabled:opacity-50">
              Add
            </button>
          </form>
        )}
      </div>

      {/* ── anchor ───────────────────────────────────────────────────────── */}
      {membersMeasured && members.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-ink">The main celebration</h3>
          <p className="sn-sec-sub">
            The one the others are shown beside — usually the wedding. A group does not need one.
          </p>
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            action={(formData) => run(() => setClusterAnchor(formData))}
          >
            <input type="hidden" name="event_cluster_id" value={clusterId} />
            <label className="sr-only" htmlFor="anchor-event">
              Choose the main celebration
            </label>
            <select
              id="anchor-event"
              name="event_id"
              defaultValue={anchored?.event_id ?? ''}
              className="input-field flex-1"
            >
              <option value="">No main celebration</option>
              {members.map((m) => (
                <option key={m.event_id} value={m.event_id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="button-secondary disabled:opacity-50"
            >
              Save
            </button>
          </form>
        </div>
      ) : null}

      {/* ── rename ───────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-ink">Rename this group</h3>
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          action={(formData) => run(() => renameCluster(formData))}
        >
          <input type="hidden" name="event_cluster_id" value={clusterId} />
          <label className="sr-only" htmlFor="rename-cluster">
            Group name
          </label>
          <input
            id="rename-cluster"
            name="display_name"
            defaultValue={clusterName}
            required
            maxLength={80}
            className="input-field flex-1"
          />
          <button type="submit" disabled={pending} className="button-secondary disabled:opacity-50">
            Rename
          </button>
        </form>
      </div>

      {/* ── remove ───────────────────────────────────────────────────────── */}
      {membersMeasured && members.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-ink">Remove from this group</h3>
          {/*
            🔑 SAY WHAT "REMOVE" DOES, BECAUSE THE WORD IS FRIGHTENING HERE.
            It deletes a label, not a wedding. Without this sentence a person
            reasonably reads the button as destroying the celebration.
          */}
          <p className="sn-sec-sub">
            This only ungroups it. The celebration, its guests, its shots and its money are not
            touched.
          </p>
          <ul className="mt-2 space-y-2">
            {members.map((m) => (
              <li key={m.event_id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{m.display_name}</span>
                <form
                  action={(formData) => run(() => unlinkCelebration(formData))}
                  className="shrink-0"
                >
                  <input type="hidden" name="event_cluster_id" value={clusterId} />
                  <input type="hidden" name="event_id" value={m.event_id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="button-secondary text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
