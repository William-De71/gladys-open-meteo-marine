// -----------------------------------------------------------------------------
// The marine weather of a spot: the two Open-Meteo answers read into one
// forecast, the scales worked out from it, the conditions at an instant.
//
// A forecast (kept in /data) is:
//   { fetchedAt, timezone, gridLatitude, gridLongitude,
//     current: { at, waveHeight, …, windSpeed, windGusts, windDirection },
//     hourly: [{ at, waveHeight, …, windSpeed, windGusts, windDirection }],
//     daily:  [{ at, date, waveHeightMax, …, windSpeedMax, windGustsMax }] }
// Instants are in ms (UTC). Every value is a finite number or null.
//
// Scales:
//   - Douglas sea state, 0 to 9, from the significant wave height (WMO code
//     3700): calm (glassy) 0 m, calm (rippled) up to 0.1 m, smooth 0.5 m,
//     slight 1.25 m, moderate 2.5 m, rough 4 m, very rough 6 m, high 9 m,
//     very high 14 m, phenomenal beyond;
//   - Beaufort force, 0 to 12, from the 10-minute mean wind, by its upper
//     bounds in knots (WMO): 1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64.
// The model values move a little at each run: a value within 5 % of a bound
// keeps the previous level (stableLevel), so a scene does not fire on noise.
// -----------------------------------------------------------------------------

const HOUR_MS = 3600 * 1000;
const KMH_PER_KNOT = 1.852;
// Douglas: upper bound (inclusive) of each degree, in metres.
const DOUGLAS_BOUNDS = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];
// Beaufort: upper bound (exclusive) of each force, in knots.
const BEAUFORT_BOUNDS = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
const MARGIN = 0.05;
// The "current" block is the conditions of the last reading: older than this,
// the hourly forecast of the hour is closer to the truth.
const CURRENT_MAX_AGE_MS = HOUR_MS;

const FIELDS = {
  current: {
    waveHeight: 'wave_height',
    waveDirection: 'wave_direction',
    wavePeriod: 'wave_period',
    windWaveHeight: 'wind_wave_height',
    swellHeight: 'swell_wave_height',
    swellDirection: 'swell_wave_direction',
    swellPeriod: 'swell_wave_period',
    seaTemperature: 'sea_surface_temperature',
    currentSpeed: 'ocean_current_velocity',
    currentDirection: 'ocean_current_direction',
    seaLevel: 'sea_level_height_msl',
  },
  hourly: {
    waveHeight: 'wave_height',
    waveDirection: 'wave_direction',
    wavePeriod: 'wave_period',
    windWaveHeight: 'wind_wave_height',
    swellHeight: 'swell_wave_height',
    swellDirection: 'swell_wave_direction',
    swellPeriod: 'swell_wave_period',
    seaTemperature: 'sea_surface_temperature',
  },
  daily: {
    waveHeightMax: 'wave_height_max',
    waveDirection: 'wave_direction_dominant',
    wavePeriodMax: 'wave_period_max',
    swellHeightMax: 'swell_wave_height_max',
    swellPeriodMax: 'swell_wave_period_max',
  },
  windCurrent: {
    windSpeed: 'wind_speed_10m',
    windDirection: 'wind_direction_10m',
    windGusts: 'wind_gusts_10m',
  },
  windHourly: {
    windSpeed: 'wind_speed_10m',
    windGusts: 'wind_gusts_10m',
    windDirection: 'wind_direction_10m',
  },
  windDaily: {
    windSpeedMax: 'wind_speed_10m_max',
    windGustsMax: 'wind_gusts_10m_max',
    windDirection: 'wind_direction_10m_dominant',
  },
};

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

class MarineDataError extends Error {
  /**
   * @param {string} kind - `land` (no marine data at this point) or `invalid`.
   * @param {string} message - The detail.
   */
  constructor(kind, message) {
    super(message);
    this.name = 'MarineDataError';
    this.kind = kind;
  }
}

/**
 * @description Read a block of single values.
 * @param {object} block - `{ time, <variable>: value }`.
 * @param {object} fields - `{ ourName: variable }`.
 * @returns {object} `{ at, ourName: number|null }`.
 */
function readBlock(block, fields) {
  return {
    at: Number.isFinite(block?.time) ? block.time * 1000 : null,
    ...Object.fromEntries(Object.entries(fields).map(([name, key]) => [name, num(block?.[key])])),
  };
}

/**
 * @description Read a block of series.
 * @param {object} block - `{ time: [], <variable>: [] }`.
 * @param {object} fields - `{ ourName: variable }`.
 * @returns {object[]} One entry per instant, `{ at, ourName: number|null }`.
 */
