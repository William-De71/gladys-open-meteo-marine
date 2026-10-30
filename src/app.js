// -----------------------------------------------------------------------------
// The Open-Meteo Marine integration: every handler, registered on a Gladys
// client.
//
// Brings the marine weather of Open-Meteo (wave, ocean and wind models of
// the national weather services) into Gladys for up to five spots:
//   - devices (device.js): one per spot: waves, swell, wind sea, water
//     temperature, current, sea level, wind, Beaufort force, sea state;
//   - scene triggers (events.js): sea state changed, Beaufort force changed,
//     strong wind forecast;
//   - scene action: the marine forecast of a spot now or in a few hours;
//   - dashboard widgets (widgets.js): conditions now, 48/72-hour chart,
//     seven-day list.
//
// Open-Meteo is read on the integration's own timer (every 15 or 30 minutes,
// two requests per spot), never on a Gladys poll; the forecasts are kept in
// /data so a restart costs no request. Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
} from './config.js';
import { createOpenMeteoClient } from './open-meteo.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { parseForecast, conditionsAt, isUsable } from './marine.js';
import { buildDevice, buildStates, idsOf, spotKeyOfDevice } from './device.js';
import { detectEvents, actionOutputs } from './events.js';
import {
  WIDGETS,
  messageContent,
  buildConditionsWidget,
  buildForecastWidget,
  buildDailyWidget,
  readWidgetSettings,
} from './widgets.js';
import { defaultTimeZone, jitterOf, MINUTE_MS, HOUR_MS } from './time.js';
import { t, all, LANGUAGES, shortTime, formatNumber, douglasLabel } from './i18n.js';

