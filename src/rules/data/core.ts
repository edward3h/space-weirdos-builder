import type { CloseWeapon, Equipment, Power, RangedWeapon, Trait } from '../types';

const c = <T extends object>(page: number, items: T[]) =>
  items.map((i) => ({ ...i, source: 'core' as const, page }));

export const CORE_RANGED: RangedWeapon[] = c(8, [
  { id: 'auto-pistol', name: 'Auto Pistol', cost: 0, maxShoot: 3, notes: '-1DT range > 1 stick' },
  {
    id: 'heavy-pistol',
    name: 'Heavy Pistol',
    cost: 1,
    maxShoot: 2,
    notes: '+1 to Under Fire rolls, -1DT past 1 stick',
  },
  {
    id: 'energy-pistol',
    name: 'Energy Pistol',
    cost: 2,
    maxShoot: 3,
    notes: 'Reroll FP rolls of 1, -1DT range > 1 stick',
  },
  { id: 'auto-rifle', name: 'Auto Rifle', cost: 1, maxShoot: 3, notes: 'Aim1' },
  {
    id: 'heavy-rifle',
    name: 'Heavy Rifle',
    cost: 2,
    maxShoot: 2,
    notes: 'Aim1, +1 to Under Fire rolls',
  },
  {
    id: 'sniper-rifle',
    name: 'Sniper Rifle',
    cost: 3,
    maxShoot: 1,
    notes:
      'Aim2, cannot target enemies < 1 stick away, reroll FP rolls of 1, +1 to Under Fire rolls',
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    cost: 2,
    maxShoot: 2,
    notes: 'Range ≤ 1 stick: +1 to Under Fire rolls. Range > 1 stick: -1DT, reroll FP rolls of 1',
  },
  {
    id: 'energy-rifle',
    name: 'Energy Rifle',
    cost: 2,
    maxShoot: 2,
    notes: 'Aim1, reroll FP rolls of 1',
  },
  { id: 'flamer', name: 'Flamer', cost: 2, maxShoot: 1, notes: 'Cone AoE' },
  {
    id: 'rocket-launcher',
    name: 'Rocket Launcher',
    cost: 3,
    maxShoot: 1,
    notes: 'Aim2, cannot target enemies < 1 stick away, Blast AoE',
  },
  {
    id: 'autocannon',
    name: 'Autocannon',
    cost: 3,
    maxShoot: 3,
    notes: 'Reroll FP rolls of 1 or 2',
  },
]);

export const CORE_CLOSE: CloseWeapon[] = c(8, [
  { id: 'unarmed', name: 'Unarmed', cost: 0, maxFight: 3, notes: '-1DT to Prw rolls' },
  { id: 'claws-teeth', name: 'Claws & Teeth', cost: 2, maxFight: 3 },
  {
    id: 'horrible-claws-teeth',
    name: 'Horrible Claws & Teeth',
    cost: 3,
    maxFight: 3,
    notes: '+1 to Under Attack rolls',
  },
  { id: 'melee-weapon', name: 'Melee Weapon', cost: 1, maxFight: 2 },
  {
    id: 'powered-weapon',
    name: 'Powered Weapon',
    cost: 2,
    maxFight: 2,
    notes: 'Reroll Prw rolls of 1',
  },
  {
    id: 'large-melee-weapon',
    name: 'Large Melee Weapon',
    cost: 1,
    maxFight: 1,
    notes: '+1 to Under Attack rolls',
  },
  {
    id: 'large-powered-weapon',
    name: 'Large Powered Weapon',
    cost: 3,
    maxFight: 1,
    notes: 'Reroll Prw rolls of 1, +1 to Under Attack rolls',
  },
  {
    id: 'whip-tail',
    name: 'Whip/Tail',
    cost: 2,
    maxFight: 2,
    notes: 'Can target enemies up to 1 stick away',
  },
]);

export const CORE_EQUIPMENT: Equipment[] = c(9, [
  {
    id: 'cybernetics',
    name: 'Cybernetics',
    cost: 1,
    type: 'P',
    bonus: 'prw',
    notes: '+1 to Prw rolls',
  },
  {
    id: 'grenade',
    name: 'Grenade',
    cost: 1,
    type: 'A',
    notes:
      'May only be used once per game. Targets point up to 1 stick from attacker, Blast AoE, 2d10 FP, +1 to Under Fire rolls',
  },
  {
    id: 'heavy-armor',
    name: 'Heavy Armor',
    cost: 1,
    type: 'P',
    bonus: 'def',
    notes: '+1 to Def rolls',
  },
  {
    id: 'jump-pack',
    name: 'Jump Pack',
    cost: 1,
    type: 'P',
    notes: 'Can ignore terrain and other models when taking Move actions',
  },
  {
    id: 'medkit',
    name: 'Medkit',
    cost: 1,
    type: 'A',
    notes: 'May only be used once per game. 1 model touching this model becomes ready',
  },
  {
    id: 'psychic-focus',
    name: 'Psychic Focus',
    cost: 1,
    type: 'P',
    bonus: 'will',
    notes: '+1 to Will rolls',
  },
  {
    id: 'stealth-suit',
    name: 'Stealth Suit',
    cost: 2,
    type: 'P',
    notes: 'If this model’s base touches terrain, enemies have no LoS unless within 1 stick',
  },
  {
    id: 'targeting-reticule',
    name: 'Targeting Reticule',
    cost: 1,
    type: 'P',
    bonus: 'fp',
    notes: '+1 to FP rolls',
  },
]);

