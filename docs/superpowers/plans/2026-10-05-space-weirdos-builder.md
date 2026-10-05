# Space Weirdos Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static web app for building Space Weirdos warbands (core rules plus the fan expansion) that autosaves a library of warbands in the browser and prints fixed-size portrait unit cards.

**Architecture:** A pure TypeScript rules module (data tables plus an engine that computes costs and warnings) with no DOM dependency; a storage module over an injectable key-value interface; and a small framework-free UI (hash-routed library, editor and print screens) that only displays what the engine returns.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright (one smoke test file), Prettier. No UI framework.

**Spec:** `docs/superpowers/specs/2026-10-05-space-weirdos-builder-design.md`

**Source rules:** `../Space_Weirdos.pdf` (core) and `../Space_Weirdos_Fan_Expansion.pdf`. The data tables below were transcribed from them; where a page number is given it is the zine page number.

**Conventions for every task:**
- Work on branch `feature/builder` (created in Task 1), never on `main` or `master`.
- British English in docs and comments; US spelling only where the code needs it (for example `color` in CSS).
- Run `npm run format` before each commit.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts
.prettierrc, .prettierignore, .gitignore, index.html, README.md
src/
  main.ts                    router + storage banner
  style.css                  screen and print styles
  rules/
    types.ts                 item and trait types
    data/core.ts             core tables
    data/expansion.ts        expansion tables
    catalog.ts               combined tables, lookup, availability filter
    engine.ts                costs, display stats, warnings
    engine.test.ts
    examples.test.ts         example warbands from both PDFs
  model/
    types.ts                 ModelSpec, Warband
    factory.ts               newModel, newWarband, newId
  storage/
    kv.ts                    KV interface, in-memory and browser implementations
    validate.ts              parseWarband, migrate
    library.ts               Library class, export/import
    storage.test.ts
  ui/
    dom.ts                   h() helper
    library-view.ts
    editor-view.ts
    print-view.ts
e2e/smoke.spec.ts
```

---

## Chunk 1: Scaffold, rules data and engine

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.prettierrc`, `.prettierignore`, `.gitignore`, `index.html`, `src/main.ts`

- [ ] **Step 1: Create the feature branch**

Run: `cd /home/edward/Nextcloud/gaming/weirdos/builder && git checkout -b feature/builder`
Expected: `Switched to a new branch 'feature/builder'`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "space-weirdos-builder",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "e2e": "playwright test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 3: Install dependencies**

This machine has Node 18.16, which the newest Vite and Vitest no longer support, so pin the last majors that do (check `node -v` first; if Node is 20.19 or later, unpinned latest is fine):

Run: `npm install -D vite@5 vitest@2 typescript prettier @playwright/test@1.49`
Expected: installs without errors; `package-lock.json` created. If `@playwright/test@1.49` is not installable, use the newest 1.x that supports Node 18 and say which in the commit message.

Also change `import { defineConfig } from 'vitest/config';` only if the installed Vitest version needs it; the plan's `vite.config.ts` works with Vitest 2.

- [ ] **Step 4: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts` (relative base so the build works under a sub-path):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: { include: ['src/**/*.test.ts'] },
});
```

`.prettierrc`:
```json
{ "singleQuote": true, "printWidth": 100 }
```

`.prettierignore`:
```
dist
node_modules
docs
.remember
supertool
package-lock.json
playwright-report
test-results
```

`.gitignore`:
```
node_modules
dist
playwright-report
test-results
.remember
supertool
```

`index.html`:
```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Space Weirdos Builder</title>
  </head>
  <body>
    <div id="banner"></div>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (placeholder, replaced in Task 9):
```ts
document.querySelector('#app')!.textContent = 'Space Weirdos Builder';
```

- [ ] **Step 5: Verify the toolchain**

Run: `npm run build && npm run format:check`
Expected: build succeeds; Prettier reports all files formatted (run `npm run format` first if not).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite, TypeScript, Vitest and Prettier

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Rules types and data tables

**Files:**
- Create: `src/rules/types.ts`, `src/rules/data/core.ts`, `src/rules/data/expansion.ts`, `src/rules/catalog.ts`

- [ ] **Step 1: Create `src/rules/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/rules/data/core.ts`** (core rules pp. 7-10)

```ts
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
    notes: 'Aim2, cannot target enemies < 1 stick away, reroll FP rolls of 1, +1 to Under Fire rolls',
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
  { id: 'powered-weapon', name: 'Powered Weapon', cost: 2, maxFight: 2, notes: 'Reroll Prw rolls of 1' },
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
  { id: 'cybernetics', name: 'Cybernetics', cost: 1, type: 'P', bonus: 'prw', notes: '+1 to Prw rolls' },
  {
    id: 'grenade',
    name: 'Grenade',
    cost: 1,
    type: 'A',
    notes: 'May only be used once per game. Targets point up to 1 stick from attacker, Blast AoE, 2d10 FP, +1 to Under Fire rolls',
  },
  { id: 'heavy-armor', name: 'Heavy Armor', cost: 1, type: 'P', bonus: 'def', notes: '+1 to Def rolls' },
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
  { id: 'psychic-focus', name: 'Psychic Focus', cost: 1, type: 'P', bonus: 'will', notes: '+1 to Will rolls' },
  {
    id: 'stealth-suit',
    name: 'Stealth Suit',
    cost: 2,
    type: 'P',
    notes:
      'If this model’s base touches terrain, enemies have no LoS unless within 1 stick',
  },
  { id: 'targeting-reticule', name: 'Targeting Reticule', cost: 1, type: 'P', bonus: 'fp', notes: '+1 to FP rolls' },
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
    effect:
      'Speed, Claws & Teeth, Horrible Claws & Teeth, and Whip/Tail cost 1 less point.',
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
    effect:
      'A second staggered condition does not take models in this Warband out of action.',
  },
]);
```

- [ ] **Step 3: Create `src/rules/data/expansion.ts`** (fan expansion pp. 7-10)

```ts
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
    notes: 'No Psychic Power actions can be made or have an effect within half a stick of this model',
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
```

- [ ] **Step 4: Create `src/rules/catalog.ts`**

```ts
import type { CloseWeapon, Equipment, Power, RangedWeapon, Source, Trait } from './types';
import {
  CORE_CLOSE,
  CORE_EQUIPMENT,
  CORE_LEADER_TRAITS,
  CORE_POWERS,
  CORE_RANGED,
  CORE_WARBAND_TRAITS,
} from './data/core';
import {
  EXP_CLOSE,
  EXP_EQUIPMENT,
  EXP_LEADER_TRAITS,
  EXP_POWERS,
  EXP_RANGED,
  EXP_WARBAND_TRAITS,
} from './data/expansion';

export const catalog = {
  ranged: [...CORE_RANGED, ...EXP_RANGED] as RangedWeapon[],
  close: [...CORE_CLOSE, ...EXP_CLOSE] as CloseWeapon[],
  equipment: [...CORE_EQUIPMENT, ...EXP_EQUIPMENT] as Equipment[],
  powers: [...CORE_POWERS, ...EXP_POWERS] as Power[],
  leaderTraits: [...CORE_LEADER_TRAITS, ...EXP_LEADER_TRAITS] as Trait[],
  warbandTraits: [...CORE_WARBAND_TRAITS, ...EXP_WARBAND_TRAITS] as Trait[],
};

export type CatalogKind = keyof typeof catalog;

export function lookup<K extends CatalogKind>(
  kind: K,
  id: string,
): (typeof catalog)[K][number] | undefined {
  return (catalog[kind] as { id: string }[]).find((i) => i.id === id) as
    | (typeof catalog)[K][number]
    | undefined;
}