const ACTIONS = { REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_MARINE_FORECAST: 'get_marine_forecast' };
// After a failed reading: new tries, then the usual pace.
const RETRY_DELAYS_MIN = [5, 10, 20, 40];
// Open-Meteo said "too many requests": never sooner than this.
const RATE_LIMIT_DELAY_MIN = 60;
// A manual refresh never reads again within this delay.
const REFRESH_MIN_INTERVAL_MS = 5 * MINUTE_MS;
// The scene action looks at most this far ahead (the forecast covers 7 days).
const MAX_ACTION_HOURS = 168;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport to Open-Meteo (tests).
 * @param {Function} [options.sleep] - Pause between two requests (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of the times shown (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    sleep,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = null;
  let createdDevices = new Set();
  // The problems of the last reading, per spot: `{ key, name, kind, detail }`.
  let spotErrors = [];
  let lastStatus = null;
  let lastDiscovery = null;
  let lastError = null;
  let failures = 0;
  let retryAt = null;
  let timer = null;
  let running = null;
  let stopped = false;

  const client = createOpenMeteoClient({
    now,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(sleep ? { sleep } : {}),
  });
  const store = createStore({ path: storePath, logger });

  const intervalMs = () => config.interval * MINUTE_MS;
  const jitter = () => jitterOf(config.spots.map((spot) => spot.key).join('|'));
  const isLand = (key) => store.data.failures[key]?.kind === 'land';
  const forecastOf = (key) => {
    const forecast = store.data.forecasts[key];
    return isUsable(forecast, now()) ? forecast : null;
  };
  const conditionsOf = (key) => conditionsAt(forecastOf(key), now());

  /**
   * @description The configured spots, with their device id.
   * @returns {object[]} `{ slot, key, name, latitude, longitude, deviceId }`.
   */
  const spots = () =>
    config.spots.map((spot) => ({ ...spot, deviceId: idsOf(gladys, spot.key).device }));

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () =>
    config.language === AUTO_LANGUAGE ? (language ?? DEFAULT_TEXT_LANGUAGE) : config.language;

  const textOptions = () => ({ language: textLanguage(), windUnit: config.windUnit, timeZone });

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  // --- Devices and states ------------------------------------------------------------

  /**
   * @description Offer the spot devices on the Discovery screen, when they
   * changed. A spot without marine data (inland) is not offered.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} The count.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = spots()
      .filter((spot) => !isLand(spot.key))
      .map((spot) => buildDevice(gladys, spot, { language: lang }));
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const states = spots()
      .filter((spot) => createdDevices.has(spot.deviceId))
      .flatMap((spot) => buildStates(gladys, spot.key, conditionsOf(spot.key)));
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  /**
   * @description Ask every open widget to pull its content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description When the next reading is due.
   * @returns {number} The instant, in ms.
   */
  const nextReading = () =>
    store.data.fetchedAt ? store.data.fetchedAt + intervalMs() + jitter() : now();

  /**
   * @description The spots and their sea now, for a message.
   * @param {string} l - The language.
   * @returns {string} "Quiberon slight 1.2 m F4, Marseille smooth 0.1 m F2".
   */
  const spotsText = (l) =>
    spots()
      .map((spot) => {
        const c = conditionsOf(spot.key);
        if (!c) {
          return null;
        }
        return `${spot.name} ${douglasLabel(c.douglas, l).toLowerCase()} ${formatNumber(c.waveHeight, l)} m ${t('forceShort', l, { force: c.beaufort ?? '?' })}`;
      })
      .filter(Boolean)
      .join(', ') || '-';

  /**
   * @description The problems of the spots (configuration and last reading), for a message.
   * @param {string} l - The language.
   * @returns {string[]} One sentence per spot.
   */
  const problemsText = (l) =>
    [
      ...config.problems.map((problem) => ({
        name: problem.name,
        detail: () => t(`problem_${problem.kind}`, l),
      })),
      ...spots()
        .filter((spot) => isLand(spot.key))
        .map((spot) => ({ name: spot.name, detail: () => t('problem_land', l) })),
      ...spotErrors.map((error) => ({
        name: error.name,
        detail: () => t('problem_error', l, { detail: error.detail }),
      })),
    ].map((problem) => t('statusSpotProblem', l, { spot: problem.name, detail: problem.detail() }));

  /**
   * @description The status message after a reading.
   * @returns {object} The multi-language message.
   */
  function connectedMessage() {
    const next = Math.min(nextReading(), retryAt ?? Infinity);
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [
          t('statusConnected', l, { spots: spotsText(l), next: shortTime(next, l, timeZone) }),
          ...problemsText(l),
        ].join(' '),
      ]),
    );
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - The error.
   * @param {number} minutes - Minutes before the next try.
   * @returns {object} The message.
   */
  function errorMessage(err, minutes) {
    switch (err.kind) {
      case 'rate_limited':
        return all('statusRateLimited', { minutes });
      case 'server':
        return all('statusServer', { status: err.status ?? '?', minutes });
      case 'refused':
        return all('statusRefused', { detail: String(err.message).slice(0, 100), minutes });
      case 'invalid':
        return all('statusInvalid', { minutes });
      default:
        return all('statusUnreachable', { detail: String(err.message).slice(0, 80), minutes });
    }
  }

  /**
   * @description The delay before the next try after a failed reading.
   * @param {Error} err - The error.
   * @returns {number} The delay, in ms.
   */
  function retryDelay(err) {
    const backoff = RETRY_DELAYS_MIN[Math.min(failures, RETRY_DELAYS_MIN.length) - 1] * MINUTE_MS;
    if (err.kind === 'rate_limited') {
      return Math.max(backoff, RATE_LIMIT_DELAY_MIN * MINUTE_MS, (err.retryAfter ?? 0) * 1000);
    }
    return backoff;
  }

  /**
   * @description Read one spot: the marine request, then the wind request.
   * @param {object} spot - The spot.
   * @returns {Promise<void>}
   */
  async function readSpot(spot) {
    const marine = await client.marine(spot);
    const wind = await client.wind(spot);
    store.data.forecasts[spot.key] = parseForecast(marine, wind, now());
    delete store.data.failures[spot.key];
  }

  /**
   * @description Read Open-Meteo for every spot, publish everything.
   * @returns {Promise<boolean>} True when at least one spot was read.
   */
  async function round() {
    const list = spots();
    if (list.length === 0) {
      spotErrors = [];
      await reportStatus(
        false,
        Object.fromEntries(
          LANGUAGES.map((l) => [l, [t('noSpots', l), ...problemsText(l)].join(' ')]),
        ),
      );
      return false;
    }
    const errors = [];
    let failure = null;
    let read = 0;
    for (const spot of list.filter((candidate) => !isLand(candidate.key))) {
      if (failure?.kind === 'rate_limited') {
        // Open-Meteo asked to slow down: no more requests in this round.
        errors.push({ key: spot.key, name: spot.name, kind: failure.kind, detail: 'HTTP 429' });
        continue;
      }
      try {
        await readSpot(spot);
        read += 1;
      } catch (err) {
        if (err.kind === 'land') {
          store.data.failures[spot.key] = { kind: 'land', at: now() };
          delete store.data.forecasts[spot.key];
          logger.warn(`Spot ${spot.key}: no marine data at this point`);
          continue;
        }
        logger.warn(`Spot ${spot.key}: ${err.kind ?? 'error'} ${err.message}`);
        failure = failure ?? err;
        errors.push({
          key: spot.key,
          name: spot.name,
          kind: err.kind ?? 'error',
          detail: String(err.message).slice(0, 80),
        });
      }
    }
    spotErrors = errors;
    store.data.seen = Object.fromEntries(
      Object.entries(store.data.seen).filter(([key]) => list.some((spot) => spot.key === key)),
    );

    if (read === 0 && failure) {
      failures += 1;
      lastError = { at: now(), kind: failure.kind ?? 'error', message: failure.message };
      const delay = retryDelay(failure);
      retryAt = now() + delay;
      await store.save();
      logger.warn(`Open-Meteo reading failed (${failure.kind ?? 'error'}): ${failure.message}`);
      await publishDiscoveredDevices().catch(() => {});
      // The forecast kept still gives the conditions of the hour.
      await publishQuietly();
      await reportStatus(false, errorMessage(failure, Math.round(delay / MINUTE_MS)));
      return false;
    }

    failures = 0;
    retryAt = null;
    lastError = failure
      ? { at: now(), kind: failure.kind ?? 'error', message: failure.message }
      : null;
    store.data.fetchedAt = now();
    const { events, seen } = detectEvents({
      spots: list.filter((spot) => !isLand(spot.key)),
      conditionsOf,
      forecastOf,
      seen: store.data.seen,
      now: now(),
      options: textOptions(),
    });
    store.data.seen = seen;
    await store.save();
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Unable to fire ${event.key}: ${err.message}`);
      }
    }
    logger.info(
      `Open-Meteo read for ${read} spot(s): ${events.length} scene event(s), ${errors.length} spot problem(s), ${client.requests.today.count} request(s) today`,
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await publishQuietly();
    refreshWidgets();
    if (read === 0) {
      // Every spot is inland.
      await reportStatus(
        false,
        Object.fromEntries(
          LANGUAGES.map((l) => [l, [t('statusNoSea', l), ...problemsText(l)].join(' ')]),
        ),
      );
      return false;
    }
    await reportStatus(true, connectedMessage());
    return true;
  }

  /**
   * @description Run one reading at a time.
   * @returns {Promise<boolean>} The result of round().
   */
  function read() {
    if (!running) {
      running = round().finally(() => {
        running = null;
      });
    }
    return running;
  }

  /**
   * @description Whether the data kept in /data are still fresh for these spots.
   * @returns {boolean} True when read less than an interval ago, every spot known.
   */
  function cacheIsFresh() {
    if (!store.data.fetchedAt || now() >= nextReading()) {
      return false;
    }
    return (
      config.spots.length > 0 &&
      config.spots.every(({ key }) => isLand(key) || forecastOf(key) !== null)
    );
  }

  // --- Timer -------------------------------------------------------------------------

  /**
   * @description Arm the timer for the next reading or retry.
   */
  function schedule() {
    if (!timers || stopped) {
      return;
    }
    clearTimeout(timer);
    const at = Math.min(nextReading(), retryAt ?? Infinity);
    timer = setTimeout(tick, Math.max(1000, at - now()));
    timer.unref?.();
  }

  /**
   * @description What the timer does when it fires.
   * @returns {Promise<void>}
   */
  async function tick() {
    try {
      if (config.spots.length > 0) {
        await read();
      }
    } catch (err) {
      logger.error('Timer', err);
    }
    schedule();
  }

  /**
   * @description Offer the devices, read when needed.
   * @param {object} [options] - `{ force }`: read even with fresh data.
   * @returns {Promise<void>}
   */
  async function refreshAll({ force = false } = {}) {
    if (!force && cacheIsFresh()) {
      spotErrors = [];
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to offer the devices: ${err.message}`),
      );
      await publishQuietly();
      refreshWidgets();
      const anySea = config.spots.some(({ key }) => !isLand(key));
      await reportStatus(
        anySea,
        anySea
          ? connectedMessage()
          : Object.fromEntries(
              LANGUAGES.map((l) => [l, [t('statusNoSea', l), ...problemsText(l)].join(' ')]),
            ),
      );
    } else {
      await read();
    }
    schedule();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The spot of a widget instance or a scene action.
   * @param {unknown} deviceId - The device external id chosen (or nothing).
   * @returns {object|null} The spot, the first one when none was chosen.
   */
  function spotOf(deviceId) {
    const key = spotKeyOfDevice(deviceId);
    const list = spots();
    if (key) {
      return list.find((spot) => spot.key === key) ?? null;
    }
    return list.find((spot) => !isLand(spot.key)) ?? list[0] ?? null;
  }

  /**
   * @description Common checks of a widget request.
   * @param {object|null} spot - The spot.
   * @param {string} lang - The language.
   * @returns {object|null} A message content, null when the widget can be built.
   */
  function widgetProblem(spot, lang) {
    if (!spot) {
      return messageContent(t('widgetNoSpot', lang), 60);
    }
    if (isLand(spot.key)) {
      return messageContent(`${spot.name}: ${t('problem_land', lang)}`, 300);
    }
    if (!forecastOf(spot.key) || !conditionsOf(spot.key)) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return null;
  }

  gladys.onWidgetGet(WIDGETS.CONDITIONS, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const spot = spotOf(readWidgetSettings(settings).spot);
    return (
      widgetProblem(spot, lang) ??
      buildConditionsWidget({
        spot,
        conditions: conditionsOf(spot.key),
        updatedAt: forecastOf(spot.key).fetchedAt,
        language: lang,
        windUnit: config.windUnit,
        timeZone,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const chosen = readWidgetSettings(settings);
    const spot = spotOf(chosen.spot);
    return (
      widgetProblem(spot, lang) ??
      buildForecastWidget({
        spot,
        forecast: forecastOf(spot.key),
        now: now(),
        variable: chosen.variable,
        hours: chosen.hours,
        language: lang,
        windUnit: config.windUnit,
        timeZone,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.DAILY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const spot = spotOf(readWidgetSettings(settings).spot);
    return (
      widgetProblem(spot, lang) ??
      buildDailyWidget({
        spot,
        forecast: forecastOf(spot.key),
        now: now(),
        language: lang,
        windUnit: config.windUnit,
        timeZone,
      })
    );
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, async (fields = {}) => {
    const spot = spotOf(fields.spot);
    if (!spot) {
      throw new Error(`Unknown spot: ${fields.spot ?? '(none)'}`);
    }
    if (isLand(spot.key)) {
      throw new Error(`No marine data for ${spot.name}: place the point at sea`);
    }
    const raw =
      fields.hours === undefined || fields.hours === null || fields.hours === ''
        ? 0
        : Number(fields.hours);
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_ACTION_HOURS) {
      throw new Error(`Hours ahead must be between 0 and ${MAX_ACTION_HOURS}`);
    }
    const at = now() + Math.round(raw) * HOUR_MS;
    const conditions = conditionsAt(forecastOf(spot.key), at);
    if (!conditions) {
      throw new Error(`No forecast of ${spot.name} for that time yet`);
    }
    return actionOutputs({ spot, conditions, at, now: now() }, textOptions());
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (config.spots.length === 0) {
      return all('noSpots');
    }
    const fetchedAt = store.data.fetchedAt;
    if (fetchedAt && now() - fetchedAt < REFRESH_MIN_INTERVAL_MS && !lastError && cacheIsFresh()) {
      return all('refreshTooSoon', {
        minutes: Math.max(1, Math.round((now() - fetchedAt) / MINUTE_MS)),
      });
    }
    // A spot found inland is asked again: the user may have moved it.
    store.data.failures = {};
    const ok = await read();
    schedule();
    if (!ok) {
      return lastStatus ? JSON.parse(lastStatus)[1] : all('noSpots');
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [t('refreshDone', l, { spots: spotsText(l) }), ...problemsText(l)].join(' ').slice(0, 200),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      interval: config.interval,
      windUnit: config.windUnit,
      language: textLanguage(),
      spots: spots().map(({ key, name, slot, deviceId }) => {
        const forecast = store.data.forecasts[key];
        return {
          key,
          name,
          slot,
          created: createdDevices.has(deviceId),
          failure: store.data.failures[key] ?? null,
          grid: forecast ? [forecast.gridLatitude, forecast.gridLongitude] : null,
          timezone: forecast?.timezone ?? null,
          fetchedAt: forecast?.fetchedAt ? new Date(forecast.fetchedAt).toISOString() : null,
          hours: forecast?.hourly?.length ?? 0,
          conditions: conditionsOf(key),
        };
      }),
      problems: config.problems,
      spotErrors,
      fetchedAt: store.data.fetchedAt ? new Date(store.data.fetchedAt).toISOString() : null,
      nextReading: new Date(nextReading()).toISOString(),
      retryAt: retryAt ? new Date(retryAt).toISOString() : null,
      lastError,
      requests: client.requests,
      seen: store.data.seen,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Marine diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} spot(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const signature = () => JSON.stringify(config.spots.map((spot) => spot.key));
    const before = signature();
    await loadConfig(rawConfig);
    const after = signature();
    lastDiscovery = null;
    failures = 0;
    retryAt = null;
    logger.info('Configuration updated');
    // New spots: read now; a name, unit or language change only rewrites the texts.
    const unknown = config.spots.some(
      ({ key }) => !store.data.forecasts[key] && !store.data.failures[key],
    );
    await refreshAll({ force: before !== after && unknown });
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await refreshAll();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearTimeout(timer);
  });

  return {
    store,
    client,
    read,
    tick,
    refreshAll,
    getConfig: () => config,
    getSpots: spots,
    getRetryAt: () => retryAt,
    whenReady: () => startup,
  };
}

export {
  createApp,
  ACTIONS,
  SCENE_ACTIONS,
  RETRY_DELAYS_MIN,
  RATE_LIMIT_DELAY_MIN,
  REFRESH_MIN_INTERVAL_MS,
  MAX_ACTION_HOURS,
};
