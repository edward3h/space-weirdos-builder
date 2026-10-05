import { describe, expect, it } from 'vitest';
import { isPristine, newModel } from './factory';

describe('isPristine', () => {
  it('is true for a model straight from newModel, leader or not', () => {
    expect(isPristine(newModel(true))).toBe(true);
    expect(isPristine(newModel(false))).toBe(true);
  });

  it('is false once anything has been changed', () => {
    const changes = [
      (m: ReturnType<typeof newModel>) => (m.name = 'Boss'),
      (m: ReturnType<typeof newModel>) => (m.speed = 3),
      (m: ReturnType<typeof newModel>) => (m.defense = '2d8'),
      (m: ReturnType<typeof newModel>) => (m.rangedWeapons = ['auto-pistol']),
      (m: ReturnType<typeof newModel>) => (m.closeWeapons = []),
      (m: ReturnType<typeof newModel>) => m.equipment.push('grenade'),
      (m: ReturnType<typeof newModel>) => m.powers.push('fear'),
      (m: ReturnType<typeof newModel>) => (m.leaderTrait = 'tactician'),
      (m: ReturnType<typeof newModel>) => (m.powerful = true),
    ];
    for (const change of changes) {
      const m = newModel(true);
      change(m);
      expect(isPristine(m)).toBe(false);
    }
  });

  it('ignores the id', () => {
    expect(isPristine({ ...newModel(false), id: 'something-else' })).toBe(true);
  });

  it('is false for a weirdo that was switched to leader (the default leader has another name)', () => {
    expect(isPristine({ ...newModel(false), isLeader: true })).toBe(false);
  });
});
