"use client";

import { useTransition } from "react";
import {
  extendReviewWindowAction,
  releaseGalleryEarlyAction,
} from "../actions";

interface Props {
  eventId: string;
  daysLeft: number;
  hoursLeft: number;
  unlocksAt: string;
  windowDays: number;
}

export function ReviewBanner({ eventId, daysLeft, hoursLeft, unlocksAt, windowDays }: Props) {
  const [pending, start] = useTransition();
  const unlocksLabel = new Date(unlocksAt).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const headline =
    daysLeft > 0
      ? `Public unlock in ${daysLeft}d ${hoursLeft}h`
      : `Public unlock in ${hoursLeft}h`;

  return (
    <div
      className="rounded-2xl border border-rule bg-surface px-5 py-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(201,123,75,0.06), rgba(232,201,176,0.10))",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="meta-label mb-1">Couple review window · {windowDays} days</p>
          <p className="text-[15px] font-medium text-ink">{headline}</p>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            Unlocks to all guests at {unlocksLabel}. Hide anything you&apos;d rather
            keep private before then.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await extendReviewWindowAction(eventId, 1);
              })
            }
            className="btn-default text-[12px]"
          >
            Extend by 1 day
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  "Release the gallery to all guests now? This stops the review window and cannot be undone.",
                )
              ) {
                return;
              }
              start(async () => {
                await releaseGalleryEarlyAction(eventId);
              });
            }}
            className="btn-primary text-[12px]"
          >
            Release now
          </button>
        </div>
      </div>
    </div>
  );
}
