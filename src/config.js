// -----------------------------------------------------------------------------
// Configuration of the Open-Meteo Marine integration.
//
// Fields of the config_schema:
//   - `spot_<n>_name`, `spot_<n>_coordinates`  up to five spots: a name and
//                    "latitude, longitude" (text fields, see spots.js);
//   - `interval`     minutes between two readings of each spot: 15 or 30;
//   - `wind_unit`    unit of the wind in the widgets and the scene texts:
//                    `kmh`, `kn` or `ms` (the devices stay in km/h, the only
//                    wind unit Gladys knows besides m/s);
//   - `language`     language of the texts Gladys does not ask for in a
//                    language (device names, scene summaries): `auto`
//                    follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, kept for the
//                      texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { MAX_SPOTS, parseCoordinates, spotKeyOf, cleanName } from './spots.js';

const AUTO_LANGUAGE = 'auto';
const DEFAULT_TEXT_LANGUAGE = 'en';
const INTERNAL_KEYS = { language: 'last_language' };
const INTERVALS = [15, 30];
const DEFAULT_INTERVAL = 30;
const WIND_UNITS = ['kmh', 'kn', 'ms'];
const DEFAULT_WIND_UNIT = 'kn';

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ spots: [{ slot, key, name, latitude, longitude }],
 * problems: [{ slot, name, kind }], interval, windUnit, language }`. A slot
 * with coordinates that cannot be read is a problem (`coordinates`), one with
 * a name but no coordinates too (`missing`); a spot typed twice (same key) is
 * kept once (`duplicate`).
 * @example
 * normalizeConfig({ spot_1_name: 'Quiberon', spot_1_coordinates: '47.45, -3.2' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const spots = [];
  const problems = [];
  for (let slot = 1; slot <= MAX_SPOTS; slot += 1) {
    const rawCoordinates = config[`spot_${slot}_coordinates`];
    const typedName = cleanName(config[`spot_${slot}_name`]);
    const hasCoordinates = typeof rawCoordinates === 'string' && rawCoordinates.trim() !== '';
    if (!hasCoordinates) {
      if (typedName) {
        problems.push({ slot, name: typedName, kind: 'missing' });
      }
      continue;
    }
    const coordinates = parseCoordinates(rawCoordinates);
    const name = typedName || `Spot ${slot}`;
    if (!coordinates) {
      problems.push({ slot, name, kind: 'coordinates' });
      continue;
    }
    const key = spotKeyOf(coordinates.latitude, coordinates.longitude);
    if (spots.some((spot) => spot.key === key)) {
      problems.push({ slot, name, kind: 'duplicate' });
      continue;
    }
    spots.push({ slot, key, name, ...coordinates });
  }
  const interval = Number(config.interval);
  return {
    spots,
    problems,
    interval: INTERVALS.includes(interval) ? interval : DEFAULT_INTERVAL,
    windUnit: WIND_UNITS.includes(config.wind_unit) ? config.wind_unit : DEFAULT_WIND_UNIT,
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
  INTERNAL_KEYS,
  INTERVALS,
  DEFAULT_INTERVAL,
  WIND_UNITS,
  DEFAULT_WIND_UNIT,
  normalizeConfig,
  readLanguage,
};
