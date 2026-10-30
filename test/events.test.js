// The scene triggers (transitions only, once, after a baseline) and the
// outputs of the scene action.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRIGGERS,
  STRONG_WIND_FROM,
  ACTION_OUTPUTS,
  conditionsSummary,
  detectEvents,
  actionOutputs,
} from '../src/events.js';
import { parseForecast, conditionsAt, HOUR_MS } from '../src/marine.js';
import { NOW, TZ, SPOTS, fixture, withValues } from './helpers/fixtures.js';

const DEVICE = 'ext:test-integration:spot:n4745_w320';
const spot = { ...SPOTS.quiberon, deviceId: DEVICE };
const options = { language: 'en', windUnit: 'kn', timeZone: TZ };

/**
 * @description The events of a reading of Quiberon with some values changed.
 * @param {object} input - `{ seen, current, windCurrent, windHourly, language }`.
 * @returns {object} detectEvents().
 */
function readingOf({
  seen = {},
  current = {},
  windCurrent = {},
  windHourly = {},
  language = 'en',
}) {
  const forecast = parseForecast(
    withValues('quiberon.marine', current),
    withValues('quiberon.wind', windCurrent, windHourly),
    NOW,
  );
  return detectEvents({
    spots: [spot],
    conditionsOf: () => conditionsAt(forecast, NOW),
    forecastOf: () => forecast,
    seen,
    now: NOW,
    options: { ...options, language },
  });
}

test('the first reading of a spot is a baseline: no event, the levels remembered', () => {
  const { events, seen } = readingOf({});
  assert.deepEqual(events, []);
  assert.deepEqual(seen, { n4745_w320: { seaState: 3, beaufort: 4, strongWind: 0 } });
});

test('a sea state change fires once, with its payload', () => {
  const { seen } = readingOf({});
  const { events, seen: after } = readingOf({ seen, current: { wave_height: 2.8 } });
  assert.equal(events.length, 1);
  const [event] = events;
  assert.equal(event.key, TRIGGERS.SEA_STATE_CHANGED);
  assert.equal(event.data.spot, DEVICE);
  assert.equal(event.data.sea_state, 5);
  assert.equal(event.data.sea_state_label, 'Rough');
  assert.equal(event.data.previous_sea_state, 3);
  assert.equal(event.data.rising, true);
  assert.equal(event.data.wave_height, 2.8);
  assert.equal(
    event.data.summary,
    'Sea state at Quiberon: rough (5), waves 2.8 m (before: slight).',
  );
  const again = readingOf({ seen: after, current: { wave_height: 2.8 } });
  assert.deepEqual(again.events, [], 'never twice');
});

test('noise around a bound does not fire', () => {
  const { seen } = readingOf({ current: { wave_height: 1.24 } });
  assert.deepEqual(readingOf({ seen, current: { wave_height: 1.27 } }).events, []);
  assert.equal(readingOf({ seen, current: { wave_height: 1.4 } }).events.length, 1);
});

test('a Beaufort change fires with the wind in km/h and knots', () => {
  const { seen } = readingOf({});
  const { events } = readingOf({ seen, windCurrent: { wind_speed_10m: 45, wind_gusts_10m: 60 } });
  assert.deepEqual(
    events.map((event) => event.key),
    [TRIGGERS.BEAUFORT_CHANGED],
  );
  const { data } = events[0];
  assert.equal(data.beaufort, 6);
  assert.equal(data.beaufort_label, 'Strong breeze');
  assert.equal(data.previous_beaufort, 4);
  assert.equal(data.wind_speed, 45);
  assert.equal(data.wind_speed_kn, 24);
  assert.equal(
    data.summary,
    'Wind at Quiberon: force 6 (strong breeze), 24 kn, gusts 32 kn (before: force 4).',
  );
});

