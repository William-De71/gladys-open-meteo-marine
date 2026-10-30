# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the marine weather of
Open-Meteo: a Node.js service (Node 22+, ESM, no build step) that runs in its
own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. Every 15 or 30 minutes it asks, for each of up to
five spots, the Marine Weather API (`https://marine-api.open-meteo.com/v1/marine`)
and the Forecast API (`https://api.open-meteo.com/v1/forecast`, the wind), no
key, keeps the 7-day forecasts in `/data`, and works out the Beaufort force and
the Douglas sea state. Transport: cloud only. "Weather data by Open-Meteo.com"
(CC BY 4.0) must stay visible (widgets, configuration, docs), and so must the
warning that these model data are not fit for the safety of navigation.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer,
                        the reading round, retries, the scene action
src/open-meteo.js       client of the two APIs (queries, user agent, one
                        request at a time, error kinds)
src/marine.js           the answers read into one forecast; Douglas, Beaufort,
                        the anti-flapping margin; conditions at an instant
src/spots.js            "latitude, longitude" parsing, the eternal spot key
src/time.js             reading pace, stable jitter
src/store.js            /data/open-meteo-marine.json: forecasts, inland spots,
                        `seen`
src/events.js           trigger transitions, payloads, scene action outputs
src/device.js           one device per spot, its states
src/widgets.js          conditions, forecast chart and seven-day widgets
src/config.js           configuration (five spots, interval, wind unit, language)
src/i18n.js             runtime texts and scale names, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real Open-Meteo answers, byte for byte (Quiberon,
                        Marseille, Lyon inland: all null)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`spot:<key>`, the key coming from the coordinates
  rounded to two decimals, `n4745_w320`, never from the name; feature keys in
  `FEATURES` of `src/device.js`), feature `category` / `type` / `unit` /
  `min` / `max` / `step`, the keys of `config_schema` (`spot_1..5_name`,
  `spot_1..5_coordinates`, `interval`, `wind_unit`, `language`), `actions`,
  the widgets and their settings, the scene triggers (fields, options,
  variables) and the scene action (fields, outputs).
  `test/structure.test.js` compares them to a baseline: never update the
  baseline to make a test pass without a documented migration.
- **Category / type pairs** come from the SDK constants and the pairs the
  front knows: heights `distance-sensor/decimal` m; periods
  `duration/decimal` s; directions `angle-sensor/integer` degrees (where it
  comes from); water `temperature-sensor/probe` °C (kept out of the room
  average); current and wind `speed-sensor/decimal` km/h (Gladys has no knot
  unit: knots only in widgets and texts); sea level `level-sensor/decimal` m,
  signed; Beaufort `speed-sensor/integer` and Douglas `level-sensor/decimal`
  without unit. No state for a null value.
- **Coordinates are text fields**: a `number` field cannot take a decimal in
  every core version. A point inland gets null everywhere: refuse it
  (`failures` in /data), never offer its device.
- **Be gentle with Open-Meteo** (free tier: non-commercial, < 10,000 calls a
  day, 600 a minute, per IP). Two requests per spot and reading, one at a
  time, a user agent naming the project, 15 or 30 minutes plus a stable
  jitter, at least an hour after a 429, back-off on other errors. Never add a
  request per widget, per scene action or per tick: they read the kept
  forecast. `wave_peak_period` is always null: do not ask for it.
- **The format can change.** When the reader breaks, record the new answer in
  `test/fixtures/` first (byte for byte: excluded from Prettier and from
  line-ending normalization), then fix `src/marine.js`.
- **Events once.** `seen` (in /data) remembers per spot the sea state, the
  Beaufort force and the strong wind already announced; the first reading of a
  spot is a baseline; a value within 5 % of a bound keeps its level. A scene
  action or a widget never fires an event.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages and
  scale names in `src/i18n.js`, `docs/*.md`, README) exists in English,
  French, German and Spanish. `test/i18n.test.js` checks it. The scale names
  follow the marine forecasts of each language (peu agitée, leicht bewegt,
  marejada; grand frais, steifer Wind, frescachón).
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files. A card
  list in `list` display holds 8 items; a chart holds 4 series.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB; at most 20 scene action outputs. No `countries` (the seas of the
  whole world). No permission is declared. Transport: `["cloud"]`.
  `gladys_version` `>=5.3.0`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (a fake `fetch` at most).