/** Items the player may pick: core always, expansion only when it is switched on. */
export function available<T extends { source: Source }>(items: T[], expansion: boolean): T[] {
  return items.filter((i) => expansion || i.source === 'core');
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run format && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add rules types and core and expansion data tables

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 3: Model types and factory

**Files:**
- Create: `src/model/types.ts`, `src/model/factory.ts`

- [ ] **Step 1: Create `src/model/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/model/factory.ts`**

`crypto.randomUUID` is not available on insecure origins (for example `file://`), so use a simple fallback-free generator.

```ts
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
```

- [ ] **Step 3: Verify and commit**

Run: `npm run format && npm run build`
Expected: succeeds.

```bash
git add -A
git commit -m "feat: add warband and model types with factory

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: Engine: costs (TDD)

**Files:**
- Create: `src/rules/engine.ts`, `src/rules/engine.test.ts`

- [ ] **Step 1: Write the failing cost tests in `src/rules/engine.test.ts`**

```ts
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
    const big = m({ speed: 3, defense: '2d10', firepower: '2d10', prowess: '2d10', willpower: '2d10' });
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
    expect(modelCost(model, { expansion: false, warbandTrait: 'heavily-armed' }).total).toBe(base - 1);
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/rules/engine.test.ts`
Expected: FAIL (cannot resolve `./engine`).

- [ ] **Step 3: Implement the cost half of `src/rules/engine.ts`**

```ts
import type { ModelSpec, Warband } from '../model/types';
import { lookup } from './catalog';
import type { DefenceDie, Die, FirepowerDie, Item, StatKey } from './types';

export interface Context {
  expansion: boolean;
  warbandTrait: string | null;
}
export interface CostLine {
  label: string;
  cost: number;
}
export interface ModelCost {
  total: number;
  lines: CostLine[];
}

export const contextOf = (wb: Warband): Context => ({
  expansion: wb.expansion,
  warbandTrait: wb.warbandTrait,
});

const ATTR_COST = {
  speed: { 1: 0, 2: 1, 3: 3 },
  defense: { '2d4': -1, '2d6': 2, '2d8': 4, '2d10': 8 } as Record<DefenceDie, number>,
  firepower: { none: 0, '2d6': 1, '2d8': 2, '2d10': 4 } as Record<FirepowerDie, number>,
  prowess: { '2d6': 2, '2d8': 4, '2d10': 6 } as Record<Die, number>,
  willpower: { '2d6': 2, '2d8': 4, '2d10': 6 } as Record<Die, number>,
};

type WeaponKind = 'ranged' | 'close' | 'equipment' | 'power';

/** Item cost after warband trait adjustments. */
export function adjustedCost(item: Item, kind: WeaponKind, ctx: Context): number {
  let cost = item.cost;
  switch (ctx.warbandTrait) {
    case 'heavily-armed':
      if (kind === 'ranged') cost -= 1;
      break;
    case 'mutants':
      if (['claws-teeth', 'horrible-claws-teeth', 'whip-tail'].includes(item.id)) cost -= 1;
      break;
    case 'soldiers':
      if (['grenade', 'heavy-armor', 'medkit'].includes(item.id)) cost = 0;
      break;
  }
  return Math.max(0, cost);
}

export const equipmentAllowance = (m: ModelSpec, ctx: Context): number =>
  (m.isLeader ? 2 : 1) + (ctx.warbandTrait === 'cyborgs' ? 1 : 0);

/** Number of items above the normal allowance across weapons and equipment. */
export function extraItems(m: ModelSpec, ctx: Context): number {
  return (
    Math.max(0, m.rangedWeapons.length - 1) +
    Math.max(0, m.closeWeapons.length - 1) +
    Math.max(0, m.equipment.length - equipmentAllowance(m, ctx))
  );
}

export function modelCost(m: ModelSpec, ctx: Context): ModelCost {
  const lines: CostLine[] = [];
  const add = (label: string, cost: number) => lines.push({ label, cost });

  const speed = ATTR_COST.speed[m.speed];
  add(`Speed ${m.speed}`, ctx.warbandTrait === 'mutants' ? Math.max(0, speed - 1) : speed);
  add(`Defence ${m.defense}`, ATTR_COST.defense[m.defense]);
  add(`Firepower ${m.firepower}`, ATTR_COST.firepower[m.firepower]);
  add(`Prowess ${m.prowess}`, ATTR_COST.prowess[m.prowess]);
  add(`Willpower ${m.willpower}`, ATTR_COST.willpower[m.willpower]);

  const addItems = (kind: WeaponKind, ids: string[]) => {
    const catalogKind = { ranged: 'ranged', close: 'close', equipment: 'equipment', power: 'powers' }[
      kind
    ] as 'ranged' | 'close' | 'equipment' | 'powers';
    for (const id of ids) {
      const item = lookup(catalogKind, id);
      if (item) add(item.name, adjustedCost(item, kind, ctx));
      else add(`Unknown item (${id})`, 0);
    }
  };
  addItems('ranged', m.rangedWeapons);
  addItems('close', m.closeWeapons);
  addItems('equipment', m.equipment);
  addItems('power', m.powers);

  if (ctx.expansion) {
    const extra = extraItems(m, ctx);
    if (extra > 0) add('Extra items (Heavily Equipped)', extra);
  }

  return { total: lines.reduce((s, l) => s + l.cost, 0), lines };
}

/**
 * The cost that counts towards the warband total: a Hero/Villain leader counts double
 * (expansion). Model limits are checked on the undoubled `modelCost`, because the rules
 * do not say the doubled value must fit under the 25-point cap; this is an interpretation.
 */
export function displayCost(m: ModelSpec, ctx: Context): number {
  const cost = modelCost(m, ctx).total;
  return ctx.expansion && m.isLeader && m.leaderTrait === 'hero-villain' ? cost * 2 : cost;
}

export function warbandCost(wb: Warband): number {
  const ctx = contextOf(wb);
  return wb.models.reduce((sum, m) => sum + displayCost(m, ctx), 0);
}

export type { StatKey };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/rules/engine.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add engine cost calculation with trait effects

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 5: Engine: display stats and warnings (TDD)

**Files:**
- Modify: `src/rules/engine.ts`, `src/rules/engine.test.ts`

- [ ] **Step 1: Append the failing tests to `src/rules/engine.test.ts`**

Add `displayStats, limits, validateWarband` to the import from `./engine`, then append:

```ts
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
const messages = (wb: ReturnType<typeof newWarband>) =>
  validateWarband(wb).map((w) => w.message);
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
    expect(messages(wbWith([m({ isLeader: true }), m({ isLeader: true })])).some((x) => /more than one leader/i.test(x))).toBe(true);
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
    expect(messages(wbWith([m({ isLeader: true, closeWeapons: [] })])).some((x) => /close combat/i.test(x))).toBe(true);
  });

  it('warns about leader traits on non-leaders', () => {
    expect(messages(wbWith([m({ isLeader: true }), m({ leaderTrait: 'tactician' })])).some((x) => /leader trait/i.test(x))).toBe(true);
  });

  it('flags expansion content used while the expansion is off, but not when on', () => {
    const model = m({ rangedWeapons: ['smg'], firepower: '2d8' });
    expect(messages(wbWith([m({ isLeader: true }), model])).some((x) => /expansion/i.test(x))).toBe(true);
    expect(messages(wbWith([m({ isLeader: true }), model], { expansion: true })).some((x) => /expansion/i.test(x))).toBe(false);
  });

  it('flags unknown item ids but keeps them', () => {
    const msgs = messages(wbWith([m({ isLeader: true, powers: ['nope'] })]));
    expect(msgs.some((x) => /unknown item 'nope'/i.test(x))).toBe(true);
  });

  it('handles Elites (+5) and Powerful models (30, not a leader, only one)', () => {
    const elites = wbWith([withCost(30), withCost(25)], { expansion: true, warbandTrait: 'elites', target: 125 });
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/rules/engine.test.ts`
Expected: FAIL (`displayStats`, `limits`, `validateWarband` not exported).

- [ ] **Step 3: Append to `src/rules/engine.ts`**

Replace the final `export type { StatKey };` line with the code below.

```ts
export interface DisplayStats {
  spd: string;
  def: string;
  fp: string;
  prw: string;
  will: string;
}

/** Stat line as printed on a card, with +1 equipment bonuses folded in (for example 2d8+1). */
export function displayStats(m: ModelSpec): DisplayStats {
  const bonus = (stat: StatKey) =>
    m.equipment.filter((id) => lookup('equipment', id)?.bonus === stat).length;
  const dice = (base: string, stat: StatKey) => {
    const n = bonus(stat);
    return n > 0 ? `${base}+${n}` : base;
  };
  return {
    spd: String(m.speed),
    def: dice(m.defense, 'def'),
    fp: m.firepower === 'none' ? 'n/a' : dice(m.firepower, 'fp'),
    prw: dice(m.prowess, 'prw'),
    will: dice(m.willpower, 'will'),
  };
}

export interface Limits {
  normal: number;
  top: number;
  powerful: number;
}

export function limits(ctx: Context): Limits {
  const bonus = ctx.expansion && ctx.warbandTrait === 'elites' ? 5 : 0;
  return { normal: 20 + bonus, top: 25 + bonus, powerful: 30 };
}

export interface Warning {
  /** 'warband' or a model id */
  scope: string;
  level: 'warning' | 'info';
  message: string;
}

export function validateWarband(wb: Warband): Warning[] {
  const ctx = contextOf(wb);
  const out: Warning[] = [];
  const warn = (scope: string, message: string, level: Warning['level'] = 'warning') =>
    out.push({ scope, level, message });
  const lim = limits(ctx);
  const label = (m: ModelSpec) => m.name || 'Unnamed model';

  const leaders = wb.models.filter((m) => m.isLeader);
  if (leaders.length === 0) warn('warband', 'Warband has no leader.');
  if (leaders.length > 1) warn('warband', 'Warband has more than one leader.');

  const total = warbandCost(wb);
  if (total > wb.target) warn('warband', `Warband is over its points target (${total} of ${wb.target}).`);

  const wbTrait = wb.warbandTrait ? lookup('warbandTraits', wb.warbandTrait) : undefined;
  if (wb.warbandTrait && !wbTrait) warn('warband', `Unknown warband trait '${wb.warbandTrait}' (kept).`);
  if (wbTrait?.source === 'expansion' && !ctx.expansion)
    warn('warband', `${wbTrait.name} is an expansion trait but the expansion is switched off.`);

  const powerfulModels = wb.models.filter((m) => m.powerful);
  if (powerfulModels.length > 1) warn('warband', 'Only one Powerful model is allowed per warband.');

  let aboveNormal = 0;
  for (const m of wb.models) {
    const cost = modelCost(m, ctx).total;

    if (m.powerful) {
      if (!ctx.expansion) warn(m.id, `${label(m)}: Powerful models are an expansion rule.`);
      if (m.isLeader) warn(m.id, `${label(m)}: a Powerful model cannot be a leader.`);
      if (cost > lim.powerful)
        warn(m.id, `${label(m)} costs ${cost}, limit ${lim.powerful} for a Powerful model.`);
    } else {
      // A model over the top limit is also over the normal limit, so these are independent
      if (cost > lim.top) warn(m.id, `${label(m)} costs ${cost}, limit ${lim.top}.`);
      if (cost > lim.normal) aboveNormal++;
    }

    // Leader trait
    if (m.leaderTrait) {
      const t = lookup('leaderTraits', m.leaderTrait);
      if (!m.isLeader) warn(m.id, `${label(m)} has a leader trait but is not the leader.`);
      if (!t) warn(m.id, `Unknown leader trait '${m.leaderTrait}' (kept).`);
      else if (t.source === 'expansion' && !ctx.expansion)
        warn(m.id, `${t.name} is an expansion trait but the expansion is switched off.`);
    }

    // Attributes that only exist in the expansion
    if (!ctx.expansion && m.defense === '2d4')
      warn(m.id, `${label(m)}: 2d4 Defence is an expansion rule.`);
    if (!ctx.expansion && m.firepower === '2d6')
      warn(m.id, `${label(m)}: 2d6 Firepower is an expansion rule.`);

    // Weapons
    if (m.firepower === 'none' && m.rangedWeapons.length > 0)
      warn(m.id, `${label(m)} has a ranged weapon but no Firepower.`);
    if (m.firepower !== 'none' && m.rangedWeapons.length === 0)
      warn(m.id, `${label(m)} has Firepower but no ranged weapon.`);
    if (m.closeWeapons.length === 0)
      warn(m.id, `${label(m)} needs a close combat weapon (Unarmed is free).`);

    // Allowances: surcharge with the expansion, warning without it
    const allowance = equipmentAllowance(m, ctx);
    const overs: [string, number, number][] = [
      ['ranged weapons', m.rangedWeapons.length, 1],
      ['close combat weapons', m.closeWeapons.length, 1],
      ['equipment', m.equipment.length, allowance],
    ];
    for (const [what, n, max] of overs) {
      if (n <= max) continue;
      if (ctx.expansion)
        warn(m.id, `${label(m)}: ${n - max} extra ${what} (+${n - max} points, Heavily Equipped).`, 'info');
      else warn(m.id, `${label(m)} has ${n} ${what}, max ${max}.`);
    }

    // Unknown ids and expansion items used while the expansion is off
    const groups: [Parameters<typeof lookup>[0], string[]][] = [
      ['ranged', m.rangedWeapons],
      ['close', m.closeWeapons],
      ['equipment', m.equipment],
      ['powers', m.powers],
    ];
    for (const [kind, ids] of groups) {
      for (const id of ids) {
        const item = lookup(kind, id);
        if (!item) warn(m.id, `${label(m)}: unknown item '${id}' (kept).`);
        else if (item.source === 'expansion' && !ctx.expansion)
          warn(m.id, `${label(m)}: ${item.name} is an expansion item but the expansion is switched off.`);
      }
    }
  }

  if (aboveNormal > 1)
    warn('warband', `Only one model may cost more than ${lim.normal} points (${aboveNormal} do).`);

  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/rules/engine.test.ts`
Expected: all PASS. Fix any failing test by checking whether the test or the engine is wrong against the rules text; do not weaken a rule to make a test pass.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add display stats, limits and warnings to the engine

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 6: Validate the data against the PDFs' example warbands

This is the check that the data tables and cost rules agree with the published example warbands.

**Files:**
- Create: `src/rules/examples.test.ts`

- [ ] **Step 1: Write the test**

`expected` is the cost computed by hand from the cost tables. `published` is given only where the PDF prints a different number; those twelve (Astral, Vampire and ten in the expansion) are suspected errors in the PDFs and are reported, not "fixed". Final summary to the user must list them.

```ts
import { describe, expect, it } from 'vitest';
import { newModel } from '../model/factory';
import type { ModelSpec } from '../model/types';
import { modelCost, type Context } from './engine';

interface Example {
  name: string;
  trait: string | null;
  expansion?: boolean;
  expected: number;
  /** Cost printed in the PDF when it disagrees with the cost tables */
  published?: number;
  spd: 1 | 2 | 3;
  def: string;
  fp: string;
  prw: string;
  will: string;
  ranged?: string[];
  close?: string[];
  equip?: string[];
  powers?: string[];
  leader?: boolean;
}

const E = (e: Example) => e;
const examples: Example[] = [
  // Alien X-Terminators (soldiers), core p.12
  E({ name: 'Rookie', trait: 'soldiers', expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-rifle'], equip: ['grenade'] }),
  E({ name: 'Ranger', trait: 'soldiers', expected: 19, spd: 3, def: '2d8', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['shotgun'], close: ['powered-weapon'], equip: ['grenade'] }),
  E({ name: 'Heavy', trait: 'soldiers', expected: 17, spd: 2, def: '2d8', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['rocket-launcher'], close: ['large-melee-weapon'], equip: ['heavy-armor'] }),
  E({ name: 'Sniper', trait: 'soldiers', expected: 16, spd: 2, def: '2d6', fp: '2d10', prw: '2d6', will: '2d6', ranged: ['sniper-rifle'], equip: ['stealth-suit'] }),
  E({ name: 'Psychic Trooper', trait: 'soldiers', expected: 19, leader: true, spd: 2, def: '2d8', fp: '2d8', prw: '2d6', will: '2d10', ranged: ['heavy-rifle'], equip: ['heavy-armor'], powers: ['prescience', 'telekinesis'] }),
  // Aliens (mutants)
  E({ name: 'MIB', trait: 'mutants', expected: 12, spd: 3, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['energy-pistol'] }),
  E({ name: 'Grey', trait: 'mutants', expected: 15, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d8', ranged: ['energy-pistol'], powers: ['fear', 'mind-control'] }),
  E({ name: 'Ophidian', trait: 'mutants', expected: 17, spd: 3, def: '2d8', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['energy-rifle'], close: ['whip-tail'] }),
  E({ name: 'Brute', trait: 'mutants', expected: 18, spd: 2, def: '2d10', fp: 'none', prw: '2d10', will: '2d6', close: ['horrible-claws-teeth'] }),
  // The PDF prints 18; the cost tables give 17.
  E({ name: 'Astral', trait: 'mutants', expected: 17, published: 18, leader: true, spd: 2, def: '2d8', fp: 'none', prw: '2d6', will: '2d10', equip: ['psychic-focus'], powers: ['mind-stab', 'teleport'] }),
  // Darkest Future
  E({ name: 'Trooper', trait: 'fanatics', expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-rifle'] }),
  E({ name: 'Veteran Trooper', trait: 'fanatics', expected: 14, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d8', ranged: ['heavy-rifle'], equip: ['targeting-reticule'] }),
  E({ name: 'Supersoldier', trait: 'fanatics', expected: 20, spd: 2, def: '2d8', fp: '2d10', prw: '2d8', will: '2d8', ranged: ['heavy-rifle'], close: ['melee-weapon'] }),
  E({ name: 'Adjudicator', trait: 'fanatics', expected: 25, leader: true, spd: 2, def: '2d8', fp: '2d10', prw: '2d8', will: '2d10', ranged: ['heavy-rifle'], close: ['powered-weapon'], powers: ['fear', 'healing'] }),
  // Neon City
  E({ name: 'Razor Girl', trait: 'cyborgs', expected: 14, spd: 3, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-pistol'], close: ['melee-weapon'], equip: ['cybernetics', 'targeting-reticule'] }),
  E({ name: 'Razor Queen', trait: 'cyborgs', expected: 23, leader: true, spd: 3, def: '2d8', fp: 'none', prw: '2d10', will: '2d8', close: ['horrible-claws-teeth'], equip: ['cybernetics', 'heavy-armor', 'jump-pack'] }),
  E({ name: 'Steroid Boy', trait: 'living-weapons', expected: 14, spd: 2, def: '2d8', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['auto-rifle'] }),
  E({ name: 'Steroid King', trait: 'living-weapons', expected: 25, leader: true, spd: 2, def: '2d10', fp: '2d8', prw: '2d10', will: '2d8', ranged: ['autocannon'], equip: ['heavy-armor'] }),
  E({ name: 'Zombie', trait: 'undead', expected: 10, spd: 1, def: '2d6', fp: 'none', prw: '2d8', will: '2d6', close: ['claws-teeth'] }),
  // The PDF prints 24; the cost tables give 25.
  E({ name: 'Vampire', trait: 'undead', expected: 25, published: 24, leader: true, spd: 3, def: '2d8', fp: 'none', prw: '2d10', will: '2d8', close: ['horrible-claws-teeth'], equip: ['jump-pack'], powers: ['meat-puppet', 'mind-control'] }),
  // Fan expansion p.14
  E({ name: 'Princess Rebellia', trait: 'plucky-rebels', expansion: true, expected: 18, leader: true, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d10', ranged: ['energy-pistol'], equip: ['comms-unit', 'psychic-focus'], powers: ['prescience'] }),
  E({ name: 'Luke Starweirder', trait: 'plucky-rebels', expansion: true, expected: 20, spd: 2, def: '2d8', fp: 'none', prw: '2d8', will: '2d10', close: ['powered-weapon'], equip: ['laser-sword'], powers: ['telekinesis', 'prescience'] }),
  E({ name: 'Chow-baka', trait: 'plucky-rebels', expansion: true, expected: 24, spd: 2, def: '2d8', fp: '2d10', prw: '2d10', will: '2d8', ranged: ['heavy-rifle'], close: ['claws-teeth'], equip: ['grenade'] }),
  E({ name: 'Han Loco', trait: 'plucky-rebels', expansion: true, expected: 12, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['energy-pistol'], equip: ['targeting-reticule'] }),
  // The rest of the expansion's example warbands (pp.14-15). Where the printed cost
  // disagrees with the cost tables, `expected` is the table value and `published` the PDF's.
  // Imperial Empire (Imperial Numbers)
  E({ name: 'Darn Father', trait: 'imperial-numbers', expansion: true, expected: 24, published: 25, leader: true, spd: 2, def: '2d8', fp: 'none', prw: '2d10', will: '2d8', close: ['powered-weapon'], equip: ['laser-sword'], powers: ['telekinesis', 'mind-stab', 'prescience', 'fear'] }),
  E({ name: 'Darn Sillious', trait: 'imperial-numbers', expansion: true, expected: 20, published: 19, spd: 2, def: '2d6', fp: 'none', prw: '2d8', will: '2d10', equip: ['psychic-focus'], powers: ['telekinesis', 'fear', 'mind-stab', 'prescience'] }),
  E({ name: 'Imperial Trooper', trait: 'imperial-numbers', expansion: true, expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-rifle'] }),
  E({ name: 'Imperial Scout', trait: 'imperial-numbers', expansion: true, expected: 12, published: 11, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['sniper-rifle'] }),
  E({ name: 'Rebel Fighter', trait: 'plucky-rebels', expansion: true, expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['heavy-pistol'] }),
  // Crime Lords (Mutants)
  E({ name: 'Big Pappa', trait: 'mutants', expansion: true, expected: 19, published: 17, leader: true, spd: 1, def: '2d10', fp: 'none', prw: '2d6', will: '2d10', close: ['claws-teeth'], equip: ['heavy-armor', 'comms-unit'] }),
  E({ name: 'Slave Driver', trait: 'mutants', expansion: true, expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['heavy-pistol'], close: ['whip-tail'] }),
  E({ name: 'Pigman', trait: 'mutants', expansion: true, expected: 11, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['energy-rifle'], close: ['claws-teeth'] }),
  E({ name: 'Bounty Hunter', trait: 'mutants', expansion: true, expected: 15, spd: 3, def: '2d8', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['energy-pistol'], equip: ['jump-pack'] }),
  // Xenos Cult (Fanatics; the two-column layout of the PDF makes the Xenos models look like Mutants)
  E({ name: 'Cult Father', trait: 'fanatics', expansion: true, expected: 21, leader: true, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d10', ranged: ['energy-pistol'], close: ['melee-weapon'], equip: ['psychic-focus'], powers: ['prescience', 'fear', 'mind-control'] }),
  E({ name: 'Xenos', trait: 'fanatics', expansion: true, expected: 19, spd: 3, def: '2d8', fp: 'none', prw: '2d10', will: '2d6', close: ['horrible-claws-teeth'], equip: ['cybernetics'] }),
  E({ name: 'Hybrid', trait: 'fanatics', expansion: true, expected: 15, spd: 2, def: '2d6', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['flamer'], close: ['claws-teeth'] }),
  E({ name: 'Cultist', trait: 'fanatics', expansion: true, expected: 10, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-rifle'] }),
  // Sporks (Heavily Armed)
  E({ name: 'Big Bozz', trait: 'heavily-armed', expansion: true, expected: 19, leader: true, spd: 2, def: '2d8', fp: '2d8', prw: '2d8', will: '2d8', ranged: ['heavy-pistol'], close: ['large-powered-weapon'], equip: ['heavy-armor'] }),
  E({ name: 'Ladz', trait: 'heavily-armed', expansion: true, expected: 11, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['heavy-pistol'], close: ['melee-weapon'], equip: ['heavy-armor'] }),
  E({ name: 'Stormin Ladz', trait: 'heavily-armed', expansion: true, expected: 16, spd: 3, def: '2d6', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['heavy-pistol'], close: ['powered-weapon'], equip: ['jump-pack'] }),
  E({ name: 'Little Gitz', trait: 'heavily-armed', expansion: true, expected: 9, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['auto-pistol'] }),
  // Stumpies (Blue Collar)
  E({ name: 'Karl', trait: 'blue-collar', expansion: true, expected: 22, published: 21, leader: true, spd: 1, def: '2d8', fp: '2d8', prw: '2d8', will: '2d10', ranged: ['energy-pistol'], close: ['powered-weapon'], equip: ['cybernetics', 'heavy-armor'] }),
  E({ name: 'Dwarf Trooper', trait: 'blue-collar', expansion: true, expected: 12, published: 11, spd: 1, def: '2d6', fp: '2d8', prw: '2d6', will: '2d8', ranged: ['energy-rifle'] }),
  E({ name: 'Dwarf Demolisher', trait: 'blue-collar', expansion: true, expected: 16, published: 15, spd: 1, def: '2d6', fp: '2d10', prw: '2d6', will: '2d8', ranged: ['rocket-launcher'], equip: ['targeting-reticule'] }),
  E({ name: 'Bezerker', trait: 'blue-collar', expansion: true, expected: 16, published: 15, spd: 1, def: '2d6', fp: '2d8', prw: '2d8', will: '2d8', ranged: ['energy-pistol'], close: ['melee-weapon'], equip: ['grenade'] }),
  // Xenos Bugs (Mutants)
  E({ name: 'Big Bug', trait: 'mutants', expansion: true, expected: 24, leader: true, spd: 2, def: '2d8', fp: '2d8', prw: '2d8', will: '2d10', ranged: ['shotgun'], close: ['horrible-claws-teeth'], equip: ['heavy-armor'], powers: ['prescience', 'mind-control'] }),
  E({ name: 'Flying Bug', trait: 'mutants', expansion: true, expected: 18, spd: 3, def: '2d8', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['shotgun'], close: ['claws-teeth'], equip: ['jump-pack'] }),
  E({ name: 'Grunt Bug', trait: 'mutants', expansion: true, expected: 13, spd: 2, def: '2d8', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['shotgun'], close: ['claws-teeth'] }),
  E({ name: 'Little Bugs', trait: 'mutants', expansion: true, expected: 8, published: 10, spd: 1, def: '2d6', fp: 'none', prw: '2d6', will: '2d6', close: ['horrible-claws-teeth'] }),
  // Neon City: Purifying Flame (Fanatics), Tech Bros (Cyborgs), Miners Guild (Blue Collar)
  E({ name: 'Deacon Inferno', trait: 'fanatics', expansion: true, expected: 23, leader: true, spd: 2, def: '2d6', fp: '2d10', prw: '2d8', will: '2d10', ranged: ['flamer'], close: ['melee-weapon'], equip: ['grenade', 'grenade'], powers: ['fear'] }),
  E({ name: 'Acolyte', trait: 'fanatics', expansion: true, expected: 12, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['heavy-pistol'], close: ['melee-weapon'], equip: ['grenade'] }),
  E({ name: 'Tech Daddy', trait: 'cyborgs', expansion: true, expected: 21, published: 23, leader: true, spd: 2, def: '2d8', fp: '2d10', prw: '2d6', will: '2d6', ranged: ['sniper-rifle'], equip: ['stealth-suit', 'targeting-reticule', 'comms-unit'], powers: ['prescience'] }),
  E({ name: 'Tech Bro', trait: 'cyborgs', expansion: true, expected: 14, spd: 2, def: '2d6', fp: '2d8', prw: '2d6', will: '2d6', ranged: ['energy-rifle'], equip: ['targeting-reticule', 'stealth-suit'] }),
  E({ name: 'Foreman', trait: 'blue-collar', expansion: true, expected: 19, leader: true, spd: 2, def: '2d6', fp: '2d10', prw: '2d6', will: '2d8', ranged: ['autocannon'], close: ['melee-weapon'], equip: ['heavy-armor', 'targeting-reticule'] }),
  E({ name: 'Crew', trait: 'blue-collar', expansion: true, expected: 12, spd: 2, def: '2d6', fp: '2d8', prw: '2d8', will: '2d6', ranged: ['auto-pistol'], close: ['melee-weapon'] }),
];

describe('example warbands from the PDFs', () => {
  for (const ex of examples) {
    it(`${ex.name} costs ${ex.expected}${ex.published ? ` (PDF prints ${ex.published})` : ''}`, () => {
      const model: ModelSpec = {
        ...newModel(ex.leader),
        name: ex.name,
        speed: ex.spd,
        defense: ex.def as ModelSpec['defense'],
        firepower: ex.fp as ModelSpec['firepower'],
        prowess: ex.prw as ModelSpec['prowess'],
        willpower: ex.will as ModelSpec['willpower'],
        rangedWeapons: ex.ranged ?? [],
        closeWeapons: ex.close ?? ['unarmed'],
        equipment: ex.equip ?? [],
        powers: ex.powers ?? [],
      };
      const ctx: Context = { expansion: !!ex.expansion, warbandTrait: ex.trait };
      expect(modelCost(model, ctx).total).toBe(ex.expected);
    });
  }
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/rules/examples.test.ts`
Expected: all PASS. If any example fails, re-read the relevant PDF page (`pdftotext -layout`) and decide whether the data table or the example is wrong. Do not edit `expected` just to make a test pass. If a further genuine PDF discrepancy turns up, add it with a `published` value and tell the user.

- [ ] **Step 3: Commit**

```bash
npm run format
git add -A
git commit -m "test: check engine against example warbands in the PDFs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Chunk 2: Storage

### Task 7: KV interface, validation and library (TDD)

**Files:**
- Create: `src/storage/kv.ts`, `src/storage/validate.ts`, `src/storage/library.ts`, `src/storage/storage.test.ts`

- [ ] **Step 1: Create `src/storage/kv.ts`**

```ts
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export class MemoryKV implements KV {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  keys() {
    return [...this.data.keys()];
  }
}

/** localStorage-backed KV, or null when storage is unavailable (private mode, blocked, etc.). */
export function browserKV(): KV | null {
  try {
    const probe = '__weirdos_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch {
    return null;
  }
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
    keys: () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!),
  };
}
```

- [ ] **Step 2: Write the failing tests in `src/storage/storage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { newModel, newWarband } from '../model/factory';
import { Library } from './library';
import { MemoryKV } from './kv';
import { parseWarband } from './validate';

