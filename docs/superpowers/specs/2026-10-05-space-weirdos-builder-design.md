# Space Weirdos Warband Builder: Design

Date: 2026-10-05

## Purpose

A standalone web app for building warbands for Space Weirdos (core rules plus the "Weird Millennium" fan expansion). It replaces an existing online builder (spaceweirdo.netlify.app) whose author cannot be contacted, and fixes two flaws in it:

1. **Printing:** unit cards print at sizes that depend on their content, and only in landscape.
2. **Persistence:** warbands are lost on reload; the only way to keep them is manual JSON export and import.

## Decisions

| Topic | Decision |
|---|---|
| Rules scope | Core rules plus fan expansion; expansion content switchable per warband |
| Print | Portrait, 2×4 grid of fixed 3.5×2.5 in (89×64 mm) cards; fits both US Letter and A4 |
| Persistence | Library of warbands in browser `localStorage`, autosaved; JSON export and import kept as backup |
| Rule enforcement | Warn but allow; nothing is blocked |
| Stack | TypeScript, Vite, no UI framework, Vitest, Prettier; static build output |

Out of scope: the hobby warband tokens PDF, accounts or server-side sync, file-system sync, scenario and campaign tooling.

## Architecture

```
src/
  rules/
    data/core.ts        core tables (costs, weapons, equipment, powers, traits)
    data/expansion.ts   expansion tables
    engine.ts           pure functions: costs, trait effects, warnings
  model/                warband and model types, schemaVersion
  storage/              library, autosave, export/import, migrations
  ui/                   library, editor, print view
```

- Data entries carry a `source` (`core` or `expansion`) and a page reference.
- `engine.ts` has no DOM dependency. The UI never computes costs itself.
- Editor state is a single warband object. Each edit recomputes cost and warnings through the engine, saves (debounced), then re-renders.

### Rules covered by the engine

- Attribute costs: Speed 1/2/3 = 0/1/3; Defence 2d6/2d8/2d10 = 2/4/8; Firepower none/2d8/2d10 = 0/2/4; Prowess and Willpower 2d6/2d8/2d10 = 2/4/6.
- Weapons, equipment and psychic powers from the tables.
- Limits: one model up to 25 points, others up to 20. Leader may take 2 pieces of equipment, others 1. Any number of powers.
- Warband traits that alter cost or slots: Heavily Armed (ranged weapons 1 cheaper), Mutants (Speed, Claws & Teeth, Horrible Claws & Teeth and Whip/Tail 1 cheaper), Soldiers (Grenades, Heavy Armor and Medkits free but still use slots), Cyborgs (one extra equipment slot).
- Expansion effects: Elites (+5 to the per-model cap), Hero/Villain (leader cost doubled), Powerful Model (one non-leader up to 30 points), 2d6 Firepower (1 point), 2d4 Defence (-1 point), Heavily Equipped (+1 point per extra item).

Where the PDFs are ambiguous, the ambiguity is flagged to the user rather than guessed.

### Expansion toggle

A per-warband switch. Expansion options appear in the pickers only when it is on. Turning it off for a warband that already uses expansion items keeps the items and flags them as warnings; nothing is deleted.

### Warnings

The engine returns a list of warnings, for example "model costs 22, limit 20", "3 equipment, max 1", "warband is over its points target". The UI shows them in red but never prevents a choice.

## User interface

Hash-routed screens, no server needed.

- **Library:** list of saved warbands (name, points, model count). New, duplicate, rename, delete, import JSON, export one or all.
- **Editor:** header with warband name, points target (75, 125 or custom), expansion toggle, warband trait, running total and warnings. Below, a list of model editors with the leader first.
- **Model editor:** name, leader flag, leader trait; pickers for Spd, Def, Fp, Prw, Will; ranged weapon; close combat weapon; equipment; psychic powers. Live cost and warnings. Picker rows show cost and notes, with full rule text on hover or tap. Defence modifiers such as Heavy Armor's +1 are shown as in the example warbands.
- **Print:** a print preview page, also printable directly.

Single column on phones, two columns on wide screens. Follows system dark mode on screen; always prints black on white.

### Print layout

- `@page` is portrait; paper size is left to the browser default.
- A 2×4 grid of fixed 3.5×2.5 in cards (7×10 in in total), so every card is the same size whatever its content. Text shrinks to a minimum size; a card that still overflows is flagged on screen before printing.
- Card content: name, cost, the five attributes, weapons with notes, equipment, psychic powers. No token boxes.
- The first card is a warband summary card: name, warband trait (shown once only), points total and leader trait. Unit cards follow.
- Optional extra: a one-page quick reference (Under Fire and Under Attack tables).

## Storage

- One `localStorage` key per warband (prefix `weirdos:wb:`), so one corrupt entry cannot take down the library. There is no separate index of ids: the library lists warbands by scanning for the prefix, which cannot get out of step with the entries.
- Each record carries a `schemaVersion`, with a migration function.
- If `localStorage` is unavailable or full, a visible banner says changes will not be kept and offers an export.
- Import validates the JSON and reports problems clearly. It accepts a single warband or a whole library; an imported warband whose id or name matches an existing one gets a "(copy)" suffix (and a new id if the id clashed).
- Unknown item ids (for example from a future version) are kept and flagged, not dropped.

## Testing

- **Engine unit tests:** each trait's cost effect and every warning rule. The example warbands in both PDFs (for example X-Terminators and Razor Girls) must reproduce their published point costs, which also checks the transcribed data.
- **Storage tests:** round-trip, migration, corrupt entries, import validation.
- **Playwright smoke test:** build a warband, reload and confirm it persists; confirm the print view gives eight equal-sized cards per page.
- Prettier enforces code style via a separate `npm run format:check` step, run alongside the tests and build before each merge.

## Open points

- The example warband stat lines show Firepower as "Fn/a" for models with no ranged weapon; the card should show "none" or "n/a" consistently.
- Twelve published example costs do not match the cost tables (Astral and Vampire in the core rules; Darn Father, Darn Sillious, Imperial Scout, Big Pappa, Karl, Dwarf Trooper, Dwarf Demolisher, Bezerker, Little Bugs and Tech Daddy in the expansion). They are recorded in the example tests with both numbers rather than silently adjusted. The other 45 or so examples agree exactly.
- Hero/Villain doubles the leader's cost towards the warband total, but the 25-point (or 20 or 30) model limits are checked on the undoubled cost. The rules do not say which is intended.
