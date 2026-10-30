// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The widgets of a spot off Quiberon (Brittany) on 30 October 2026: the
// answers are real ones (test/fixtures/quiberon.*.json, recorded from
// Open-Meteo that morning), read by the real reader (src/marine.js) at a
// fixed "now", and drawn by the real widget builders (src/widgets.js), with
// the wind in knots (the default).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildConditionsWidget, buildForecastWidget, buildDailyWidget } =
  await load('src/widgets.js');
const { parseForecast, conditionsAt } = await load('src/marine.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));
const answer = (name) => JSON.parse(readFileSync(`${repo}/test/fixtures/${name}.json`, 'utf8'));

// Friday 30 October 2026, 08:50 in Paris: five minutes after the current block.
const NOW = Date.parse('2026-10-30T07:50:00Z');
const TZ = 'Europe/Paris';
const forecast = parseForecast(answer('quiberon.marine'), answer('quiberon.wind'), NOW);
const spot = { key: 'n4745_w320', name: 'Quiberon', latitude: 47.45, longitude: -3.2 };
const common = { spot, now: NOW, windUnit: 'kn', timeZone: TZ };

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    conditions: buildConditionsWidget({
      ...common,
      conditions: conditionsAt(forecast, NOW),
      updatedAt: forecast.fetchedAt,
      language,
    }),
    forecast: buildForecastWidget({ ...common, forecast, variable: 'waves', hours: 72, language }),
    daily: buildDailyWidget({ ...common, forecast, language }),
    forecast_wind: buildForecastWidget({
      ...common,
      forecast,
      variable: 'wind',
      hours: 72,
      language,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