const make = () => new Library(new MemoryKV());

describe('parseWarband', () => {
  it('accepts a valid warband and round-trips it', () => {
    const wb = newWarband('Test');
    wb.models.push({ ...newModel(), powers: ['unknown-future-power'] });
    expect(parseWarband(JSON.parse(JSON.stringify(wb)))).toEqual(wb);
  });

  it('rejects bad data with a helpful path', () => {
    const wb: any = newWarband();
    wb.models[0].speed = 7;
    expect(() => parseWarband(wb)).toThrow(/models\[0\]\.speed/);
    expect(() => parseWarband({})).toThrow(/id/);
    expect(() => parseWarband(null)).toThrow(/object/);
  });

  it('rejects an unsupported future schema version', () => {
    const wb: any = { ...newWarband(), schemaVersion: 99 };
    expect(() => parseWarband(wb)).toThrow(/version/i);
  });
});

describe('Library', () => {
  it('saves, lists, gets and removes warbands', () => {
    const lib = make();
    const a = newWarband('A');
    const b = newWarband('B');
    lib.save(a);
    lib.save(b);
    expect(lib.list().warbands.map((w) => w.name).sort()).toEqual(['A', 'B']);
    expect(lib.get(a.id)?.name).toBe('A');
    lib.remove(a.id);
    expect(lib.get(a.id)).toBeNull();
    expect(lib.list().warbands).toHaveLength(1);
  });

  it('survives a reload (a new Library over the same store)', () => {
    const kv = new MemoryKV();
    new Library(kv).save(newWarband('Persisted'));
    expect(new Library(kv).list().warbands[0]?.name).toBe('Persisted');
  });

  it('skips a corrupt entry and reports it, without losing the others', () => {
    const kv = new MemoryKV();
    const lib = new Library(kv);
    lib.save(newWarband('Good'));
    kv.setItem('weirdos:wb:broken', '{not json');
    const { warbands, errors } = lib.list();
    expect(warbands.map((w) => w.name)).toEqual(['Good']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/broken/);
  });

  it('updates updatedAt on save', () => {
    const lib = make();
    const wb = newWarband();
    wb.updatedAt = '2000-01-01T00:00:00.000Z';
    lib.save(wb);
    expect(lib.get(wb.id)!.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('duplicates with a new id and a (copy) suffix', () => {
    const lib = make();
    const wb = newWarband('Orig');
    lib.save(wb);
    const copy = lib.duplicate(wb.id)!;
    expect(copy.id).not.toBe(wb.id);
    expect(copy.name).toBe('Orig (copy)');
    expect(lib.list().warbands).toHaveLength(2);
  });
});

describe('export and import', () => {
  it('round-trips one warband and a whole library', () => {
    const lib = make();
    const a = newWarband('A');
    const b = newWarband('B');
    lib.save(a);
    lib.save(b);
    const text = lib.exportAll();
    const other = make();
    const result = other.importText(text);
    expect(result.errors).toEqual([]);
    expect(other.list().warbands.map((w) => w.name).sort()).toEqual(['A', 'B']);
    expect(JSON.parse(lib.exportOne(a.id)!).warbands).toHaveLength(1);
  });

  it('gives imported warbands with clashing ids a new id and a (copy) suffix', () => {
    const lib = make();
    const a = newWarband('A');
    lib.save(a);
    const result = lib.importText(lib.exportAll());
    expect(result.imported).toBe(1);
    const names = lib.list().warbands.map((w) => w.name).sort();
    expect(names).toEqual(['A', 'A (copy)']);
  });

  it('also adds (copy) when a different warband has the same name', () => {
    const lib = make();
    lib.save(newWarband('Same name'));
    const other = newWarband('Same name'); // different id, same name
    const result = lib.importText(JSON.stringify(other));
    expect(result.imported).toBe(1);
    expect(lib.get(other.id)?.name).toBe('Same name (copy)');
  });

  it('accepts a bare warband object as well as the wrapper format', () => {
    const lib = make();
    const result = lib.importText(JSON.stringify(newWarband('Bare')));
    expect(result.imported).toBe(1);
  });

  it('reports invalid JSON and invalid warbands without throwing', () => {
    const lib = make();
    expect(lib.importText('nope').errors[0]).toMatch(/not valid JSON/i);
    const bad = JSON.stringify({ format: 'space-weirdos-warbands', version: 1, warbands: [{ id: 'x' }] });
    const r = lib.importText(bad);
    expect(r.imported).toBe(0);
    expect(r.errors).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/storage`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create `src/storage/validate.ts`**

```ts
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
const oneOf = <T extends string>(o: Record<string, unknown>, k: string, path: string, allowed: string[]) =>
  allowed.includes(o[k] as string) ? (o[k] as T) : fail(`${path}${k}`, `expected one of ${allowed.join(', ')}`);

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
  throw new Invalid(`schemaVersion: unsupported version ${String(v)} (this app understands ${SCHEMA_VERSION})`);
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
    models: (o.models as unknown[]).map(parseModel),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  };
}
```

Unknown item ids are deliberately accepted here (the parser only checks that the lists contain strings), so saved data is never lost. They are flagged by `validateWarband` (Task 5) and shown in the editor's checklists (Task 10).

There is no separate index of warband ids (the spec's Storage section is updated to match): `Library.list()` scans the store's keys for the `weirdos:wb:` prefix, which cannot get out of step with the entries.

- [ ] **Step 5: Create `src/storage/library.ts`**

```ts
import { newId } from '../model/factory';
import type { Warband } from '../model/types';
import type { KV } from './kv';
import { parseWarband } from './validate';

const PREFIX = 'weirdos:wb:';
const FORMAT = 'space-weirdos-warbands';

export interface ImportResult {
  imported: number;
  errors: string[];
}

export class Library {
  constructor(private kv: KV) {}

  list(): { warbands: Warband[]; errors: string[] } {
    const warbands: Warband[] = [];
    const errors: string[] = [];
    for (const key of this.kv.keys().filter((k) => k.startsWith(PREFIX))) {
      try {
        warbands.push(parseWarband(JSON.parse(this.kv.getItem(key) ?? '')));
      } catch (e) {
        errors.push(`${key.slice(PREFIX.length)}: ${(e as Error).message}`);
      }
    }
    warbands.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { warbands, errors };
  }

  get(id: string): Warband | null {
    const text = this.kv.getItem(PREFIX + id);
    if (text === null) return null;
    try {
      return parseWarband(JSON.parse(text));
    } catch {
      return null;
    }
  }

  /** Throws if the browser refuses the write (quota). Callers show a warning. */
  save(wb: Warband): void {
    wb.updatedAt = new Date().toISOString();
    this.kv.setItem(PREFIX + wb.id, JSON.stringify(wb));
  }

  remove(id: string): void {
    this.kv.removeItem(PREFIX + id);
  }

  duplicate(id: string): Warband | null {
    const wb = this.get(id);
    if (!wb) return null;
    const copy: Warband = {
      ...structuredClone(wb),
      id: newId(),
      name: `${wb.name} (copy)`,
    };
    copy.models = copy.models.map((m) => ({ ...m, id: newId() }));
    this.save(copy);
    return copy;
  }

  exportOne(id: string): string | null {
    const wb = this.get(id);
    return wb ? wrap([wb]) : null;
  }

  exportAll(): string {
    return wrap(this.list().warbands);
  }

  importText(text: string): ImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { imported: 0, errors: ['The file is not valid JSON.'] };
    }
    const items: unknown[] =
      typeof data === 'object' && data !== null && Array.isArray((data as { warbands?: unknown }).warbands)
        ? (data as { warbands: unknown[] }).warbands
        : [data];
    const result: ImportResult = { imported: 0, errors: [] };
    items.forEach((raw, i) => {
      try {
        const wb = parseWarband(raw);
        const idClash = this.get(wb.id) !== null;
        const nameClash = this.list().warbands.some((w) => w.name === wb.name);
        if (idClash) wb.id = newId();
        if (idClash || nameClash) wb.name = `${wb.name} (copy)`;
        this.save(wb);
        result.imported++;
      } catch (e) {
        result.errors.push(`Warband ${i + 1}: ${(e as Error).message}`);
      }
    });
    return result;
  }
}

function wrap(warbands: Warband[]): string {
  return JSON.stringify({ format: FORMAT, version: 1, warbands }, null, 2);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run && npm run build`
Expected: all tests (rules and storage) PASS, and the build type-checks (Vitest does not type-check).

- [ ] **Step 7: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add warband library storage with validation and import/export

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Chunk 3: User interface

UI code is not unit-tested; it is covered by the Playwright smoke test in Task 12. Keep logic out of it: it only calls the engine and the library.

### Task 8: DOM helper, app shell and router

**Files:**
- Create: `src/ui/dom.ts`, `src/style.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/ui/dom.ts`**

```ts
type Child = Node | string | null | false | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

export function select<T extends string>(
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLSelectElement {
  const el = h('select', { onChange: () => onChange(el.value as T) });
  for (const o of options) el.append(h('option', { value: o.value }, o.label));
  el.value = value;
  return el;
}
```

- [ ] **Step 2: Replace `src/main.ts` with the router**

Views are added in Tasks 9 to 11; until then these imports do not exist, so create the three view files with a stub first.

Create `src/ui/library-view.ts`, `src/ui/editor-view.ts`, `src/ui/print-view.ts`, each containing the matching stub:

```ts
import type { Library } from '../storage/library';
export function renderLibrary(root: HTMLElement, _lib: Library): void {
  root.textContent = 'Library';
}
```
```ts
import type { Library } from '../storage/library';
export function renderEditor(root: HTMLElement, _lib: Library, _id: string): void {
  root.textContent = 'Editor';
}
```
```ts
import type { Library } from '../storage/library';
export function renderPrint(root: HTMLElement, _lib: Library, _id: string): void {
  root.textContent = 'Print';
}
```

`src/main.ts`:
```ts
import './style.css';
import { MemoryKV, browserKV } from './storage/kv';
import { Library } from './storage/library';
import { renderEditor } from './ui/editor-view';
import { renderLibrary } from './ui/library-view';
import { renderPrint } from './ui/print-view';
import { h } from './ui/dom';

const kv = browserKV();
const lib = new Library(kv ?? new MemoryKV());

const banner = document.querySelector<HTMLElement>('#banner')!;
if (!kv) {
  banner.append(
    h(
      'div',
      { class: 'banner-warning' },
      'Browser storage is unavailable, so changes will not be kept after you close or reload this page. Use Export to keep a copy.',
    ),
  );
}

const app = document.querySelector<HTMLElement>('#app')!;

function route() {
  app.replaceChildren();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'wb' && parts[1]) {
    if (parts[2] === 'print') renderPrint(app, lib, parts[1]);
    else renderEditor(app, lib, parts[1]);
  } else {
    renderLibrary(app, lib);
  }
}

window.addEventListener('hashchange', route);
route();
```

- [ ] **Step 3: Create `src/style.css`** (screen styles; print styles are added in Task 11)

```css
:root {
  --bg: #fafafa;
  --fg: #1c1c1c;
  --muted: #666;
  --card: #fff;
  --border: #d0d0d0;
  --accent: #2b5fd9;
  --warn: #b3261e;
  --info: #7a5a00;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17181a;
    --fg: #e8e8e8;
    --muted: #9a9a9a;
    --card: #222427;
    --border: #3a3d41;
    --accent: #7ea2ff;
    --warn: #ff8a80;
    --info: #e6c35c;
  }
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.4 system-ui, sans-serif;
}
#app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.banner-warning {
  background: var(--warn);
  color: #fff;
  padding: 8px 16px;
}
h1,
h2,
h3 {
  margin: 0.4em 0;
}
button,
select,
input {
  font: inherit;
  color: inherit;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
}
button {
  cursor: pointer;
}
button.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}
.toolbar .spacer {
  flex: 1;
}
.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  margin: 12px 0;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
}
.row label {
  display: flex;
  flex-direction: column;
  font-size: 0.85em;
  color: var(--muted);
  gap: 2px;
}
.row label.inline {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.warnings {
  margin: 6px 0 0;
  padding-left: 20px;
}
.warnings .warning {
  color: var(--warn);
}
.warnings .info {
  color: var(--info);
}
.total {
  font-weight: 600;
}
.total.over {
  color: var(--warn);
}
.checklist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 2px 12px;
  max-height: 14em;
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
}
.checklist label {
  display: flex;
  gap: 6px;
  font-size: 0.9em;
  color: var(--fg);
}
.checklist .cost {
  color: var(--muted);
}
.models {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 12px;
}
@media (max-width: 480px) {
  .models {
    grid-template-columns: 1fr;
  }
}
table.list {
  width: 100%;
  border-collapse: collapse;
}
table.list td,
table.list th {
  text-align: left;
  padding: 6px;
  border-bottom: 1px solid var(--border);
}
.muted {
  color: var(--muted);
}
td.actions button {
  margin: 0 4px 4px 0;
}
```

- [ ] **Step 4: Verify**

Run: `npm run format && npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add DOM helper, router and base styles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 9: Library view

