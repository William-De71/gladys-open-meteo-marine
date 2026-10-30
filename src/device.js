// -----------------------------------------------------------------------------
// One Gladys device per spot: "Marine weather Quiberon".
//
// External ids: `ext:<selector>:spot:<key>` and `…:spot:<key>:<feature key>`,
// the key coming from the coordinates rounded to two decimals (spots.js):
// renaming a spot keeps its device.
//
// Features (category / type chosen from the SDK constants, and from the pairs
// the Gladys front knows: icon and label):
//   - heights of the waves, of the swell and of the wind sea:
//     `distance-sensor` / `decimal`, m, 0 to 30;
//   - periods: `duration` / `decimal`, s, 0 to 30;
//   - directions (where the waves and the wind come FROM, as forecasts
//     write them): `angle-sensor` / `integer`, degrees, 0 to 360 (the pair
//     the Netatmo integration of the core uses for the wind);
//   - water temperature: `temperature-sensor` / `probe`, °C, -5 to 40: a
//     temperature read away from the house, kept out of the room average on
//     purpose (a `decimal` one would mix the sea into the room's temperature);
//   - ocean current: `speed-sensor` / `decimal`, km/h, 0 to 30;
//   - sea level above the global mean sea level, tides included:
//     `level-sensor` / `decimal`, m, -10 to 10 (signed, symmetric bounds);
//   - mean wind and gusts: `speed-sensor` / `decimal`, km/h, 0 to 400 (Gladys
//     has no knot unit; the widgets and scene texts can show knots);
//   - Beaufort force: `speed-sensor` / `integer` without unit, 0 to 12 (a
//     wind speed scale);
//   - Douglas sea state: `level-sensor` / `decimal` without unit, 0 to 9.
//
// No state for an unknown value (Open-Meteo answers null where a model does
// not reach, for example the current or the sea level in some seas). The
// conditions are those of the last reading while it is less than an hour old,
// then the hourly forecast of the hour (marine.js). `should_poll` stays false:
// Open-Meteo is read on the integration's own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

import { t } from './i18n.js';
import { coordinatesText } from './spots.js';

const DEVICE_TYPE = 'spot';
const MODEL = 'Open-Meteo marine forecast';

const sensor = { read_only: true, has_feedback: false, keep_history: true };
const height = {
  category: CATEGORIES.DISTANCE_SENSOR,
  type: TYPES.SENSOR.DECIMAL,
  unit: UNITS.M,
  ...sensor,
  min: 0,
  max: 30,
};
const period = {
  category: CATEGORIES.DURATION,
  type: TYPES.DURATION.DECIMAL,
  unit: UNITS.SECONDS,
  ...sensor,
  min: 0,
  max: 30,
};
const direction = {
  category: CATEGORIES.ANGLE_SENSOR,
  type: TYPES.SENSOR.INTEGER,
  unit: UNITS.DEGREE,
  ...sensor,
  min: 0,
  max: 360,
};
const speed = (max) => ({
  category: CATEGORIES.SPEED_SENSOR,
  type: TYPES.SPEED_SENSOR.DECIMAL,
  unit: UNITS.KILOMETER_PER_HOUR,
  ...sensor,
  min: 0,
  max,
});

const round = (value, digits) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp = (value, { min, max }) =>
  value === null ? null : Math.min(max, Math.max(min, value));
const degrees = (value) => (value === null ? null : Math.round(value) % 360);

// The features: key (eternal), name (TEXTS key), shape, and the state from
// the conditions (null: nothing to publish).
const FEATURES = [
  { key: 'wave_height', shape: height, state: (c) => round(c.waveHeight, 2) },
  { key: 'wave_period', shape: period, state: (c) => round(c.wavePeriod, 1) },
  { key: 'wave_direction', shape: direction, state: (c) => degrees(c.waveDirection) },
  { key: 'swell_height', shape: height, state: (c) => round(c.swellHeight, 2) },
  { key: 'swell_period', shape: period, state: (c) => round(c.swellPeriod, 1) },
  { key: 'swell_direction', shape: direction, state: (c) => degrees(c.swellDirection) },
  { key: 'wind_wave_height', shape: height, state: (c) => round(c.windWaveHeight, 2) },
  {
    key: 'sea_temperature',
    shape: {
      category: CATEGORIES.TEMPERATURE_SENSOR,
      type: TYPES.TEMPERATURE_SENSOR.PROBE,
      unit: UNITS.CELSIUS,
      ...sensor,
      min: -5,
      max: 40,
    },
    state: (c) => round(c.seaTemperature, 1),
  },
  { key: 'current_speed', shape: speed(30), state: (c) => round(c.currentSpeed, 1) },
  {
    key: 'sea_level',
    shape: {
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.M,
      ...sensor,
      min: -10,
      max: 10,
    },
    state: (c) => round(c.seaLevel, 2),
  },
  { key: 'wind_speed', shape: speed(400), state: (c) => round(c.windSpeed, 1) },
  { key: 'wind_gusts', shape: speed(400), state: (c) => round(c.windGusts, 1) },
  { key: 'wind_direction', shape: direction, state: (c) => degrees(c.windDirection) },
  {
    key: 'beaufort',
    shape: {
      category: CATEGORIES.SPEED_SENSOR,
      type: TYPES.SPEED_SENSOR.INTEGER,
      ...sensor,
      min: 0,
      max: 12,
    },
    state: (c) => c.beaufort ?? null,
  },
  {
    key: 'sea_state',
    shape: {
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      ...sensor,
      min: 0,
      max: 9,
    },
    state: (c) => c.douglas ?? null,
  },
];

/**
 * @description The ids of a spot device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The spot key, `n4745_w320`.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, key) => gladys.externalIds(DEVICE_TYPE, key);

/**
 * @description The spot a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The spot key.
 * @example
 * spotKeyOfDevice('ext:open-meteo-marine:spot:n4745_w320'); // -> 'n4745_w320'
 */
function spotKeyOfDevice(externalId) {
  const match = /:spot:([ns]\d{1,4}_[ew]\d{1,5})(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The device of a spot.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} spot - `{ key, name, latitude, longitude }`.
 * @param {object} [options] - `{ language }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, spot, { language = 'en' } = {}) {
  const ids = idsOf(gladys, spot.key);
  return {
    name: t('deviceName', language, { spot: spot.name }),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [
      { name: 'SPOT', value: spot.key },
      { name: 'LATITUDE', value: String(spot.latitude) },
      { name: 'LONGITUDE', value: String(spot.longitude) },
      { name: 'COORDINATES', value: coordinatesText(spot) },
    ],
    features: FEATURES.map((spec) => ({
      name: t(`feature_${spec.key}`, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a spot device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The spot key.
 * @param {object|null} conditions - conditionsAt().
 * @returns {object[]} The states; none without conditions.
 */
function buildStates(gladys, key, conditions) {
  if (!conditions) {
    return [];
  }
  const ids = idsOf(gladys, key);
  return FEATURES.flatMap((spec) => {
    const value = clamp(spec.state(conditions), spec.shape);
    return value === null
      ? []
      : [{ device_feature_external_id: ids.feature(spec.key), state: value }];
  });
}

export { DEVICE_TYPE, FEATURES, idsOf, spotKeyOfDevice, buildDevice, buildStates };
