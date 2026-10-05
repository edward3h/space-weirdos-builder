import { describe, expect, it } from 'vitest';
import { newModel, newWarband } from '../model/factory';
import type { ModelSpec } from '../model/types';
import { displayCost, modelCost, warbandCost, type Context } from './engine';

const core: Context = { expansion: false, warbandTrait: null };
const m = (o: Partial<ModelSpec> = {}): ModelSpec => ({ ...newModel(), ...o });

describe('modelCost', () => {
  it('prices a minimal model from the attribute tables', () => {
    // Speed 2 = 1, Def 2d6 = 2, no FP = 0, Prw 2d6 = 2, Will 2d6 = 2, Unarmed = 0
    expect(modelCost(m(), core).total).toBe(7);
  });

  it('prices each attribute level', () => {
    const big = m({
      speed: 3,
      defense: '2d10',
      firepower: '2d10',
      prowess: '2d10',
      willpower: '2d10',
    });
    // 3 + 8 + 4 + 6 + 6
    expect(modelCost(big, core).total).toBe(27);
  });

  it('adds weapons, equipment and powers', () => {
    const model = m({
      firepower: '2d8',
      rangedWeapons: ['auto-rifle'],
      closeWeapons: ['melee-weapon'],
      equipment: ['grenade'],
      powers: ['fear', 'mind-stab'],
    });
    // base 1+2+2+2+2 = 9; +1 +1 +1 +1 +3
    expect(modelCost(model, core).total).toBe(16);
  });

  it('returns itemised lines that sum to the total', () => {
    const r = modelCost(m({ equipment: ['heavy-armor'] }), core);
    expect(r.lines.reduce((s, l) => s + l.cost, 0)).toBe(r.total);
  });

  it('costs unknown ids at 0 so saved data is never lost', () => {
    expect(modelCost(m({ equipment: ['not-a-thing'] }), core).total).toBe(7);
  });
});

describe('warband trait cost effects', () => {
  it('Heavily Armed makes ranged weapons 1 cheaper (minimum 0)', () => {
    const model = m({ firepower: '2d8', rangedWeapons: ['heavy-rifle', 'auto-pistol'] });
    const base = modelCost(model, core).total;
    expect(modelCost(model, { expansion: false, warbandTrait: 'heavily-armed' }).total).toBe(
      base - 1,
    );
  });

  it('Mutants make Speed and claws, horrible claws and whip/tail 1 cheaper', () => {
    const ctx: Context = { expansion: false, warbandTrait: 'mutants' };
    expect(modelCost(m({ speed: 3 }), ctx).total).toBe(modelCost(m({ speed: 3 }), core).total - 1);
    expect(modelCost(m({ speed: 1 }), ctx).total).toBe(modelCost(m({ speed: 1 }), core).total);
    // Speed 1 costs 0, so only the weapon discount shows (Mutants also discount Speed 2)
    for (const id of ['claws-teeth', 'horrible-claws-teeth', 'whip-tail']) {
      const model = m({ speed: 1, closeWeapons: [id] });
      expect(modelCost(model, ctx).total).toBe(modelCost(model, core).total - 1);
    }
  });

  it('Soldiers get grenades, heavy armour and medkits free', () => {
    const model = m({ equipment: ['grenade'] });
    expect(modelCost(model, { expansion: false, warbandTrait: 'soldiers' }).total).toBe(7);
    const other = m({ equipment: ['jump-pack'] });
    expect(modelCost(other, { expansion: false, warbandTrait: 'soldiers' }).total).toBe(8);
  });
});

describe('expansion cost effects', () => {
  const exp: Context = { expansion: true, warbandTrait: null };

  it('2d4 Defence costs -1 and 2d6 Firepower costs 1', () => {
    expect(modelCost(m({ defense: '2d4' }), exp).total).toBe(4); // 1 + -1 + 0 + 2 + 2
    expect(modelCost(m({ firepower: '2d6' }), exp).total).toBe(8);
  });

  it('charges +1 per item above the allowance when the expansion is on (Heavily Equipped)', () => {
    const model = m({ equipment: ['grenade', 'jump-pack'] }); // allowance 1
    expect(modelCost(model, exp).total).toBe(7 + 1 + 1 + 1);
    // Without the expansion there is no surcharge (a warning is raised instead, see Task 5)
    expect(modelCost(model, core).total).toBe(7 + 1 + 1);
  });
});

describe('warbandCost', () => {
  it('sums the models', () => {
    const wb = newWarband();
    wb.models = [m({ isLeader: true }), m()];
    expect(warbandCost(wb)).toBe(14);
  });

  it('doubles a Hero/Villain leader when the expansion is on', () => {
    const wb = newWarband();
    wb.expansion = true;
    wb.models = [m({ isLeader: true, leaderTrait: 'hero-villain' }), m()];
    expect(warbandCost(wb)).toBe(7 * 2 + 7);
    wb.expansion = false;
    expect(warbandCost(wb)).toBe(14);
  });

  it('displayCost is the cost that counts towards the total (doubled for Hero/Villain)', () => {
    const leader = m({ isLeader: true, leaderTrait: 'hero-villain' });
    expect(displayCost(leader, { expansion: true, warbandTrait: null })).toBe(14);
    expect(displayCost(leader, core)).toBe(7);
    expect(modelCost(leader, { expansion: true, warbandTrait: null }).total).toBe(7);
  });
});