**Files:**
- Modify: `src/ui/library-view.ts`

- [ ] **Step 1: Replace the stub**

```ts
import { newWarband } from '../model/factory';
import { warbandCost } from '../rules/engine';
import type { Library } from '../storage/library';
import { h } from './dom';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderLibrary(root: HTMLElement, lib: Library): void {
  const draw = () => {
    root.replaceChildren();
    const { warbands, errors } = lib.list();

    const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const result = lib.importText(await file.text());
      const lines = [`Imported ${result.imported} warband(s).`, ...result.errors];
      alert(lines.join('\n'));
      draw();
    });

    root.append(
      h('h1', {}, 'Space Weirdos warbands'),
      h(
        'div',
        { class: 'toolbar' },
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              const wb = newWarband();
              lib.save(wb);
              location.hash = `#/wb/${wb.id}`;
            },
          },
          'New warband',
        ),
        h('button', { onClick: () => fileInput.click() }, 'Import JSON'),
        h(
          'button',
          {
            disabled: warbands.length === 0,
            onClick: () => download('space-weirdos-warbands.json', lib.exportAll()),
          },
          'Export all',
        ),
        fileInput,
      ),
    );

    if (errors.length > 0) {
      root.append(
        h(
          'div',
          { class: 'panel' },
          h('strong', {}, 'Some saved warbands could not be read:'),
          h('ul', { class: 'warnings' }, ...errors.map((e) => h('li', { class: 'warning' }, e))),
        ),
      );
    }

    if (warbands.length === 0) {
      root.append(h('p', { class: 'muted' }, 'No warbands yet. Create one to get started.'));
      return;
    }

    const table = h('table', { class: 'list' });
    table.append(
      h('thead', {}, h('tr', {}, ...['Name', 'Points', 'Models', ''].map((t) => h('th', {}, t)))),
    );
    const body = h('tbody');
    for (const wb of warbands) {
      const total = warbandCost(wb);
      body.append(
        h(
          'tr',
          {},
          h('td', {}, h('a', { href: `#/wb/${wb.id}` }, wb.name || '(unnamed)')),
          h('td', { class: total > wb.target ? 'total over' : '' }, `${total} / ${wb.target}`),
          h('td', {}, String(wb.models.length)),
          h(
            'td',
            { class: 'actions' },
            h('button', { onClick: () => (location.hash = `#/wb/${wb.id}/print`) }, 'Print'),
            h(
              'button',
              {
                onClick: () => {
                  lib.duplicate(wb.id);
                  draw();
                },
              },
              'Duplicate',
            ),
            h(
              'button',
              {
                onClick: () => {
                  const name = prompt('Rename warband', wb.name);
                  if (name === null) return;
                  wb.name = name;
                  lib.save(wb);
                  draw();
                },
              },
              'Rename',
            ),
            h(
              'button',
              { onClick: () => download(`${wb.name || 'warband'}.json`, lib.exportOne(wb.id)!) },
              'Export',
            ),
            h(
              'button',
              {
                onClick: () => {
                  if (confirm(`Delete “${wb.name}”? This cannot be undone.`)) {
                    lib.remove(wb.id);
                    draw();
                  }
                },
              },
              'Delete',
            ),
          ),
        ),
      );
    }
    table.append(body);
    root.append(table);
  };
  draw();
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run build` (must succeed), then `npm run dev` and open the printed URL. Create two warbands, reload the page (both must still be listed), duplicate one, rename one, export all, delete one.

- [ ] **Step 3: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add warband library view

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 10: Editor view

Design notes:
- Text inputs update state without a redraw, so typing keeps focus. They save through a 250 ms debounce.
- Pickers that do not change the editor's structure (dice selects, equipment and power checklists) save immediately and only refresh totals and warnings, so scroll position and keyboard focus are kept.
- Only structural changes (leader or powerful toggle, expansion toggle, warband or leader trait, add or remove a model) save and redraw the whole editor.
- `flushEditor()` writes any pending debounced edit at once. It is called before every view change, and on `pagehide`, so navigating or closing the tab within 250 ms of an edit loses nothing and the next view never reads stale data.
- Limits and the "one model above 20 points" check use the undoubled model cost; the cost shown for a Hero/Villain leader is the doubled value that counts towards the warband total (`displayCost`).

**Files:**
- Modify: `src/ui/editor-view.ts`, `src/main.ts`

- [ ] **Step 1: Replace the stub `src/ui/editor-view.ts`**

```ts
import { newModel } from '../model/factory';
import type { ModelSpec, Warband } from '../model/types';
import { available, catalog, lookup } from '../rules/catalog';
import {
  adjustedCost,
  contextOf,
  displayCost,
  validateWarband,
  warbandCost,
  type Context,
  type Warning,
} from '../rules/engine';
import type { Item } from '../rules/types';
import type { Library } from '../storage/library';
import { h, select } from './dom';

