import type { ModelSpec } from '../model/types';
import { displayStats } from '../rules/engine';
import { h } from './dom';
import { itemTables } from './item-tables';

/** The read-only view of a model: its stats, then tables of weapons, equipment and powers. */
export function modelSummary(m: ModelSpec): HTMLElement {
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

  return h(
    'div',
    { class: 'summary' },
    h('div', { class: 'stats-line' }, ...stats),
    ...itemTables(m),
  );
}
