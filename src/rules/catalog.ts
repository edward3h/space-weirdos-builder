import type { CloseWeapon, Equipment, Power, RangedWeapon, Source, Trait } from './types';
import {
  CORE_CLOSE,
  CORE_EQUIPMENT,
  CORE_LEADER_TRAITS,
  CORE_POWERS,
  CORE_RANGED,
  CORE_WARBAND_TRAITS,
} from './data/core';
import {
  EXP_CLOSE,
  EXP_EQUIPMENT,
  EXP_LEADER_TRAITS,
  EXP_POWERS,
  EXP_RANGED,
  EXP_WARBAND_TRAITS,
} from './data/expansion';

export const catalog = {
  ranged: [...CORE_RANGED, ...EXP_RANGED] as RangedWeapon[],
  close: [...CORE_CLOSE, ...EXP_CLOSE] as CloseWeapon[],
  equipment: [...CORE_EQUIPMENT, ...EXP_EQUIPMENT] as Equipment[],
  powers: [...CORE_POWERS, ...EXP_POWERS] as Power[],
  leaderTraits: [...CORE_LEADER_TRAITS, ...EXP_LEADER_TRAITS] as Trait[],
  warbandTraits: [...CORE_WARBAND_TRAITS, ...EXP_WARBAND_TRAITS] as Trait[],
};

export type CatalogKind = keyof typeof catalog;

export function lookup<K extends CatalogKind>(
  kind: K,
  id: string,
): (typeof catalog)[K][number] | undefined {
  return (catalog[kind] as { id: string }[]).find((i) => i.id === id) as
    (typeof catalog)[K][number] | undefined;
}

/** Items the player may pick: core always, expansion only when it is switched on. */
export function available<T extends { source: Source }>(items: T[], expansion: boolean): T[] {
  return items.filter((i) => expansion || i.source === 'core');
}
