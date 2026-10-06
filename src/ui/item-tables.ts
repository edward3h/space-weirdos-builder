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

function table(heads: string[], rows: Row[]) {
  return h(
    'table',
    { class: 'items' },
    h('thead', {}, h('tr', {}, ...heads.map((t) => h('th', {}, t)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))),
  );
}

/**
 * The read-only tables for a model: one for weapons (ranged and close combat together),
 * one for equipment and one for psychic powers. A table is left out when it would be empty.
 */
export function itemTables(m: ModelSpec): HTMLElement[] {
  const weapons = [
    ...m.rangedWeapons.map((id) => weaponRow('ranged', id)),
    ...m.closeWeapons.map((id) => weaponRow('close', id)),
  ];
  return [
    weapons.length > 0 ? table(['Weapon', 'Actions', 'Notes'], weapons) : null,
    m.equipment.length > 0 ? table(['Equipment', 'Notes'], m.equipment.map(equipmentRow)) : null,
    m.powers.length > 0 ? table(['Psychic power', 'Notes'], m.powers.map(powerRow)) : null,
  ].filter((t): t is HTMLTableElement => t !== null);
}
