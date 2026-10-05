import { newId } from '../model/factory';
import { SCHEMA_VERSION, type ModelSpec, type Warband } from '../model/types';

const DICE = ['2d6', '2d8', '2d10'];

class Invalid extends Error {}
const fail = (path: string, what: string): never => {
  throw new Invalid(`${path}: ${what}`);
};

const str = (o: Record<string, unknown>, k: string, path: string): string =>
  typeof o[k] === 'string' ? (o[k] as string) : fail(`${path}${k}`, 'expected a string');
const bool = (o: Record<string, unknown>, k: string, path: string): boolean =>
  typeof o[k] === 'boolean' ? (o[k] as boolean) : fail(`${path}${k}`, 'expected true or false');
const strOrNull = (o: Record<string, unknown>, k: string, path: string): string | null =>
  o[k] === null || o[k] === undefined ? null : str(o, k, path);
const strList = (o: Record<string, unknown>, k: string, path: string): string[] => {
  const v = o[k];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
    fail(`${path}${k}`, 'expected a list of strings');
  return v as string[];
};
const oneOf = <T extends string>(
  o: Record<string, unknown>,
  k: string,
  path: string,
  allowed: string[],
) =>
  allowed.includes(o[k] as string)
    ? (o[k] as T)
    : fail(`${path}${k}`, `expected one of ${allowed.join(', ')}`);

function parseModel(raw: unknown, i: number): ModelSpec {
  const path = `models[${i}].`;
  if (typeof raw !== 'object' || raw === null) return fail(`models[${i}]`, 'expected an object');
  const o = raw as Record<string, unknown>;
  const speed = o.speed;
  if (speed !== 1 && speed !== 2 && speed !== 3) fail(`${path}speed`, 'expected 1, 2 or 3');
  return {
    id: str(o, 'id', path),
    name: str(o, 'name', path),
    isLeader: bool(o, 'isLeader', path),
    leaderTrait: strOrNull(o, 'leaderTrait', path),
    powerful: o.powerful === undefined ? false : bool(o, 'powerful', path),
    speed: speed as 1 | 2 | 3,
    defense: oneOf(o, 'defense', path, ['2d4', ...DICE]),
    firepower: oneOf(o, 'firepower', path, ['none', ...DICE]),
    prowess: oneOf(o, 'prowess', path, DICE),
    willpower: oneOf(o, 'willpower', path, DICE),
    rangedWeapons: strList(o, 'rangedWeapons', path),
    closeWeapons: strList(o, 'closeWeapons', path),
    equipment: strList(o, 'equipment', path),
    powers: strList(o, 'powers', path),
  };
}

/** Bring older saved data up to the current schema. Add a case here when SCHEMA_VERSION changes. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = raw.schemaVersion;
  if (v === SCHEMA_VERSION) return raw;
  throw new Invalid(
    `schemaVersion: unsupported version ${String(v)} (this app understands ${SCHEMA_VERSION})`,
  );
}

/** Model ids key the editor's warnings, so give an empty or repeated id a fresh one. */
function uniqueIds(models: ModelSpec[]): ModelSpec[] {
  const seen = new Set<string>();
  for (const m of models) {
    if (m.id === '' || seen.has(m.id)) m.id = newId();
    seen.add(m.id);
  }
  return models;
}

export function parseWarband(raw: unknown): Warband {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Invalid('warband: expected an object');
  const rawObj = raw as Record<string, unknown>;
  str(rawObj, 'id', ''); // check id first, so a bare {} reports the missing id
  const o = migrate(rawObj);
  const target = o.target;
  if (typeof target !== 'number' || !Number.isFinite(target)) fail('target', 'expected a number');
  if (!Array.isArray(o.models)) fail('models', 'expected a list');
  return {
    id: str(o, 'id', ''),
    schemaVersion: SCHEMA_VERSION,
    name: str(o, 'name', ''),
    target: target as number,
    expansion: bool(o, 'expansion', ''),
    warbandTrait: strOrNull(o, 'warbandTrait', ''),
    models: uniqueIds((o.models as unknown[]).map(parseModel)),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  };
}