const DICE = ['2d6', '2d8', '2d10'] as const;
const TARGET_PRESETS = [75, 125];

let flushCurrent: (() => void) | undefined;
let detachCurrent: (() => void) | undefined;

/** Write any pending debounced edit now. main.ts calls this before it changes view. */
export function flushEditor(): void {
  flushCurrent?.();
}

export function renderEditor(root: HTMLElement, lib: Library, id: string): void {
  detachCurrent?.();
  const wb = lib.get(id);
  if (!wb) {
    root.append(h('p', {}, 'Warband not found. '), h('a', { href: '#/' }, 'Back to the library'));
    return;
  }
  const state: Warband = wb;
  let saveTimer: number | undefined;
  let saveFailed = false;

  const doSave = () => {
    try {
      lib.save(state);
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
    refreshStatus();
  };
  /** Debounced save, for text inputs. */
  const save = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      doSave();
    }, 250);
  };
  const flush = () => {
    if (saveTimer === undefined) return;
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    doSave();
  };
  flushCurrent = flush;
  window.addEventListener('pagehide', flush);
  detachCurrent = () => {
    window.removeEventListener('pagehide', flush);
    flushCurrent = undefined;
  };

  /** A change that keeps the editor's structure: save now and refresh totals and warnings. */
  const touched = () => doSave();
  /** A structural change: save now and redraw everything. */
  const changed = () => {
    doSave();
    draw();
  };

  const warningsList = (ws: Warning[]) =>
    ws.map((w) => h('li', { class: w.level }, w.message));

  function refreshStatus() {
    const ctx = contextOf(state);
    const total = warbandCost(state);
    const all = validateWarband(state);
    const totalEl = root.querySelector<HTMLElement>('[data-total]');
    if (totalEl) {
      totalEl.textContent = `${total} / ${state.target} points`;
      totalEl.classList.toggle('over', total > state.target);
    }
    root
      .querySelector<HTMLElement>('[data-warband-warnings]')
      ?.replaceChildren(...warningsList(all.filter((w) => w.scope === 'warband')));
    for (const m of state.models) {
      const costEl = root.querySelector<HTMLElement>(`[data-cost="${m.id}"]`);
      if (costEl) costEl.textContent = `${displayCost(m, ctx)} pts`;
      root
        .querySelector<HTMLElement>(`[data-model-warnings="${m.id}"]`)
        ?.replaceChildren(...warningsList(all.filter((w) => w.scope === m.id)));
    }
    const saveEl = root.querySelector<HTMLElement>('[data-save-status]');
    if (saveEl) saveEl.textContent = saveFailed ? 'Could not save! Use Export to keep a copy.' : '';
  }

  /**
   * A list of tick boxes. Reads and writes the selection through get/set so that ticking
   * does not need a redraw. Selected items that are not in `items` (expansion switched off,
   * unknown ids) are still listed, so nothing is silently dropped.
   */
  function checklist(
    kind: 'ranged' | 'close' | 'equipment' | 'powers',
    items: Item[],
    get: () => string[],
    set: (next: string[]) => void,
    ctx: Context,
  ) {
    const costKind = ({ ranged: 'ranged', close: 'close', equipment: 'equipment', powers: 'power' } as const)[kind];
    const known = new Set(items.map((i) => i.id));
    const extra = get().filter((s) => !known.has(s));
    const rows = [
      ...items.map((i) => ({ item: i as Item | undefined, id: i.id })),
      ...extra.map((e) => ({ item: lookup(kind, e) as Item | undefined, id: e })),
    ];
    return h(
      'div',
      { class: 'checklist' },
      ...rows.map(({ item, id: itemId }) => {
        const box = h('input', { type: 'checkbox' });
        box.checked = get().includes(itemId);
        box.addEventListener('change', () => {
          const current = get();
          set(box.checked ? [...current, itemId] : current.filter((s) => s !== itemId));
        });
        const cost = item ? adjustedCost(item, costKind, ctx) : 0;
        return h(
          'label',
          { title: item?.notes ?? '' },
          box,
          h(
            'span',
            { class: 'item' },
            h('span', {}, item ? item.name : `Unknown (${itemId})`),
            item?.notes && h('small', { class: 'muted' }, item.notes),
          ),
          h('span', { class: 'cost' }, String(cost)),
        );
      }),
    );
  }

  /** Trait picker with the chosen trait's rules text shown underneath. */
  const traitPicker = (
    kind: 'leaderTraits' | 'warbandTraits',
    value: string | null,
    onChange: (v: string | null) => void,
  ) => {
    const shown = available(catalog[kind], state.expansion);
    const hiddenSelected = value !== null && !shown.some((t) => t.id === value);
    const known = value ? lookup(kind, value) : undefined;
    const options = [
      { value: '', label: '(none)' },
      ...shown.map((t) => ({ value: t.id, label: t.name })),
      ...(hiddenSelected
        ? [{ value: value!, label: known ? `${known.name} (expansion)` : `Unknown (${value})` }]
        : []),
    ];
    return h(
      'div',
      { class: 'trait' },
      select(options, value ?? '', (v) => onChange(v === '' ? null : v)),
      h('small', { class: 'muted' }, known?.effect ?? ''),
    );
  };

  const toggle = (label: string, checked: boolean, onToggle: (v: boolean) => void) => {
    const box = h('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', () => onToggle(box.checked));
    return h('label', { class: 'inline' }, box, label);
  };

  function modelPanel(m: ModelSpec, ctx: Context) {
    const dieSelect = <T extends string>(opts: readonly T[], value: T, set: (v: T) => void) =>
      select(
        opts.map((o) => ({ value: o, label: o })),
        value,
        (v) => {
          set(v);
          touched();
        },
      );
    const defOpts = (
      state.expansion || m.defense === '2d4' ? ['2d4', ...DICE] : [...DICE]
    ) as ModelSpec['defense'][];
    const fpOpts = [
      'none',
      ...(state.expansion || m.firepower === '2d6' ? ['2d6'] : []),
      '2d8',
      '2d10',
    ] as ModelSpec['firepower'][];
    const field = (label: string, el: Node) => h('label', {}, label, el);

    const nameInput = h('input', { value: m.name, 'aria-label': 'Model name' });
    nameInput.addEventListener('input', () => {
      m.name = nameInput.value;
      save();
    });

    return h(
      'div',
      { class: 'panel' },
      h(
        'div',
        { class: 'row' },
        field('Name', nameInput),
        h('span', { class: 'total', 'data-cost': m.id }, ''),
        toggle('Leader', m.isLeader, (v) => {
          m.isLeader = v;
          if (!v) m.leaderTrait = null;
          changed();
        }),
        state.expansion &&
          toggle('Powerful', m.powerful, (v) => {
            m.powerful = v;
            changed();
          }),
        h(
          'button',
          {
            onClick: () => {
              state.models = state.models.filter((x) => x !== m);
              changed();
            },
          },
          'Remove',
        ),
      ),
      m.isLeader &&
        h(
          'div',
          { class: 'row' },
          field(
            'Leader trait',
            traitPicker('leaderTraits', m.leaderTrait, (v) => {
              m.leaderTrait = v;
              changed();
            }),
          ),
        ),
      h(
        'div',
        { class: 'row' },
        field(
          'Speed',
          dieSelect(['1', '2', '3'] as const, String(m.speed) as '1', (v) => (m.speed = Number(v) as 1)),
        ),
        field('Defence', dieSelect(defOpts, m.defense, (v) => (m.defense = v))),
        field('Firepower', dieSelect(fpOpts, m.firepower, (v) => (m.firepower = v))),
        field('Prowess', dieSelect(DICE, m.prowess, (v) => (m.prowess = v))),
        field('Willpower', dieSelect(DICE, m.willpower, (v) => (m.willpower = v))),
      ),
      h('h3', {}, 'Ranged weapon'),
      checklist(
        'ranged',
        available(catalog.ranged, state.expansion),
        () => m.rangedWeapons,
        (n) => {
          m.rangedWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Close combat weapon'),
      checklist(
        'close',
        available(catalog.close, state.expansion),
        () => m.closeWeapons,
        (n) => {
          m.closeWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Equipment'),
      checklist(
        'equipment',
        available(catalog.equipment, state.expansion),
        () => m.equipment,
        (n) => {
          m.equipment = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Psychic powers'),
      checklist(
        'powers',
        available(catalog.powers, state.expansion),
        () => m.powers,
        (n) => {
          m.powers = n;
          touched();
        },
        ctx,
      ),
      h('ul', { class: 'warnings', 'data-model-warnings': m.id }),
    );
  }

  function draw() {
    root.replaceChildren();
    const ctx = contextOf(state);

    const nameInput = h('input', { value: state.name, 'aria-label': 'Warband name' });
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value;
      save();
    });
    const targetInput = h('input', {
      type: 'text',
      inputmode: 'numeric',
      list: 'targets',
      value: String(state.target),
      style: 'width:6em',
    });
    targetInput.addEventListener('input', () => {
      state.target = Number(targetInput.value) || 0;
      save();
      refreshStatus();
    });

    // The leader is shown first
    const ordered = [...state.models].sort((a, b) => Number(b.isLeader) - Number(a.isLeader));

    root.append(
      h(
        'div',
        { class: 'toolbar' },
        h('a', { href: '#/', onClick: flush }, '← Library'),
        h('span', { class: 'spacer' }),
        h('span', { class: 'warnings warning', 'data-save-status': true }),
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              flush();
              location.hash = `#/wb/${state.id}/print`;
            },
          },
          'Print',
        ),
      ),
      h(
        'div',
        { class: 'panel' },
        h(
          'div',
          { class: 'row' },
          h('label', {}, 'Warband name', nameInput),
          h('label', {}, 'Points target', targetInput),
          h('datalist', { id: 'targets' }, ...TARGET_PRESETS.map((n) => h('option', { value: String(n) }))),
          toggle('Include fan expansion', state.expansion, (v) => {
            state.expansion = v;
            changed();
          }),
          h(
            'label',
            {},
            'Warband trait',
            traitPicker('warbandTraits', state.warbandTrait, (v) => {
              state.warbandTrait = v;
              changed();
            }),
          ),
          h('span', { class: 'total', 'data-total': true }),
        ),
        h('ul', { class: 'warnings', 'data-warband-warnings': true }),
      ),
      h('div', { class: 'models' }, ...ordered.map((m) => modelPanel(m, ctx))),
      h(
        'div',
        { class: 'toolbar' },
        h(
          'button',
          {
            onClick: () => {
              state.models.push(newModel(false));
              changed();
            },
          },
          'Add model',
        ),
      ),
    );
    refreshStatus();
  }

  draw();
}
```

Note: the per-warband warnings list is an `ul` whose children are replaced in place, so `refreshStatus` never swaps the element itself.

- [ ] **Step 2: Flush pending edits and reset scroll when the view changes**

In `src/main.ts` add `import { flushEditor, renderEditor } from './ui/editor-view';` (replacing the existing editor import) and change `route()` to start with:

```ts
function route() {
  flushEditor(); // write any debounced edit before the next view reads storage
  app.replaceChildren();
  window.scrollTo(0, 0);
  // ... rest unchanged
```

- [ ] **Step 3: Add the supporting styles to `src/style.css`**

```css
.checklist .item {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.checklist .item small {
  font-size: 0.8em;
}
.trait {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 28em;
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run build` (must succeed), then `npm run dev`:
- Create a warband; add models; change attributes; costs and warnings update live. The leader is always listed first.
- Type in a name field: focus is not lost. Click "← Library" or Print immediately after typing: the new name is there.
- Tick an item far down a long list: the list does not jump back to the top. Arrow through a Speed select with the keyboard: it keeps focus.
- Reload: everything is still there.
- Turn on the expansion: expansion items and traits appear, with their rules text shown. Turn it off with an expansion item or trait selected: it stays selected (the trait is labelled "(expansion)") and a warning appears.
- Over-limit choices (for example two equipment on a non-leader) are allowed and flagged.
- Points target: typing 75 or 125 or any other number works, with 75 and 125 offered as suggestions.
- Give the leader the Hero/Villain trait with the expansion on: the leader's cost shown is doubled and matches the warband total.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add warband editor view with live costs and warnings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 11: Print view

**Files:**
- Modify: `src/ui/print-view.ts`, `src/style.css`

- [ ] **Step 1: Replace the stub `src/ui/print-view.ts`**

Layout rules: pages hold 8 cards; the first card is the warband summary card; cards are exactly 3.5 x 2.5 in; overflowing text shrinks down to a minimum and is flagged if it still does not fit.

```ts
import type { ModelSpec, Warband } from '../model/types';
import { lookup } from '../rules/catalog';
import { contextOf, displayCost, displayStats, warbandCost } from '../rules/engine';
import type { Library } from '../storage/library';
import { h } from './dom';

const MIN_FONT_PX = 8;

const nameOf = (kind: Parameters<typeof lookup>[0], id: string) => lookup(kind, id)?.name ?? `Unknown (${id})`;

function line(label: string, text: string) {
  return h('div', { class: 'line' }, h('b', {}, `${label}: `), text);
}

function unitCard(m: ModelSpec, wb: Warband) {
  const ctx = contextOf(wb);
  const s = displayStats(m);
  const ranged = m.rangedWeapons.map((id) => {
    const w = lookup('ranged', id);
    return w ? `${w.name} (max ${w.maxShoot}${w.notes ? `; ${w.notes}` : ''})` : nameOf('ranged', id);
  });
  const close = m.closeWeapons.map((id) => {
    const w = lookup('close', id);
    return w ? `${w.name} (max ${w.maxFight}${w.notes ? `; ${w.notes}` : ''})` : nameOf('close', id);
  });
  const equip = m.equipment.map((id) => {
    const e = lookup('equipment', id);
    return e ? `${e.name} (${e.type})${e.notes ? `: ${e.notes}` : ''}` : nameOf('equipment', id);
  });
  const powers = m.powers.map((id) => {
    const p = lookup('powers', id);
    return p ? `${p.name} (${p.type})${p.notes ? `: ${p.notes}` : ''}` : nameOf('powers', id);
  });
  const trait = m.leaderTrait ? nameOf('leaderTraits', m.leaderTrait) : '';

  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card-body' },
      h(
        'div',
        { class: 'card-head' },
        h('b', {}, m.name || 'Unnamed'),
        m.isLeader && h('span', { class: 'tag' }, trait ? `Leader · ${trait}` : 'Leader'),
        m.powerful && h('span', { class: 'tag' }, 'Powerful'),
        h('span', { class: 'pts' }, `${displayCost(m, ctx)} pts`),
      ),
      h(
        'div',
        { class: 'stats' },
        ...(
          [
            ['Spd', s.spd],
            ['Def', s.def],
            ['FP', s.fp],
            ['Prw', s.prw],
            ['Will', s.will],
          ] as const
        ).map(([k, v]) => h('div', {}, h('small', {}, k), h('b', {}, v))),
      ),
      ranged.length > 0 && line('Ranged', ranged.join('; ')),
      close.length > 0 && line('Close', close.join('; ')),
      equip.length > 0 && line('Equipment', equip.join('; ')),
      powers.length > 0 && line('Powers', powers.join('; ')),
    ),
  );
}

function summaryCard(wb: Warband) {
  const trait = wb.warbandTrait ? lookup('warbandTraits', wb.warbandTrait) : undefined;
  const leader = wb.models.find((m) => m.isLeader);
  const leaderTrait = leader?.leaderTrait ? lookup('leaderTraits', leader.leaderTrait) : undefined;
  return h(
    'div',
    { class: 'card summary' },
    h(
      'div',
      { class: 'card-body' },
      h(
        'div',
        { class: 'card-head' },
        h('b', {}, wb.name || 'Unnamed warband'),
        h('span', { class: 'pts' }, `${warbandCost(wb)} / ${wb.target} pts`),
      ),
      trait ? line(`Warband trait: ${trait.name}`, trait.effect) : line('Warband trait', 'none'),
      leaderTrait && line(`Leader trait: ${leaderTrait.name}`, leaderTrait.effect),
      line('Models', String(wb.models.length)),
    ),
  );
}

/** Shrink text in any card whose content overflows, down to a floor; flag it if still too big. */
export function fitCards(root: HTMLElement) {
  for (const card of root.querySelectorAll<HTMLElement>('.card')) {
    const body = card.querySelector<HTMLElement>('.card-body')!;
    body.style.fontSize = '';
    let size = parseFloat(getComputedStyle(body).fontSize);
    while (body.scrollHeight > card.clientHeight && size > MIN_FONT_PX) {
      size -= 0.5;
      body.style.fontSize = `${size}px`;
    }
    card.classList.toggle('overflow', body.scrollHeight > card.clientHeight);
  }
}

let detachCurrent: (() => void) | undefined;

export function renderPrint(root: HTMLElement, lib: Library, id: string): void {
  detachCurrent?.(); // drop the previous print view's beforeprint listener
  const wb = lib.get(id);
  if (!wb) {
    root.append(h('p', {}, 'Warband not found. '), h('a', { href: '#/' }, 'Back to the library'));
    return;
  }
  // The leader's card comes first, as in the editor
  const ordered = [...wb.models].sort((a, b) => Number(b.isLeader) - Number(a.isLeader));
  const cards = [summaryCard(wb), ...ordered.map((m) => unitCard(m, wb))];
  const pages: HTMLElement[] = [];
  for (let i = 0; i < cards.length; i += 8) {
    pages.push(h('div', { class: 'sheet' }, ...cards.slice(i, i + 8)));
  }

  const status = h('span', { class: 'warnings warning', 'data-overflow': true });
  root.append(
    h(
      'div',
      { class: 'toolbar no-print' },
      h('a', { href: `#/wb/${wb.id}` }, '← Back to editor'),
      h('span', { class: 'spacer' }),
      status,
      h('button', { class: 'primary', onClick: () => window.print() }, 'Print'),
    ),
    h('p', { class: 'muted no-print' }, 'Cards print 8 to a page (2 × 4) in portrait, 3.5 × 2.5 in each. Set scale to 100% in the print dialogue.'),
    h('div', { class: 'sheets' }, ...pages),
  );

  const refit = () => {
    fitCards(root);
    const n = root.querySelectorAll('.card.overflow').length;
    status.textContent = n > 0 ? `${n} card(s) have more text than fits.` : '';
  };
  refit();
  window.addEventListener('beforeprint', refit);
  detachCurrent = () => window.removeEventListener('beforeprint', refit);
}
```

- [ ] **Step 2: Append print styles to `src/style.css`**

```css
/* ---- Print view ---- */
.sheets {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-items: safe center; /* on a narrow screen, scroll rather than clip the left edge */
  gap: 16px;
  overflow-x: auto;
}
.sheet {
  display: grid;
  grid-template-columns: repeat(2, 3.5in);
  grid-template-rows: repeat(4, 2.5in);
  width: 7in;
  height: 10in;
  background: #fff;
  color: #000;
}
.card {
  width: 3.5in;
  height: 2.5in;
  border: 0.5px dashed #888;
  overflow: hidden;
  background: #fff;
  color: #000;
}
.card.overflow {
  outline: 2px solid #c00;
}
.card-body {
  padding: 0.08in 0.1in;
  font-size: 10px;
  line-height: 1.25;
}
.card-head {
  display: flex;
  gap: 6px;
  align-items: baseline;
  border-bottom: 1px solid #000;
  margin-bottom: 4px;
  font-size: 1.3em;
}
.card-head .pts {
  margin-left: auto;
}
.card-head .tag {
  font-size: 0.65em;
  text-transform: uppercase;
  border: 1px solid #000;
  padding: 0 3px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  text-align: center;
  margin-bottom: 4px;
}
.stats small {
  display: block;
  font-size: 0.75em;
}
.card .line {
  margin: 2px 0;
}

@page {
  size: portrait;
  margin: 0.4in;
}
@media print {
  body {
    background: #fff;
  }
  #app {
    padding: 0;
    max-width: none;
  }
  .no-print,
  #banner {
    display: none !important;
  }
  .sheets {
    display: block;
  }
  .sheet {
    margin: 0 auto;
    break-after: page;
    break-inside: avoid;
  }
  .sheet:last-child {
    break-after: auto;
  }
  .card {
    outline: none !important;
  }
}
```

Note: the margin is 0.4 in rather than 0.5 in so a Letter page (11 in tall) has a little slack over the 10 in sheet; with exactly 1 in of margins, rounding could push each sheet onto an extra blank page. Letter's printable area is then 7.7 × 10.2 in and A4's about 7.5 × 10.9 in, both larger than the 7 × 10 in sheet.

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open a warband with 10 models and use the browser's print preview (Ctrl+P):
- The preview is portrait, with eight equal-size cards per page and the summary card first.
- Compare Letter and A4 in the paper size dropdown: the 7×10 in grid fits both with no clipping.
- A model with many items shrinks its text rather than growing its card; a deliberately overloaded card is outlined in red on screen (the outline does not print).
- The warband trait appears only on the summary card.

- [ ] **Step 4: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add print view with fixed-size portrait cards

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Chunk 4: End-to-end test and documentation

### Task 12: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

- [ ] **Step 1: Install the browser**

Run: `npx playwright install chromium`
Expected: Chromium downloads. If a later run cannot launch the browser on a fresh Linux machine, use `npx playwright install --with-deps chromium` instead (it needs sudo for the system libraries).

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5199' },
});
```

