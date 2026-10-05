import { adjustedCost, type Context } from '../rules/engine';
import type { Item } from '../rules/types';

export type ItemKind = 'ranged' | 'close' | 'equipment' | 'powers';

const COST_KIND = {
  ranged: 'ranged',
  close: 'close',
  equipment: 'equipment',
  powers: 'power',
} as const;

/** One line of facts about an item: cost, actions or type, and whether it is expansion content. */
export function itemFacts(kind: ItemKind, item: Item, ctx: Context): string {
  const x = item as Item & { maxShoot?: number; maxFight?: number; type?: string };
  const cost = adjustedCost(item, COST_KIND[kind], ctx);
  const facts = [`${cost} ${cost === 1 ? 'pt' : 'pts'}`];
  if (x.maxShoot !== undefined)
    facts.push(`max ${x.maxShoot} shoot action${x.maxShoot === 1 ? '' : 's'}`);
  if (x.maxFight !== undefined)
    facts.push(`max ${x.maxFight} fight action${x.maxFight === 1 ? '' : 's'}`);
  if (kind === 'equipment') facts.push(x.type === 'A' ? 'Use Item action' : 'passive');
  if (kind === 'powers') facts.push(`${x.type?.toLowerCase()} power`);
  if (item.source === 'expansion') facts.push('expansion');
  return facts.join(' · ');
}
