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

export interface DisplayStats {
  spd: string;
  def: string;
  fp: string;
  prw: string;
  will: string;
}

/** Stat line as printed on a card, with +1 equipment bonuses folded in (for example 2d8+1). */
export function displayStats(m: ModelSpec): DisplayStats {
  const bonus = (stat: StatKey) =>
    m.equipment.filter((id) => lookup('equipment', id)?.bonus === stat).length;
  const dice = (base: string, stat: StatKey) => {
    const n = bonus(stat);
    return n > 0 ? `${base}+${n}` : base;
  };
  return {
    spd: String(m.speed),
    def: dice(m.defense, 'def'),
    fp: m.firepower === 'none' ? 'n/a' : dice(m.firepower, 'fp'),
    prw: dice(m.prowess, 'prw'),
    will: dice(m.willpower, 'will'),
  };
}

export interface Limits {
  normal: number;
  top: number;
  powerful: number;
}

export function limits(ctx: Context): Limits {
  const bonus = ctx.expansion && ctx.warbandTrait === 'elites' ? 5 : 0;
  return { normal: 20 + bonus, top: 25 + bonus, powerful: 30 };
}

export interface Warning {
  /** 'warband' or a model id */
  scope: string;
  level: 'warning' | 'info';
  message: string;
}

export function validateWarband(wb: Warband): Warning[] {
  const ctx = contextOf(wb);
  const out: Warning[] = [];
  const warn = (scope: string, message: string, level: Warning['level'] = 'warning') =>
    out.push({ scope, level, message });
  const lim = limits(ctx);
  const label = (m: ModelSpec) => m.name || 'Unnamed model';

  const leaders = wb.models.filter((m) => m.isLeader);
  if (leaders.length === 0) warn('warband', 'Warband has no leader.');
  if (leaders.length > 1) warn('warband', 'Warband has more than one leader.');

  const total = warbandCost(wb);
  if (total > wb.target)
    warn('warband', `Warband is over its points target (${total} of ${wb.target}).`);

  const wbTrait = wb.warbandTrait ? lookup('warbandTraits', wb.warbandTrait) : undefined;
  if (wb.warbandTrait && !wbTrait)
    warn('warband', `Unknown warband trait '${wb.warbandTrait}' (kept).`);
  if (wbTrait?.source === 'expansion' && !ctx.expansion)
    warn('warband', `${wbTrait.name} is an expansion trait but the expansion is switched off.`);

  const powerfulModels = wb.models.filter((m) => m.powerful);
  if (powerfulModels.length > 1) warn('warband', 'Only one Powerful model is allowed per warband.');

  let aboveNormal = 0;
  for (const m of wb.models) {
    const cost = modelCost(m, ctx).total;

    if (m.powerful) {
      if (!ctx.expansion) warn(m.id, `${label(m)}: Powerful models are an expansion rule.`);
      if (m.isLeader) warn(m.id, `${label(m)}: a Powerful model cannot be a leader.`);
      if (cost > lim.powerful)
        warn(m.id, `${label(m)} costs ${cost}, limit ${lim.powerful} for a Powerful model.`);
    } else {
      // A model over the top limit is also over the normal limit, so these are independent
      if (cost > lim.top) warn(m.id, `${label(m)} costs ${cost}, limit ${lim.top}.`);
      if (cost > lim.normal) aboveNormal++;
    }

    // Leader trait
    if (m.leaderTrait) {
      const t = lookup('leaderTraits', m.leaderTrait);
      if (!m.isLeader) warn(m.id, `${label(m)} has a leader trait but is not the leader.`);
      if (!t) warn(m.id, `Unknown leader trait '${m.leaderTrait}' (kept).`);
      else if (t.source === 'expansion' && !ctx.expansion)
        warn(m.id, `${t.name} is an expansion trait but the expansion is switched off.`);
    }

    // Attributes that only exist in the expansion
    if (!ctx.expansion && m.defense === '2d4')
      warn(m.id, `${label(m)}: 2d4 Defence is an expansion rule.`);
    if (!ctx.expansion && m.firepower === '2d6')
      warn(m.id, `${label(m)}: 2d6 Firepower is an expansion rule.`);

    // Weapons
    if (m.firepower === 'none' && m.rangedWeapons.length > 0)
      warn(m.id, `${label(m)} has a ranged weapon but no Firepower.`);
    if (m.firepower !== 'none' && m.rangedWeapons.length === 0)
      warn(m.id, `${label(m)} has Firepower but no ranged weapon.`);
    if (m.closeWeapons.length === 0)
      warn(m.id, `${label(m)} needs a close combat weapon (Unarmed is free).`);

    // Allowances: surcharge with the expansion, warning without it
    const allowance = equipmentAllowance(m, ctx);
    const overs: [string, number, number][] = [
      ['ranged weapons', m.rangedWeapons.length, 1],
      ['close combat weapons', m.closeWeapons.length, 1],
      ['equipment', m.equipment.length, allowance],
    ];
    for (const [what, n, max] of overs) {
      if (n <= max) continue;
      if (ctx.expansion)
        warn(
          m.id,
          `${label(m)}: ${n - max} extra ${what} (+${n - max} points, Heavily Equipped).`,
          'info',
        );
      else warn(m.id, `${label(m)} has ${n} ${what}, max ${max}.`);
    }

    // Unknown ids and expansion items used while the expansion is off
    const groups: [Parameters<typeof lookup>[0], string[]][] = [
      ['ranged', m.rangedWeapons],
      ['close', m.closeWeapons],
      ['equipment', m.equipment],
      ['powers', m.powers],
    ];
    for (const [kind, ids] of groups) {
      for (const id of ids) {
        const item = lookup(kind, id);
        if (!item) warn(m.id, `${label(m)}: unknown item '${id}' (kept).`);
        else if (item.source === 'expansion' && !ctx.expansion)
          warn(
            m.id,
            `${label(m)}: ${item.name} is an expansion item but the expansion is switched off.`,
          );
      }
    }
  }

  if (aboveNormal > 1)
    warn('warband', `Only one model may cost more than ${lim.normal} points (${aboveNormal} do).`);

  return out;
}
