// The reader of the Open-Meteo answers and the scales, on the recorded answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOUR_MS,
  MarineDataError,
  isLandAnswer,
  parseForecast,
  douglasOf,
  knotsOf,
  windIn,
  beaufortOf,
  stableLevel,
  hourAt,
  conditionsAt,
  hoursFrom,
  strongestWind,
  isUsable,
  sectorOf,
} from '../src/marine.js';
import { NOW, fixture, withValues } from './helpers/fixtures.js';

const forecastOf = (place, now = NOW) =>
  parseForecast(fixture(`${place}.marine`), fixture(`${place}.wind`), now);

test('Quiberon (Atlantic): the current block, 168 hours, 7 days, the timezone of the spot', () => {
  const forecast = forecastOf('quiberon');
  assert.equal(forecast.timezone, 'Europe/Paris');
  assert.equal(forecast.fetchedAt, NOW);
  assert.deepEqual([forecast.gridLatitude, forecast.gridLongitude], [47.458336, -3.2083282]);
  assert.equal(forecast.current.at, Date.parse('2026-10-30T07:45:00Z'));
  assert.equal(forecast.current.waveHeight, 1.16);
  assert.equal(forecast.current.wavePeriod, 10.05);
  assert.equal(forecast.current.swellHeight, 0.94);
  assert.equal(forecast.current.swellDirection, 271);
  assert.equal(forecast.current.seaTemperature, 13.1);
  assert.equal(forecast.current.currentSpeed, 1.3);
  assert.equal(forecast.current.seaLevel, 0.42);
  assert.equal(forecast.current.windSpeed, 22);
  assert.equal(forecast.current.windGusts, 27.7);
  assert.equal(forecast.hourly.length, 168);
  assert.equal(forecast.hourly[0].at, Date.parse('2026-10-29T23:00:00Z'), 'local midnight');
  assert.ok(forecast.hourly.every((hour) => hour.waveHeight !== null && hour.windSpeed !== null));
  assert.equal(forecast.daily.length, 7);
  assert.equal(forecast.daily[0].waveHeightMax, 1.54);
  assert.equal(forecast.daily[0].windSpeedMax, 26.6);
});

test('Marseille (Mediterranean): short periods, a negative sea level', () => {
  const forecast = forecastOf('marseille');
  assert.equal(forecast.current.waveHeight, 0.14);
  assert.equal(forecast.current.wavePeriod, 3.4);
  assert.equal(forecast.current.seaLevel, -0.46);
  assert.equal(forecast.current.seaTemperature, 20.5);
  assert.equal(douglasOf(forecast.current.waveHeight), 2);
});

test('Lyon (inland): every marine value is null, the spot is refused', () => {
  assert.ok(isLandAnswer(fixture('lyon.marine')));
  assert.ok(!isLandAnswer(fixture('quiberon.marine')));
  assert.throws(
    () => forecastOf('lyon'),
    (err) => err instanceof MarineDataError && err.kind === 'land',
  );
});

test('an answer without its blocks is invalid', () => {
  assert.throws(
    () => parseForecast({}, fixture('quiberon.wind'), NOW),
    (err) => err.kind === 'invalid',
  );
  assert.throws(
    () => parseForecast(fixture('quiberon.marine'), { current: {} }, NOW),
    (err) => err.kind === 'invalid',
  );
});

test('Douglas sea state: the WMO bounds, inclusive', () => {
  const cases = [
    [0, 0],
    [0.05, 1],
    [0.1, 1],
    [0.11, 2],
    [0.5, 2],
    [1.16, 3],
    [1.25, 3],
    [2.5, 4],
    [3, 5],
    [5, 6],
    [8, 7],
    [12, 8],
    [14.5, 9],
  ];
  for (const [height, state] of cases) {
    assert.equal(douglasOf(height), state, String(height));
  }
  assert.equal(douglasOf(null), null);
  assert.equal(douglasOf(-1), null);
});

