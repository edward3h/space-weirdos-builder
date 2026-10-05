import { describe, expect, it } from 'vitest';
import { newModel, newWarband } from '../model/factory';
import type { ModelSpec } from '../model/types';
import {
  displayCost,
  displayStats,
  limits,
  modelCost,
  validateWarband,
  warbandCost,
  type Context,
} from './engine';

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

describe('displayStats', () => {
  it('adds +1 for equipment bonuses and shows n/a for no Firepower', () => {
    const s = displayStats(m({ defense: '2d8', equipment: ['heavy-armor'], speed: 3 }));
    expect(s).toEqual({ spd: '3', def: '2d8+1', fp: 'n/a', prw: '2d6', will: '2d6' });
  });

  it('applies Targeting Reticule, Cybernetics and Psychic Focus', () => {
    const s = displayStats(
      m({ firepower: '2d8', equipment: ['targeting-reticule', 'cybernetics', 'psychic-focus'] }),
    );
    expect(s.fp).toBe('2d8+1');
    expect(s.prw).toBe('2d6+1');
    expect(s.will).toBe('2d6+1');
  });
});

const wbWith = (models: ModelSpec[], o: Partial<ReturnType<typeof newWarband>> = {}) => ({
  ...newWarband(),
  models,
  ...o,
});
const messages = (wb: ReturnType<typeof newWarband>) => validateWarband(wb).map((w) => w.message);
// A model costing exactly `target` points (minimum 15): a 15-point base
// (Speed 2 = 1, Def 2d10 = 8, no FP = 0, Prw 2d8 = 4, Will 2d6 = 2) plus one
// Prescience (1 point each) per extra point.
const base15 = () => m({ defense: '2d10', prowess: '2d8', willpower: '2d6', firepower: 'none' });
const withCost = (target: number): ModelSpec => {
  const base = base15();
  const need = target - modelCost(base, core).total;
  if (need < 0) throw new Error('withCost: minimum is 15');
  return { ...base, powers: Array(need).fill('prescience') };
};

describe('limits', () => {
  it('uses 20/25 normally and 25/30 with Elites', () => {
    expect(limits(core)).toEqual({ normal: 20, top: 25, powerful: 30 });
    expect(limits({ expansion: true, warbandTrait: 'elites' })).toEqual({
      normal: 25,
      top: 30,
      powerful: 30,
    });
    // Elites does nothing without the expansion
    expect(limits({ expansion: false, warbandTrait: 'elites' }).normal).toBe(20);
  });
});

describe('validateWarband', () => {
  it('has no warnings for a legal warband', () => {
    expect(messages(wbWith([m({ isLeader: true }), m()], { target: 75 }))).toEqual([]);
  });

  it('warns when over the points target', () => {
    const wb = wbWith([withCost(20), withCost(20), withCost(20), withCost(20)], { target: 75 });
    wb.models[0]!.isLeader = true;
    expect(messages(wb).some((x) => /over.*75/i.test(x))).toBe(true);
  });

  it('warns about a model over 25 and a second model over 20', () => {
    const wb = wbWith([withCost(26), withCost(22), m()], { target: 125 });
    wb.models[0]!.isLeader = true;
    const msgs = messages(wb);
    expect(msgs.some((x) => /costs 26.*limit 25/i.test(x))).toBe(true);
    expect(msgs.some((x) => /only one model may cost more than 20/i.test(x))).toBe(true);
  });

  it('allows one model up to 25 without warnings', () => {
    const wb = wbWith([withCost(25), withCost(20)], { target: 125 });
    wb.models[0]!.isLeader = true;
    expect(messages(wb)).toEqual([]);
  });

  it('warns about leader count', () => {
    expect(messages(wbWith([m()])).some((x) => /no leader/i.test(x))).toBe(true);
    expect(
      messages(wbWith([m({ isLeader: true }), m({ isLeader: true })])).some((x) =>
        /more than one leader/i.test(x),
      ),
    ).toBe(true);
  });

  it('warns about too much equipment (core) and gives an info note (expansion)', () => {
    const model = m({ equipment: ['grenade', 'jump-pack'] });
    const core1 = validateWarband(wbWith([m({ isLeader: true }), model]));
    expect(core1.find((w) => /2 equipment, max 1/i.test(w.message))?.level).toBe('warning');
    const exp1 = validateWarband(wbWith([m({ isLeader: true }), model], { expansion: true }));
    expect(exp1.find((w) => /extra/i.test(w.message))?.level).toBe('info');
  });

  it('gives leaders 2 equipment slots and Cyborgs one more', () => {
    const two = m({ isLeader: true, equipment: ['grenade', 'jump-pack'] });
    expect(messages(wbWith([two]))).toEqual([]);
    const cyb = m({ equipment: ['grenade', 'jump-pack'] });
    expect(messages(wbWith([m({ isLeader: true }), cyb], { warbandTrait: 'cyborgs' }))).toEqual([]);
  });

  it('warns when ranged weapon and Firepower do not match', () => {
    const a = m({ firepower: 'none', rangedWeapons: ['auto-rifle'] });
    const b = m({ firepower: '2d8', rangedWeapons: [] });
    const msgs = messages(wbWith([m({ isLeader: true }), a, b]));
    expect(msgs.some((x) => /ranged weapon but no firepower/i.test(x))).toBe(true);
    expect(msgs.some((x) => /firepower but no ranged weapon/i.test(x))).toBe(true);
  });

  it('warns about a missing close combat weapon', () => {
    expect(
      messages(wbWith([m({ isLeader: true, closeWeapons: [] })])).some((x) =>
        /close combat/i.test(x),
      ),
    ).toBe(true);
  });

  it('warns about leader traits on non-leaders', () => {
    expect(
      messages(wbWith([m({ isLeader: true }), m({ leaderTrait: 'tactician' })])).some((x) =>
        /leader trait/i.test(x),
      ),
    ).toBe(true);
  });

  it('flags expansion content used while the expansion is off, but not when on', () => {
    const model = m({ rangedWeapons: ['smg'], firepower: '2d8' });
    expect(messages(wbWith([m({ isLeader: true }), model])).some((x) => /expansion/i.test(x))).toBe(
      true,
    );
    expect(
      messages(wbWith([m({ isLeader: true }), model], { expansion: true })).some((x) =>
        /expansion/i.test(x),
      ),
    ).toBe(false);
  });

  it('flags unknown item ids but keeps them', () => {
    const msgs = messages(wbWith([m({ isLeader: true, powers: ['nope'] })]));
    expect(msgs.some((x) => /unknown item 'nope'/i.test(x))).toBe(true);
  });

  it('handles Elites (+5) and Powerful models (30, not a leader, only one)', () => {
    const elites = wbWith([withCost(30), withCost(25)], {
      expansion: true,
      warbandTrait: 'elites',
      target: 125,
    });
    elites.models[0]!.isLeader = true;
    expect(messages(elites)).toEqual([]);

    const big = { ...withCost(30), powerful: true };
    const ok = wbWith([m({ isLeader: true }), big], { expansion: true, target: 125 });
    expect(messages(ok)).toEqual([]);
    const bad = wbWith([{ ...big, isLeader: true }, { ...big }], { expansion: true, target: 125 });
    const msgs = messages(bad);
    expect(msgs.some((x) => /powerful model cannot be a leader/i.test(x))).toBe(true);
    expect(msgs.some((x) => /only one powerful model/i.test(x))).toBe(true);
    const off = wbWith([m({ isLeader: true }), big], { expansion: false, target: 125 });
    expect(messages(off).some((x) => /powerful/i.test(x))).toBe(true);
  });
});
