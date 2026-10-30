// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, a unit
// outside the list of its category is refused by the front, and a single
// invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

import {
  DEVICE_TYPE,
  FEATURES,
  buildDevice,
  buildStates,
  idsOf,
  spotKeyOfDevice,
} from '../src/device.js';
import { parseForecast, conditionsAt, HOUR_MS } from '../src/marine.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, fixture, NOW, SPOTS } from './helpers/fixtures.js';

const spots = [SPOTS.quiberon, SPOTS.marseille];
const devices = (language) => spots.map((spot) => buildDevice(fakeGladys, spot, { language }));
const conditions = (place, at = NOW) =>
  conditionsAt(parseForecast(fixture(`${place}.marine`), fixture(`${place}.wind`), NOW), at);

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js,
// master of 2026-10-29), for the categories used here.
const UNITS = {
  [C.DISTANCE_SENSOR]: [U.MM, U.CM, U.M, U.KM, U.INCH, U.FEET, U.MILE],
  [C.LEVEL_SENSOR]: [U.MM, U.CM, U.M, U.KM, U.INCH, U.FEET, U.MILE, U.PERCENT],
  [C.DURATION]: [U.MICROSECONDS, U.MILLISECONDS, U.SECONDS, U.MINUTES, U.HOURS],
  [C.ANGLE_SENSOR]: [U.DEGREE],
  [C.TEMPERATURE_SENSOR]: [U.CELSIUS, U.FAHRENHEIT, U.KELVIN],
  [C.SPEED_SENSOR]: [U.METER_PER_SECOND, U.KILOMETER_PER_HOUR],
};
// Pairs with an icon and a label in the Gladys front (front/src/utils/consts.js
// and the deviceFeatureCategory translations).
const PAIRS = [
  [C.DISTANCE_SENSOR, T.SENSOR.DECIMAL],
  [C.LEVEL_SENSOR, T.SENSOR.DECIMAL],
  [C.DURATION, T.DURATION.DECIMAL],
  [C.ANGLE_SENSOR, T.SENSOR.INTEGER],
  [C.TEMPERATURE_SENSOR, T.TEMPERATURE_SENSOR.PROBE],
  [C.SPEED_SENSOR, T.SPEED_SENSOR.DECIMAL],
  [C.SPEED_SENSOR, T.SPEED_SENSOR.INTEGER],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('15 features, in a stable order', () => {
  assert.deepEqual(
    FEATURES.map((spec) => spec.key),
    [
      'wave_height',
      'wave_period',
      'wave_direction',
      'swell_height',
      'swell_period',
      'swell_direction',
      'wind_wave_height',
      'sea_temperature',
      'current_speed',
      'sea_level',
      'wind_speed',
      'wind_gusts',
      'wind_direction',
      'beaufort',
      'sea_state',
    ],
  );
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
          assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min < feature.max, feature.external_id);
        assert.equal(feature.read_only, true);
        assert.equal(feature.has_feedback, false);
        assert.ok(feature.name.trim(), feature.external_id);
      }
      const names = device.features.map((feature) => feature.name);
      assert.equal(new Set(names).size, names.length, `${language}: distinct names`);
    }
  }
});

test('category / type pairs known by the front, units allowed for their category', () => {
  for (const feature of devices('en')[0].features) {
    assert.ok(
      PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
      `${feature.external_id}: ${feature.category}/${feature.type}`,
    );
    if (feature.unit !== undefined) {
      assert.ok(UNITS[feature.category]?.includes(feature.unit), feature.external_id);
    }
  }
  const byKey = new Map(FEATURES.map((spec) => [spec.key, spec.shape]));
  assert.deepEqual([byKey.get('sea_level').min, byKey.get('sea_level').max], [-10, 10]);
  assert.deepEqual([byKey.get('beaufort').min, byKey.get('beaufort').max], [0, 12]);
  assert.deepEqual([byKey.get('sea_state').min, byKey.get('sea_state').max], [0, 9]);
  assert.equal(byKey.get('beaufort').unit, undefined, 'a scale has no unit');
  assert.equal(byKey.get('sea_state').unit, undefined);
  assert.equal(
    byKey.get('sea_temperature').type,
    T.TEMPERATURE_SENSOR.PROBE,
    'the sea never enters the room temperature',
  );
});

