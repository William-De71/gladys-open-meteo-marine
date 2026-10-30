// The dashboard widgets: every content passes the validator of the SDK (what
// the core would drop), within the card budget, in the four languages, for
// the Atlantic and the Mediterranean, and every wind unit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  WIDGETS,
  TTL,
  clip,
  messageContent,
  seaStateColor,
  beaufortColor,
  buildConditionsWidget,
  buildForecastWidget,
  buildDailyWidget,
  readWidgetSettings,
} from '../src/widgets.js';
import { parseForecast, conditionsAt } from '../src/marine.js';
import { LANGUAGES } from '../src/i18n.js';
import { NOW, TZ, SPOTS, fixture } from './helpers/fixtures.js';

const forecastOf = (place) =>
  parseForecast(fixture(`${place}.marine`), fixture(`${place}.wind`), NOW);

/**
 * @description The three widgets of a spot.
 * @param {string} place - `quiberon` or `marseille`.
 * @param {string} language - The language.
 * @param {object} [options] - `{ windUnit, variable, hours }`.
 * @returns {object[]} The contents.
 */
function contents(place, language, { windUnit = 'kn', variable = 'waves', hours = 48 } = {}) {
  const forecast = forecastOf(place);
  const spot = SPOTS[place];
  return [
    buildConditionsWidget({
      spot,
      conditions: conditionsAt(forecast, NOW),
      updatedAt: forecast.fetchedAt,
      language,
      windUnit,
      timeZone: TZ,
    }),
    buildForecastWidget({
      spot,
      forecast,
      now: NOW,
      variable,
      hours,
      language,
      windUnit,
      timeZone: TZ,
    }),
    buildDailyWidget({ spot, forecast, now: NOW, language, windUnit, timeZone: TZ }),
  ];
}

