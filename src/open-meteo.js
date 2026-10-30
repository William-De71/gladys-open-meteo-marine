// -----------------------------------------------------------------------------
// Client of the Open-Meteo APIs (no key, free for non-commercial use).
//
//   https://marine-api.open-meteo.com/v1/marine   waves, swell, sea surface
//     temperature, ocean current, sea level (with tides); `current` comes from
//     15-minute model data, `hourly` and `daily` up to 7 days;
//   https://api.open-meteo.com/v1/forecast        the wind at 10 m: the marine
//     API has none.
//
// Terms of Open-Meteo (https://open-meteo.com/en/terms): non-commercial use,
// fewer than 10,000 calls a day, 5,000 an hour and 600 a minute per IP, data
// under CC BY 4.0 ("Weather data by Open-Meteo.com"). The integration makes
// two requests per spot and reading (every 15 or 30 minutes), one at a time,
// with a user agent naming the project. `timeformat=unixtime` gives instants
// without any timezone arithmetic; `timezone=auto` makes the days of `daily`
// the local days of the spot; `cell_selection=sea` takes the nearest sea cell
// of the model, so a point typed on the beach still gets waves.
//
// Errors carry a `kind`: `rate_limited` (429), `server` (5xx), `refused` (400:
// Open-Meteo explains why in `reason`), `unreachable` (network, timeout) and
// `invalid` (an answer that is not the expected JSON).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 20000;
const PAUSE_MS = 300;
const FORECAST_DAYS = 7;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const USER_AGENT = `gladys-open-meteo-marine/${VERSION} (+https://github.com/William-De71/gladys-open-meteo-marine)`;

// The variables asked for. `wave_peak_period` answers null everywhere: left out.
const MARINE_CURRENT = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
  'sea_level_height_msl',
];
const MARINE_HOURLY = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
];
const MARINE_DAILY = [
  'wave_height_max',
  'wave_direction_dominant',
  'wave_period_max',
  'swell_wave_height_max',
  'swell_wave_period_max',
];
const WIND_CURRENT = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
const WIND_HOURLY = ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m'];
const WIND_DAILY = ['wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant'];

class OpenMeteoError extends Error {
  /**
   * @param {string} kind - `rate_limited`, `server`, `refused`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status, retryAfter }` (retryAfter in seconds).
   */
  constructor(kind, message, { status = null, retryAfter = null } = {}) {
    super(message);
    this.name = 'OpenMeteoError';
    this.kind = kind;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * @description The query of a spot, coordinates at four decimals (about 10 m).
 * @param {object} spot - `{ latitude, longitude }`.
 * @returns {object} The common parameters.
 */
const where = ({ latitude, longitude }) => ({
  latitude: latitude.toFixed(4),
  longitude: longitude.toFixed(4),
  timezone: 'auto',
  timeformat: 'unixtime',
  forecast_days: String(FORECAST_DAYS),
});

/**
 * @description The URL of the marine request of a spot.
 * @param {object} spot - `{ latitude, longitude }`.
 * @returns {string} The URL.
 */
function marineUrl(spot) {
  const query = new URLSearchParams({
    ...where(spot),
    current: MARINE_CURRENT.join(','),
    hourly: MARINE_HOURLY.join(','),
    daily: MARINE_DAILY.join(','),
    cell_selection: 'sea',
  });
  return `${MARINE_URL}?${query}`;
}

/**
 * @description The URL of the wind request of a spot.
 * @param {object} spot - `{ latitude, longitude }`.
 * @returns {string} The URL.
 */
function windUrl(spot) {
  const query = new URLSearchParams({
    ...where(spot),
    current: WIND_CURRENT.join(','),
    hourly: WIND_HOURLY.join(','),
    daily: WIND_DAILY.join(','),
  });
  return `${FORECAST_URL}?${query}`;
}

/**
 * @description The seconds of a Retry-After header.
 * @param {string|null} value - The header.
 * @returns {number|null} Seconds, null when absent or unreadable.
 */
function retryAfterOf(value) {
  const seconds = Number(value);
  return value !== null && value !== '' && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : null;
}

/**
 * @description A client of Open-Meteo.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {Function} [options.sleep] - `(ms) => Promise` between two requests (tests).
 * @returns {object} `{ marine, wind, requests }`.
 */
function createOpenMeteoClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  // Requests made, for the diagnostic.
  const requests = { total: 0, failed: 0, last: null, today: { date: null, count: 0 } };
  let queue = Promise.resolve();

  /**
   * @description One request.
   * @param {string} url - The URL.
   * @returns {Promise<object>} The JSON answer.
   */
  async function request(url) {
    if (requests.last !== null && now() - requests.last < PAUSE_MS) {
      await sleep(PAUSE_MS - (now() - requests.last));
    }
    requests.total += 1;
    requests.last = now();
    const date = new Date(now()).toISOString().slice(0, 10);
    requests.today =
      requests.today.date === date ? { date, count: requests.today.count + 1 } : { date, count: 1 };
    let response;
    try {
      response = await fetchFn(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      requests.failed += 1;
      throw new OpenMeteoError('unreachable', err.cause?.code ?? err.message);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      requests.failed += 1;
      const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : '';
      const extra = {
        status: response.status,
        retryAfter: retryAfterOf(response.headers.get('retry-after')),
      };
      if (response.status === 429) {
        throw new OpenMeteoError('rate_limited', reason || 'HTTP 429', extra);
      }
      if (response.status >= 500) {
        throw new OpenMeteoError('server', `HTTP ${response.status}`, extra);
      }
      throw new OpenMeteoError('refused', reason || `HTTP ${response.status}`, extra);
    }
    if (!body || typeof body !== 'object' || body.error === true) {
      requests.failed += 1;
      throw new OpenMeteoError('invalid', body?.reason ?? 'not a JSON object');
    }
    return body;
  }

  /**
   * @description Run one request after the others.
   * @param {string} url - The URL.
   * @returns {Promise<object>} The JSON answer.
   */
  function enqueue(url) {
    const run = queue.then(() => request(url));
    queue = run.catch(() => {});
    return run;
  }

  return {
    marine: (spot) => enqueue(marineUrl(spot)),
    wind: (spot) => enqueue(windUrl(spot)),
    requests,
  };
}

export {
  MARINE_URL,
  FORECAST_URL,
  FORECAST_DAYS,
  USER_AGENT,
  PAUSE_MS,
  OpenMeteoError,
  marineUrl,
  windUrl,
  retryAfterOf,
  createOpenMeteoClient,
};
