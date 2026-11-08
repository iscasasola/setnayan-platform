'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListFilter } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { addChoices, NEW_BUNDLE_HREF } from './shop-services-head';

/**
 * 👍 SHOP'S THUMB ROW — Search services · Show & sort · ＋ (New bundle · New service — Build 3 Lane E item 6: the one add
 * control, the same two choices as the services head's ＋) (owner v95: "Thumb row: search · Show & sort
 * (Show All/Live/Draft; Sort Most viewed/Most asked/Name) · ＋"; THE ONE BUILD A3 W12, lane C4).
 *
 *   · Search narrows the shipped card list IN PLACE by its words (the house move — Hub's crew search), no request.
 *   · Show = All · Live · Hidden — the app's words for `is_active` ("Live — tap to hide" / "Hidden"), never "Draft".
 *   · Sort = As listed · Name. ✂ "Most viewed" / "Most asked" are NOT offered: views are counted per shop only
 *     (`vendor_profile_views`), so a per-card order would be invented (A3 §9 Q12).
 * One ThumbMenu holds Show and Sort (any set of choices is ONE dropdown). A group heading with no card left steps aside.
 * 🔒 shop/the-shop-tab-is-v113.test.ts
 */
type Show = 'all' | 'live' | 'hidden';
type Sort = 'listed' | 'name';

function apply(words: string, show: Show, sort: Sort) {
  const needle = words.trim().toLowerCase();
  const list = document.querySelector<HTMLElement>('[data-shop-card-list]');
  if (!list) return;
  const items = [...list.children] as HTMLElement[];
  // Sort · Name: CSS order inside the list, so no node moves (a form mid-edit keeps its state).
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  let shown = 0;
  let group: HTMLElement | null = null;
  let groupHas = false;
  const names = items.filter((li) => li.hasAttribute('data-shop-card')).map((li) => li.dataset.shopCardName ?? '').sort();
  for (const li of items) {
    if (li.hasAttribute('data-shop-card-group')) {
      if (group) group.style.display = groupHas && sort === 'listed' ? '' : 'none';
      group = li;
      groupHas = false;
      continue;
    }
    if (!li.hasAttribute('data-shop-card')) continue;
    const live = li.dataset.shopCardLive === '1';
    const hit =
      (!needle || (li.textContent ?? '').toLowerCase().includes(needle)) &&
      (show === 'all' || (show === 'live' ? live : !live));
    li.style.display = hit ? '' : 'none';
    li.style.order = sort === 'name' ? String(names.indexOf(li.dataset.shopCardName ?? '')) : '';
    if (hit) {
      shown += 1;
      groupHas = true;
    }
  }
  if (group) group.style.display = groupHas && sort === 'listed' ? '' : 'none';
  const none = document.querySelector<HTMLElement>('[data-shop-cards-none]');
  if (none) none.hidden = shown > 0;
}

export function ShopServicesThumb({ bundlesOn = false }: { bundlesOn?: boolean } = {}) {
  const router = useRouter();
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('listed');
  const [words, setWords] = useState('');
  return (
    <SupplierThumbRow
      name="services"
      label="Service actions"
      row={
        <ThumbRow
          name="services"
          field={{
            placeholder: 'Search services',
            input: {
              onInput: (e) => {
                const v = e.currentTarget.value;
                setWords(v);
                apply(v, show, sort);
              },
              'data-shop-services-find': '',
            },
            onClear: () => {
              setWords('');
              apply('', show, sort);
            },
          }}
          right={[
            {
              menu: [
                { key: 'show:all', label: 'All', group: 'Show' },
                { key: 'show:live', label: 'Live', group: 'Show' },
                { key: 'show:hidden', label: 'Hidden', group: 'Show' },
                { key: 'sort:listed', label: 'As listed', group: 'Sort' },
                { key: 'sort:name', label: 'Name', group: 'Sort' },
              ],
              label: 'Show and sort',
              value: `show:${show}`,
              onPick: (k: string) => {
                const [kind, v] = k.split(':') as ['show' | 'sort', string];
                const nextShow = kind === 'show' ? (v as Show) : show;
                const nextSort = kind === 'sort' ? (v as Sort) : sort;
                setShow(nextShow);
                setSort(nextSort);
                apply(words, nextShow, nextSort);
              },
              mark: 'data-shop-services-show',
              face: (
                <span aria-hidden className="inline-flex">
                  <ListFilter className="h-5 w-5" strokeWidth={1.75} />
                </span>
              ),
            },
          ]}
          action={{
            menu: addChoices(bundlesOn).map((c) => ({ key: c.key, label: c.label })),
            label: 'Add',
            value: null,
            onPick: (k: string) => router.push(k === 'bundle' ? NEW_BUNDLE_HREF : SERVICE_MAKER_HREF),
            mark: 'data-shop-services-add-thumb',
          }}
        />
      }
    />
  );
}
