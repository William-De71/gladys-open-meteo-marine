// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `sea_state_changed`     the Douglas sea state of a spot changes (from
//                             the significant wave height now);
//   - `beaufort_changed`      the Beaufort force of the mean wind changes;
//   - `strong_wind_forecast`  the forecast of the next 24 hours reaches force
//                             7 (near gale, "grand frais") or more, or a higher
//                             force than the one already announced. Force 7
//                             is the threshold of the coastal gale warnings
//                             of Météo-France (BMS côte) and of the small
//                             craft advisories in many countries: a fixed
//                             threshold, the `beaufort` filter of the scene
//                             picks the forces that matter.
// The levels do not flap on model noise: a value within 5 % of a bound keeps
// the previous level (marine.js, stableLevel).
//
// What was announced is remembered per spot (`seen`, kept in /data): a
// restart or the next reading never fires the same event twice. The first
// reading of a spot is a baseline: no event replays it. A scene action or a
// widget never fires an event.
// -----------------------------------------------------------------------------

import { t, douglasLabel, beaufortLabel, compassLabel, formatNumber, dayTime } from './i18n.js';
import {
  douglasOf,
  beaufortOf,
  stableLevel,
  strongestWind,
  sectorOf,
  windIn,
  knotsOf,
} from './marine.js';

const TRIGGERS = {
  SEA_STATE_CHANGED: 'sea_state_changed',
  BEAUFORT_CHANGED: 'beaufort_changed',
  STRONG_WIND_FORECAST: 'strong_wind_forecast',
};
const STRONG_WIND_FROM = 7;
const STRONG_WIND_HOURS = 24;
// The outputs of the `get_marine_forecast` scene action (manifest order).
const ACTION_OUTPUTS = [
  'spot_name',
  'forecast_time',
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_height',
  'swell_period',
  'swell_direction',
  'wind_wave_height',
  'sea_temperature',
  'wind_speed',
  'wind_speed_kn',
  'wind_gusts',
  'wind_direction',
  'beaufort',
  'beaufort_label',
  'sea_state',
  'sea_state_label',
  'summary',
];

const round = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10 ** digits) / 10 ** digits
    : null;

/**
 * @description The sentence of the conditions of a spot.
 * @param {object} input - `{ spot, conditions, when }`; `when` is "now" or a time.
 * @param {object} options - `{ language, windUnit }`.
 * @returns {string} The summary.
 */
function conditionsSummary({ spot, conditions: c, when }, { language, windUnit }) {
  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  return t('summary', language, {
    spot: spot.name,
    when,
    height: fmt(c.waveHeight),
    period: fmt(c.wavePeriod, 0),
    direction: compassLabel(sectorOf(c.waveDirection), language),
    swell: fmt(c.swellHeight),
    state: douglasLabel(c.douglas, language).toLowerCase(),
    wind: fmt(windIn(c.windSpeed, windUnit)),
    unit: t(`unit_${windUnit}`, language),
    windDirection: compassLabel(sectorOf(c.windDirection), language),
    force: c.beaufort ?? '?',
    gusts: fmt(windIn(c.windGusts, windUnit)),
    water: fmt(c.seaTemperature),
  });
}

/**
 * @description The scene events of a reading, and the new `seen`.
 * @param {object} input - Input.
 * @param {object[]} input.spots - The spots read, with `deviceId`.
 * @param {Function} input.conditionsOf - `(key) => conditions|null` (now).
 * @param {Function} input.forecastOf - `(key) => forecast|null`.
 * @param {object} input.seen - What was already announced (not modified).
 * @param {number} input.now - The instant, in ms.
 * @param {object} input.options - `{ language, windUnit, timeZone }`.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The events and the new memory.
 */
