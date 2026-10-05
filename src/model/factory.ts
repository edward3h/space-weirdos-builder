import { SCHEMA_VERSION, type ModelSpec, type Warband } from './types';

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function newModel(isLeader = false): ModelSpec {
  return {
    id: newId(),
    name: isLeader ? 'Leader' : 'Weirdo',
    isLeader,
    leaderTrait: null,
    powerful: false,
    speed: 2,
    defense: '2d6',
    firepower: 'none',
    prowess: '2d6',
    willpower: '2d6',
    rangedWeapons: [],
    closeWeapons: ['unarmed'],
    equipment: [],
    powers: [],
  };
}

export function newWarband(name = 'New warband'): Warband {
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name,
    target: 75,
    expansion: false,
    warbandTrait: null,
    models: [newModel(true)],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * True for a model that is still exactly as newModel() made it. The editor opens such
 * models in edit mode, since they are waiting to be filled in.
 */
export function isPristine(m: ModelSpec): boolean {
  const { id: _id, ...base } = newModel(m.isLeader);
  const { id: _other, ...mine } = m;
  return (Object.keys(base) as (keyof typeof base)[]).every(
    (k) => JSON.stringify(mine[k]) === JSON.stringify(base[k]),
  );
}