test('Beaufort force: the WMO bounds in knots', () => {
  const cases = [
    [0, 0],
    [1.8, 1],
    [8, 2],
    [15, 3],
    [22, 4],
    [35, 5],
    [45, 6],
    [55, 7],
    [66, 8],
    [80, 9],
    [95, 10],
    [110, 11],
    [120, 12],
    [200, 12],
  ];
  for (const [kmh, force] of cases) {
    assert.equal(beaufortOf(kmh), force, `${kmh} km/h`);
  }
  assert.equal(beaufortOf(null), null);
  assert.equal(Math.round(knotsOf(22) * 10) / 10, 11.9);
});

test('wind units: whole km/h and knots, m/s to one decimal', () => {
  assert.equal(windIn(22, 'kmh'), 22);
  assert.equal(windIn(22, 'kn'), 12);
  assert.equal(windIn(22, 'ms'), 6.1);
  assert.equal(windIn(null, 'kn'), null);
});

test('a level does not flap within 5 % of a bound, but follows a real change', () => {
  // 1.24 m is "slight" (3), 1.27 m "moderate" (4): both within 5 % of 1.25 m.
  assert.equal(stableLevel(3, 1.27, douglasOf), 3);
  assert.equal(stableLevel(4, 1.24, douglasOf), 4);
  assert.equal(stableLevel(3, 1.4, douglasOf), 4);
  assert.equal(stableLevel(null, 1.27, douglasOf), 4, 'no previous level');
  assert.equal(stableLevel(1, 1.27, douglasOf), 4, 'a jump of two levels or more');
  assert.equal(stableLevel(3, null, douglasOf), null);
});

test('conditions: the current block while fresh, then the hourly forecast', () => {
  const forecast = forecastOf('quiberon');
  const now = conditionsAt(forecast, NOW);
  assert.equal(now.source, 'current');
  assert.equal(now.waveHeight, 1.16);
  assert.equal(now.douglas, 3);
  assert.equal(now.beaufort, 4);
  assert.equal(now.currentSpeed, 1.3);
  const later = conditionsAt(forecast, NOW + 6 * HOUR_MS);
  assert.equal(later.source, 'hourly');
  assert.equal(later.at, Date.parse('2026-10-30T13:00:00Z'));
  assert.equal(later.currentSpeed, null, 'no current in the hourly forecast');
  assert.equal(conditionsAt(forecast, NOW + 8 * 24 * HOUR_MS), null, 'beyond the forecast');
  assert.equal(conditionsAt(null, NOW), null);
  assert.equal(hourAt(forecast, NOW).at, Date.parse('2026-10-30T07:00:00Z'));
});

test('the hours ahead and the strongest wind of the next 24 hours', () => {
  const forecast = forecastOf('quiberon');
  const next = hoursFrom(forecast, NOW, 48);
  assert.equal(next[0].at, Date.parse('2026-10-30T07:00:00Z'));
  assert.equal(next.length, 49);
  const strongest = strongestWind(forecast, NOW, 24);
  assert.equal(strongest.beaufort, 4);
  assert.ok(strongest.windGusts >= strongest.windSpeed);
  const gale = parseForecast(
    withValues('quiberon.marine'),
    withValues('quiberon.wind', {}, { wind_speed_10m: (v, i) => (i === 20 ? 65 : v) }),
    NOW,
  );
  const warning = strongestWind(gale, NOW, 24);
  assert.equal(warning.beaufort, 8);
  assert.equal(warning.firstAt, Date.parse('2026-10-30T19:00:00Z'));
  assert.equal(strongestWind({ hourly: [] }, NOW, 24), null);
});

test('a forecast is usable for 12 hours, and while it reaches beyond now', () => {
  const forecast = forecastOf('quiberon');
  assert.ok(isUsable(forecast, NOW));
  assert.ok(isUsable(forecast, NOW + 11 * HOUR_MS));
  assert.ok(!isUsable(forecast, NOW + 13 * HOUR_MS));
  assert.ok(!isUsable(null, NOW));
});

test('16-point compass sectors', () => {
  assert.equal(sectorOf(0), 0);
  assert.equal(sectorOf(271), 12);
  assert.equal(sectorOf(75), 3);
  assert.equal(sectorOf(359), 0);
  assert.equal(sectorOf(-90), 12);
  assert.equal(sectorOf(null), null);
});