function detectEvents({ spots, conditionsOf, forecastOf, seen = {}, now, options }) {
  const { language, windUnit, timeZone } = options;
  const unit = t(`unit_${windUnit}`, language);
  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  const events = [];
  const next = { ...seen };
  for (const spot of spots) {
    const c = conditionsOf(spot.key);
    const before = seen[spot.key];
    if (!c) {
      continue;
    }
    // A spot never met: its first reading is the reference.
    const baseline = !before;
    const memory = { ...(before ?? {}) };

    const seaState = stableLevel(memory.seaState ?? null, c.waveHeight, douglasOf);
    if (seaState !== null) {
      if (!baseline && memory.seaState !== undefined && seaState !== memory.seaState) {
        events.push({
          key: TRIGGERS.SEA_STATE_CHANGED,
          data: {
            spot: spot.deviceId,
            spot_name: spot.name,
            sea_state: seaState,
            sea_state_label: douglasLabel(seaState, language),
            previous_sea_state: memory.seaState ?? null,
            rising: seaState > (memory.seaState ?? -1),
            wave_height: round(c.waveHeight, 2),
            wave_period: round(c.wavePeriod),
            wave_direction: round(c.waveDirection, 0),
            swell_height: round(c.swellHeight, 2),
            summary: t('summarySeaState', language, {
              spot: spot.name,
              label: douglasLabel(seaState, language).toLowerCase(),
              state: seaState,
              height: fmt(c.waveHeight),
              previous: douglasLabel(memory.seaState, language).toLowerCase(),
            }),
          },
        });
      }
      memory.seaState = seaState;
    }

    const force = stableLevel(memory.beaufort ?? null, c.windSpeed, beaufortOf);
    if (force !== null) {
      if (!baseline && memory.beaufort !== undefined && force !== memory.beaufort) {
        events.push({
          key: TRIGGERS.BEAUFORT_CHANGED,
          data: {
            spot: spot.deviceId,
            spot_name: spot.name,
            beaufort: force,
            beaufort_label: beaufortLabel(force, language),
            previous_beaufort: memory.beaufort ?? null,
            rising: force > (memory.beaufort ?? -1),
            wind_speed: round(c.windSpeed),
            wind_speed_kn: round(knotsOf(c.windSpeed), 0),
            wind_gusts: round(c.windGusts),
            wind_direction: round(c.windDirection, 0),
            summary: t('summaryBeaufort', language, {
              spot: spot.name,
              force,
              label: beaufortLabel(force, language).toLowerCase(),
              wind: fmt(windIn(c.windSpeed, windUnit)),
              gusts: fmt(windIn(c.windGusts, windUnit)),
              unit,
              previous: memory.beaufort,
            }),
          },
        });
      }
      memory.beaufort = force;
    }

    const strongest = strongestWind(forecastOf(spot.key), now, STRONG_WIND_HOURS);
    if (strongest) {
      if (strongest.beaufort < STRONG_WIND_FROM) {
        // Re-armed: the next strong wind forecast will be announced.
        memory.strongWind = 0;
      } else if (strongest.beaufort > (memory.strongWind ?? 0)) {
        if (!baseline) {
          events.push({
            key: TRIGGERS.STRONG_WIND_FORECAST,
            data: {
              spot: spot.deviceId,
              spot_name: spot.name,
              beaufort: strongest.beaufort,
              beaufort_label: beaufortLabel(strongest.beaufort, language),
              wind_speed: round(strongest.windSpeed),
              wind_speed_kn: round(knotsOf(strongest.windSpeed), 0),
              wind_gusts: round(strongest.windGusts),
              starts_at: new Date(strongest.firstAt).toISOString(),
              hours_until: Math.max(0, Math.round((strongest.firstAt - now) / 3600000)),
              summary: t('summaryStrongWind', language, {
                spot: spot.name,
                force: strongest.beaufort,
                label: beaufortLabel(strongest.beaufort, language).toLowerCase(),
                time: dayTime(strongest.firstAt, language, timeZone),
                gusts: fmt(windIn(strongest.windGusts, windUnit)),
                unit,
              }),
            },
          });
        }
        memory.strongWind = strongest.beaufort;
      }
    }
    next[spot.key] = memory;
  }
  return { events, seen: next };
}

/**
 * @description The outputs of the `get_marine_forecast` scene action.
 * @param {object} input - `{ spot, conditions, at, now }`.
 * @param {object} options - `{ language, windUnit, timeZone }`.
 * @returns {object} Only the declared outputs, scalars.
 */
function actionOutputs({ spot, conditions: c, at, now }, { language, windUnit, timeZone }) {
  const when = at - now < 30 * 60 * 1000 ? t('now', language) : dayTime(at, language, timeZone);
  const data = {
    spot_name: spot.name,
    forecast_time: new Date(c.at ?? at).toISOString(),
    wave_height: round(c.waveHeight, 2),
    wave_period: round(c.wavePeriod),
    wave_direction: round(c.waveDirection, 0),
    swell_height: round(c.swellHeight, 2),
    swell_period: round(c.swellPeriod),
    swell_direction: round(c.swellDirection, 0),
    wind_wave_height: round(c.windWaveHeight, 2),
    sea_temperature: round(c.seaTemperature),
    wind_speed: round(c.windSpeed),
    wind_speed_kn: round(knotsOf(c.windSpeed), 0),
    wind_gusts: round(c.windGusts),
    wind_direction: round(c.windDirection, 0),
    beaufort: c.beaufort,
    beaufort_label: beaufortLabel(c.beaufort, language),
    sea_state: c.douglas,
    sea_state_label: douglasLabel(c.douglas, language),
    summary: conditionsSummary({ spot, conditions: c, when }, { language, windUnit }),
  };
  return Object.fromEntries(ACTION_OUTPUTS.map((key) => [key, data[key] ?? null]));
}

export {
  TRIGGERS,
  STRONG_WIND_FROM,
  STRONG_WIND_HOURS,
  ACTION_OUTPUTS,
  conditionsSummary,
  detectEvents,
  actionOutputs,
};