- [ ] **Step 3: Create `e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('a warband survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.getByLabel('Warband name').fill('Persistent Weirdos');
  await page.getByLabel('Model name').first().fill('Big Boss');
  // Autosave is debounced; wait until the edit has reached local storage before reloading
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .map((k) => localStorage.getItem(k))
          .join(''),
      ),
    )
    .toContain('Big Boss');
  await page.reload();
  await expect(page.getByLabel('Warband name')).toHaveValue('Persistent Weirdos');
  await expect(page.getByLabel('Model name').first()).toHaveValue('Big Boss');
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Persistent Weirdos' })).toBeVisible();
});

test('print view gives equal-sized cards, eight to a page, in portrait', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  // Leader plus 9 more models = 10 models, so summary + 10 cards = 11 cards on 2 pages
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Add model' }).click();
  // Give one model a lot of content so card sizes would differ if they depended on it
  await page.getByLabel('Model name').nth(1).fill('A model with an extremely long name that goes on and on');
  // The editor's Print button flushes any pending autosave before it navigates
  await page.getByRole('button', { name: 'Print' }).click();
  await page.emulateMedia({ media: 'print' });

  const cards = page.locator('.card');
  await expect(cards).toHaveCount(11);
  const boxes = await cards.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    }),
  );
  for (const [w, h] of boxes) {
    expect(w).toBe(336); // 3.5 in at 96 dpi
    expect(h).toBe(240); // 2.5 in at 96 dpi
  }
  await expect(page.locator('.sheet')).toHaveCount(2);
  await expect(page.locator('.sheet').nth(0).locator('.card')).toHaveCount(8);
  await expect(page.locator('.sheet').nth(1).locator('.card')).toHaveCount(3);

  const pdf = await page.pdf({ preferCSSPageSize: false, format: 'Letter' });
  expect(pdf.byteLength).toBeGreaterThan(1000);
});
```

