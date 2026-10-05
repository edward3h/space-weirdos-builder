import type { CloseWeapon, Equipment, Power, RangedWeapon, Trait } from '../types';

const x = <T extends object>(page: number, items: T[]) =>
  items.map((i) => ({ ...i, source: 'expansion' as const, page }));

export const EXP_RANGED: RangedWeapon[] = x(7, [
  {
    id: 'web-pistol',
    name: 'Web Pistol',
    cost: 1,
    maxShoot: 2,
    notes:
      '-1DT range > 1 stick. Any target hit becomes Staggered. Cannot take models Out of Action. If OoA is rolled on the Under Fire table, subsequent Recover rolls are -2DT.',
  },
  {
    id: 'web-rifle',
    name: 'Web Rifle',
    cost: 2,
    maxShoot: 2,
    notes:
      'Aim 1. Any target hit becomes Staggered. Cannot take models Out of Action. If OoA is rolled on the Under Fire table, subsequent Recover rolls are -2DT.',
  },
  {
    id: 'plasma-pistol',
    name: 'Plasma Pistol',
    cost: 2,
    maxShoot: 2,
    notes:
      '-1DT range > 1 stick. Optional +1DT to FP. If used, any roll of doubles causes the attacker to take a 2d10 FP hit.',
  },
  {
    id: 'smg',
    name: 'Submachine Gun (SMG)',
    cost: 2,
    maxShoot: 3,
    notes: '-1DT range > 2 sticks, < 2 sticks +1 to Under Fire rolls',
  },
  {
    id: 'plasma-rifle',
    name: 'Plasma Rifle',
    cost: 3,
    maxShoot: 2,
    notes:
      'Aim 1, optional +1DT to FP. If used, any roll of doubles causes the attacker to take a 2d12 FP hit.',
  },
  {
    id: 'disintegrator',
    name: 'Disintegrator',
    cost: 3,
    maxShoot: 1,
    notes: 'Aim 2, -1DT range < 1 stick, reroll FP rolls of 1, +1 to Under Fire rolls',
  },
  {
    id: 'laser-cannon',
    name: 'Laser Cannon',
    cost: 3,
    maxShoot: 1,
    notes: '+2 to Under Fire rolls, reroll FP rolls of 1',
  },
]);

export const EXP_CLOSE: CloseWeapon[] = x(7, [
  {
    id: 'psychic-weapon',
    name: 'Psychic Weapon',
    cost: 3,
    maxFight: 2,
    notes: 'When attacking with this weapon, use Will instead of Prw',
  },
]);

export const EXP_EQUIPMENT: Equipment[] = x(8, [
  {
    id: 'adrenaline-stim',
    name: 'Adrenaline Stim',
    cost: 1,
    type: 'P',
    notes: 'If this model ends a Move action within half a stick of an enemy, it may move BtB',
  },
  {
    id: 'comms-unit',
    name: 'Comms Unit',
    cost: 1,
    type: 'A',
    notes:
      '1 model in a Warband may have a Comms Unit. Any model in its Warband may immediately take a Move, Fight, or Shoot action',
  },
  {
    id: 'disguise',
    name: 'Disguise',
    cost: 1,
    type: 'P',
    notes:
      'Until this model takes a Shoot, Fight, Psychic Power, or Use Item action or an enemy moves within half a stick, enemies may not use those actions to affect it',
  },
  {
    id: 'extra-limbs',
    name: 'Extra Limbs',
    cost: 1,
    type: 'P',
    notes: 'Increase Max Fight Actions for close combat weapons by 1, up to 3',
  },
  {
    id: 'auto-grappling-hook',
    name: 'Auto Grappling Hook',
    cost: 1,
    type: 'P',
    notes: 'If ending a Move touching terrain, may move to the top of the terrain for free',
  },
  {
    id: 'laser-sword',
    name: 'Laser Sword',
    cost: 1,
    type: 'P',
    notes:
      'Needs a Powered or Large Powered Weapon. May use Return Fire and Snap Shot results using Prw instead of FP',
  },
  {
    id: 'loader',
    name: 'Loader',
    cost: 1,
    type: 'P',
    notes:
      'A friendly model with Max Shoot Actions of 1 may take a second Shoot action within half a stick of this model',
  },
  {
    id: 'mount',
    name: 'Mount',
    cost: 0,
    type: 'P',
    notes: '+1 to Prw rolls vs. models that aren’t mounted. Cannot climb terrain',
  },
  {
    id: 'psionic-dampener',
    name: 'Psionic Dampener',
    cost: 2,
    type: 'P',
    notes:
      'No Psychic Power actions can be made or have an effect within half a stick of this model',
  },
  {
    id: 'smoke-grenade',
    name: 'Smoke Grenade',
    cost: 1,
    type: 'A',
    notes:
      'Target a point up to 1 stick from attacker, Blast AoE, blocks line of sight until this model’s next activation',
  },
  {
    id: 'space-monk-master-robes',
    name: 'Space Monk Master Robes',
    cost: 2,
    type: 'P',
    notes: 'Model must also have a Laser Sword. -1 on Under Fire rolls',
  },
]);

