# Space Weirdos Builder

A warband builder for [Space Weirdos](https://caseyg.itch.io/space-weirdos), the skirmish wargame by Casey Garske, with optional support for the community "Weird Millennium" fan expansion.

Build a warband, see its cost and any rule problems as you go, keep a library of warbands in your browser, and print unit cards for the table.

This is an unofficial fan tool. It is not affiliated with or endorsed by the game's author. It does not contain the rulebook: you need the game to play it, so please get it from the link above.

## Features

- **A library of warbands** that autosaves in your browser, so a reload never loses your work. You can create, duplicate, rename and delete warbands, and export and import them as JSON files as a backup or to move them between browsers.
- **Core rules plus the fan expansion.** The expansion is switched on or off per warband, and its options only appear when it is on.
- **Costs and rule checks as you build.** Attribute, weapon, equipment and psychic power costs, warband and leader traits that change costs (Heavily Armed, Mutants, Soldiers, Cyborgs, Elites, Hero/Villain and so on), per-model and per-warband limits, and your points target. Problems are shown as warnings but never block a choice, so house rules, campaigns and the expansion's "Heavily Equipped" option all work.
- **Read-only model cards.** Each model is shown as a card with its stats, weapons, equipment and powers. Press Edit to change it, and Save to go back to the card. Changes are saved as you make them.
- **Drop-down pickers.** Weapons, equipment and powers are chosen from drop-downs that list names only. Each chosen item shows its cost, actions and rule text underneath, and a "+" button adds the next one.
- **Printable unit cards.** Portrait pages with eight cards each in a 2 × 4 grid. Every card is exactly 3.5 × 2.5 in (89 × 64 mm) whatever its content, so the sheet fits both US Letter and A4. Text shrinks to fit, and a card with more text than will fit is flagged on screen before you print. The first card summarises the warband and its trait, so the trait appears once rather than on every card.

## Using it

1. Open the library and press **New warband**.
2. Set the warband's name, points target (75 and 125 are the standard sizes) and trait, and switch on the fan expansion if you want it.
3. Fill in the leader and add models. A new or untouched model opens in edit mode; press **Save** when you are done with it.
4. Press **Print** to open the card preview, then **Print** again to print it. In the browser's print dialogue choose portrait and **100% scale** (not "fit to page") so the cards print at their true size.

## Getting started

You need Node 22. The repository pins it with [mise](https://mise.jdx.dev/) (`mise.toml`); run `mise install` if you use mise. In a shell that has not picked up the pin, prefix commands with `mise exec --`.

```sh
npm install
npm run dev          # local development server
npm test             # unit tests (rules, storage, model helpers)
npm run e2e          # end-to-end tests with Playwright (run `npx playwright install chromium` once)
npm run format       # Prettier
npm run format:check # check formatting without changing files
npm run build        # type-check and build to dist/
```

Before merging a change, `npm run format:check`, `npm test`, `npm run build` and `npm run e2e` should all pass.

## Hosting

`npm run build` produces static files in `dist/`. Host them on any static web server. The build uses relative paths, so it also works under a sub-path.

Browsers block module scripts on `file://` pages, so serve the folder (for example with `npm run preview`) rather than double-clicking `index.html`.

Warbands are stored in the browser, per site address. They do not sync between devices or browsers; use Export and Import to move them. If browser storage is unavailable or full, the app says so and offers Export as the way to keep your work.

## How it is organised

```
src/
  rules/     the rules: data tables (data/core.ts, data/expansion.ts), the catalogue,
             and the engine that works out costs, displayed stats and warnings
  model/     warband and model types, and helpers for creating them
  storage/   the warband library, validation and migration of saved data, JSON import and export
  ui/        the library, editor and print views (plain TypeScript, no UI framework)
e2e/         end-to-end tests
docs/        the design document and implementation plan
```

The rules engine has no dependency on the browser, and the interface never works out costs itself: it only displays what the engine returns.

## Rules data

The item tables are transcribed from the core rules and the fan expansion, with page references. They are checked against the example warbands printed in both PDFs: `src/rules/examples.test.ts` rebuilds roughly 55 example models and expects each to cost what the cost tables say.

Twelve of those printed costs disagree with the cost tables. Astral and Vampire in the core rules, and Darn Father, Darn Sillious, Imperial Scout, Big Pappa, Karl, Dwarf Trooper, Dwarf Demolisher, Bezerker, Little Bugs and Tech Daddy in the expansion. The tests record both numbers rather than hiding the difference. They look like errors in the examples, but if you spot a mistake in the tables themselves, please say so.

Where the rules are unclear the builder takes the simplest reading and warns rather than blocks. For example, a Hero/Villain leader counts double towards the warband total, but the per-model point limits are checked on the undoubled cost.

## Known limitations

- Two browser tabs editing the same warband overwrite each other: the last save wins.
- A few rules are shown as text but not checked: one Comms Unit per warband, the Laser Sword and Space Monk Master Robes prerequisites, the Gunfighters trait's change to Heavy Pistols and Heavy Rifles, and Imperial Numbers' extra Trooper.
- There is no one-page quick-reference sheet yet.
- A saved warband that cannot be read (for example one saved by a newer version) is reported in the library but cannot be deleted from the interface.

## Licence

No licence has been chosen for this code yet. The rules, names and text of Space Weirdos and its fan expansion belong to their authors.