test('a strong wind forecast fires once, again only for a higher force, re-armed below 7', () => {
  const gale = (speed) => ({ wind_speed_10m: (v, i) => (i === 20 ? speed : v) });
  const { seen } = readingOf({});
  const first = readingOf({ seen, windHourly: gale(55), language: 'fr' });
  assert.equal(first.events.length, 1);
  const { data } = first.events[0];
  assert.equal(first.events[0].key, TRIGGERS.STRONG_WIND_FORECAST);
  assert.equal(data.beaufort, STRONG_WIND_FROM);
  assert.equal(data.beaufort_label, 'Grand frais');
  assert.equal(data.starts_at, '2026-10-30T19:00:00.000Z');
  assert.equal(data.hours_until, 11);
  assert.match(
    data.summary,
    /^Vent fort prévu à Quiberon : force 7 \(grand frais\) à partir de ven\. 20:00/,
  );
  const same = readingOf({ seen: first.seen, windHourly: gale(55) });
  assert.deepEqual(same.events, []);
  const worse = readingOf({ seen: first.seen, windHourly: gale(80) });
  assert.equal(worse.events[0].data.beaufort, 9);
  const calm = readingOf({ seen: worse.seen });
  assert.equal(calm.seen.n4745_w320.strongWind, 0);
  assert.equal(readingOf({ seen: calm.seen, windHourly: gale(55) }).events.length, 1);
});

test('a strong wind already forecast at the first reading is a baseline too', () => {
  const { events, seen } = readingOf({
    windHourly: { wind_speed_10m: (v, i) => (i === 20 ? 55 : v) },
  });
  assert.deepEqual(events, []);
  assert.equal(seen.n4745_w320.strongWind, 7);
});

test('payloads are flat scalars within the limits of the core', () => {
  const { seen } = readingOf({});
  const { events } = readingOf({
    seen,
    current: { wave_height: 3 },
    windCurrent: { wind_speed_10m: 60 },
    windHourly: { wind_speed_10m: (v, i) => (i === 10 ? 90 : v) },
  });
  assert.equal(events.length, 3);
  for (const event of events) {
    const entries = Object.entries(event.data);
    assert.ok(entries.length <= 30);
    for (const [key, value] of entries) {
      assert.ok(
        value === null ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value)) ||
          (typeof value === 'string' && value.length <= 1000),
        `${event.key}.${key}`,
      );
    }
  }
});

test('a spot without conditions keeps its memory', () => {
  const { events, seen } = detectEvents({
    spots: [spot],
    conditionsOf: () => null,
    forecastOf: () => null,
    seen: { n4745_w320: { seaState: 2 } },
    now: NOW,
    options,
  });
  assert.deepEqual(events, []);
  assert.deepEqual(seen, { n4745_w320: { seaState: 2 } });
});

test('scene action outputs: only the declared keys, now and in six hours', () => {
  const forecast = parseForecast(fixture('quiberon.marine'), fixture('quiberon.wind'), NOW);
  const now = actionOutputs(
    { spot, conditions: conditionsAt(forecast, NOW), at: NOW, now: NOW },
    { ...options, language: 'fr' },
  );
  assert.deepEqual(Object.keys(now), ACTION_OUTPUTS);
  assert.ok(ACTION_OUTPUTS.length <= 20);
  assert.equal(now.forecast_time, '2026-10-30T07:45:00.000Z');
  assert.equal(now.wave_height, 1.16);
  assert.equal(now.wind_speed_kn, 12);
  assert.equal(now.sea_state_label, 'Peu agitée');
  assert.equal(
    now.summary,
    'Quiberon, maintenant : vagues de 1,2 m toutes les 10 s de secteur O, houle 0,9 m, mer peu agitée. Vent de secteur ENE 12 nd (force 4), rafales 15 nd. Eau à 13,1 °C.',
  );
  const later = NOW + 6 * HOUR_MS;
  const six = actionOutputs(
    { spot, conditions: conditionsAt(forecast, later), at: later, now: NOW },
    options,
  );
  assert.equal(six.forecast_time, '2026-10-30T13:00:00.000Z');
  assert.match(six.summary, /^Quiberon, Fri 02:50 PM: waves/);
  for (const value of Object.values(six)) {
    assert.ok(value === null || ['string', 'number'].includes(typeof value));
  }
});

test('the summary in German and Spanish, unknown values as a question mark', () => {
  const c = { douglas: null, beaufort: null };
  const de = conditionsSummary(
    { spot, conditions: c, when: 'jetzt' },
    { language: 'de', windUnit: 'kmh' },
  );
  assert.match(de, /^Quiberon, jetzt: Wellen \? m alle \? s aus \?/);
  const es = conditionsSummary(
    { spot, conditions: { ...c, windSpeed: 36 }, when: 'ahora' },
    { language: 'es', windUnit: 'ms' },
  );
  assert.match(es, /Viento de componente \? 10 m\/s/);
});