export const EXP_POWERS: Power[] = x(9, [
  {
    id: 'blur',
    name: 'Blur',
    cost: 1,
    type: 'Effect',
    notes:
      'Target 1 friendly model within LoS. Until the psychic activates again, enemies have no LoS on it unless within 1 stick',
  },
  {
    id: 'fearful-visage',
    name: 'Fearful Visage',
    cost: 1,
    type: 'Effect',
    notes:
      'Target 1 friendly model within LoS. Until the psychic activates again, enemies must win a Will roll vs. it to move BtB',
  },
  {
    id: 'force-lightning',
    name: 'Force Lightning',
    cost: 2,
    type: 'Attack',
    notes:
      'Affects all models in Line AoE. Models > 1 stick away gain +1DT to their Will roll. Roll on Under Fire table for each, treating results < 5 as 5',
  },
  {
    id: 'psychic-aura',
    name: 'Psychic Aura',
    cost: 1,
    type: 'Effect',
    notes: 'Until end of round, friendly models within 1 stick may reroll 1’s',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    cost: 2,
    type: 'Attack',
    notes: 'Target 1 enemy under 20 pts within 1 stick. It is Staggered and Down',
  },
  {
    id: 'slow-mo',
    name: 'Slow Mo',
    cost: 1,
    type: 'Attack',
    notes:
      'Target 1 enemy within LoS. Until the psychic’s next activation its Speed is reduced by 1 (2 if the roll was > double the target’s), min 1',
  },
  {
    id: 'smoke-cloud',
    name: 'Smoke Cloud',
    cost: 1,
    type: 'Effect',
    notes:
      'Target a point within LoS. Blast AoE, blocks line of sight until this model’s next activation',
  },
]);

const t = (items: Omit<Trait, 'source' | 'page'>[]): Trait[] =>
  items.map((i) => ({ ...i, source: 'expansion' as const, page: 10 }));

export const EXP_WARBAND_TRAITS: Trait[] = t([
  {
    id: 'blue-collar',
    name: 'Blue Collar',
    effect: 'Models in this Warband may take a Use Item action for 1 action instead of 2.',
  },
  {
    id: 'chaos-worshippers',
    name: 'Chaos Worshippers',
    effect: 'Once per round, force your opponent to re-roll a single maximum die result.',
  },
  { id: 'elites', name: 'Elites', effect: 'Each model may cost 5 more points than normal.' },
  {
    id: 'gunfighters',
    name: 'Gunfighters',
    effect:
      'The Max Shoot Actions of Heavy Pistols and Heavy Rifles are raised to 3 for models in this Warband.',
  },
  {
    id: 'imperial-numbers',
    name: 'Imperial Numbers',
    effect: 'Add 1 Trooper (Space Weirdos pg. 12) to your Warband.',
  },
  {
    id: 'plucky-rebels',
    name: 'Plucky Rebels',
    effect: 'Each round, this Warband can re-roll a single die result of 1.',
  },
  {
    id: 'undead-updated',
    name: 'Undead (Updated)',
    effect: 'Recover actions are automatically successful.',
  },
  {
    id: 'violent',
    name: 'Violent',
    effect: 'Once per round, this Warband can activate twice in a row for one Command Point.',
  },
  {
    id: 'warriors-born',
    name: 'Warriors Born',
    effect:
      'When attacked by a Fight action, members of this Warband may use their Prw instead of Def value when rolling to defend.',
  },
]);

export const EXP_LEADER_TRAITS: Trait[] = t([
  {
    id: 'hero-villain',
    name: 'Hero/Villain',
    effect:
      'Double the point value of this model. It can activate twice in a round, but not twice in a row. Remove movement tokens when you activate the 2nd time.',
  },
  {
    id: 'mage-killer',
    name: 'Mage Killer',
    effect: '+1DT to Attack rolls vs. models that can cast spells. +1DT to Will rolls vs. spells.',
  },
  {
    id: 'mastermind',
    name: 'Mastermind',
    effect:
      'Any Shoot or Fight action targeting this Leader instead targets any other model in the Leader’s Warband within 1/2 stick that costs fewer points than the Leader.',
  },
  {
    id: 'psionic-abomination',
    name: 'Psionic Abomination',
    effect: 'All enemy models get -1DT to Will rolls when in LoS of this model.',
  },
]);
