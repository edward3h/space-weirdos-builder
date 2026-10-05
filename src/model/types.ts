import type { DefenceDie, Die, FirepowerDie } from '../rules/types';

export interface ModelSpec {
  id: string;
  name: string;
  isLeader: boolean;
  leaderTrait: string | null;
  /** Expansion "Powerful model": may cost up to 30 points, cannot be a leader */
  powerful: boolean;
  speed: 1 | 2 | 3;
  defense: DefenceDie;
  firepower: FirepowerDie;
  prowess: Die;
  willpower: Die;
  rangedWeapons: string[];
  closeWeapons: string[];
  equipment: string[];
  powers: string[];
}

export const SCHEMA_VERSION = 1;

export interface Warband {
  id: string;
  schemaVersion: number;
  name: string;
  /** Points target, for example 75 or 125 */
  target: number;
  /** Whether the fan expansion content is enabled */
  expansion: boolean;
  warbandTrait: string | null;
  models: ModelSpec[];
  updatedAt: string;
}
