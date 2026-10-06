import type { ModelSpec } from '../model/types';
import { lookup } from '../rules/catalog';
import type { Item } from '../rules/types';
import { h } from './dom';

type Row = string[];

const joinNotes = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('. ');

function weaponRow(kind: 'ranged' | 'close', id: string): Row {
  const w = lookup(kind, id) as (Item & { maxShoot?: number; maxFight?: number }) | undefined;
  if (!w) return [`Unknown (${id})`, '', ''];
  const actions = kind === 'ranged' ? `${w.maxShoot} shoot` : `${w.maxFight} fight`;
  return [w.name, actions, w.notes ?? ''];
}

function equipmentRow(id: string): Row {
  const e = lookup('equipment', id);
  if (!e) return [`Unknown (${id})`, ''];
  return [e.name, joinNotes(e.type === 'A' ? 'Use Item action' : undefined, e.notes)];
}

function powerRow(id: string): Row {
  const p = lookup('powers', id);
  if (!p) return [`Unknown (${id})`, ''];
  return [p.name, joinNotes(`${p.type} power`, p.notes)];
}

/** One section of the table: a heading row, then a row per item. A short row's last cell spans the rest. */
function section(heads: string[], rows: Row[]) {
  const span = (cells: string[], i: number) => (i === cells.length - 1 ? 4 - cells.length : 0);
  const cell = (tag: 'th' | 'td', cells: string[], i: number) =>
    h(tag, { colspan: span(cells, i) > 0 ? span(cells, i) + 1 : null }, cells[i]!);
  const tr = (tag: 'th' | 'td', cells: string[]) =>
    h('tr', {}, ...cells.map((_, i) => cell(tag, cells, i)));
  return [h('thead', {}, tr('th', heads)), h('tbody', {}, ...rows.map((r) => tr('td', r)))];
}

/**
 * The read-only table for a model: weapons (ranged and close combat together) with their
 * actions and notes, then equipment and psychic powers, whose notes span the Actions and
 * Notes columns. A section is left out when it would be empty.
 */
export function itemTable(m: ModelSpec): HTMLElement | null {
  const weapons = [
    ...m.rangedWeapons.map((id) => weaponRow('ranged', id)),
    ...m.closeWeapons.map((id) => weaponRow('close', id)),
  ];
  const sections = [
    weapons.length > 0 ? section(['Weapon', 'Actions', 'Notes'], weapons) : [],
    m.equipment.length > 0 ? section(['Equipment', 'Notes'], m.equipment.map(equipmentRow)) : [],
    m.powers.length > 0 ? section(['Psychic power', 'Notes'], m.powers.map(powerRow)) : [],
  ].flat();
  return sections.length > 0 ? h('table', { class: 'items' }, ...sections) : null;
}
