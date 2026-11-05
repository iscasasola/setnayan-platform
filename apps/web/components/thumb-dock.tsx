'use client';

/**
 * ThumbDock — where a `ThumbRow` sits on a page that had no floating row of its
 * own yet (Events, Discover; owner 2026-10-22 "One thumb row").
 *
 * · Phone and tablet (< 1024): drawn into <body> (a transformed ancestor would
 *   capture `position: fixed`), on the bottom dock (`--sn-bottomdock-h`, which
 *   the iPhone shell publishes with its home-indicator inset), sliding up once
 *   the page has rendered — the same plumbing `SupplierThumbRow` and Find carry.
 * · Computer (≥ 1024): not floating — the row is the content column's first
 *   line, drawn where the host mounted it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './thumb-row.module.css';

const DESK = '(min-width: 1024px)';

export function ThumbDock({
  children,
  noBar = false,
}: {
  children: ReactNode;
  /** The page has no account bar below it (/help, /features): stand on the screen's foot (safe area), not 64px up. */
  noBar?: boolean;
}) {
  const [desk, setDesk] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESK);
    const sync = () => setDesk(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      mq.removeEventListener('change', sync);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  if (desk === null) return null;
  if (desk) return <div className={styles.deskLine}>{children}</div>;
  return createPortal(
    <div className={noBar ? `${styles.dock} ${styles.dockNoBar}` : styles.dock} data-on={on ? 'true' : 'false'} data-thumb-dock="">
      {children}
    </div>,
    document.body,
  );
}
