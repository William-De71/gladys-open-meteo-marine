import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
  DEFAULT_INTERVAL,
  DEFAULT_WIND_UNIT,
  INTERNAL_KEYS,
  normalizeConfig,
  readLanguage,
} from '../src/config.js';

test('empty config: no spot, defaults', () => {
  const empty = {
    spots: [],
    problems: [],
    interval: DEFAULT_INTERVAL,
    windUnit: DEFAULT_WIND_UNIT,
    language: AUTO_LANGUAGE,
  };
  assert.deepEqual(normalizeConfig(), empty);
  assert.deepEqual(normalizeConfig(null), empty);
  assert.equal(DEFAULT_INTERVAL, 30);
  assert.equal(DEFAULT_WIND_UNIT, 'kn');
  assert.equal(DEFAULT_TEXT_LANGUAGE, 'en');
});

test('up to five spots, in slot order, with their key', () => {
  const config = normalizeConfig({
    spot_1_name: ' Quiberon ',
    spot_1_coordinates: '47.45, -3.2',
    spot_3_name: 'Marseille',
    spot_3_coordinates: '43,2 5,3',
    spot_6_name: 'Too many',
    spot_6_coordinates: '10, 10',
  });
  assert.deepEqual(config.spots, [
    { slot: 1, key: 'n4745_w320', name: 'Quiberon', latitude: 47.45, longitude: -3.2 },
    { slot: 3, key: 'n4320_e530', name: 'Marseille', latitude: 43.2, longitude: 5.3 },
  ]);
  assert.deepEqual(config.problems, []);
});

test('a spot without a name is named after its slot', () => {
  const config = normalizeConfig({ spot_2_coordinates: '43.2, 5.3' });
  assert.equal(config.spots[0].name, 'Spot 2');
});

test('problems: missing or unreadable coordinates, the same place twice', () => {
  const config = normalizeConfig({
    spot_1_name: 'Quiberon',
    spot_1_coordinates: '47.45, -3.2',
    spot_2_name: 'No coordinates',
    spot_3_name: 'Typo',
    spot_3_coordinates: '47.45 N 3.2 W',
    spot_4_name: 'Quiberon again',
    spot_4_coordinates: '47.4512, -3.1987',
  });
  assert.equal(config.spots.length, 1);
  assert.deepEqual(config.problems, [
    { slot: 2, name: 'No coordinates', kind: 'missing' },
    { slot: 3, name: 'Typo', kind: 'coordinates' },
    { slot: 4, name: 'Quiberon again', kind: 'duplicate' },
  ]);
});

test('interval, wind unit and language: known values, else the defaults', () => {
  assert.equal(normalizeConfig({ interval: '15' }).interval, 15);
  assert.equal(normalizeConfig({ interval: 5 }).interval, 30);
  assert.equal(normalizeConfig({ wind_unit: 'kmh' }).windUnit, 'kmh');
  assert.equal(normalizeConfig({ wind_unit: 'mph' }).windUnit, 'kn');
  assert.equal(normalizeConfig({ language: 'fr' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'it' }).language, AUTO_LANGUAGE);
});

test('the stored language of the last widget request', () => {
  assert.equal(INTERNAL_KEYS.language, 'last_language');
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, null), null);
});