function readSeries(block, fields) {
  const times = Array.isArray(block?.time) ? block.time : [];
  return times
    .map((time, index) => ({
      at: Number.isFinite(time) ? time * 1000 : null,
      ...Object.fromEntries(
        Object.entries(fields).map(([name, key]) => [name, num(block?.[key]?.[index])]),
      ),
    }))
    .filter((entry) => entry.at !== null);
}

/**
 * @description Merge two series on their instants (the first one leads).
 * @param {object[]} first - Entries with `at`.
 * @param {object[]} second - Entries with `at`.
 * @param {object} fields - The fields the second one adds.
 * @returns {object[]} The merged entries.
 */
function mergeSeries(first, second, fields) {
  const byInstant = new Map(second.map((entry) => [entry.at, entry]));
  return first.map((entry) => {
    const other = byInstant.get(entry.at) ?? {};
    return {
      ...entry,
      ...Object.fromEntries(Object.keys(fields).map((name) => [name, other[name] ?? null])),
    };
  });
}

/**
 * @description Whether a marine answer holds no marine value at all: the
 * point is inland (Open-Meteo answers null everywhere).
 * @param {object} marine - The marine answer.
 * @returns {boolean} True when every wave height is null.
 */
function isLandAnswer(marine) {
  const current = num(marine?.current?.wave_height);
  const hourly = Array.isArray(marine?.hourly?.wave_height) ? marine.hourly.wave_height : [];
  return current === null && !hourly.some((value) => num(value) !== null);
}

/**
 * @description The forecast of a spot from the two answers.
 * @param {object} marine - The marine answer.
 * @param {object} wind - The wind answer.
 * @param {number} fetchedAt - When it was read, in ms.
 * @returns {object} The forecast.
 * @throws {MarineDataError} `land` when there is no marine data at this point,
 * `invalid` when an answer is not shaped as expected.
 */
function parseForecast(marine, wind, fetchedAt) {
  if (!marine?.current || !marine?.hourly || !wind?.current || !wind?.hourly) {
    throw new MarineDataError('invalid', 'missing current or hourly block');
  }
  if (isLandAnswer(marine)) {
    throw new MarineDataError('land', 'no marine data at this point');
  }
  const current = {
    ...readBlock(marine.current, FIELDS.current),
    ...Object.fromEntries(
      Object.entries(readBlock(wind.current, FIELDS.windCurrent)).filter(([key]) => key !== 'at'),
    ),
  };
  const hourly = mergeSeries(
    readSeries(marine.hourly, FIELDS.hourly),
    readSeries(wind.hourly, FIELDS.windHourly),
    FIELDS.windHourly,
  );
  const daily = mergeSeries(
    readSeries(marine.daily, FIELDS.daily),
    readSeries(wind.daily, FIELDS.windDaily),
    FIELDS.windDaily,
  );
  return {
    fetchedAt,
    timezone: typeof marine.timezone === 'string' ? marine.timezone : 'GMT',
    gridLatitude: num(marine.latitude),
    gridLongitude: num(marine.longitude),
    current,
    hourly,
    daily,
  };
}

/**
 * @description The Douglas sea state of a significant wave height.
 * @param {number|null} height - Metres.
 * @returns {number|null} 0 to 9.
 * @example
 * douglasOf(1.16); // -> 3 (slight)
 */
function douglasOf(height) {
  if (num(height) === null || height < 0) {
    return null;
  }
  const index = DOUGLAS_BOUNDS.findIndex((bound) => height <= bound);
  return index === -1 ? 9 : index;
}

/**
 * @description Km/h to knots.
 * @param {number|null} kmh - The speed.
 * @returns {number|null} Knots.
 */
const knotsOf = (kmh) => (num(kmh) === null ? null : kmh / KMH_PER_KNOT);

/**
 * @description A wind speed in the unit of the widgets and scene texts.
 * @param {number|null} kmh - The speed, in km/h.
 * @param {string} unit - `kmh`, `kn` or `ms`.
 * @returns {number|null} Rounded: whole km/h or knots, m/s to one decimal.
 * @example
 * windIn(22, 'kn'); // -> 12
 */
function windIn(kmh, unit) {
  if (num(kmh) === null) {
    return null;
  }
  if (unit === 'kn') {
    return Math.round(kmh / KMH_PER_KNOT);
  }
  if (unit === 'ms') {
    return Math.round(kmh / 0.36) / 10;
  }
  return Math.round(kmh);
}

/**
 * @description The Beaufort force of a mean wind.
 * @param {number|null} kmh - The 10-minute mean wind, in km/h.
 * @returns {number|null} 0 to 12.
 * @example
 * beaufortOf(22); // -> 4 (11.9 kn)
 */
function beaufortOf(kmh) {
  const knots = knotsOf(kmh);
  if (knots === null || knots < 0) {
    return null;
  }
  const rounded = Math.round(knots);
  const index = BEAUFORT_BOUNDS.findIndex((bound) => rounded < bound);
  return index === -1 ? 12 : index;
}

