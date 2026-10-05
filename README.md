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
