'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, Plus, Unlink } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';
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
    <section className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--sn-ink-500)]">
        Manage this group
      </h2>

      {error ? (
        <p
          className="text-sm text-[rgb(var(--color-danger))]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* ── add ──────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-ink">Add an event</h3>
        {!linkableMeasured ? (
          <p className="mt-1 text-sm text-[rgb(var(--color-warn))]" role="status">
            We could not load your other events just now — not the same as none. Refresh to try again.
          </p>
        ) : linkable.length === 0 ? (
          <p className="mt-1 text-sm text-ink/75">
            You have no other events to add. An event can be in one group at a time.
          </p>
        ) : (
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            action={(formData) => run(() => linkCelebration(formData))}
          >
            <input type="hidden" name="event_cluster_id" value={clusterId} />
            <PostedPick
              name="event_id"
              label="Choose an event…"
              options={linkable.map((e) => ({ key: e.event_id, label: e.display_name }))}
              className="flex-1"
            />
            <ActionButton type="submit" tone="brand" icon={Plus} label="Add" disabled={pending} waiting={pending} />
          </form>
        )}
      </div>

      {/* ── anchor ───────────────────────────────────────────────────────── */}
      {membersMeasured && members.length > 0 ? (
        <div>
          <InfoTip label="The main event" labelAs="h3" labelClassName="text-sm font-semibold text-ink" align="start">
            The one the others are shown beside — usually the wedding. A group does not need one.
          </InfoTip>
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            action={(formData) => run(() => setClusterAnchor(formData))}
          >
            <input type="hidden" name="event_cluster_id" value={clusterId} />
            <PostedPick
              name="event_id"
              label="Choose the main event"
              initial={anchored?.event_id ?? ''}
              options={[
                { key: '', label: 'No main event' },
                ...members.map((m) => ({ key: m.event_id, label: m.display_name })),
              ]}
              className="flex-1"
            />
            <ActionButton type="submit" tone="neutral" icon={Check} label="Save" disabled={pending} waiting={pending} />
          </form>
        </div>
      ) : null}

      {/* ── rename ───────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-ink">Rename this group</h3>
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          action={(formData) => run(() => renameCluster(formData))}
        >
          <input type="hidden" name="event_cluster_id" value={clusterId} />
          <label className="sr-only" htmlFor="rename-cluster">
            Group name
          </label>
          <input
            autoComplete="off"
            id="rename-cluster"
            name="display_name"
            defaultValue={clusterName}
            required
            maxLength={80}
            className="input-field flex-1"
          />
          <ActionButton type="submit" tone="neutral" icon={Pencil} label="Rename" disabled={pending} waiting={pending} />
        </form>
      </div>

      {/* ── remove ───────────────────────────────────────────────────────── */}
      {membersMeasured && members.length > 0 ? (
        <div>
          <InfoTip
            label="Remove from this group"
            labelAs="h3"
            labelClassName="text-sm font-semibold text-ink"
            align="start"
          >
            This only ungroups it. The event, its guests, its shots and its money are not touched.
          </InfoTip>
          {/*
            🔑 SAY WHAT "REMOVE" DOES, BECAUSE THE WORD IS FRIGHTENING HERE.
            It deletes a label, not a wedding. Without this sentence a person
            reasonably reads the button as destroying the celebration.
          */}
          <ul className="mt-2 divide-y divide-ink/10">
            {members.map((m) => (
              <SwipeToDelete
                key={m.event_id}
                as="li"
                word="Remove"
                icon={Unlink}
                label={`Remove ${m.display_name} from this group`}
                busy={pending}
                disabled={pending}
                radiusClass="rounded-none"
                surfaceClass="bg-cream"
                onDelete={(close) => {
                  close();
                  const formData = new FormData();
                  formData.set('event_cluster_id', clusterId);
                  formData.set('event_id', m.event_id);
                  run(() => unlinkCelebration(formData));
                }}
              >
                <span className="flex min-h-14 items-center py-1 text-sm text-ink">
                  <span className="min-w-0 truncate">{m.display_name}</span>
                </span>
              </SwipeToDelete>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