export const CORE_POWERS: Power[] = c(9, [
  {
    id: 'fear',
    name: 'Fear',
    cost: 1,
    type: 'Attack',
    notes: 'Each enemy within 1 stick who loses its opposed Will roll must move 1 stick away',
  },
  {
    id: 'healing',
    name: 'Healing',
    cost: 1,
    type: 'Effect',
    notes: '1 model within 1 stick and in LoS becomes ready',
  },
  {
    id: 'meat-puppet',
    name: 'Meat Puppet',
    cost: 2,
    type: 'Effect',
    notes:
      'Return 1 OoA model within 1 stick of the psychic. Its Spd is reduced by 1 (min 1) and it rolls with -1DT. Once per model',
  },
  {
    id: 'mind-control',
    name: 'Mind Control',
    cost: 2,
    type: 'Attack',
    notes: 'Targeted enemy takes one action of the psychic’s choice',
  },
  {
    id: 'mind-stab',
    name: 'Mind Stab',
    cost: 3,
    type: 'Attack',
    notes: 'Target 1 enemy within 1 stick. Roll on Under Fire table +3',
  },
  {
    id: 'prescience',
    name: 'Prescience',
    cost: 1,
    type: 'Effect',
    notes: 'Any model gains +1DT or -1DT for all its actions this round',
  },
  {
    id: 'telekinesis',
    name: 'Telekinesis',
    cost: 1,
    type: 'Either',
    notes: 'Effect: move 1 obstacle or ally up to 1 stick. Attack: move an enemy 1 stick',
  },
  {
    id: 'teleport',
    name: 'Teleport',
    cost: 1,
    type: 'Effect',
    notes: 'Place the psychic anywhere on the board',
  },
]);

const t = (items: Omit<Trait, 'source' | 'page'>[]): Trait[] =>
  items.map((i) => ({ ...i, source: 'core' as const, page: 10 }));

export const CORE_LEADER_TRAITS: Trait[] = t([
  {
    id: 'bounty-hunter',
    name: 'Bounty Hunter',
    effect:
      'Once per round, when a model from your warband is touching a down or staggered enemy, it can take a Use Item action to make the enemy model out of action.',
  },
  {
    id: 'healer',
    name: 'Healer',
    effect:
      'During the Initiative Phase, one of your models within one stick of your leader may make a free Stand or Recover action with +1DT.',
  },
  {
    id: 'majestic',
    name: 'Majestic',
    effect:
      'Any time one of your warband has to make a Willpower roll, that model may use the Leader’s Willpower instead.',
  },
  {
    id: 'monstrous',
    name: 'Monstrous',
    effect: 'Non-Leader models must win a Willpower roll vs. your leader to move into contact.',
  },
  {
    id: 'political-officer',
    name: 'Political Officer',
    effect:
      'During the Initiative Phase, before rolling, take one of your warband within LOS of your leader out of action to make all other models in the warband ready, remove the broken condition from your warband, and gain +1DT to this Initiative roll.',
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    effect: 'Psychic Power actions cost 1 action instead of 2, but may still only use 1 per turn.',
  },
  { id: 'tactician', name: 'Tactician', effect: '+1DT to Initiative rolls.' },
]);

export const CORE_WARBAND_TRAITS: Trait[] = t([
  {
    id: 'cyborgs',
    name: 'Cyborgs',
    effect: 'All members of the Warband can purchase 1 additional piece of equipment.',
  },
  {
    id: 'fanatics',
    name: 'Fanatics',
    effect: 'Roll Willpower with +1DT for all rolls except Psychic Powers.',
  },
  {
    id: 'living-weapons',
    name: 'Living Weapons',
    effect: 'Unarmed attacks do not have -1DT to Prowess rolls.',
  },
  { id: 'heavily-armed', name: 'Heavily Armed', effect: 'All Ranged weapons cost 1 point less.' },
  {
    id: 'mutants',
    name: 'Mutants',
    effect: 'Speed, Claws & Teeth, Horrible Claws & Teeth, and Whip/Tail cost 1 less point.',
  },
  {
    id: 'soldiers',
    name: 'Soldiers',
    effect:
      'Grenades, Heavy Armor, and Medkits may be purchased for free. They still use a model’s equipment slots.',
  },
  {
    id: 'undead',
    name: 'Undead',
    effect: 'A second staggered condition does not take models in this Warband out of action.',
  },
]);