/**
 * @description Check a content: valid for the core, within the card budget.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  const report = validateWidgetContent(content);
  assert.deepEqual(report, [], `${label}: ${JSON.stringify(report)}`);
  const count = (types) => content.components.filter((c) => types.includes(c.type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
}

test('the keys of the widgets', () => {
  assert.deepEqual(WIDGETS, { CONDITIONS: 'conditions', FORECAST: 'forecast', DAILY: 'daily' });
  assert.equal(TTL.data, 600);
});

test('every content is valid: four languages, two seas, three units, both charts', () => {
  for (const language of LANGUAGES) {
    for (const place of ['quiberon', 'marseille']) {
      for (const windUnit of ['kn', 'kmh', 'ms']) {
        for (const [variable, hours] of [
          ['waves', 48],
          ['wind', 72],
        ]) {
          contents(place, language, { windUnit, variable, hours }).forEach((content, index) =>
            assertValid(content, `${place}.${index}.${language}.${windUnit}.${variable}`),
          );
        }
      }
    }
  }
});

test('conditions: tiles, the warning, the scales and the source', () => {
  const [conditions] = contents('quiberon', 'fr');
  assert.deepEqual(conditions.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'Quiberon',
  });
  const tiles = conditions.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.label, tile.value, tile.unit]),
    [
      ['Vagues', 1.2, 'm'],
      ['Période', 10, 's'],
      ['Houle O', 0.9, 'm'],
      ['Eau', 13.1, '°C'],
      ['Vent ENE', 12, 'nd'],
    ],
  );
  assert.equal(tiles[0].color, 'info');
  const body = conditions.components.find((c) => c.variant === 'body');
  assert.match(body.text, /inadaptée à la sécurité de la navigation/);
  const rows = Object.fromEntries(
    conditions.components.find((c) => c.type === 'status').items.map((item) => [item.label, item]),
  );
  assert.equal(rows['État de la mer'].value, '3 – Peu agitée');
  assert.equal(rows.Beaufort.value, '4 – Jolie brise');
  assert.equal(rows.Beaufort.color, 'success');
  assert.equal(rows.Rafales.value, '15 nd');
  assert.equal(rows.Houle.value, '0,9 m · 9 s · O');
  assert.equal(rows.Courant.value, '1,3 km/h · O');
  assert.equal(rows['Mis à jour'].value, '08:50');
  assert.equal(rows.Source.value, 'Open-Meteo.com (CC BY 4.0)');
});

test('forecast chart: waves, swell and wind sea in metres, or wind and gusts', () => {
  const [, waves] = contents('quiberon', 'en');
  const chart = waves.components.find((c) => c.type === 'chart');
  assert.equal(chart.chart_type, 'line');
  assert.equal(chart.unit, 'm');
  assert.deepEqual(
    chart.series.map((serie) => [serie.name, serie.points.length]),
    [
      ['Waves', 49],
      ['Swell', 49],
      ['Wind sea', 49],
    ],
  );
  assert.equal(chart.series[0].points[0].t, '2026-10-30T07:00:00.000Z');
  const [, wind] = contents('quiberon', 'de', { variable: 'wind', hours: 72, windUnit: 'kmh' });
  const windChart = wind.components.find((c) => c.type === 'chart');
  assert.equal(windChart.title, 'Wind (km/h)');
  assert.equal(windChart.unit, 'km/h');
  assert.deepEqual(
    windChart.series.map((serie) => [serie.name, serie.points.length]),
    [
      ['Mittelwind', 73],
      ['Böen', 73],
    ],
  );
  const labels = wind.components.find((c) => c.type === 'status').items.map((i) => i.label);
  assert.deepEqual(labels, ['Höchste Wellen', 'Stärkster Wind', 'Quelle']);
});

test('daily: seven days in the timezone of the spot, the sea state as a badge', () => {
  const [, , daily] = contents('quiberon', 'en');
  const list = daily.components.find((c) => c.type === 'card-list');
  assert.equal(list.items.length, 7);
  assert.deepEqual(list.items[0], {
    title: 'Fri, Oct 30 · waves 1.5 m',
    subtitle: 'Swell 1.5 m · 10 s · wind 14 kn F4',
    badge: { text: 'Moderate', color: 'warning' },
  });
  for (const item of list.items) {
    assert.ok(item.subtitle.length <= 60 && item.title.length <= 60);
  }
  const [, , mediterranean] = contents('marseille', 'es');
  const first = mediterranean.components.find((c) => c.type === 'card-list').items[0];
  assert.equal(first.badge.text, 'Marejada');
});

test('an empty forecast gives a sentence instead of an empty chart or list', () => {
  const forecast = { fetchedAt: NOW, timezone: 'GMT', hourly: [], daily: [] };
  const spot = SPOTS.quiberon;
  const chart = buildForecastWidget({
    spot,
    forecast,
    now: NOW,
    variable: 'waves',
    hours: 48,
    language: 'en',
    windUnit: 'kn',
  });
  assertValid(chart, 'empty chart');
  assert.equal(chart.components[1].text, 'Not read yet: the first reading takes a few seconds.');
  const daily = buildDailyWidget({ spot, forecast, now: NOW, language: 'en', windUnit: 'kn' });
  assertValid(daily, 'empty list');
});

test('helpers: clip, message, colors, settings', () => {
  assert.equal(clip('abcdef', 4), 'abc…');
  assert.equal(clip(undefined, 4), '');
  assertValid(messageContent('x'.repeat(400)), 'message');
  assert.deepEqual([null, 0, 2, 3, 4, 5, 9].map(seaStateColor), [
    'neutral',
    'success',
    'success',
    'info',
    'warning',
    'danger',
    'danger',
  ]);
  assert.deepEqual([null, 4, 5, 6, 7, 12].map(beaufortColor), [
    'neutral',
    'success',
    'warning',
    'warning',
    'danger',
    'danger',
  ]);
  assert.deepEqual(
    readWidgetSettings({ spot: 'ext:x:spot:n4745_w320', variable: 'wind', hours: '72' }),
    {
      spot: 'ext:x:spot:n4745_w320',
      variable: 'wind',
      hours: 72,
    },
  );
  assert.deepEqual(readWidgetSettings(undefined), { spot: null, variable: 'waves', hours: 48 });
  assert.deepEqual(readWidgetSettings({ variable: 'tide', hours: 12 }), {
    spot: null,
    variable: 'waves',
    hours: 48,
  });
});
