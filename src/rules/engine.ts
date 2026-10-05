import type { ModelSpec, Warband } from '../model/types';
import { lookup } from './catalog';
import type { DefenceDie, Die, FirepowerDie, Item, StatKey } from './types';

export interface Context {
  expansion: boolean;
  warbandTrait: string | null;
}
export interface CostLine {
  label: string;
  cost: number;
}
export interface ModelCost {
  total: number;
  lines: CostLine[];
}

export const contextOf = (wb: Warband): Context => ({
  expansion: wb.expansion,
  warbandTrait: wb.warbandTrait,
});

const ATTR_COST = {
  speed: { 1: 0, 2: 1, 3: 3 },
  defense: { '2d4': -1, '2d6': 2, '2d8': 4, '2d10': 8 } as Record<DefenceDie, number>,
  firepower: { none: 0, '2d6': 1, '2d8': 2, '2d10': 4 } as Record<FirepowerDie, number>,
  prowess: { '2d6': 2, '2d8': 4, '2d10': 6 } as Record<Die, number>,
  willpower: { '2d6': 2, '2d8': 4, '2d10': 6 } as Record<Die, number>,
};

type WeaponKind = 'ranged' | 'close' | 'equipment' | 'power';

/** Item cost after warband trait adjustments. */
export function adjustedCost(item: Item, kind: WeaponKind, ctx: Context): number {
  let cost = item.cost;
  switch (ctx.warbandTrait) {
    case 'heavily-armed':
      if (kind === 'ranged') cost -= 1;
      break;
    case 'mutants':
      if (['claws-teeth', 'horrible-claws-teeth', 'whip-tail'].includes(item.id)) cost -= 1;
      break;
    case 'soldiers':
      if (['grenade', 'heavy-armor', 'medkit'].includes(item.id)) cost = 0;
      break;
  }
  return Math.max(0, cost);
}

export const equipmentAllowance = (m: ModelSpec, ctx: Context): number =>
  (m.isLeader ? 2 : 1) + (ctx.warbandTrait === 'cyborgs' ? 1 : 0);

/** Number of items above the normal allowance across weapons and equipment. */
export function extraItems(m: ModelSpec, ctx: Context): number {
  return (
    Math.max(0, m.rangedWeapons.length - 1) +
    Math.max(0, m.closeWeapons.length - 1) +
    Math.max(0, m.equipment.length - equipmentAllowance(m, ctx))
  );
}

export function modelCost(m: ModelSpec, ctx: Context): ModelCost {
  const lines: CostLine[] = [];
  const add = (label: string, cost: number) => lines.push({ label, cost });

  const speed = ATTR_COST.speed[m.speed];
  add(`Speed ${m.speed}`, ctx.warbandTrait === 'mutants' ? Math.max(0, speed - 1) : speed);
  add(`Defence ${m.defense}`, ATTR_COST.defense[m.defense]);
  add(`Firepower ${m.firepower}`, ATTR_COST.firepower[m.firepower]);
  add(`Prowess ${m.prowess}`, ATTR_COST.prowess[m.prowess]);
  add(`Willpower ${m.willpower}`, ATTR_COST.willpower[m.willpower]);

  const addItems = (kind: WeaponKind, ids: string[]) => {
    const catalogKind = {
      ranged: 'ranged',
      close: 'close',
      equipment: 'equipment',
      power: 'powers',
    }[kind] as 'ranged' | 'close' | 'equipment' | 'powers';
    for (const id of ids) {
      const item = lookup(catalogKind, id);
      if (item) add(item.name, adjustedCost(item, kind, ctx));
      else add(`Unknown item (${id})`, 0);
    }
  };
  addItems('ranged', m.rangedWeapons);
  addItems('close', m.closeWeapons);
  addItems('equipment', m.equipment);
  addItems('power', m.powers);

  if (ctx.expansion) {
    const extra = extraItems(m, ctx);
    if (extra > 0) add('Extra items (Heavily Equipped)', extra);
  }

  return { total: lines.reduce((s, l) => s + l.cost, 0), lines };
}

/**
 * The cost that counts towards the warband total: a Hero/Villain leader counts double
 * (expansion). Model limits are checked on the undoubled `modelCost`, because the rules
 * do not say the doubled value must fit under the 25-point cap; this is an interpretation.
 */
export function displayCost(m: ModelSpec, ctx: Context): number {
  const cost = modelCost(m, ctx).total;
  return ctx.expansion && m.isLeader && m.leaderTrait === 'hero-villain' ? cost * 2 : cost;
}

export function warbandCost(wb: Warband): number {
  const ctx = contextOf(wb);
  return wb.models.reduce((sum, m) => sum + displayCost(m, ctx), 0);
}

export type { StatKey };
