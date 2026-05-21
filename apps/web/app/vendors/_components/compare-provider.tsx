'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Compare-basket state for the public marketplace. Backed by localStorage
 * so a refresh doesn't wipe the selection. Capped at 3 (mirrors
 * `MAX_COMPARE` on the /vendors/compare page).
 *
 * Anonymous browsers can use this too — comparison is just a URL routing
 * concern, no auth needed until the user lands on the compare page.
 */

const STORAGE_KEY = 'setnayan.compare.ids';
const MAX_COMPARE = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CompareContextValue = {
  ids: string[];
  toggle: (vendorProfileId: string) => void;
  remove: (vendorProfileId: string) => void;
  clear: () => void;
  isSelected: (vendorProfileId: string) => boolean;
  isFull: boolean;
  hydrated: boolean;
  max: number;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  // `hydrated` keeps the first server-rendered paint stable; consumers
  // that render selection state should gate on this to avoid the empty
  // → filled flicker after localStorage rehydrates.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((x): x is string => typeof x === 'string' && UUID_RE.test(x))
            .slice(0, MAX_COMPARE);
          if (cleaned.length > 0) setIds(cleaned);
        }
      }
    } catch {
      // Quota / corrupted JSON / SSR — fall through with empty state.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (ids.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      }
    } catch {
      // Private-browsing / quota — ignore.
    }
  }, [ids, hydrated]);

  const toggle = useCallback((vendorProfileId: string) => {
    if (!UUID_RE.test(vendorProfileId)) return;
    setIds((prev) => {
      if (prev.includes(vendorProfileId)) {
        return prev.filter((x) => x !== vendorProfileId);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, vendorProfileId];
    });
  }, []);

  const remove = useCallback((vendorProfileId: string) => {
    setIds((prev) => prev.filter((x) => x !== vendorProfileId));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const isSelected = useCallback(
    (vendorProfileId: string) => ids.includes(vendorProfileId),
    [ids],
  );

  const value = useMemo<CompareContextValue>(
    () => ({
      ids,
      toggle,
      remove,
      clear,
      isSelected,
      isFull: ids.length >= MAX_COMPARE,
      hydrated,
      max: MAX_COMPARE,
    }),
    [ids, toggle, remove, clear, isSelected, hydrated],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare must be called inside <CompareProvider>');
  }
  return ctx;
}