test('external ids: the key of the coordinates, unique, readable back', () => {
  const ids = devices('en').flatMap((device) => [
    device.external_id,
    ...device.features.map((f) => f.external_id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  const quiberon = buildDevice(fakeGladys, SPOTS.quiberon, { language: 'en' });
  assert.equal(quiberon.external_id, `ext:test-integration:${DEVICE_TYPE}:n4745_w320`);
  assert.equal(
    quiberon.features[0].external_id,
    'ext:test-integration:spot:n4745_w320:wave_height',
  );
  assert.equal(spotKeyOfDevice(quiberon.external_id), 'n4745_w320');
  assert.equal(spotKeyOfDevice(quiberon.features[14].external_id), 'n4745_w320');
  assert.equal(spotKeyOfDevice('ext:x:station:PBE'), null);
  assert.equal(spotKeyOfDevice(undefined), null);
  assert.equal(idsOf(fakeGladys, 'n4320_e530').device, 'ext:test-integration:spot:n4320_e530');
  const renamed = buildDevice(fakeGladys, { ...SPOTS.quiberon, name: 'Côte sauvage' });
  assert.equal(renamed.external_id, quiberon.external_id, 'renaming keeps the device');
});

test('names and params in the language of the user', () => {
  const fr = buildDevice(fakeGladys, SPOTS.quiberon, { language: 'fr' });
  assert.equal(fr.name, 'Météo marine Quiberon');
  assert.equal(fr.features[3].name, 'Hauteur de la houle');
  assert.equal(
    buildDevice(fakeGladys, SPOTS.quiberon, { language: 'de' }).name,
    'Seewetter Quiberon',
  );
  assert.deepEqual(
    fr.params.map((param) => [param.name, param.value]),
    [
      ['SPOT', 'n4745_w320'],
      ['LATITUDE', '47.45'],
      ['LONGITUDE', '-3.2'],
      ['COORDINATES', '47.45° N, 3.20° W'],
    ],
  );
});

test('the fake Gladys accepts the discovery of the spots', async () => {
  const gladys = createFakeGladys({});
  await gladys.connect();
  await gladys.publishDiscoveredDevices(spots.map((spot) => buildDevice(gladys, spot)));
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  gladys.fake.shutdown();
});

test('states of Quiberon now: every feature, rounded, within the bounds', () => {
  const states = buildStates(fakeGladys, 'n4745_w320', conditions('quiberon'));
  assert.equal(states.length, 15);
  const byKey = Object.fromEntries(
    states.map((state) => [state.device_feature_external_id.split(':').at(-1), state.state]),
  );
  assert.deepEqual(byKey, {
    wave_height: 1.16,
    wave_period: 10.1,
    wave_direction: 271,
    swell_height: 0.94,
    swell_period: 8.6,
    swell_direction: 271,
    wind_wave_height: 0.4,
    sea_temperature: 13.1,
    current_speed: 1.3,
    sea_level: 0.42,
    wind_speed: 22,
    wind_gusts: 27.7,
    wind_direction: 75,
    beaufort: 4,
    sea_state: 3,
  });
});

test('states of Marseille: a negative sea level is kept', () => {
  const states = buildStates(fakeGladys, 'n4320_e530', conditions('marseille'));
  const level = states.find((state) => state.device_feature_external_id.endsWith(':sea_level'));
  assert.equal(level.state, -0.46);
});

test('from the hourly forecast: no current nor sea level, never a fake value', () => {
  const states = buildStates(fakeGladys, 'n4745_w320', conditions('quiberon', NOW + 3 * HOUR_MS));
  const keys = states.map((state) => state.device_feature_external_id.split(':').at(-1));
  assert.equal(states.length, 13);
  assert.ok(!keys.includes('current_speed') && !keys.includes('sea_level'));
  assert.deepEqual(buildStates(fakeGladys, 'n4745_w320', null), []);
});

test('values beyond the bounds are capped, a direction of 360° is 0°', () => {
  const states = buildStates(fakeGladys, 'n4745_w320', {
    waveHeight: 42,
    waveDirection: 360,
    seaLevel: -12,
    windSpeed: 500,
    beaufort: 12,
    douglas: 9,
  });
  const byKey = Object.fromEntries(
    states.map((state) => [state.device_feature_external_id.split(':').at(-1), state.state]),
  );
  assert.equal(byKey.wave_height, 30);
  assert.equal(byKey.wave_direction, 0);
  assert.equal(byKey.sea_level, -10);
  assert.equal(byKey.wind_speed, 400);
});
