import type { ModelSpec } from '../model/types';
import { lookup } from '../rules/catalog';
import { displayStats, type Context } from '../rules/engine';
import type { Item } from '../rules/types';
import { h } from './dom';
import { itemFacts, type ItemKind } from './item-info';

/** The read-only view of a model: its stats, weapons, equipment and powers. */
export function modelSummary(m: ModelSpec, ctx: Context): HTMLElement {
  const s = displayStats(m);
  const stats = (
    [
      ['Spd', s.spd],
      ['Def', s.def],
      ['FP', s.fp],
      ['Prw', s.prw],
      ['Will', s.will],
    ] as const
  ).map(([k, v]) => h('div', { class: 'stat' }, h('small', {}, k), h('b', {}, v)));

  const group = (title: string, kind: ItemKind, ids: string[]) =>
    ids.length === 0
      ? null
      : h(
          'div',
          { class: 'summary-group' },
          h('h3', {}, title),
          ...ids.map((id) => {
            const item = lookup(kind, id) as Item | undefined;
            if (!item) return h('div', { class: 'summary-item muted' }, `Unknown item “${id}”`);
            return h(
              'div',
              { class: 'summary-item' },
              h('b', {}, item.name),
              h('span', { class: 'muted' }, ` · ${itemFacts(kind, item, ctx)}`),
              item.notes && h('div', { class: 'muted notes' }, item.notes),
            );
          }),
        );

  return h(
    'div',
    { class: 'summary' },
    h('div', { class: 'stats-line' }, ...stats),
    group('Ranged weapons', 'ranged', m.rangedWeapons),
    group('Close combat weapons', 'close', m.closeWeapons),
    group('Equipment', 'equipment', m.equipment),
    group('Psychic powers', 'powers', m.powers),
  );
}