- [ ] **Step 4: Run**

Run: `npm run e2e`
Expected: both tests PASS. If the card-size assertion fails by 1 px, check for borders affecting `box-sizing`; the `*{box-sizing:border-box}` rule in `style.css` should keep them at 336×240.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "test: add Playwright smoke tests for persistence and print layout

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 13: README and final checks

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-10-05-space-weirdos-builder-design.md` (only if the implementation diverged)

- [ ] **Step 1: Create `README.md`**

```markdown
# Space Weirdos Builder

A warband builder for [Space Weirdos](https://www.drivethrurpg.com/) (core rules plus the "Weird Millennium" fan expansion). It is an unofficial fan tool and is not affiliated with the game's author.

## Features

- Autosaves a library of warbands in your browser (local storage). JSON export and import are available as a backup.
- Warns about rule problems (over-limit models, too much equipment, over the points target) but never blocks a choice.
- The fan expansion is switched on or off per warband.
- Prints portrait unit cards: 3.5 × 2.5 in, eight to a page, the same size whatever their content, on US Letter or A4. The first card summarises the warband and its trait.

## Development

    npm install
    npm run dev          # local dev server
    npm test             # unit tests (rules, storage)
    npm run e2e          # Playwright smoke tests (run `npx playwright install chromium` once)
    npm run format       # Prettier
    npm run build        # type-check and build to dist/

## Hosting

`npm run build` produces static files in `dist/`; host them anywhere. The build uses relative paths, so it works under a sub-path. Browsers block module scripts on `file://` pages, so serve the folder (for example `npx vite preview`) rather than double-clicking `index.html`.

Warbands are stored per browser and per site address; they do not sync between devices. Use Export and Import to move them.

## Rules data

The tables are in `src/rules/data/` (`core.ts` and `expansion.ts`), transcribed from the rules PDFs with page references. `src/rules/examples.test.ts` checks the engine against the example warbands in both PDFs. Twelve example costs printed in the PDFs (Astral and Vampire in the core rules, ten in the expansion) disagree with the cost tables; the tests record both numbers.
```

- [ ] **Step 2: Run the full check**

Run: `npm run format:check && npm test && npm run build && npm run e2e`
Expected: every command succeeds. Report any failure rather than working around it.

- [ ] **Step 3: Update the spec if reality diverged**

Compare the spec's "Decisions" and "Architecture" sections with what was built (for example: `.gitignore` entries, the weapon-checklist UI, `Library` API). Edit the spec to match anything that changed.

- [ ] **Step 4: Commit and finish**

```bash
git add -A
git commit -m "docs: add README and final checks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Then use superpowers:finishing-a-development-branch to decide how to integrate `feature/builder`.

---

## Deferred (not in this plan)

- One-page quick reference sheet (Under Fire and Under Attack tables) as an optional print extra. Listed as optional in the spec; add as a follow-up if wanted.
- Rules checks that need more modelling: Comms Unit "one per warband", Laser Sword requiring a Powered weapon, Space Monk Robes requiring a Laser Sword, Gunfighters' effect on Max Shoot Actions, and Imperial Numbers adding a free Trooper. For now the trait and item text is displayed and the player applies it.