/**
 * @description A level that does not flap on noise: a value within 5 % of a
 * bound keeps the previous level, unless it jumped two levels or more.
 * @param {number|null} previous - The level announced before.
 * @param {number|null} value - The measured value.
 * @param {Function} levelOf - `(value) => level`.
 * @returns {number|null} The level to keep.
 */
function stableLevel(previous, value, levelOf) {
  const level = levelOf(value);
  if (level === null || previous === null || previous === undefined || level === previous) {
    return level;
  }
  if (Math.abs(level - previous) >= 2) {
    return level;
  }
  const low = levelOf(value * (1 - MARGIN));
  const high = levelOf(value * (1 + MARGIN));
  return low === high ? level : previous;
}

/**
 * @description The hourly entry of an instant (the hour it falls in).
 * @param {object} forecast - The forecast.
 * @param {number} at - The instant, in ms.
 * @returns {object|null} The entry, null outside the forecast.
 */
function hourAt(forecast, at) {
  const hourly = forecast?.hourly ?? [];
  let found = null;
  for (const entry of hourly) {
    if (entry.at <= at && at < entry.at + HOUR_MS) {
      found = entry;
      break;
    }
  }
  return found;
}

/**
 * @description The conditions of a spot at an instant: the "current" block of
 * the last reading while it is less than an hour old (now), else the hourly
 * forecast of that hour. The scales are added.
 * @param {object|null} forecast - The forecast.
 * @param {number} at - The instant, in ms.
 * @returns {object|null} The conditions (`source: 'current' | 'hourly'`), null
 * when the forecast does not reach this instant.
 */
function conditionsAt(forecast, at) {
  if (!forecast) {
    return null;
  }
  const current = forecast.current;
  const fresh =
    current?.at !== null &&
    current?.at !== undefined &&
    Math.abs(at - current.at) < CURRENT_MAX_AGE_MS;
  const entry = fresh ? current : hourAt(forecast, at);
  const source = fresh ? 'current' : 'hourly';
  if (!entry) {
    return null;
  }
  return {
    currentSpeed: null,
    currentDirection: null,
    seaLevel: null,
    ...entry,
    source,
    douglas: douglasOf(entry.waveHeight),
    beaufort: beaufortOf(entry.windSpeed),
  };
}

/**
 * @description The hourly entries from an instant, for a number of hours.
 * @param {object} forecast - The forecast.
 * @param {number} from - The instant, in ms.
 * @param {number} hours - How many hours.
 * @returns {object[]} The entries (the hour of `from` included).
 */
function hoursFrom(forecast, from, hours) {
  const start = from - HOUR_MS;
  return (forecast?.hourly ?? []).filter(
    (entry) => entry.at > start && entry.at <= from + hours * HOUR_MS,
  );
}

/**
 * @description The strongest wind forecast in the next hours.
 * @param {object} forecast - The forecast.
 * @param {number} from - The instant, in ms.
 * @param {number} hours - How many hours ahead.
 * @returns {object|null} `{ beaufort, windSpeed, windGusts, at, firstAt }`:
 * the highest force, its wind and gusts, when it peaks, and when the force
 * first reaches its level; null without any wind value.
 */
function strongestWind(forecast, from, hours) {
  const entries = hoursFrom(forecast, from, hours).filter((entry) => entry.windSpeed !== null);
  if (entries.length === 0) {
    return null;
  }
  const peak = entries.reduce((best, entry) => (entry.windSpeed > best.windSpeed ? entry : best));
  const beaufort = beaufortOf(peak.windSpeed);
  const first = entries.find((entry) => beaufortOf(entry.windSpeed) >= beaufort) ?? peak;
  const windGusts = Math.max(...entries.map((entry) => entry.windGusts ?? 0));
  return { beaufort, windSpeed: peak.windSpeed, windGusts, at: peak.at, firstAt: first.at };
}

/**
 * @description Whether a forecast is still usable: read less than 12 hours
 * ago, and reaching beyond now.
 * @param {object|null} forecast - The forecast.
 * @param {number} now - The instant, in ms.
 * @returns {boolean} True when usable.
 */
function isUsable(forecast, now) {
  return Boolean(
    forecast?.fetchedAt &&
    now - forecast.fetchedAt < 12 * HOUR_MS &&
    (forecast.hourly ?? []).some((entry) => entry.at > now),
  );
}

/**
 * @description The 16-point compass sector of a direction.
 * @param {number|null} degrees - 0 to 360.
 * @returns {number|null} 0 (N) to 15 (NNW).
 */
function sectorOf(degrees) {
  if (num(degrees) === null) {
    return null;
  }
  return Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
}

export {
  HOUR_MS,
  KMH_PER_KNOT,
  DOUGLAS_BOUNDS,
  BEAUFORT_BOUNDS,
  MARGIN,
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
};
