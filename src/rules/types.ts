export type Source = 'core' | 'expansion';
export type Die = '2d6' | '2d8' | '2d10';
export type DefenceDie = '2d4' | Die;
export type FirepowerDie = 'none' | Die;
export type StatKey = 'def' | 'fp' | 'prw' | 'will';

export interface Item {
  id: string;
  name: string;
  cost: number;
  source: Source;
  page?: number;
  notes?: string;
}
export interface RangedWeapon extends Item {
  maxShoot: number;
}
export interface CloseWeapon extends Item {
  maxFight: number;
}
export interface Equipment extends Item {
  /** P = passive, A = needs a Use Item action */
  type: 'P' | 'A';
  /** A +1 added to this stat's dice, for display, for example Heavy Armor +1 Def */
  bonus?: StatKey;
}
export interface Power extends Item {
  type: 'Attack' | 'Effect' | 'Either';
}
export interface Trait {
  id: string;
  name: string;
  effect: string;
  source: Source;
  page?: number;
}
